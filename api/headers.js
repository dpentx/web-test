const CHECKS = [
  {
    header: 'strict-transport-security',
    label:  'Strict-Transport-Security',
    pass: v => v && /max-age=\d+/i.test(v),
    passNote: null,
    failNote: 'HSTS not set — enforce HTTPS connections',
    warnCond: v => v && /max-age=(\d+)/.test(v) && parseInt(v.match(/max-age=(\d+)/)[1]) < 31536000,
    warnNote: 'max-age should be ≥ 31536000 (1 year)',
  },
  {
    header: 'content-security-policy',
    label:  'Content-Security-Policy',
    pass: v => !!v,
    failNote: 'CSP not set — XSS mitigation missing',
    warnCond: v => v && v.includes("'unsafe-inline'"),
    warnNote: "unsafe-inline weakens CSP effectiveness",
  },
  {
    header: 'x-frame-options',
    label:  'X-Frame-Options',
    pass: v => v && /^(DENY|SAMEORIGIN)$/i.test(v.trim()),
    failNote: 'Missing — page may be embeddable (clickjacking risk)',
    warnCond: v => v && v.toUpperCase() === 'ALLOWALL',
    warnNote: 'ALLOWALL is insecure',
  },
  {
    header: 'x-content-type-options',
    label:  'X-Content-Type-Options',
    pass: v => v && v.toLowerCase().includes('nosniff'),
    failNote: 'Should be "nosniff" to prevent MIME sniffing',
    warnCond: null,
    warnNote: null,
  },
  {
    header: 'referrer-policy',
    label:  'Referrer-Policy',
    pass: v => !!v,
    failNote: 'Not set — browser default may leak referrer info',
    warnCond: v => v === 'unsafe-url',
    warnNote: 'unsafe-url exposes full URL in referrer',
  },
  {
    header: 'permissions-policy',
    label:  'Permissions-Policy',
    pass: v => !!v,
    failNote: 'Not set — browser features unrestricted',
    warnCond: null,
    warnNote: null,
  },
  {
    header: 'cross-origin-opener-policy',
    label:  'Cross-Origin-Opener-Policy',
    pass: v => !!v,
    failNote: 'Not set — cross-origin isolation not enforced',
    warnCond: null,
    warnNote: null,
  },
  {
    header: 'x-xss-protection',
    label:  'X-XSS-Protection',
    pass: v => !v,               // modern browsers ignore it, absence is fine
    passNote: 'Not needed in modern browsers (CSP is preferred)',
    failNote: null,
    warnCond: v => v && v.startsWith('1'),
    warnNote: 'Legacy header — rely on CSP instead',
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  let target;
  try { target = new URL(url); } catch {
    return res.status(400).json({ error: 'invalid URL' });
  }

  let headers;
  try {
    const r = await fetch(target.href, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    headers = r.headers;
  } catch {
    // fallback to GET
    try {
      const r = await fetch(target.href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      headers = r.headers;
    } catch (e) {
      return res.status(200).json({ error: `fetch failed: ${e.message}` });
    }
  }

  const checks = CHECKS.map(c => {
    const value = headers.get(c.header);

    if (c.warnCond && c.warnCond(value)) {
      return { header: c.label, value, status: 'WARN', note: c.warnNote };
    }
    if (c.pass(value)) {
      return { header: c.label, value, status: 'PASS', note: c.passNote || null };
    }
    return { header: c.label, value, status: 'FAIL', note: c.failNote };
  });

  res.status(200).json({ checks });
}
