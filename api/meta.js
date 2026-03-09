export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url param required' });

  let target;
  try { target = new URL(url); } catch {
    return res.status(400).json({ error: 'invalid URL' });
  }

  let html;
  try {
    const r = await fetch(target.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebCheck/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    html = await r.text();
  } catch (e) {
    return res.status(200).json({ error: `fetch failed: ${e.message}` });
  }

  function getMeta(name) {
    const m =
      html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
    return m ? m[1].trim() : null;
  }

  function getProp(prop) {
    const m =
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
    return m ? m[1].trim() : null;
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Lang
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1] : null;

  // Canonical
  const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                     html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonical = canonMatch ? canonMatch[1].trim() : null;

  // H1s
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1s = h1Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  // H2 count
  const h2count = (html.match(/<h2[\s>]/gi) || []).length;

  // Robots
  const robots = getMeta('robots');

  // OG
  const og = {
    title:       getProp('og:title'),
    description: getProp('og:description'),
    image:       getProp('og:image'),
    type:        getProp('og:type'),
    url:         getProp('og:url'),
    site_name:   getProp('og:site_name'),
  };

  // Twitter
  const twitter = {
    card:  getMeta('twitter:card'),
    title: getMeta('twitter:title'),
    image: getMeta('twitter:image'),
  };

  res.status(200).json({
    title,
    description: getMeta('description'),
    canonical,
    lang,
    robots,
    h1s,
    h2count,
    og,
    twitter,
  });
}
