// api/auth.js
// Initiates Shopify OAuth flow for a given brand/store
// Redirects user to Shopify login → Shopify calls back to /api/callback

const STORES = {
  ctrl8:      { shop: 'ctrl8.myshopify.com',      clientId: process.env.SHOPIFY_CTRL8_CLIENT_ID },
  '100ampere':{ shop: '100ampere.myshopify.com',  clientId: process.env.SHOPIFY_100AMPERE_CLIENT_ID },
  blackkey:   { shop: 'blackkey.myshopify.com',   clientId: process.env.SHOPIFY_BLACKKEY_CLIENT_ID },
};

// Scopes needed to create blog articles
const SCOPES = 'write_content,read_content';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { brand } = req.query;
  const store = STORES[brand];

  if (!store) {
    return res.status(400).send(`Unknown brand: ${brand}. Must be ctrl8, 100ampere, or blackkey.`);
  }

  if (!store.clientId) {
    return res.status(500).send(`SHOPIFY_${brand.toUpperCase()}_CLIENT_ID not set in Vercel environment variables.`);
  }

  // Build the redirect URI — must match exactly what's registered in Shopify Partner app
  const redirectUri = `${process.env.APP_URL}/api/callback?brand=${brand}`;

  // State for CSRF protection
  const state = Buffer.from(JSON.stringify({ brand, ts: Date.now() })).toString('base64');

  const authUrl = `https://${store.shop}/admin/oauth/authorize?` +
    `client_id=${store.clientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  return res.redirect(authUrl);
}
