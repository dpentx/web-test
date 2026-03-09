export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  // PageSpeed requires no API key for basic usage (60 req/min limit)
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}&strategy=mobile` +
    `&category=performance&category=accessibility&category=best-practices&category=seo` +
    (process.env.PAGESPEED_KEY ? `&key=${process.env.PAGESPEED_KEY}` : '');

  let json;
  try {
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const msg = err?.error?.message || `PageSpeed API error ${r.status}`;
      return res.status(200).json({ error: msg });
    }
    json = await r.json();
  } catch (e) {
    return res.status(200).json({ error: `PageSpeed request failed: ${e.message}` });
  }

  const cats = json?.lighthouseResult?.categories || {};
  const audits = json?.lighthouseResult?.audits || {};

  const scores = {};
  if (cats.performance)    scores['Performance']    = Math.round((cats.performance.score    || 0) * 100);
  if (cats.accessibility)  scores['Accessibility']  = Math.round((cats.accessibility.score  || 0) * 100);
  if (cats['best-practices']) scores['Best Practices'] = Math.round((cats['best-practices'].score || 0) * 100);
  if (cats.seo)            scores['SEO']            = Math.round((cats.seo.score            || 0) * 100);

  // Core Web Vitals
  const vitals = {};

  const fcp = audits['first-contentful-paint'];
  if (fcp) vitals['FCP'] = { value: fcp.displayValue, rating: fcp.score >= 0.9 ? 'good' : fcp.score >= 0.5 ? 'needs-improvement' : 'poor' };

  const lcp = audits['largest-contentful-paint'];
  if (lcp) vitals['LCP'] = { value: lcp.displayValue, rating: lcp.score >= 0.9 ? 'good' : lcp.score >= 0.5 ? 'needs-improvement' : 'poor' };

  const tbt = audits['total-blocking-time'];
  if (tbt) vitals['TBT'] = { value: tbt.displayValue, rating: tbt.score >= 0.9 ? 'good' : tbt.score >= 0.5 ? 'needs-improvement' : 'poor' };

  const cls = audits['cumulative-layout-shift'];
  if (cls) vitals['CLS'] = { value: cls.displayValue, rating: cls.score >= 0.9 ? 'good' : cls.score >= 0.5 ? 'needs-improvement' : 'poor' };

  const si = audits['speed-index'];
  if (si) vitals['Speed Index'] = { value: si.displayValue, rating: si.score >= 0.9 ? 'good' : si.score >= 0.5 ? 'needs-improvement' : 'poor' };

  res.status(200).json({ scores, vitals });
}
