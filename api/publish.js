// api/publish.js
// Publishes a blog article directly to the correct Shopify store
// All tokens are stored in Vercel environment variables — never in this file
//
// Environment variables required in Vercel:
//   SHOPIFY_100AMPERE_DOMAIN   = 100ampere.myshopify.com
//   SHOPIFY_100AMPERE_TOKEN    = shpat_xxxx   (from 100ampere Custom App)
//   SHOPIFY_100AMPERE_BLOG_ID  = (blog id number)
//
//   SHOPIFY_CTRL8_DOMAIN       = ctrl8.myshopify.com
//   SHOPIFY_CTRL8_TOKEN        = shpat_xxxx   (from ctrl8 Custom App)
//   SHOPIFY_CTRL8_BLOG_ID      = 120374526231
//
//   SHOPIFY_BLACKKEY_DOMAIN    = blackkey.myshopify.com
//   SHOPIFY_BLACKKEY_TOKEN     = shpat_xxxx   (from blackkey Custom App)
//   SHOPIFY_BLACKKEY_BLOG_ID   = (blog id number)

const STORE_CONFIG = {
  '100ampere': {
    domain:  () => process.env.SHOPIFY_100AMPERE_DOMAIN,
    token:   () => process.env.SHOPIFY_100AMPERE_TOKEN,
    blog_id: () => process.env.SHOPIFY_100AMPERE_BLOG_ID,
  },
  ctrl8: {
    domain:  () => process.env.SHOPIFY_CTRL8_DOMAIN,
    token:   () => process.env.SHOPIFY_CTRL8_TOKEN,
    blog_id: () => process.env.SHOPIFY_CTRL8_BLOG_ID,
  },
  blackkey: {
    domain:  () => process.env.SHOPIFY_BLACKKEY_DOMAIN,
    token:   () => process.env.SHOPIFY_BLACKKEY_TOKEN,
    blog_id: () => process.env.SHOPIFY_BLACKKEY_BLOG_ID,
  },
};

// Converts plain Markdown to basic HTML suitable for Shopify
function markdownToHtml(md) {
  if (!md) return '';
  return md
    // H1
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Markdown links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Paragraphs — double newlines become <p> breaks
    .replace(/\n\n(.+)/g, '<p>$1</p>')
    // Clean up
    .replace(/<p><(h[123]|ul|hr)/g, '<$1')
    .replace(/<\/(h[123]|ul|hr)><\/p>/g, '</$1>')
    .trim();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.blogdashboard.tech');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    brand,          // '100ampere' | 'ctrl8' | 'blackkey'
    title,          // SEO meta title string
    bodyMarkdown,   // Full blog body in markdown
    metaDescription,
    tags,           // Array of strings
    author,
    status,         // 'draft' | 'published'
    urlSlug,        // e.g. best-earbuds-under-500-india-2025
    featuredImageUrl, // optional
  } = req.body;

  // Validate brand
  const store = STORE_CONFIG[brand];
  if (!store) {
    return res.status(400).json({ error: `Unknown brand: ${brand}. Must be 100ampere, ctrl8, or blackkey.` });
  }

  const domain  = store.domain();
  const token   = store.token();
  const blog_id = store.blog_id();

  // Check env vars are set
  if (!domain || !token || !blog_id) {
    return res.status(500).json({
      error: `Shopify environment variables not configured for brand "${brand}". Please set SHOPIFY_${brand.toUpperCase()}_DOMAIN, SHOPIFY_${brand.toUpperCase()}_TOKEN, and SHOPIFY_${brand.toUpperCase()}_BLOG_ID in Vercel.`,
    });
  }

  if (!title || !bodyMarkdown) {
    return res.status(400).json({ error: 'title and bodyMarkdown are required' });
  }

  // Convert markdown to HTML
  const bodyHtml = markdownToHtml(bodyMarkdown);

  // Build Shopify article payload
  const article = {
    title,
    body_html: bodyHtml,
    author: author || `${brand} Editorial Team`,
    tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
    published: status === 'published',
    metafields: [
      {
        namespace: 'global',
        key: 'description_tag',
        value: metaDescription || '',
        type: 'single_line_text_field',
      },
      {
        namespace: 'seo',
        key: 'url_handle',
        value: urlSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        type: 'single_line_text_field',
      },
    ],
  };

  // Add featured image if provided
  if (featuredImageUrl) {
    article.image = { src: featuredImageUrl };
  }

  const shopifyUrl = `https://${domain}/admin/api/2024-01/blogs/${blog_id}/articles.json`;

  try {
    const shopifyRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ article }),
    });

    const shopifyData = await shopifyRes.json();

    if (!shopifyRes.ok) {
      console.error('Shopify error:', shopifyData);
      return res.status(shopifyRes.status).json({
        error: shopifyData.errors || `Shopify API error ${shopifyRes.status}`,
      });
    }

    const created = shopifyData.article;

    // Build admin URL for direct link back to the post
    const storeHandle = domain.replace('.myshopify.com', '');
    const adminUrl = `https://admin.shopify.com/store/${storeHandle}/content/articles/${created.id}`;
    const publicUrl = created.handle
      ? `https://${brand === '100ampere' ? '100ampere.com' : brand === 'ctrl8' ? 'ctrl8.in' : 'blackkey.in'}/blogs/news/${created.handle}`
      : null;

    return res.status(200).json({
      success: true,
      articleId: created.id,
      title: created.title,
      status: created.published_at ? 'published' : 'draft',
      adminUrl,
      publicUrl,
      handle: created.handle,
      publishedAt: created.published_at,
      createdAt: created.created_at,
    });

  } catch (err) {
    console.error('Publish error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
