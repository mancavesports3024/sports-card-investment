import {
  findArticleBySlug,
  formatArticleDate,
  getAllArticles,
  getArticleBySlug,
  getArticleLoadErrors,
  getArticleUrl,
  sortArticlesByDate,
  toIsoTimestamp,
  validateArticle,
} from './newsArticleService';

// A minimal article that satisfies every required field, used as the starting
// point for the negative validation cases below.
const validArticle = () => ({
  slug: 'example-article',
  status: 'published',
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
});

describe('loading article files', () => {
  it('discovers every article JSON file with no validation errors', () => {
    const articles = getAllArticles();

    expect(getArticleLoadErrors()).toEqual([]);
    expect(articles.length).toBeGreaterThanOrEqual(3);
  });

  it('includes the three migrated articles', () => {
    const slugs = getAllArticles().map((article) => article.slug);

    expect(slugs).toContain('2026-bowman-chrome-baseball-budget-guide');
    expect(slugs).toContain('smarter-way-to-collect-data-driven-insights');
    expect(slugs).toContain('the-national-2025-why-every-collector-should-be-watching');
  });

  it('ships the three migrated articles as published, with no drafts', () => {
    getAllArticles().forEach((article) => {
      expect(article.status).toBe('published');
    });
  });

  it('has no draft file sitting in the published content directory', () => {
    // The directory contract, checked against the real files rather than the
    // loader's output: src/content/news is the only directory the browser
    // bundle can see, so a "draft" in here would have shipped its full text to
    // every visitor. There is no getDraftArticles() to assert against because
    // supporting one would require bundling that text in the first place.
    const { loadRawArticles } = require('./newsArticleContext');

    const statuses = loadRawArticles().map((file) => ({
      source: file.source,
      status: file.data.status,
    }));

    expect(statuses.length).toBeGreaterThanOrEqual(3);
    expect(statuses.filter((f) => f.status !== 'published')).toEqual([]);
  });

  it('normalizes every loaded article to the expected shape', () => {
    getAllArticles().forEach((article) => {
      expect(typeof article.slug).toBe('string');
      expect(typeof article.title).toBe('string');
      expect(typeof article.excerpt).toBe('string');
      expect(typeof article.author).toBe('string');
      expect(typeof article.category).toBe('string');
      expect(typeof article.readingTime).toBe('string');
      expect(typeof article.metaTitle).toBe('string');
      expect(typeof article.metaDescription).toBe('string');
      expect(typeof article.featured).toBe('boolean');
      expect(Array.isArray(article.tags)).toBe(true);
      expect(Array.isArray(article.sourceLinks)).toBe(true);
      expect(Array.isArray(article.body)).toBe(true);
      expect(article.body.length).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(article.publishedAt).getTime())).toBe(false);
      expect(Number.isNaN(new Date(article.updatedAt).getTime())).toBe(false);
    });
  });

  it('does not render the visitor\'s current date as a publication date', () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dataDriven = getArticleBySlug('smarter-way-to-collect-data-driven-insights');

    // The migrated article used new Date() before; its date is now fixed to the
    // commit that first introduced the content.
    expect(dataDriven.publishedAt).toBe('2025-12-24');
    expect(dataDriven.publishedAt).not.toBe(todayIso);
  });
});

describe('sorting', () => {
  it('returns articles newest first', () => {
    const articles = getAllArticles();
    const timestamps = articles.map((a) => new Date(a.publishedAt).getTime());
    const descending = [...timestamps].sort((a, b) => b - a);

    expect(timestamps).toEqual(descending);
  });

  it('puts the newest migrated article first', () => {
    expect(getAllArticles()[0].slug).toBe('2026-bowman-chrome-baseball-budget-guide');
  });

  it('sorts an unordered list without mutating the input', () => {
    const input = [
      { publishedAt: '2025-07-28', title: 'Older' },
      { publishedAt: '2026-09-07', title: 'Newest' },
      { publishedAt: '2025-12-24', title: 'Middle' },
    ];

    expect(sortArticlesByDate(input).map((a) => a.title)).toEqual([
      'Newest',
      'Middle',
      'Older',
    ]);
    expect(input[0].title).toBe('Older');
  });

  it('breaks ties deterministically by title', () => {
    const sameDay = [
      { publishedAt: '2026-01-01', title: 'Beta' },
      { publishedAt: '2026-01-01', title: 'Alpha' },
    ];

    expect(sortArticlesByDate(sameDay).map((a) => a.title)).toEqual(['Alpha', 'Beta']);
  });
});

