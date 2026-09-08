// Browser-facing entry point for the file-based news system.
//
// Discovery lives in newsArticleContext.js, the validation rules live in
// newsArticleSchema.js (shared with the Node build scripts), and SEO metadata
// lives in newsArticleSeo.js. This module only wires them together and adds
// the browser concerns: memoisation and date formatting.
//
// There is no draft-reading API here, by design. Drafts are not filtered out at
// runtime; they are not in the bundle at all, because they live outside src
// where `require.context` cannot reach them. Adding a getDraftArticles() here
// would mean bundling draft data to support it, which is precisely the leak
// this arrangement exists to prevent. Draft inspection is Node-side authoring
// tooling: see backend/list-news-drafts.js.

import { loadRawArticles } from './newsArticleContext';
import {
  BODY_BLOCK_TYPES,
  DRAFT,
  PUBLISHED,
  SITE_URL,
  articleLastmod,
  findArticleBySlug,
  isValidCalendarDate,
  normalizeInlineContent,
  sortArticlesByDate,
  validateArticle,
  validateArticleCollection,
} from './newsArticleSchema';
import { articleUrl, toIsoTimestamp } from './newsArticleSeo';

export {
  BODY_BLOCK_TYPES,
  DRAFT,
  PUBLISHED,
  SITE_URL,
  articleLastmod,
  findArticleBySlug,
  normalizeInlineContent,
  sortArticlesByDate,
  toIsoTimestamp,
  validateArticle,
};

let cache = null;

/**
 * Loads and validates every article the bundle can see.
 *
 * `require.context` only reaches src/content/news, which the directory contract
 * requires to hold published articles exclusively, so PUBLISHED is passed as
 * the expected status. A file that says `"draft"` while sitting there is a
 * botched approval move and is rejected rather than quietly rendered.
 *
 * A malformed file is reported and skipped rather than thrown, so one bad
 * article can never take down the News page in production. The production build
 * is the gate that stops bad content shipping at all: generate-sitemap.js and
 * generate-article-pages.js run the same validation and fail the build loudly.
 */
export function loadArticles() {
  if (cache) return cache;

  const { published, invalid } = validateArticleCollection(
    loadRawArticles().map((file) => ({ ...file, expectedStatus: PUBLISHED }))
  );

  if (invalid.length > 0 && process.env.NODE_ENV === 'development') {
    invalid.forEach(({ source, errors }) => {
      console.error(
        `[news] Skipped invalid article "${source}":\n  - ${errors.join('\n  - ')}`
      );
    });
  }

  cache = { articles: published, errors: invalid };
  return cache;
}

/** Test helper: forget memoized results. */
export function resetArticleCache() {
  cache = null;
}

/** Published articles, newest first. The only list any public view should use. */
export function getAllArticles() {
  return loadArticles().articles;
}

/**
 * Looks up a published article.
 *
 * A draft slug resolves to null exactly like a typo would, because the draft is
 * not in the bundle for this to find.
 */
export function getArticleBySlug(slug) {
  return findArticleBySlug(getAllArticles(), slug);
}

export function getArticleLoadErrors() {
  return loadArticles().errors;
}

export function getArticleUrl(slug) {
  return articleUrl(slug);
}

/**
 * Formats a date for display. Pinned to UTC so a date-only value such as
 * "2026-09-07" never renders as the previous day for western timezones.
 */
export function formatArticleDate(value) {
  if (!isValidCalendarDate(value)) return '';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
