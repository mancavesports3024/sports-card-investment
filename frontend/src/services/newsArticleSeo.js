// Route-level SEO metadata, derived once and consumed twice.
//
// `buildArticleSeo` (one article) and `buildNewsIndexSeo` (the /news index) are
// the only places those routes' title/description/canonical/Open Graph/Twitter/
// JSON-LD values are computed. The React components feed the result to
// react-helmet for the client-rendered DOM, and
// backend/generate-article-pages.js serialises the same result into the static
// HTML shells that social crawlers see. Because both read from here they cannot
// drift apart.
//
// CommonJS and dependency-free for the same reason as newsArticleSchema.js: it
// has to load in the browser bundle, in Jest, and in plain Node.

const { isValidCalendarDate } = require('./newsArticleSchema');
const {
  DEFAULT_SHARE_IMAGE,
  SITE_DEFAULTS,
  SITE_NAME,
  SITE_URL,
  canonicalUrlForPath,
} = require('./siteMetadata');

const HELMET_ATTRIBUTE = 'data-react-helmet';

function articleUrl(slug) {
  return `${SITE_URL}/news/${slug}`;
}

function absoluteUrl(value) {
  if (!value) return DEFAULT_SHARE_IMAGE;
  return /^https?:\/\//i.test(value) ? value : `${SITE_URL}${value}`;
}

/** ISO-8601 timestamp for SEO metadata and structured data. '' when unusable. */
function toIsoTimestamp(value) {
  if (!isValidCalendarDate(value)) return '';
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/**
 * Everything a crawler needs for one article, in one object.
 *
 * `meta` is an ordered list of plain descriptors. Each entry carries exactly
 * one of `name` or `property`, matching the attribute the platform expects
 * (Open Graph and article:* use `property`, everything else uses `name`).
 */
function buildArticleSeo(article) {
  const canonical = articleUrl(article.slug);
  const publishedIso = toIsoTimestamp(article.publishedAt);
  const modifiedIso = toIsoTimestamp(article.updatedAt);
  const image = absoluteUrl(article.heroImage);

  const meta = [
    { name: 'description', content: article.metaDescription },
    { name: 'author', content: article.author },
    { name: 'robots', content: 'index, follow' },

    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: article.title },
    { property: 'og:description', content: article.metaDescription },
    { property: 'og:url', content: canonical },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:image', content: image },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: article.title },
    { name: 'twitter:description', content: article.metaDescription },
    { name: 'twitter:image', content: image },

    { property: 'article:published_time', content: publishedIso },
    { property: 'article:modified_time', content: modifiedIso },
    { property: 'article:section', content: article.category },
    ...article.tags.map((tag) => ({ property: 'article:tag', content: tag })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.metaDescription,
    image,
    url: canonical,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_SHARE_IMAGE,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    articleSection: article.category,
    keywords: article.tags.join(', '),
  };

  return {
    title: article.metaTitle,
    canonical,
    image,
    publishedIso,
    modifiedIso,
    meta,
    jsonLd,
  };
}

/**
 * The /news index descriptor: one definition, two consumers.
 *
 * NewsPage renders it through react-helmet and
 * backend/generate-article-pages.js serialises it into build/news/index.html,
 * so a raw request to /news carries the News metadata instead of the homepage's
 * before any JavaScript runs.
 */
const NEWS_INDEX = {
  path: '/news',
  title: 'Sports Card News, Releases & Market Insights | Scorecard',
  // Bare name (no "| Scorecard" suffix) for structured data.
  name: 'Sports Card News, Releases & Market Insights',
  description:
    'Sports card release calendar, industry news and trending market data. Track release dates for Topps, Panini, Bowman and Upper Deck, and read expert analysis for collectors and investors.',
  keywords:
    'sports card news, trading card news, card release calendar, Topps, Panini, Bowman, Upper Deck, trending cards, card market analysis',
  author: 'ManCave Sports Cards LLC',
};

function newsIndexUrl() {
  return `${SITE_URL}${NEWS_INDEX.path}`;
}

/**
 * Everything a crawler needs for the /news index.
 *
 * @param {Array} articles published articles, newest first. Callers must pass
 *   published articles only -- this is a public surface, so a draft reaching the
 *   ItemList would advertise an unapproved URL. Drafts are not in the browser
 *   bundle at all, and the Node build script feeds this from
 *   loadNewsContent().published.
 */
function buildNewsIndexSeo(articles = []) {
  const canonical = newsIndexUrl();
  const image = DEFAULT_SHARE_IMAGE;

  const meta = [
    { name: 'description', content: NEWS_INDEX.description },
    { name: 'keywords', content: NEWS_INDEX.keywords },
    { name: 'author', content: NEWS_INDEX.author },
    { name: 'robots', content: 'index, follow' },

    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: NEWS_INDEX.title },
    { property: 'og:description', content: NEWS_INDEX.description },
    { property: 'og:url', content: canonical },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:image', content: image },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: NEWS_INDEX.title },
    { name: 'twitter:description', content: NEWS_INDEX.description },
    { name: 'twitter:image', content: image },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: NEWS_INDEX.name,
    description: NEWS_INDEX.description,
    url: canonical,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_SHARE_IMAGE,
      },
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: articleUrl(article.slug),
        name: article.title,
      })),
    },
  };

  return {
    title: NEWS_INDEX.title,
    canonical,
    image,
    meta,
    jsonLd,
  };
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * JSON-LD payload safe to embed in an HTML <script> block.
 * Escaping `<` is what prevents a `</script>` sequence in authored content from
 * closing the block early.
 */
