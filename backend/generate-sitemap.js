// Generates sitemap.xml for the frontend (run from frontend prebuild)
// Writes to frontend/public/sitemap.xml
//
// Articles are discovered from the JSON files in frontend/src/content/news and
// validated with the same contract the React app uses, via backend/news-content.js.
// A published article that fails validation fails the build rather than being
// dropped from the sitemap without anyone noticing.
//
// Only published articles are listed. Drafts live in frontend/content/news-drafts
// and are never advertised here; news-content.js reads both directories so that
// a draft reusing a published slug is still detected as a collision.

'use strict';

const fs = require('fs');
const path = require('path');

const { articleLastmod } = require('../frontend/src/services/newsArticleSchema');
const {
  NEWS_CONTENT_DIR,
  cliContentOverrides,
  loadNewsContent,
} = require('./news-content');

const BASE = 'https://www.mancavesportscardsllc.com';

// Public routes that are not generated from content.
//
// None of them carry a lastmod: these pages change when the app is redeployed,
// not on a schedule we can honestly describe, and stamping them with the build
// date tells crawlers every page changed every deploy. Omitting the element is
// the truthful option. /news is the exception because its freshness genuinely
// is the freshness of its newest published article.
// /history is deliberately absent. frontend/src/components/HistoryPage.js is a
// 41-byte stub containing a single `import { Helmet }` line with no component
// and no export, and nothing in the app references it, so App.js has no
// /history route. Advertising the URL made it a soft 404: the SPA fallback
// answered 200 with an empty page. It stays out of the sitemap until the
// component actually exists; newsSitemap.test.js enforces that a route is only
// advertised once App.js can render it.
const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/search', changefreq: 'daily', priority: '0.9' },
  { loc: '/card-set-analysis', changefreq: 'weekly', priority: '0.8' },
  { loc: '/news', changefreq: 'weekly', priority: '0.8', lastmodFrom: 'newestArticle' },
  { loc: '/ebay-bidding', changefreq: 'weekly', priority: '0.6' },
];

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Published articles as { slug, lastmod } sitemap entries, newest first.
 * Throws when a published article is invalid or any file is unparseable.
 */
function loadNewsArticles(contentDir = NEWS_CONTENT_DIR, options = {}) {
  return loadNewsContent(contentDir, options).published.map((article) => ({
    slug: article.slug,
    lastmod: articleLastmod(article),
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    title: article.title,
  }));
}

/** The most recent lastmod across published articles, or '' when there are none. */
function newestArticleDate(newsArticles) {
  return newsArticles.reduce(
    (newest, article) => (article.lastmod > newest ? article.lastmod : newest),
    ''
  );
}

function buildRoutes(newsArticles = loadNewsArticles()) {
  const newest = newestArticleDate(newsArticles);

  const staticRoutes = STATIC_ROUTES.map(({ lastmodFrom, ...route }) => {
    if (lastmodFrom === 'newestArticle' && newest) {
      return { ...route, lastmod: newest };
    }
    return route;
  });

  return [
    ...staticRoutes,
    ...newsArticles.map((article) => ({
      loc: `/news/${article.slug}`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: article.lastmod,
    })),
  ];
}

function buildSitemapXml(routes = buildRoutes()) {
  const urls = routes
    .map((route) => {
      const lines = [`    <loc>${escapeXml(`${BASE}${route.loc}`)}</loc>`];

      // Only claim a modification date when we actually have a truthful one.
      if (route.lastmod) {
        lines.push(`    <lastmod>${escapeXml(route.lastmod)}</lastmod>`);
      }

      lines.push(`    <changefreq>${escapeXml(route.changefreq)}</changefreq>`);
      lines.push(`    <priority>${escapeXml(route.priority)}</priority>`);

      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function generateSitemap({ contentDir, outPath, draftDir, logger } = {}) {
  const newsArticles = loadNewsArticles(contentDir, { draftDir, logger });
  const routes = buildRoutes(newsArticles);
  const target =
    outPath || path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');

  fs.writeFileSync(target, buildSitemapXml(routes));
  console.log(
    `Generated sitemap at ${target} (${routes.length} URLs, ${newsArticles.length} published news articles)`
  );

  return { outPath: target, routes };
}

// Only write when invoked directly (frontend prebuild), so tests can import
// the builders without touching frontend/public/sitemap.xml.
if (require.main === module) {
  try {
    generateSitemap({
      ...cliContentOverrides(),
      ...(process.env.NEWS_SITEMAP_OUT ? { outPath: process.env.NEWS_SITEMAP_OUT } : {}),
    });
  } catch (error) {
    console.error(`\nSitemap generation failed.\n${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  BASE,
  NEWS_CONTENT_DIR,
  STATIC_ROUTES,
  escapeXml,
  loadNewsArticles,
  newestArticleDate,
  buildRoutes,
  buildSitemapXml,
  generateSitemap,
};
