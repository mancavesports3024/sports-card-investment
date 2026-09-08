// Regression tests for the shared validation contract.
//
// These rules are the same ones enforced during the production build by
// backend/generate-sitemap.js and backend/generate-article-pages.js, so a case
// covered here is covered everywhere.

const {
  DRAFT,
  PUBLISHED,
  isAbsoluteHttpUrl,
  isInternalPath,
  isSafeUrl,
  isValidCalendarDate,
  validateArticle,
  validateArticleCollection,
} = require('./newsArticleSchema');

const article = (overrides = {}) => ({
  slug: 'example-article',
  status: PUBLISHED,
  title: 'Example Article',
  excerpt: 'A short summary of the example article.',
  publishedAt: '2026-01-15',
  updatedAt: '2026-01-20',
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example'],
  readingTime: '4 min read',
  featured: false,
  metaTitle: 'Example Article | Scorecard',
  metaDescription: 'Meta description for the example article.',
  sourceLinks: [],
  body: [{ type: 'paragraph', content: 'Hello world.' }],
  ...overrides,
});

const asFile = (data, source) => ({ source: source || `${data.slug}.json`, data });

const validate = (overrides, source) => {
  const raw = article(overrides);
  return validateArticle(raw, source || `${raw.slug}.json`);
};

describe('calendar dates', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    expect(isValidCalendarDate('2026-09-07')).toBe(true);
    expect(isValidCalendarDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible rollover dates instead of silently shifting them', () => {
    // new Date('2026-02-30') rolls forward to March 2nd, which is how a typo
    // like this used to sail through validation.
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2025-02-29')).toBe(false); // not a leap year
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);
  });

  it('requires the exact YYYY-MM-DD shape', () => {
    expect(isValidCalendarDate('2026-9-7')).toBe(false);
    expect(isValidCalendarDate('September 7, 2026')).toBe(false);
    expect(isValidCalendarDate('2026-09-07T00:00:00Z')).toBe(false);
    expect(isValidCalendarDate('')).toBe(false);
    expect(isValidCalendarDate(undefined)).toBe(false);
  });

  it('rejects an article whose publishedAt is an impossible date', () => {
    const { article: parsed, errors } = validate({ publishedAt: '2026-02-30' });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('publishedAt must be an exact YYYY-MM-DD');
  });

  it('rejects an article whose updatedAt is an impossible date', () => {
    const { article: parsed, errors } = validate({ updatedAt: '2026-02-30' });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('updatedAt must be an exact YYYY-MM-DD');
  });

  it('rejects updatedAt earlier than publishedAt', () => {
    const { article: parsed, errors } = validate({
      publishedAt: '2026-01-15',
      updatedAt: '2026-01-14',
    });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('must not be earlier than publishedAt');
  });

  it('allows updatedAt equal to publishedAt', () => {
    const { article: parsed, errors } = validate({
      publishedAt: '2026-01-15',
      updatedAt: '2026-01-15',
    });

    expect(errors).toEqual([]);
    expect(parsed.updatedAt).toBe('2026-01-15');
  });
});

