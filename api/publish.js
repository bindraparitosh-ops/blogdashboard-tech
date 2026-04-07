// api/publish.js
// Publishes blog article to Shopify using OAuth access token
// Token is passed from frontend (stored in sessionStorage after OAuth)

const STORE_CONFIG = {
  ctrl8: {
    shop:   'ctrl8.myshopify.com',
    blogId: () => process.env.SHOPIFY_CTRL8_BLOG_ID || '120374526231',
  },
  '100ampere': {
    shop:   '100ampere.myshopify.com',
    blogId: () => process.env.SHOPIFY_100AMPERE_BLOG_ID,
  },
  blackkey: {
    shop:   'blackkey.myshopify.com',
    blogId: () => process.env.SHOPIFY_BLACKKEY_BLOG_ID,
  },
};

// Convert Markdown to basic HTML for Shopify
function markdownToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm,  '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)\n(?!<li>)/g, '$1</ul>\n')
    .replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1')
    .replace(/^---+$/gm, '<hr>')
    .replace(/\n\n([^<])/g, '\n\n<p>$1')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    brand,
    accessToken,    // OAuth token from frontend sessionStorage
    title,
    bodyMarkdown,
    metaDescription,
    urlSlug,
    author,
    tags,
    status,
    featuredImageUrl,
  } = req.body;

  if (!brand || !accessToken) {
    return res.status(400).json({ error: 'brand and accessToken are required. Please connect your Shopify store first.' });
  }

  const store = STORE_CONFIG[brand];
  if (!store) {
    return res.status(400).json({ error: `Unknown brand: ${brand}` });
  }

  const blogId = store.blogId();
  if (!blogId) {
    return res.status(500).json({ error: `SHOPIFY_${brand.toUpperCase()}_BLOG_ID not configured` });
  }

  if (!title || !bodyMarkdown) {
    return res.status(400).json({ error: 'title and bodyMarkdown are required' });
  }

  const bodyHtml = markdownToHtml(bodyMarkdown);

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
    ],
  };

  if (featuredImageUrl) {
    article.image = { src: featuredImageUrl };
  }

  const shopifyUrl = `https://${store.shop}/admin/api/2024-01/blogs/${blogId}/articles.json`;

  try {
    const shopifyRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ article }),
    });

    const shopifyData = await shopifyRes.json();

    if (!shopifyRes.ok) {
      return res.status(shopifyRes.status).json({
        error: shopifyData.errors || `Shopify error ${shopifyRes.status}`,
      });
    }

    const created = shopifyData.article;
    const storeHandle = store.shop.replace('.myshopify.com', '');
    const adminUrl = `https://admin.shopify.com/store/${storeHandle}/content/articles/${created.id}`;
    const publicDomain = brand === '100ampere' ? '100ampere.com' : brand === 'ctrl8' ? 'ctrl8.in' : 'blackkey.in';
    const publicUrl = created.handle ? `https://${publicDomain}/blogs/news/${created.handle}` : null;

    return res.status(200).json({
      success: true,
      articleId: created.id,
      title: created.title,
      status: created.published_at ? 'published' : 'draft',
      adminUrl,
      publicUrl,
      handle: created.handle,
    });

  } catch (err) {
    console.error('Publish error:', err);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
