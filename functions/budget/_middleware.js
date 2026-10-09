/**
 * Every /budget page: KordaBudget's own name, icon and manifest in the HTML.
 *
 * The site serves one index.html for all its apps, which names itself
 * KordaTracker. The budget app swaps those details with JavaScript once it's
 * running, but iOS reads them from the HTML as it arrives: "Add to Home Screen"
 * then offered KordaTracker, with the tracker's start page. Rewriting the head
 * here, on the way out, fixes that for every browser before any script runs.
 */
const PAPIER = '#f4f3ee';

export async function onRequest({ next }) {
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;

  const zet = (attr, waarde) => ({ element: (el) => el.setAttribute(attr, waarde) });
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent('KordaBudget') })
    .on('link[rel="manifest"]', zet('href', '/budget-manifest.json'))
    .on('link[rel="apple-touch-icon"]', zet('href', '/budget-icon-180.png'))
    .on('meta[name="apple-mobile-web-app-title"]', zet('content', 'KordaBudget'))
    .on('meta[name="theme-color"]', zet('content', PAPIER))
    // A light app: dark status-bar text instead of the tracker's translucent black.
    .on('meta[name="apple-mobile-web-app-status-bar-style"]', zet('content', 'default'))
    // Use the whole screen, so env(safe-area-inset-*) reports the home-indicator
    // strip: the bottom nav pads itself above it instead of sitting under it.
    .on('meta[name="viewport"]', zet('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover'))
    .transform(res);
}
