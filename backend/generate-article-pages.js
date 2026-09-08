// Generates the static HTML shells for the news routes (frontend postbuild).
//
// Why this exists: the app is a client-rendered SPA, so react-helmet only puts
// route metadata in the DOM *after* JavaScript runs. Most social crawlers
// (Facebook, Twitter/X, LinkedIn, Slack, Discord) never execute JavaScript, so
// they saw the homepage title and description on every news URL.
//
// Two kinds of shell are written:
//
//   build/news/index.html          the News index: CollectionPage/ItemList
//   build/news/<slug>/index.html   one per published article: BlogPosting
//
// Each is the same bundle and the same markup as build/index.html with the
// route-varying head tags replaced. Vercel serves them straight off the
// filesystem for a direct hit on /news or /news/<slug>, so the raw HTML already
// carries the right canonical, Open Graph, Twitter and JSON-LD. React then boots
// from the very same document and renders the route normally.
//
// The metadata itself comes from newsArticleSeo.js, which the React components
// also use, so the crawler-visible tags and the hydrated DOM cannot drift.
//
// Deliberately no Puppeteer, no prerender service and no framework migration:
// it is a string substitution over the file CRA already produced.

'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildArticleSeo,
  buildNewsIndexSeo,
  renderSeoHtml,
  stripRouteVaryingTags,
} = require('../frontend/src/services/newsArticleSeo');
const {
  NEWS_CONTENT_DIR,
  NEWS_DRAFT_DIR,
  cliContentOverrides,
  loadNewsContent,
} = require('./news-content');

const BUILD_DIR = path.join(__dirname, '..', 'frontend', 'build');

/**
 * Guards against a build whose assets are referenced relatively.
 *
 * An article shell lives two directories deep (/news/<slug>/index.html), so a
 * `./static/js/main.js` reference would resolve to /news/<slug>/static/... and
 * 404. CRA emits absolute `/static/...` paths unless `homepage` is set to a
 * relative value in package.json, so this only trips if that changes.
 */
function assertAbsoluteAssetPaths(template) {
  const relative = template.match(/(?:src|href)="\.\.?\/[^"]*"/g);

  if (relative) {
    throw new Error(
      'build/index.html references assets with relative paths, which cannot work ' +
        'from a nested article URL:\n' +
        `  ${relative.slice(0, 5).join('\n  ')}\n\n` +
        'Remove the relative "homepage" field from frontend/package.json so ' +
        'Create React App emits absolute /static/... paths.'
    );
  }
}

/**
 * Produces the article shell HTML from the built index.html template.
 *
 * The route-varying tags are stripped and replaced rather than appended, so the
 * raw document contains exactly one title, one canonical link and one value per
 * Open Graph / Twitter field.
 */
function injectSeo(template, seo) {
  if (!template.includes('</head>')) {
    throw new Error('build/index.html has no </head>; cannot inject route metadata.');
  }

  const stripped = stripRouteVaryingTags(template);
  const block = renderSeoHtml(seo);

  return stripped.replace('</head>', `${block}\n  </head>`);
}

function renderArticleHtml(template, article) {
  return injectSeo(template, buildArticleSeo(article));
}

/**
 * The /news index shell.
 *
 * `articles` must be the published list: the ItemList in this document is a
 * public advertisement of URLs, so a draft in here would point crawlers at an
 * unapproved article.
 */
function renderNewsIndexHtml(template, articles) {
  return injectSeo(template, buildNewsIndexSeo(articles));
}

function generateArticlePages({
  buildDir = BUILD_DIR,
  contentDir = NEWS_CONTENT_DIR,
  draftDir = NEWS_DRAFT_DIR,
  logger = console,
} = {}) {
  const templatePath = path.join(buildDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `No built index.html at ${templatePath}. Run the production build first.`
    );
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  assertAbsoluteAssetPaths(template);

  const { published, drafts } = loadNewsContent(contentDir, { draftDir, logger });
  const written = [];

  // The index first, so /news stops answering with homepage metadata.
  const indexDir = path.join(buildDir, 'news');
  const indexPath = path.join(indexDir, 'index.html');

  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(indexPath, renderNewsIndexHtml(template, published));
  written.push({ route: '/news', outPath: indexPath });

  published.forEach((article) => {
    const outDir = path.join(buildDir, 'news', article.slug);
    const outPath = path.join(outDir, 'index.html');

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, renderArticleHtml(template, article));

    written.push({ route: `/news/${article.slug}`, outPath });
  });

  return {
    buildDir,
    written,
    // Drafts are intentionally absent from the build output entirely: no shell,
    // no sitemap entry, and not even in the JavaScript bundle, because they live
    // outside src where Webpack cannot see them.
    skippedDrafts: drafts.map((article) => article.slug),
  };
}

if (require.main === module) {
  try {
    const { written, skippedDrafts } = generateArticlePages({
      ...cliContentOverrides(),
      ...(process.env.NEWS_BUILD_DIR ? { buildDir: process.env.NEWS_BUILD_DIR } : {}),
    });

    written.forEach(({ route }) => console.log(`  generated ${route}`));
    console.log(
      `Generated ${written.length} static news page(s)` +
        (skippedDrafts.length > 0
          ? `; skipped ${skippedDrafts.length} draft(s): ${skippedDrafts.join(', ')}`
          : '')
    );
  } catch (error) {
    console.error(`\nArticle page generation failed.\n${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  BUILD_DIR,
  NEWS_CONTENT_DIR,
  NEWS_DRAFT_DIR,
  assertAbsoluteAssetPaths,
  renderArticleHtml,
  renderNewsIndexHtml,
  generateArticlePages,
};
