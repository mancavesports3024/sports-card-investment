// The single validation contract for the file-based news system.
//
// This module is deliberately written as dependency-free CommonJS so the exact
// same rules run in four places:
//   * the browser bundle (imported by newsArticleService.js)
//   * Jest
//   * backend/generate-sitemap.js
//   * backend/generate-article-pages.js
//
// Nothing here may touch `fs`, `path` or any other Node built-in, otherwise the
// webpack build of the React app would break. Disk reading lives in
// backend/news-content.js and src/services/newsArticleContext.node.js.

const { SITE_URL } = require('./siteMetadata');

const DRAFT = 'draft';
const PUBLISHED = 'published';
const ARTICLE_STATUSES = [DRAFT, PUBLISHED];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BODY_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'unorderedList',
  'orderedList',
  'callout',
];

const REQUIRED_STRING_FIELDS = [
  'slug',
  'title',
  'excerpt',
  'publishedAt',
  'author',
  'category',
  'readingTime',
  'metaTitle',
  'metaDescription',
];

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * True only for an exact `YYYY-MM-DD` string that is also a real calendar date.
 *
 * The round-trip through Date.UTC is what rejects rollover values: `2026-02-30`
 * parses to March 2nd, so the day-of-month no longer matches what was authored.
 */
function isValidCalendarDate(value) {
  if (!isNonEmptyString(value) || !DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Absolute http(s) URL. Used for anything a crawler or reader leaves the site for. */
function isAbsoluteHttpUrl(value) {
  return isNonEmptyString(value) && /^https?:\/\/[^\s/][^\s]*$/i.test(value.trim());
}

/**
 * Site-relative path with exactly one leading slash.
 *
 * `//example.com` and `/\example.com` are both treated by browsers as
 * protocol-relative and would silently send readers off-site, so they are
 * rejected here rather than rendered.
 */
function isInternalPath(value) {
  if (!isNonEmptyString(value)) return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return false;
  return !(trimmed[1] === '/' || trimmed[1] === '\\');
}

/** Anything renderable as an href: an internal path or an absolute http(s) URL. */
function isSafeUrl(value) {
  if (!isNonEmptyString(value)) return false;
  return isInternalPath(value) || isAbsoluteHttpUrl(value);
}

/**
 * Normalizes inline content into an array of spans.
 * Accepts a plain string, a single span object, or an array of either, so that
 * simple paragraphs stay simple to author.
 */
function normalizeInlineContent(content, errors, where) {
  const raw = Array.isArray(content) ? content : [content];
  const spans = [];

  raw.forEach((item, index) => {
    const at = `${where}[${index}]`;

    if (typeof item === 'string') {
      spans.push({ text: item });
      return;
    }

    if (!item || typeof item !== 'object') {
      errors.push(`${at} must be a string or a span object`);
      return;
    }

    if (!isNonEmptyString(item.text)) {
      errors.push(`${at}.text is required`);
      return;
    }

    const span = { text: item.text };

    if (item.bold === true) {
      span.bold = true;
    }

    if (item.href !== undefined) {
      if (!isSafeUrl(item.href)) {
        errors.push(
          `${at}.href must be an absolute http(s) URL or a site-relative path`
        );
      } else {
        span.href = item.href;
      }
    }

    spans.push(span);
  });

  return spans;
}

function normalizeListItems(items, errors, where) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${where}.items must be a non-empty array`);
    return [];
  }

  return items.map((item, index) =>
    normalizeInlineContent(item, errors, `${where}.items[${index}]`)
  );
}

function normalizeBodyBlock(block, errors, where) {
  if (!block || typeof block !== 'object') {
    errors.push(`${where} must be an object`);
    return null;
  }

  if (!BODY_BLOCK_TYPES.includes(block.type)) {
    errors.push(
      `${where}.type "${block.type}" is not supported (expected one of ${BODY_BLOCK_TYPES.join(', ')})`
    );
    return null;
  }

  switch (block.type) {
    case 'paragraph': {
      if (block.content === undefined) {
        errors.push(`${where}.content is required`);
        return null;
      }
      return {
        type: 'paragraph',
        lead: block.lead === true,
        content: normalizeInlineContent(block.content, errors, `${where}.content`),
      };
    }

    case 'heading': {
      if (!isNonEmptyString(block.text)) {
        errors.push(`${where}.text is required`);
        return null;
      }
      const level = block.level === 3 ? 3 : 2;
      return { type: 'heading', level, text: block.text };
    }

    case 'unorderedList':
    case 'orderedList': {
      return {
        type: block.type,
        items: normalizeListItems(block.items, errors, where),
      };
    }

    case 'callout': {
      const normalized = { type: 'callout' };

      if (block.title !== undefined) {
        if (!isNonEmptyString(block.title)) {
          errors.push(`${where}.title must be a non-empty string when present`);
        } else {
          normalized.title = block.title;
        }
      }

      if (block.items !== undefined) {
        normalized.items = normalizeListItems(block.items, errors, where);
      }

      if (block.content !== undefined) {
        normalized.content = normalizeInlineContent(
          block.content,
          errors,
          `${where}.content`
        );
      }

      if (!normalized.items && !normalized.content) {
        errors.push(`${where} requires either items or content`);
        return null;
      }

      return normalized;
    }

    default:
      return null;
  }
}

function normalizeSourceLinks(sourceLinks, errors) {
  if (sourceLinks === undefined) return [];

  if (!Array.isArray(sourceLinks)) {
    errors.push('sourceLinks must be an array');
    return [];
  }

  const normalized = [];

  sourceLinks.forEach((link, index) => {
    const at = `sourceLinks[${index}]`;

    if (!link || typeof link !== 'object') {
      errors.push(`${at} must be an object with label and url`);
      return;
    }
    if (!isNonEmptyString(link.label)) {
      errors.push(`${at}.label is required`);
      return;
    }
    // Sources are citations, so they always point off-site.
    if (!isAbsoluteHttpUrl(link.url)) {
      errors.push(`${at}.url must be an absolute http(s) URL`);
      return;
    }

    normalized.push({ label: link.label, url: link.url });
  });

  return normalized;
}

function normalizeCta(cta, errors) {
  if (cta === undefined || cta === null) return null;

  if (typeof cta !== 'object') {
    errors.push('cta must be an object with label and url');
    return null;
  }
  if (!isNonEmptyString(cta.label)) {
    errors.push('cta.label is required');
    return null;
  }
  if (!isSafeUrl(cta.url)) {
    errors.push('cta.url must be an absolute http(s) URL or a site-relative path');
    return null;
  }

  return { label: cta.label, url: cta.url };
}

/**
 * True when a file declares a valid status that its directory does not allow.
 *
 * Deliberately narrow: it only fires when the status is one of the recognised
 * values *and* disagrees with the directory. A missing or unrecognised status is
 * a different error ("status is required"), reported separately, so the two
 * cases never produce two overlapping complaints about the same field.
 *
 * validateArticle uses this to phrase the error and validateArticleCollection
 * uses it to decide that the error blocks the build. Sharing one predicate is
 * what keeps those two answers from disagreeing.
 */
function isDirectoryStatusMismatch(status, expectedStatus) {
  if (!expectedStatus) return false;
  return ARTICLE_STATUSES.includes(status) && status !== expectedStatus;
}

/**
 * Validates and normalizes a single raw article.
 *
 * @param raw           parsed JSON contents
 * @param source        filename, used to enforce filename/slug agreement
 * @param expectedStatus when set, the status the containing directory requires.
 *   Published and draft articles live in physically separate directories (see
 *   frontend/content/news-drafts/README.md), and this is what keeps a file's
 *   declared status in agreement with where it actually sits. Without it, a
 *   half-finished move -- file relocated but status not updated, or the reverse
 *   -- would either leak a draft into the bundle or silently drop an approved
 *   article from the site.
 * @returns {{article: object|null, errors: string[]}} article is null on failure
 */
function validateArticle(raw, source = 'unknown', expectedStatus = null) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { article: null, errors: ['article must be a JSON object'] };
  }

  REQUIRED_STRING_FIELDS.forEach((field) => {
    if (!isNonEmptyString(raw[field])) {
      errors.push(`${field} is required`);
    }
  });

  if (isNonEmptyString(raw.slug) && !SLUG_PATTERN.test(raw.slug)) {
    errors.push(
      `slug "${raw.slug}" must be lowercase words separated by single hyphens`
    );
  }

  // The filename is the public URL, so it has to agree with the slug.
  if (source !== 'unknown' && isNonEmptyString(raw.slug)) {
    const expected = `${raw.slug}.json`;
    if (source !== expected) {
      errors.push(`filename "${source}" does not match slug (expected "${expected}")`);
    }
  }

  // Approval state is explicit: a file must say whether it is publishable.
  if (!ARTICLE_STATUSES.includes(raw.status)) {
    errors.push(
      `status is required and must be one of ${ARTICLE_STATUSES.join(', ')}`
    );
  } else if (isDirectoryStatusMismatch(raw.status, expectedStatus)) {
    errors.push(
      `status "${raw.status}" does not match this directory, which requires ` +
        `"${expectedStatus}". Move the file to the ${
          raw.status === DRAFT ? 'draft' : 'published'
        } directory or change its status.`
    );
  }

  if (!isValidCalendarDate(raw.publishedAt)) {
    errors.push(
      'publishedAt must be an exact YYYY-MM-DD calendar date (for example 2026-09-07)'
    );
  }

  if (raw.updatedAt !== undefined && !isValidCalendarDate(raw.updatedAt)) {
    errors.push('updatedAt must be an exact YYYY-MM-DD calendar date when present');
  }

  // Date-only ISO strings sort chronologically as plain strings.
  if (
    isValidCalendarDate(raw.publishedAt) &&
    isValidCalendarDate(raw.updatedAt) &&
    raw.updatedAt < raw.publishedAt
  ) {
    errors.push(
      `updatedAt "${raw.updatedAt}" must not be earlier than publishedAt "${raw.publishedAt}"`
    );
  }

  if (!Array.isArray(raw.tags) || raw.tags.length === 0) {
    errors.push('tags must be a non-empty array');
  } else if (!raw.tags.every(isNonEmptyString)) {
    errors.push('tags must contain only non-empty strings');
  }

  if (raw.featured !== undefined && typeof raw.featured !== 'boolean') {
    errors.push('featured must be a boolean when present');
  }

  if (raw.heroImage !== undefined) {
    if (!isSafeUrl(raw.heroImage)) {
      errors.push('heroImage must be an absolute http(s) URL or a site-relative path');
    }
    if (!isNonEmptyString(raw.imageAlt)) {
      errors.push('imageAlt is required when heroImage is present');
    }
  }

  const sourceLinks = normalizeSourceLinks(raw.sourceLinks, errors);
  const cta = normalizeCta(raw.cta, errors);

  let body = [];
  if (!Array.isArray(raw.body) || raw.body.length === 0) {
    errors.push('body must be a non-empty array of content blocks');
  } else {
    body = raw.body
      .map((block, index) => normalizeBodyBlock(block, errors, `body[${index}]`))
      .filter(Boolean);
  }

  if (errors.length > 0) {
    return { article: null, errors };
  }

  return {
    article: {
      slug: raw.slug,
      status: raw.status,
      title: raw.title,
      excerpt: raw.excerpt,
      publishedAt: raw.publishedAt,
      updatedAt: raw.updatedAt || raw.publishedAt,
      author: raw.author,
      category: raw.category,
      tags: [...raw.tags],
      readingTime: raw.readingTime,
      featured: raw.featured === true,
      metaTitle: raw.metaTitle,
      metaDescription: raw.metaDescription,
      heroImage: raw.heroImage || null,
      imageAlt: raw.heroImage ? raw.imageAlt : null,
      sourceLinks,
      cta,
      body,
    },
    errors: [],
  };
}

/** Newest first. Ties fall back to title so ordering stays deterministic. */
function sortArticlesByDate(articles) {
  return [...articles].sort((a, b) => {
    const diff = new Date(b.publishedAt) - new Date(a.publishedAt);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });
}

function findArticleBySlug(articles, slug) {
  if (!isNonEmptyString(slug)) return null;
  return articles.find((article) => article.slug === slug) || null;
}

/** The truthful last-modified date for an article: updatedAt, else publishedAt. */
function articleLastmod(article) {
  return article.updatedAt || article.publishedAt;
}

/**
 * Validates a whole collection of raw article files at once.
 *
 * Callers pass the published and draft directories together in a single call so
 * that duplicate slugs are still caught across the directory boundary -- a
 * draft that reuses a published slug is exactly the kind of collision that only
 * shows up when both sets are compared.
 *
 * Each entry may declare its own `expectedStatus`: the status its directory
 * requires. Combined with what the file claims, that decides whether a problem
 * blocks the build:
 *
 *   directory   file says     outcome
 *   ---------   -----------   ---------------------------------------------
 *   published   published     invalid content blocks (it was meant to ship)
 *   published   draft         BLOCKS -- directory/status mismatch
 *   drafts      draft         invalid content warns (authoring in progress)
 *   drafts      published     BLOCKS -- directory/status mismatch
 *   (none)      draft         warns
 *   (none)      anything else blocks
 *
 * A mismatch blocks in *both* directions, and that is the point. Each direction
 * is a half-finished approval move with its own failure: a draft left in the
 * published directory is unapproved text heading for the bundle, and a
 * published file left in the draft directory is an approved article that would
 * quietly never appear on the site. Treating the second as a mere warning is
 * what let it exit 0 and deploy without the article.
 *
 * A file in the draft directory with a missing or unrecognised status is *not* a
 * mismatch -- it claims nothing, so nothing is being silently dropped from the
 * site -- and stays a warning like any other malformed draft.
 *
 * @param {Array<{source: string, data: unknown, expectedStatus?: string, label?: string}>} rawFiles
 */
function validateArticleCollection(rawFiles) {
  const published = [];
  const drafts = [];
  const invalid = [];
  const slugOwners = new Map();

  (rawFiles || []).forEach(({ source, data, expectedStatus = null, label }) => {
    const where = label || source;
    const claimedStatus =
      data && typeof data === 'object' && !Array.isArray(data) ? data.status : undefined;

    // A directory/status mismatch always blocks, whichever way round it is.
    // Otherwise the directory decides, falling back to what the file claims.
    const blocks =
      isDirectoryStatusMismatch(claimedStatus, expectedStatus) ||
      (expectedStatus ? expectedStatus === PUBLISHED : claimedStatus !== DRAFT);

    const { article, errors } = validateArticle(data, source, expectedStatus);

    if (!article) {
      invalid.push({ source: where, errors, status: claimedStatus, blocks });
      return;
    }

    if (slugOwners.has(article.slug)) {
      invalid.push({
        source: where,
        status: article.status,
        blocks,
        errors: [
          `duplicate slug "${article.slug}" (already declared by "${slugOwners.get(article.slug)}")`,
        ],
      });
      return;
    }

    slugOwners.set(article.slug, where);

    if (article.status === PUBLISHED) {
      published.push(article);
    } else {
      drafts.push(article);
    }
  });

  return {
    published: sortArticlesByDate(published),
    drafts: sortArticlesByDate(drafts),
    invalid,
    blockingErrors: invalid.filter((entry) => entry.blocks),
    draftErrors: invalid.filter((entry) => !entry.blocks),
  };
}

/** Renders collection errors as a single human-readable block. */
function formatCollectionErrors(entries) {
  return entries
    .map(({ source, errors }) => `  ${source}\n${errors.map((e) => `    - ${e}`).join('\n')}`)
    .join('\n');
}

module.exports = {
  SITE_URL,
  DRAFT,
  PUBLISHED,
  ARTICLE_STATUSES,
  SLUG_PATTERN,
  DATE_PATTERN,
  BODY_BLOCK_TYPES,
  isDirectoryStatusMismatch,
  isNonEmptyString,
  isValidCalendarDate,
  isAbsoluteHttpUrl,
  isInternalPath,
  isSafeUrl,
  normalizeInlineContent,
  validateArticle,
  validateArticleCollection,
  formatCollectionErrors,
  sortArticlesByDate,
  findArticleBySlug,
  articleLastmod,
};
