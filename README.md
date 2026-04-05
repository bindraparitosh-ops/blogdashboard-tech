# blogdashboard.tech — Deployment Guide

## Project Structure
```
blogdashboard-tech/
├── public/
│   └── index.html          ← Full dashboard UI
├── api/
│   ├── generate.js         ← Anthropic blog generation proxy
│   ├── publish.js          ← Shopify publishing endpoint
│   └── blogs.js            ← Fetch existing Shopify posts
├── vercel.json             ← Routing config
└── README.md
```

## Step 1 — Deploy to Vercel

1. Create GitHub account at github.com (if you don't have one)
2. Create new repository named `blogdashboard-tech` (public)
3. Upload all files from this folder (drag and drop on GitHub web UI)
4. Go to vercel.com → Sign up with GitHub
5. Click "Add New Project" → Import `blogdashboard-tech`
6. Click Deploy — takes ~30 seconds

## Step 2 — Add Environment Variables in Vercel

Go to: Vercel Project → Settings → Environment Variables
Add ALL of the following. Set Environment to: Production + Preview + Development

```
ANTHROPIC_API_KEY          = sk-ant-api03-...     (from console.anthropic.com)

SHOPIFY_100AMPERE_DOMAIN   = 100ampere.myshopify.com
SHOPIFY_100AMPERE_TOKEN    = shpat_...            (from 100ampere Custom App)
SHOPIFY_100AMPERE_BLOG_ID  = (get from Shopify admin URL)

SHOPIFY_CTRL8_DOMAIN       = ctrl8.myshopify.com
SHOPIFY_CTRL8_TOKEN        = shpat_...            (from ctrl8 Custom App — rotate first!)
SHOPIFY_CTRL8_BLOG_ID      = 120374526231

SHOPIFY_BLACKKEY_DOMAIN    = blackkey.myshopify.com
SHOPIFY_BLACKKEY_TOKEN     = shpat_...            (from blackkey Custom App)
SHOPIFY_BLACKKEY_BLOG_ID   = (get from Shopify admin URL)
```

After adding variables → click Redeploy in Vercel Deployments tab.

## Step 3 — Connect Domain blogdashboard.tech

In Vercel → Project → Settings → Domains → Add `blogdashboard.tech`

Vercel will give you DNS records. Add to your domain registrar:
```
Type: A      Name: @    Value: 76.76.21.21
Type: CNAME  Name: www  Value: cname.vercel-dns.com
```

## Step 4 — Get shpat_ tokens from each Shopify store

For EACH store (100ampere, ctrl8, blackkey):
1. Shopify Admin → Settings → Apps and sales channels → Develop apps
2. Create app named "blogdashboard" (or open existing)
3. Configure Admin API scopes: enable write_content + read_content
4. Install app → API credentials tab → Reveal token once
5. Copy shpat_... token → paste into Vercel environment variable

## SECURITY RULES
- NEVER paste tokens into chat, email, or any document
- NEVER commit tokens to GitHub (they go in Vercel env vars only)
- Rotate any exposed tokens immediately in Shopify admin
- The ctrl8 token shared in chat must be rotated before use

## API Endpoints
- POST /api/generate  → Calls Anthropic, returns blog text
- POST /api/publish   → Posts article to Shopify store
- GET  /api/blogs     → Fetches recent articles from Shopify store
