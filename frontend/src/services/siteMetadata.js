// Site-wide identity and SEO fallbacks.
//
// Kept in its own dependency-free module on purpose: DefaultSeo is imported
// eagerly by App, so anything this file pulls in lands in the main bundle.
// Article validation (newsArticleSchema.js) and article metadata
// (newsArticleSeo.js) both read from here rather than the other way round, so
// they stay in the lazily loaded route chunks where they belong.
//
// CommonJS so the Node build scripts can require it too.

const SITE_URL = 'https://www.mancavesportscardsllc.com';
const SITE_NAME = 'Scorecard';
const DEFAULT_SHARE_IMAGE = `${SITE_URL}/ManCave.jpg`;

// Mirrored by the static tags in public/index.html; siteDefaults.test.js
// enforces that the two stay in sync so the raw HTML a crawler sees and the
// hydrated DOM never disagree.
const SITE_DEFAULTS = {
  title: 'Scorecard - Home',
  description:
    'Track trading card sales on eBay. Get real-time price data, market analysis, and investment insights for sports cards, Magic: The Gathering, Pokemon, and more. Find recent sales, price trends, and live listings.',
  ogDescription:
    'Track trading card sales on eBay. Get real-time price data, market analysis, and investment insights for sports cards, Magic: The Gathering, Pokemon, and more.',
  twitterDescription:
    'Track trading card sales on eBay. Get real-time price data, market analysis, and investment insights.',
  keywords:
    'trading cards, sports cards, eBay sales, card prices, market analysis, investment, Magic: The Gathering, Pokemon, Yu-Gi-Oh, PSA graded cards, card values',
  author: SITE_NAME,
  robots: 'index, follow',
  ogType: 'website',
  image: `${SITE_URL}/logo512.png`,
};

/** Canonical URL for any in-app route. Query strings are never canonical. */
function canonicalUrlForPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length === 0) return `${SITE_URL}/`;
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

const NOINDEX_ROBOTS = 'noindex, nofollow';

// Routes that must never be indexed.
//
// These are private or single-use utility routes. They are not in the sitemap,
// but that only means we do not *advertise* them -- a crawler can still reach a
// URL from a referrer header, a shared link, or a browser extension, and
// /auth-success in particular gets linked from an OAuth redirect. Without this
// they would inherit `index, follow` from SITE_DEFAULTS via DefaultSeo, which is
// how an admin screen or a bare "Redirecting you to the application..." page
// ends up in search results.
//
// `nofollow` as well as `noindex`, because there is nothing on these pages whose
// link graph we want crawled.
const NOINDEX_PREFIXES = ['/admin'];
const NOINDEX_PATHS = ['/auth-success'];

/** True for a private or utility route that must not be indexed. */
function isNoindexPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length === 0) return false;

  // Tolerate a trailing slash so /admin/cards/ behaves like /admin/cards.
  const clean = pathname.replace(/\/+$/, '') || '/';

  return (
    NOINDEX_PATHS.includes(clean) ||
    NOINDEX_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))
  );
}

/** The robots value a route should declare, given its path. */
function robotsForPath(pathname) {
  return isNoindexPath(pathname) ? NOINDEX_ROBOTS : SITE_DEFAULTS.robots;
}

module.exports = {
  SITE_URL,
  SITE_NAME,
  SITE_DEFAULTS,
  DEFAULT_SHARE_IMAGE,
  NOINDEX_ROBOTS,
  NOINDEX_PATHS,
  NOINDEX_PREFIXES,
  canonicalUrlForPath,
  isNoindexPath,
  robotsForPath,
};
