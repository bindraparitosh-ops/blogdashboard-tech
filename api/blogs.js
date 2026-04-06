// api/blogs.js
// Fetches existing blog articles from a Shopify store
// Used by the dashboard to show recently published posts

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.blogdashboard.tech');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { brand, limit = 10 } = req.query;

  const store = STORE_CONFIG[brand];
  if (!store) {
    return res.status(400).json({ error: `Unknown brand: ${brand}` });
  }

  const domain  = store.domain();
  const token   = store.token();
  const blog_id = store.blog_id();

  if (!domain || !token || !blog_id) {
    return res.status(500).json({ error: `Environment variables not configured for ${brand}` });
  }

  try {
    const url = `https://${domain}/admin/api/2024-01/blogs/${blog_id}/articles.json?limit=${limit}&status=any`;
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.errors || 'Shopify fetch error' });
    }

    const storeHandle = domain.replace('.myshopify.com', '');
    const articles = (data.articles || []).map(a => ({
      id: a.id,
      title: a.title,
      handle: a.handle,
      author: a.author,
      tags: a.tags,
      status: a.published_at ? 'published' : 'draft',
      publishedAt: a.published_at,
      createdAt: a.created_at,
      adminUrl: `https://admin.shopify.com/store/${storeHandle}/content/articles/${a.id}`,
    }));

    return res.status(200).json({ articles });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
