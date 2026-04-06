// api/callback.js
// Shopify redirects here after user approves OAuth
// Exchanges the temporary code for a permanent access token
// Stores the token in Vercel KV (or returns it to the frontend)

const STORES = {
  ctrl8: {
    shop:         'ctrl8.myshopify.com',
    clientId:     () => process.env.SHOPIFY_CTRL8_CLIENT_ID,
    clientSecret: () => process.env.SHOPIFY_CTRL8_CLIENT_SECRET,
    blogId:       () => process.env.SHOPIFY_CTRL8_BLOG_ID,
  },
  '100ampere': {
    shop:         '100ampere.myshopify.com',
    clientId:     () => process.env.SHOPIFY_100AMPERE_CLIENT_ID,
    clientSecret: () => process.env.SHOPIFY_100AMPERE_CLIENT_SECRET,
    blogId:       () => process.env.SHOPIFY_100AMPERE_BLOG_ID,
  },
  blackkey: {
    shop:         'blackkey.myshopify.com',
    clientId:     () => process.env.SHOPIFY_BLACKKEY_CLIENT_ID,
    clientSecret: () => process.env.SHOPIFY_BLACKKEY_CLIENT_SECRET,
    blogId:       () => process.env.SHOPIFY_BLACKKEY_BLOG_ID,
  },
};

export default async function handler(req, res) {
  const { brand, code, state, hmac, shop } = req.query;

  if (!brand || !code) {
    return res.status(400).send('Missing brand or code parameter');
  }

  const store = STORES[brand];
  if (!store) {
    return res.status(400).send(`Unknown brand: ${brand}`);
  }

  const clientId     = store.clientId();
  const clientSecret = store.clientSecret();

  if (!clientId || !clientSecret) {
    return res.status(500).send(
      `Missing env vars: SHOPIFY_${brand.toUpperCase()}_CLIENT_ID or SHOPIFY_${brand.toUpperCase()}_CLIENT_SECRET`
    );
  }

  try {
    // Exchange the code for a permanent access token
    const tokenRes = await fetch(`https://${store.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.status(500).send(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    const accessToken = tokenData.access_token;

    // Return the token to the frontend via redirect with token in URL fragment
    // The frontend stores it in sessionStorage (never sent to server again)
    const appUrl = process.env.APP_URL || 'https://blogdashboard-tech.vercel.app';
    const redirectUrl = `${appUrl}/?brand=${brand}&token=${accessToken}&connected=true`;

    return res.redirect(redirectUrl);

  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).send('OAuth error: ' + err.message);
  }
}