describe('lookup by slug', () => {
  it('finds an article by its slug', () => {
    const article = getArticleBySlug('2026-bowman-chrome-baseball-budget-guide');

    expect(article).not.toBeNull();
    expect(article.title).toBe("2026 Bowman Chrome Baseball: A Budget Collector's Guide");
    expect(article.category).toBe('Collecting Guides');
  });

  it('returns null for an unknown slug', () => {
    expect(getArticleBySlug('this-article-does-not-exist')).toBeNull();
  });

  it('returns null for empty or non-string slugs', () => {
    expect(getArticleBySlug('')).toBeNull();
    expect(getArticleBySlug(undefined)).toBeNull();
    expect(findArticleBySlug(getAllArticles(), null)).toBeNull();
  });

  it('builds canonical article URLs on the production domain', () => {
    expect(getArticleUrl('some-slug')).toBe(
      'https://www.mancavesportscardsllc.com/news/some-slug'
    );
  });
});

describe('validation', () => {
  it('accepts a well-formed article', () => {
    const { article, errors } = validateArticle(validArticle(), 'example-article.json');

    expect(errors).toEqual([]);
    expect(article.slug).toBe('example-article');
  });

  it('reports each missing required field', () => {
    const { article, errors } = validateArticle({}, 'broken.json');

    expect(article).toBeNull();
    expect(errors).toEqual(expect.arrayContaining(['title is required']));
    expect(errors).toEqual(expect.arrayContaining(['excerpt is required']));
    expect(errors).toEqual(expect.arrayContaining(['metaDescription is required']));
    expect(errors).toEqual(
      expect.arrayContaining(['body must be a non-empty array of content blocks'])
    );
  });

  it('rejects a filename that does not match the slug', () => {
    const { article, errors } = validateArticle(validArticle(), 'wrong-name.json');

    expect(article).toBeNull();
    expect(errors.join(' ')).toContain('does not match slug');
  });

  it('rejects an unsafe link protocol in paragraph content', () => {
    const raw = validArticle();
    raw.body = [
      {
        type: 'paragraph',
        content: [{ text: 'Click me', href: 'javascript:alert(1)' }],
      },
    ];

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(article).toBeNull();
    expect(errors.join(' ')).toContain('must be an absolute http(s) URL');
  });

  it('rejects an unknown body block type', () => {
    const raw = validArticle();
    raw.body = [{ type: 'videoEmbed', src: 'https://example.com' }];

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(article).toBeNull();
    expect(errors.join(' ')).toContain('is not supported');
  });

  it('requires imageAlt when heroImage is present', () => {
    const raw = validArticle();
    raw.heroImage = '/images/hero.jpg';

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(article).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining(['imageAlt is required when heroImage is present'])
    );
  });

  it('accepts a heroImage that has alt text', () => {
    const raw = validArticle();
    raw.heroImage = '/images/hero.jpg';
    raw.imageAlt = 'A stack of graded baseball cards';

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(errors).toEqual([]);
    expect(article.imageAlt).toBe('A stack of graded baseball cards');
  });

  it('defaults updatedAt to publishedAt and featured to false', () => {
    const raw = validArticle();
    delete raw.updatedAt;
    delete raw.featured;

    const { article } = validateArticle(raw, 'example-article.json');

    expect(article.updatedAt).toBe('2026-01-15');
    expect(article.featured).toBe(false);
  });

  it('normalizes string, span and array paragraph content alike', () => {
    const raw = validArticle();
    raw.body = [
      { type: 'paragraph', content: 'Plain text.' },
      {
        type: 'paragraph',
        content: [
          { text: 'See the ' },
          { text: 'source', href: 'https://example.com' },
          { text: ' for details.', bold: true },
        ],
      },
      { type: 'unorderedList', items: ['One', [{ text: 'Two', bold: true }]] },
    ];

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(errors).toEqual([]);
    expect(article.body[0].content).toEqual([{ text: 'Plain text.' }]);
    expect(article.body[1].content[1]).toEqual({
      text: 'source',
      href: 'https://example.com',
    });
    expect(article.body[2].items).toEqual([
      [{ text: 'One' }],
      [{ text: 'Two', bold: true }],
    ]);
  });

  it('validates source links', () => {
    const raw = validArticle();
    raw.sourceLinks = [{ label: 'No URL' }];

    const { article, errors } = validateArticle(raw, 'example-article.json');

    expect(article).toBeNull();
    expect(errors.join(' ')).toContain('sourceLinks[0].url');
  });
});

describe('date formatting', () => {
  it('formats a date-only value without shifting timezone', () => {
    expect(formatArticleDate('2026-09-07')).toBe('September 7, 2026');
    expect(formatArticleDate('2025-07-28')).toBe('July 28, 2025');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatArticleDate('not-a-date')).toBe('');
    expect(toIsoTimestamp('not-a-date')).toBe('');
  });

  it('produces ISO timestamps for SEO metadata', () => {
    expect(toIsoTimestamp('2026-09-07')).toBe('2026-09-07T00:00:00.000Z');
  });
});
