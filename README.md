# webcheck

Terminal-style website diagnostic tool. Enter a URL, get a full report.

## Features

| Module | What it checks |
|---|---|
| **SEO** | title length, description, canonical, lang, robots, h1/h2 tags |
| **Open Graph / Twitter Card** | all OG tags + live preview card, Twitter card meta |
| **Security Headers** | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP |
| **PageSpeed** | Performance, Accessibility, Best Practices, SEO scores + Core Web Vitals (FCP, LCP, TBT, CLS) |
| **Broken Links** | Scans up to 60 links/src attributes, reports 4xx/5xx and timeouts |

## Deploy

```bash
# 1. Clone & install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. (Optional) Set PageSpeed API key for higher rate limits
vercel env add PAGESPEED_KEY
```

No other environment variables required. PageSpeed works without a key (rate limited to ~60 req/min).

## Structure

```
/
├── index.html        ← frontend (phosphor terminal UI)
├── vercel.json
└── api/
    ├── meta.js       ← SEO + OG/Twitter (fetches & parses HTML)
    ├── headers.js    ← security headers (HEAD request)
    ├── pagespeed.js  ← Google PageSpeed Insights v5 proxy
    └── links.js      ← broken link scanner (concurrent HEAD checks)
```

## Local dev

```bash
vercel dev
# → http://localhost:3000
```

## Notes

- **PageSpeed API** is Google's public endpoint — no key needed for personal use.  
  Set `PAGESPEED_KEY` env var to raise the rate limit.
- **Link scanner** checks up to 60 links with 8 concurrent requests, HEAD-first with GET fallback.
- All API routes set `Access-Control-Allow-Origin: *` for potential cross-origin use.
