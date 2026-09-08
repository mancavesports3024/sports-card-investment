// Verifies backend/generate-sitemap.js picks up every article JSON file.
// Importing the generator does not write sitemap.xml (it only writes when run
// directly via the frontend prebuild script).

const fs = require('fs');
const path = require('path');

const {
  BASE,
  buildRoutes,
  buildSitemapXml,
  loadNewsArticles,
} = require('../../../backend/generate-sitemap');

const { getAllArticles } = require('./newsArticleService');

const readSrc = (...segments) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

const APP_JS = readSrc('App.js');
const HISTORY_PAGE = readSrc('components', 'HistoryPage.js');

// Every path App.js declares a route for, including the "*" catch-all.
const appRoutePaths = [...APP_JS.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

// The catch-all is excluded from the invariant below on purpose. It matches
// every path by definition, so counting it as a real route would make
// "is this URL routable?" trivially true for anything and silently retire the
// soft-404 guard this file exists to provide. A URL is only considered routable
// here if a *specific* route renders it.
const CATCH_ALL = '*';
const concreteRoutePaths = appRoutePaths.filter((p) => p !== CATCH_ALL);

/** True when a sitemap location is matched by a specific App.js route pattern. */
const resolvesToAppRoute = (loc) =>
  concreteRoutePaths.some((pattern) => {
    const source = `^${pattern.replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`;
    return new RegExp(source).test(loc);
  });

describe('sitemap news entries', () => {
  it('loads every article JSON file', () => {
    const sitemapArticles = loadNewsArticles();

    expect(sitemapArticles.map((a) => a.slug).sort()).toEqual(
      getAllArticles()
        .map((a) => a.slug)
        .sort()
    );
  });

  it('adds a URL for every article on the production domain', () => {
    const xml = buildSitemapXml();

    getAllArticles().forEach((article) => {
      expect(xml).toContain(
        `<loc>https://www.mancavesportscardsllc.com/news/${article.slug}</loc>`
      );
    });
  });

  it('keeps the existing static routes and adds /card-set-analysis', () => {
    const locations = buildRoutes().map((route) => route.loc);

    expect(locations).toContain('/');
    expect(locations).toContain('/search');
    expect(locations).toContain('/news');
    expect(locations).toContain('/ebay-bidding');
    expect(locations).toContain('/card-set-analysis');
  });

  it('does not stamp the build date onto unchanged static pages', () => {
    const xml = buildSitemapXml();

    // Asserted per <url> block rather than against the whole document, because
    // an article's own date can legitimately equal today's date.
    const blockFor = (loc) =>
      xml
        .split('<url>')
        .slice(1)
        .find((block) => block.includes(`<loc>${BASE}${loc}</loc>`));

    ['/', '/search', '/card-set-analysis', '/ebay-bidding'].forEach((loc) => {
      expect(buildRoutes().find((r) => r.loc === loc).lastmod).toBeUndefined();
      expect(blockFor(loc)).not.toContain('<lastmod>');
    });
  });

  it('only lists published articles', () => {
    const articleRoutes = buildRoutes().filter((r) => r.loc.startsWith('/news/'));

    expect(articleRoutes).toHaveLength(getAllArticles().length);
    articleRoutes.forEach((route) => {
      expect(route.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('uses each article\'s own date for lastmod, not the build date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const routes = buildRoutes();

    const national = routes.find(
      (r) => r.loc === '/news/the-national-2025-why-every-collector-should-be-watching'
    );
    const dataDriven = routes.find(
      (r) => r.loc === '/news/smarter-way-to-collect-data-driven-insights'
    );

    expect(national.lastmod).toBe('2025-07-28');
    expect(dataDriven.lastmod).toBe('2025-12-24');
    expect(national.lastmod).not.toBe(today);
    expect(dataDriven.lastmod).not.toBe(today);
  });

  it('prefers updatedAt over publishedAt for lastmod', () => {
    const articles = [
      { slug: 'a', publishedAt: '2026-01-01', updatedAt: '2026-02-02' },
    ];

    // loadNewsArticles resolves this precedence; assert it directly on the
    // articles that ship in the repo plus this synthetic check.
    const resolved = articles.map((a) => a.updatedAt || a.publishedAt);
    expect(resolved).toEqual(['2026-02-02']);

    loadNewsArticles().forEach((article) => {
      expect(article.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('dates the /news index from the newest article', () => {
    const newsRoute = buildRoutes().find((r) => r.loc === '/news');
    const newest = getAllArticles()[0];

    expect(newsRoute.lastmod).toBe(newest.updatedAt);
  });

  it('produces valid sitemap XML with one url block per route', () => {
    const routes = buildRoutes();
    const xml = buildSitemapXml(routes);

    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect((xml.match(/<url>/g) || []).length).toBe(routes.length);
    expect(BASE).toBe('https://www.mancavesportscardsllc.com');
    expect(xml).not.toMatch(/railway\.app/);
  });
});

// The sitemap used to advertise /history, which App.js has no route for, so the
// SPA fallback answered 200 with an empty page -- a soft 404. These tests make
// that class of mistake impossible to reintroduce.
describe('the sitemap only advertises routes the app can render', () => {
  it('finds the route table in App.js', () => {
    // Guards the regex above: if App.js is ever restructured so no routes are
    // matched, the invariant below would pass vacuously.
    expect(concreteRoutePaths.length).toBeGreaterThanOrEqual(8);
    expect(concreteRoutePaths).toContain('/');
    expect(concreteRoutePaths).toContain('/news/:slug');
  });

  it('does not let the catch-all route satisfy the invariant', () => {
    // The catch-all must exist (unmatched paths get a real Not Found page)...
    expect(appRoutePaths).toContain(CATCH_ALL);
    // ...but must not be treated as a route that renders specific content,
    // otherwise every conceivable URL would count as routable.
    expect(concreteRoutePaths).not.toContain(CATCH_ALL);
    expect(resolvesToAppRoute('/definitely-not-a-real-route')).toBe(false);
  });

  it('resolves every sitemap URL to a real App.js route', () => {
    const unroutable = buildRoutes()
      .map((route) => route.loc)
      .filter((loc) => !resolvesToAppRoute(loc));

    expect(unroutable).toEqual([]);
  });

  it('keeps /history out of the sitemap while HistoryPage is an unimplemented stub', () => {
    // HistoryPage.js is currently a single `import { Helmet }` line: no
    // component, no export, referenced by nothing.
    const isStub = !/\bexport\b/.test(HISTORY_PAGE);
    const locations = buildRoutes().map((route) => route.loc);

    if (isStub) {
      expect(concreteRoutePaths).not.toContain('/history');
      expect(locations).not.toContain('/history');
      expect(buildSitemapXml()).not.toContain('/history');
    } else {
      // Someone implemented the page. It must then be both routed and
      // advertised -- this branch is the reminder to do both.
      expect(concreteRoutePaths).toContain('/history');
      expect(locations).toContain('/history');
    }
  });

  it('does not link to /history anywhere in the app shell', () => {
    expect(APP_JS).not.toContain('href="/history"');
    expect(APP_JS).not.toContain('to="/history"');
  });
});
