// api/blogs.js
// Fetches existing blog articles using OAuth token from frontend

const STORE_CONFIG = {
  ctrl8:       { shop: 'ctrl8.myshopify.com',       blogId: () => process.env.SHOPIFY_CTRL8_BLOG_ID || '120374526231' },
  '100ampere': { shop: '100ampere.myshopify.com',   blogId: () => process.env.SHOPIFY_100AMPERE_BLOG_ID },
  blackkey:    { shop: 'blackkey.myshopify.com',    blogId: () => process.env.SHOPIFY_BLACKKEY_BLOG_ID },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { brand, limit = 20 } = req.query;
  const accessToken = req.headers.authorization?.replace('Bearer ', '');

  if (!brand || !accessToken) {
    return res.status(400).json({ error: 'brand and Authorization header (Bearer token) required' });
  }

  const store = STORE_CONFIG[brand];
  if (!store) return res.status(400).json({ error: `Unknown brand: ${brand}` });

  const blogId = store.blogId();
  if (!blogId) return res.status(500).json({ error: `Blog ID not configured for ${brand}` });

  try {
    const url = `https://${store.shop}/admin/api/2024-01/blogs/${blogId}/articles.json?limit=${limit}&status=any`;
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.errors || 'Fetch error' });

    const storeHandle = store.shop.replace('.myshopify.com', '');
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