function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Serialises a SEO descriptor into head markup.
 *
 * Every emitted tag is stamped with `data-react-helmet="true"`. That attribute
 * is what react-helmet uses to identify tags it owns: on hydration it replaces
 * these with its own identical tags instead of appending duplicates, so the
 * live DOM ends up with exactly one canonical link and one value per field.
 */
function renderSeoHtml(seo, { indent = '    ' } = {}) {
  const lines = [`<title>${escapeHtmlText(seo.title)}</title>`];

  seo.meta.forEach((tag) => {
    const key = tag.name !== undefined ? 'name' : 'property';
    lines.push(
      `<meta ${HELMET_ATTRIBUTE}="true" ${key}="${escapeHtmlAttribute(tag[key])}" content="${escapeHtmlAttribute(tag.content)}"/>`
    );
  });

  lines.push(
    `<link ${HELMET_ATTRIBUTE}="true" rel="canonical" href="${escapeHtmlAttribute(seo.canonical)}"/>`
  );
  lines.push(
    `<script ${HELMET_ATTRIBUTE}="true" type="application/ld+json">${serializeJsonLd(seo.jsonLd)}</script>`
  );

  return lines.join(`\n${indent}`);
}

/**
 * Strips the route-varying tags out of a built index.html so article-specific
 * ones can take their place.
 *
 * Removes the <title> plus every meta/link/script already marked as
 * helmet-managed. Unmarked tags (charset, viewport, favicon, manifest, AdSense)
 * are left exactly as the build emitted them.
 */
function stripRouteVaryingTags(html) {
  const marked = `${HELMET_ATTRIBUTE}=(?:"true"|'true'|true)`;

  return html
    .replace(new RegExp(`[ \\t]*<title\\b[^>]*>[\\s\\S]*?</title>[ \\t]*\\n?`, 'gi'), '')
    .replace(
      new RegExp(`[ \\t]*<script\\b[^>]*${marked}[^>]*>[\\s\\S]*?</script>[ \\t]*\\n?`, 'gi'),
      ''
    )
    .replace(new RegExp(`[ \\t]*<(?:meta|link)\\b[^>]*${marked}[^>]*>[ \\t]*\\n?`, 'gi'), '');
}

module.exports = {
  SITE_NAME,
  SITE_URL,
  SITE_DEFAULTS,
  DEFAULT_SHARE_IMAGE,
  HELMET_ATTRIBUTE,
  NEWS_INDEX,
  articleUrl,
  newsIndexUrl,
  absoluteUrl,
  canonicalUrlForPath,
  toIsoTimestamp,
  buildArticleSeo,
  buildNewsIndexSeo,
  escapeHtmlAttribute,
  escapeHtmlText,
  serializeJsonLd,
  renderSeoHtml,
  stripRouteVaryingTags,
};