describe('URL safety', () => {
  it('rejects protocol-relative URLs', () => {
    expect(isSafeUrl('//example.com')).toBe(false);
    expect(isSafeUrl('//example.com/path')).toBe(false);
    expect(isInternalPath('//example.com')).toBe(false);
    expect(isAbsoluteHttpUrl('//example.com')).toBe(false);
  });

  it('rejects the backslash variant browsers also treat as protocol-relative', () => {
    expect(isSafeUrl('/\\example.com')).toBe(false);
  });

  it('allows internal paths with exactly one leading slash', () => {
    expect(isSafeUrl('/news')).toBe(true);
    expect(isSafeUrl('/news/some-slug')).toBe(true);
    expect(isInternalPath('/')).toBe(true);
  });

  it('rejects paths with no leading slash and dangerous schemes', () => {
    expect(isSafeUrl('news/some-slug')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,AAA')).toBe(false);
  });

  it('rejects a protocol-relative href inside paragraph content', () => {
    const { article: parsed, errors } = validate({
      body: [
        {
          type: 'paragraph',
          content: [{ text: 'Offsite', href: '//example.com' }],
        },
      ],
    });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('href must be an absolute http(s) URL');
  });

  it('rejects a protocol-relative heroImage', () => {
    const { article: parsed, errors } = validate({
      heroImage: '//example.com/hero.jpg',
      imageAlt: 'Hero',
    });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('heroImage must be an absolute http(s) URL');
  });

  it('requires source links to be absolute http(s) URLs', () => {
    const relative = validate({ sourceLinks: [{ label: 'Internal', url: '/news' }] });
    expect(relative.article).toBeNull();
    expect(relative.errors.join(' ')).toContain(
      'sourceLinks[0].url must be an absolute http(s) URL'
    );

    const protocolRelative = validate({
      sourceLinks: [{ label: 'Offsite', url: '//example.com' }],
    });
    expect(protocolRelative.article).toBeNull();

    const absolute = validate({
      sourceLinks: [{ label: 'Topps', url: 'https://www.topps.com/' }],
    });
    expect(absolute.errors).toEqual([]);
  });
});

describe('approval status', () => {
  it('requires an explicit status', () => {
    const raw = article();
    delete raw.status;

    const { article: parsed, errors } = validateArticle(raw, 'example-article.json');

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('status is required');
  });

  it('rejects a status outside draft/published', () => {
    const { article: parsed, errors } = validate({ status: 'in-review' });

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('status is required');
  });

  it('accepts both supported statuses and keeps the value on the article', () => {
    expect(validate({ status: PUBLISHED }).article.status).toBe('published');
    expect(validate({ status: DRAFT }).article.status).toBe('draft');
  });

  it('treats a draft as a fully valid authoring file', () => {
    const { article: parsed, errors } = validate({ status: DRAFT });

    expect(errors).toEqual([]);
    expect(parsed.title).toBe('Example Article');
  });
});

describe('slugs and filenames', () => {
  it('rejects a filename that does not match the slug', () => {
    const { article: parsed, errors } = validate({}, 'wrong-name.json');

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toContain('does not match slug');
  });

  it('rejects slugs outside the strict lowercase-hyphen pattern', () => {
    ['Example-Article', 'example_article', 'example--article', '-example', 'example-'].forEach(
      (slug) => {
        const { article: parsed } = validateArticle(article({ slug }), `${slug}.json`);
        expect(parsed).toBeNull();
      }
    );
  });
});

describe('validateArticleCollection', () => {
  it('splits published articles from drafts', () => {
    const result = validateArticleCollection([
      asFile(article({ slug: 'live-post', status: PUBLISHED })),
      asFile(article({ slug: 'hidden-post', status: DRAFT })),
    ]);

    expect(result.published.map((a) => a.slug)).toEqual(['live-post']);
    expect(result.drafts.map((a) => a.slug)).toEqual(['hidden-post']);
    expect(result.invalid).toEqual([]);
    expect(result.blockingErrors).toEqual([]);
  });

  it('rejects duplicate slugs, keeping the first file', () => {
    const result = validateArticleCollection([
      asFile(article({ slug: 'same-slug', title: 'First' })),
      { source: 'same-slug.json', data: article({ slug: 'same-slug', title: 'Second' }) },
    ]);

    expect(result.published).toHaveLength(1);
    expect(result.published[0].title).toBe('First');
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors[0]).toContain('duplicate slug');
  });

  it('sorts published and drafts newest first, independently', () => {
    const result = validateArticleCollection([
      asFile(article({ slug: 'older', publishedAt: '2025-01-01', updatedAt: '2025-01-01' })),
      asFile(article({ slug: 'newer', publishedAt: '2026-01-01', updatedAt: '2026-01-01' })),
      asFile(
        article({
          slug: 'draft-older',
          status: DRAFT,
          publishedAt: '2025-06-01',
          updatedAt: '2025-06-01',
        })
      ),
      asFile(
        article({
          slug: 'draft-newer',
          status: DRAFT,
          publishedAt: '2026-06-01',
          updatedAt: '2026-06-01',
        })
      ),
    ]);

    expect(result.published.map((a) => a.slug)).toEqual(['newer', 'older']);
    expect(result.drafts.map((a) => a.slug)).toEqual(['draft-newer', 'draft-older']);
  });

  it('classifies a broken published article as release-blocking', () => {
    const result = validateArticleCollection([
      { source: 'broken.json', data: { slug: 'broken', status: PUBLISHED, title: '' } },
    ]);

    expect(result.blockingErrors).toHaveLength(1);
    expect(result.draftErrors).toEqual([]);
  });

  it('classifies a broken draft as non-blocking', () => {
    const result = validateArticleCollection([
      { source: 'broken.json', data: { slug: 'broken', status: DRAFT, title: '' } },
    ]);

    expect(result.draftErrors).toHaveLength(1);
    expect(result.blockingErrors).toEqual([]);
  });

  it('treats a file with no status at all as release-blocking', () => {
    const raw = article();
    delete raw.status;

    const result = validateArticleCollection([asFile(raw)]);

    expect(result.blockingErrors).toHaveLength(1);
    expect(result.published).toEqual([]);
    expect(result.drafts).toEqual([]);
  });
});
