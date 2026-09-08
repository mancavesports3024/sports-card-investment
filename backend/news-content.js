// Node-side reader for the file-based news content.
//
// Both build scripts (generate-sitemap.js and generate-article-pages.js) go
// through here so they see exactly the same articles, validated by exactly the
// same rules as the React app (frontend/src/services/newsArticleSchema.js).
//
// Published and draft articles live in physically separate directories:
//
//   frontend/src/content/news        published; inside src, so Webpack bundles it
//   frontend/content/news-drafts     drafts; outside src, unreachable from the browser
//
// That separation is the actual guarantee that unapproved text never ships. The
// browser bundle can only ever see the published directory, because
// `require.context` resolves at build time and bundles everything it matches --
// so a runtime `status` filter would run long after the bytes had already been
// served. See frontend/content/news-drafts/README.md.
//
// This module runs at build time on a developer's machine, never in a browser,
// so it is free to read both directories. It enforces the directory contract
// (published files must say "published", drafts must say "draft") and both
// directories are validated in a single pass so that a draft reusing a
// published slug is still caught.
//
// This is also the layer that decides what breaks a build:
//   * unreadable or unparseable JSON in either directory  -> throw
//   * an invalid article in the published directory        -> throw
//   * a directory/status mismatch, in either direction     -> throw
//   * an otherwise-invalid article marked "draft" in the
//     draft directory                                      -> warn, keep building
//
// Silently dropping an article is what we are specifically trying to stop,
// because it ships a site that is missing content nobody noticed was missing.
// That applies just as much to a file marked "published" that was left behind in
// the draft directory as it does to a broken article in the published one: both
// are an approved article that never appears. Both throw.

'use strict';

const fs = require('fs');
const path = require('path');

const {
  DRAFT,
  PUBLISHED,
  formatCollectionErrors,
  validateArticleCollection,
} = require('../frontend/src/services/newsArticleSchema');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

/** Published articles. Inside src, therefore inside the browser bundle. */
const NEWS_CONTENT_DIR = path.join(FRONTEND_DIR, 'src', 'content', 'news');

/** Drafts. Outside src on purpose; nothing in the bundle can reach this. */
const NEWS_DRAFT_DIR = path.join(FRONTEND_DIR, 'content', 'news-drafts');

/**
 * Reads every *.json file in a content directory.
 *
 * Throws with the offending filename if any file cannot be read or parsed, in
 * either directory: a draft that is not even valid JSON is a broken tool
 * somewhere upstream, not an authoring choice.
 *
 * @param {string} contentDir
 * @param {{expectedStatus?: string, labelPrefix?: string, required?: boolean}} options
 */
function readArticleFiles(contentDir = NEWS_CONTENT_DIR, options = {}) {
  const { expectedStatus = null, labelPrefix = '', required = true } = options;

  if (!fs.existsSync(contentDir)) {
    if (required) {
      throw new Error(`News content directory not found: ${contentDir}`);
    }
    return [];
  }

  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const filePath = path.join(contentDir, file);

      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        throw new Error(
          `Invalid article JSON in ${labelPrefix}${file}: ${error.message}\n  ${filePath}`
        );
      }

      return {
        source: file,
        data,
        expectedStatus,
        label: `${labelPrefix}${file}`,
      };
    });
}

/**
 * Reads and validates both content directories in one pass.
 *
 * @param {string} contentDir published directory
 * @param {{draftDir?: string|null, logger?: object}} options
 *   `draftDir: null` skips drafts entirely, which is what the build-script tests
 *   use so a temporary fixture directory is never mixed with the real drafts.
 * @returns {{published: Array, drafts: Array, invalid: Array}}
 * @throws if any article in the published directory fails validation.
 */
function loadNewsContent(contentDir = NEWS_CONTENT_DIR, options = {}) {
  const { draftDir = NEWS_DRAFT_DIR, logger = console } = options;

  const files = [
    ...readArticleFiles(contentDir, { expectedStatus: PUBLISHED }),
    ...(draftDir
      ? readArticleFiles(draftDir, {
          expectedStatus: DRAFT,
          labelPrefix: 'news-drafts/',
          required: false,
        })
      : []),
  ];

  const result = validateArticleCollection(files);

  if (result.blockingErrors.length > 0) {
    throw new Error(
      `${result.blockingErrors.length} article(s) failed validation and blocked the build:\n` +
        `${formatCollectionErrors(result.blockingErrors)}\n\n` +
        'Every file in frontend/src/content/news must declare "status": "published", ' +
        'and every file in frontend/content/news-drafts must declare "status": "draft".\n' +
        'Fix the content, or move the file into the directory that matches its status.'
    );
  }

  if (result.draftErrors.length > 0 && logger && typeof logger.warn === 'function') {
    logger.warn(
      `${result.draftErrors.length} draft article(s) are invalid and were skipped:\n` +
        formatCollectionErrors(result.draftErrors)
    );
  }

  return result;
}

/** Convenience wrapper: just the published articles, newest first. */
function loadPublishedArticles(contentDir = NEWS_CONTENT_DIR, options = {}) {
  return loadNewsContent(contentDir, options).published;
}

/**
 * Draft articles, newest first. Node-side authoring tooling only.
 *
 * There is deliberately no browser equivalent: exposing one would require the
 * draft text to be in the bundle for it to read.
 */
function loadDraftArticles(options = {}) {
  return loadNewsContent(NEWS_CONTENT_DIR, options).drafts;
}

/**
 * Content-directory overrides for a direct CLI invocation, read from the
 * environment.
 *
 * Only the two scripts' `require.main === module` blocks consult these; the
 * exported functions keep their real defaults, so requiring this module is
 * unaffected. They exist so the build scripts can be exercised end to end --
 * including their process exit codes, which is the part that actually gates a
 * deploy -- against fixture directories, without a test writing into the
 * repository's real content, sitemap or build output.
 *
 * Unset in a normal build, where this returns {} and changes nothing.
 */
function cliContentOverrides(env = process.env) {
  const overrides = {};
  if (env.NEWS_CONTENT_DIR) overrides.contentDir = env.NEWS_CONTENT_DIR;
  if (env.NEWS_DRAFT_DIR) overrides.draftDir = env.NEWS_DRAFT_DIR;
  return overrides;
}

module.exports = {
  NEWS_CONTENT_DIR,
  NEWS_DRAFT_DIR,
  readArticleFiles,
  loadNewsContent,
  loadPublishedArticles,
  loadDraftArticles,
  cliContentOverrides,
};
