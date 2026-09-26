// Generates an RSS 2.0 feed for the blog (frontend postbuild).
//
// Why this exists: RSS readers and blog aggregators need a machine-readable
// feed of published articles. This script generates a static RSS XML file in
// the public directory that can be served at /rss.xml.
//
// The feed includes the 50 most recent published articles with full metadata:
// title, description, link, publication date, categories, and author.

'use strict';

const fs = require('fs');
const path = require('path');

const {
  loadPublishedArticles,
  cliContentOverrides,
} = require('./news-content');

const { SITE_URL } = require('../frontend/src/services/newsArticleSchema');

const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const RSS_FILE = path.join(PUBLIC_DIR, 'rss.xml');

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRssDate(dateString) {
  // Convert YYYY-MM-DD to RFC 822 format (e.g., "Wed, 26 Sep 2026 00:00:00 GMT")
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return date.toUTCString();
}

function generateRssFeed(contentDir, options = {}) {
  const articles = loadPublishedArticles(contentDir, options);

  // Take the 50 most recent (articles are already sorted newest first)
  const recentArticles = articles.slice(0, 50);

  const now = new Date().toUTCString();

  const items = recentArticles.map((article) => {
    const link = `${SITE_URL}/news/${article.slug}`;
    const categories = [article.category, ...article.tags]
      .filter(Boolean)
      .map(cat => `    <category>${escapeXml(cat)}</category>`)
      .join('\n');

    return `  <item>
    <title>${escapeXml(article.title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <description>${escapeXml(article.excerpt)}</description>
    <pubDate>${formatRssDate(article.publishedAt)}</pubDate>
${categories}
    <author>noreply@mancavesportscardsllc.com (Man Cave Sports Cards LLC)</author>
  </item>`;
  }).join('\n\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Scorecard Blog &amp; Guides</title>
    <link>${SITE_URL}/news</link>
    <description>Sports card collecting guides, new release information, and practical buying and selling advice from Man Cave Sports Cards LLC</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/logo192.png</url>
      <title>Scorecard Blog &amp; Guides</title>
      <link>${SITE_URL}/news</link>
    </image>

${items}
  </channel>
</rss>`;

  fs.writeFileSync(RSS_FILE, rss, 'utf8');
  console.log(`Generated RSS feed with ${recentArticles.length} articles`);
}

if (require.main === module) {
  try {
    const overrides = cliContentOverrides();
    generateRssFeed(overrides.contentDir);
  } catch (error) {
    console.error('RSS generation failed:', error.message);
    process.exit(1);
  }
}

module.exports = { generateRssFeed };
