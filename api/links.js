const MAX_LINKS   = 60;   // kaç link kontrol et
const CONCURRENCY = 8;    // aynı anda kaç istek
const TIMEOUT_MS  = 7000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  let base;
  try { base = new URL(url); } catch {
    return res.status(400).json({ error: 'invalid URL' });
  }

  // 1. Fetch page HTML
  let html;
  try {
    const r = await fetch(base.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    html = await r.text();
  } catch (e) {
    return res.status(200).json({ error: `could not fetch page: ${e.message}` });
  }

  // 2. Extract all href + src links
  const rawLinks = new Set();

  for (const m of html.matchAll(/href=["']([^"'#][^"']*?)["']/gi)) rawLinks.add(m[1].trim());
  for (const m of html.matchAll(/src=["']([^"'#][^"']*?)["']/gi))  rawLinks.add(m[1].trim());

  // 3. Resolve to absolute, filter out data URIs, mailto, tel, js
  const absolutes = [];
  for (const raw of rawLinks) {
    if (/^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    try {
      const abs = new URL(raw, base.href).href;
      absolutes.push(abs);
    } catch { /* skip malformed */ }
  }

  // Dedupe, cap
  const unique = [...new Set(absolutes)].slice(0, MAX_LINKS);

  // 4. Check in batches
  async function checkLink(linkUrl) {
    try {
      const r = await fetch(linkUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });

      if (r.status === 405) {
        // HEAD not allowed, try GET
        const r2 = await fetch(linkUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: 'follow',
        });
        return { url: linkUrl, code: r2.status, status: r2.ok ? 'ok' : 'broken' };
      }

      return { url: linkUrl, code: r.status, status: r.ok ? 'ok' : 'broken' };
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        return { url: linkUrl, code: null, status: 'timeout' };
      }
      return { url: linkUrl, code: null, status: 'broken', error: e.message };
    }
  }

  // Concurrency pool
  const results = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map(checkLink));
    results.push(...settled);
  }

  res.status(200).json({
    total:   absolutes.length,
    checked: unique.length,
    links:   results,
  });
}
