// api/generate.js
// Proxies blog generation requests to Anthropic API
// Your ANTHROPIC_API_KEY is stored in Vercel environment variables — never in this file

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allows your blogdashboard.tech frontend to call this
  res.setHeader('Access-Control-Allow-Origin', 'https://www.blogdashboard.tech');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `Anthropic API error: ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n') || '';

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}
