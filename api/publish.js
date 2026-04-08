// api/publish.js
// Publishes blog article to Shopify using OAuth access token

const STORE_CONFIG = {
  ctrl8:       { shop: 'ctrl8.myshopify.com',      blogId: () => process.env.SHOPIFY_CTRL8_BLOG_ID || '120374526231' },
  '100ampere': { shop: '100ampere.myshopify.com',  blogId: () => process.env.SHOPIFY_100AMPERE_BLOG_ID },
  blackkey:    { shop: 'blackkey.myshopify.com',   blogId: () => process.env.SHOPIFY_BLACKKEY_BLOG_ID },
};

// Extract only the clean blog body from the full generated output
// Strips out sections 1-4 (slug, meta title, meta desc, keywords) and sections 6-12 (after blog body)
function extractBlogBody(fullText) {
  // Try to find the FULL BLOG POST section
  const blogStartPatterns = [
    /##\s*5\.\s*FULL BLOG POST[^\n]*\n+([\s\S]+?)(?=##\s*6\.|##\s*COMPARISON TABLE|##\s*INFOGRAPHIC|##\s*VIDEO|##\s*FAQ SECTION|##\s*AUTHOR BIO|##\s*SHOPIFY TAGS|##\s*JSON-LD|$)/i,
    /5\.\s*FULL BLOG POST[^\n]*\n+([\s\S]+?)(?=6\.|COMPARISON TABLE|INFOGRAPHIC|VIDEO CONTENT|FAQ SECTION|AUTHOR BIO|SHOPIFY TAGS|JSON-LD|$)/i,
    /FULL BLOG POST[^\n]*\n+([\s\S]+?)(?=##\s*\d+\.|COMPARISON TABLE|INFOGRAPHIC|VIDEO|FAQ SECTION|AUTHOR BIO|SHOPIFY TAGS|JSON-LD SCHEMA|$)/i,
  ];

  for (const pattern of blogStartPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1] && match[1].trim().length > 200) {
      return match[1].trim();
    }
  }

  // Fallback: find the first H1 heading and take from there
  const h1Match = fullText.match(/(^#\s+.+$[\s\S]+)/m);
  if (h1Match) {
    // Stop before any section markers
    const body = h1Match[0].split(/\n##\s*\d+\.\s*(COMPARISON|INFOGRAPHIC|VIDEO|FAQ SECTION|AUTHOR BIO|SHOPIFY TAGS|JSON-LD)/i)[0];
    if (body.trim().length > 200) return body.trim();
  }

  // Last resort: return cleaned full text
  return fullText
    .replace(/##\s*\d+\.\s*(SUGGESTED URL SLUG|SEO META TITLE|META TITLE|META DESCRIPTION|PRIMARY KEYWORD)[^\n]*\n+[^\n]+\n*/gi, '')
    .replace(/```[^`]*```/g, '')
    .trim();
}

// Convert Markdown to clean HTML for Shopify
function markdownToHtml(md) {
  if (!md) return '';

  let html = md
    // Remove triple backtick code blocks
    .replace(/```[\s\S]*?```/g, '')
    // H1, H2, H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Markdown links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Image markers — remove them (images added separately)
    .replace(/\[IMAGE \d+:[^\]]*\]/gi, '')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Numbered lists — collect consecutive items
    .replace(/^(\d+\.\s+.+)$/gm, '<li>$1</li>')
    // Bullet lists
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> items in <ol> or <ul>
  html = html.replace(/(<li>\d+\..+<\/li>\n?)+/g, match => `<ol>${match}</ol>`);
  html = html.replace(/(<li>[^<\d].+<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

  // Clean up numbered prefix inside <li> tags
  html = html.replace(/<li>\d+\.\s*/g, '<li>');

  // Wrap plain text paragraphs (lines not starting with HTML tags)
  const lines = html.split('\n');
  const result = [];
  let inBlock = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      inBlock = false;
      result.push('');
      continue;
    }
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') ||
        trimmed.startsWith('<li') || trimmed.startsWith('<hr') || trimmed.startsWith('<p') ||
        trimmed.startsWith('<strong') || trimmed.startsWith('<table') || trimmed.startsWith('<tr') ||
        trimmed.startsWith('<td') || trimmed.startsWith('<th') || trimmed.startsWith('</')) {
      result.push(trimmed);
      inBlock = false;
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    brand, accessToken, title, bodyMarkdown,
    metaDescription, urlSlug, author, tags, status, featuredImageUrl,
  } = req.body;

  if (!brand || !accessToken) {
    return res.status(400).json({ error: 'brand and accessToken are required. Please connect your Shopify store first.' });
  }

  const store = STORE_CONFIG[brand];
  if (!store) return res.status(400).json({ error: `Unknown brand: ${brand}` });

  const blogId = store.blogId();
  if (!blogId) return res.status(500).json({ error: `SHOPIFY_${brand.toUpperCase()}_BLOG_ID not configured` });

  if (!title || !bodyMarkdown) return res.status(400).json({ error: 'title and bodyMarkdown are required' });

  // Extract clean blog body then convert to HTML
  const cleanBody = extractBlogBody(bodyMarkdown);
  const bodyHtml = markdownToHtml(cleanBody);

  const article = {
    title,
    body_html: bodyHtml,
    author: author || `${brand} Editorial Team`,
    tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
    published: status === 'published',
    metafields: [
      { namespace: 'global', key: 'description_tag', value: metaDescription || '', type: 'single_line_text_field' },
    ],
  };

  if (featuredImageUrl) article.image = { src: featuredImageUrl };

  const shopifyUrl = `https://${store.shop}/admin/api/2024-01/blogs/${blogId}/articles.json`;

  try {
    const shopifyRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ article }),
    });

    const shopifyData = await shopifyRes.json();
    if (!shopifyRes.ok) {
      return res.status(shopifyRes.status).json({ error: shopifyData.errors || `Shopify error ${shopifyRes.status}` });
    }

    const created = shopifyData.article;
    const storeHandle = store.shop.replace('.myshopify.com', '');
    const adminUrl = `https://admin.shopify.com/store/${storeHandle}/content/articles/${created.id}`;
    const publicDomain = brand === '100ampere' ? '100ampere.com' : brand === 'ctrl8' ? 'ctrl8.in' : 'blackkey.in';
    const publicUrl = created.handle ? `https://${publicDomain}/blogs/news/${created.handle}` : null;

    return res.status(200).json({
      success: true, articleId: created.id, title: created.title,
      status: created.published_at ? 'published' : 'draft',
      adminUrl, publicUrl, handle: created.handle,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
