// Exercises loadArticles() against a synthetic content directory so we can
// assert how the loader behaves when someone commits a malformed article file.
// (newsArticleService.test.js covers the real files that ship in the repo.)

jest.mock('./newsArticleContext', () => ({
  loadRawArticles: jest.fn(),
}));

const { loadRawArticles } = require('./newsArticleContext');
const {
  getAllArticles,
  getArticleBySlug,
  getArticleLoadErrors,
  loadArticles,
  resetArticleCache,
} = require('./newsArticleService');

const article = (overrides = {}) => ({
  slug: 'good-article',
  status: 'published',
  title: 'Good Article',
  excerpt: 'A valid article.',
  publishedAt: '2026-01-01',
  // No updatedAt: it defaults to publishedAt, so tests can override
  // publishedAt alone without tripping the updatedAt >= publishedAt rule.
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example'],
  readingTime: '3 min read',
  featured: false,
  metaTitle: 'Good Article | Scorecard',
  metaDescription: 'Description.',
  sourceLinks: [],
  body: [{ type: 'paragraph', content: 'Body copy.' }],
  ...overrides,
});

const asFile = (data) => ({ source: `${data.slug}.json`, data });

beforeEach(() => {
  resetArticleCache();
});

describe('loading a directory that contains a malformed article', () => {
  const setup = () => {
    loadRawArticles.mockReturnValue([
      asFile(article({ slug: 'newer-article', publishedAt: '2026-05-05' })),
      { source: 'broken.json', data: { slug: 'broken', title: '' } },
      asFile(article({ slug: 'older-article', publishedAt: '2025-05-05' })),
    ]);
  };

  it('still loads every valid article', () => {
    setup();

    expect(getAllArticles().map((a) => a.slug)).toEqual([
      'newer-article',
      'older-article',
    ]);
  });

  it('reports the malformed file with actionable errors', () => {
    setup();

    const errors = getArticleLoadErrors();

    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('broken.json');
    expect(errors[0].errors.length).toBeGreaterThan(0);
    expect(errors[0].errors).toEqual(expect.arrayContaining(['title is required']));
  });

  it('does not throw, so the News page keeps rendering', () => {
    setup();

    expect(() => loadArticles()).not.toThrow();
    expect(getArticleBySlug('newer-article')).not.toBeNull();
    expect(getArticleBySlug('broken')).toBeNull();
  });
});

describe('duplicate slugs', () => {
  it('keeps the first article and reports the duplicate', () => {
    loadRawArticles.mockReturnValue([
      asFile(article({ slug: 'same-slug', title: 'First' })),
      { source: 'same-slug.json', data: article({ slug: 'same-slug', title: 'Second' }) },
    ]);

    expect(getAllArticles()).toHaveLength(1);
    expect(getAllArticles()[0].title).toBe('First');
    expect(getArticleLoadErrors()[0].errors[0]).toContain('duplicate slug');
  });
});

// A draft should never be visible here at all: the browser's require.context
// only reaches src/content/news, and the directory contract requires everything
// in there to be published. These cases simulate a botched approval move -- the
// status changed but the file was never relocated, or vice versa -- and pin down
// that the loader rejects it rather than rendering it.
describe('a draft file sitting in the published content directory', () => {
  const setup = () => {
    loadRawArticles.mockReturnValue([
      asFile(article({ slug: 'published-post', title: 'Published Post' })),
      asFile(
        article({
          slug: 'draft-post',
          status: 'draft',
          title: 'Draft Post',
          publishedAt: '2026-12-01',
        })
      ),
    ]);
  };

  it('is excluded from the public article list', () => {
    setup();

    expect(getAllArticles().map((a) => a.slug)).toEqual(['published-post']);
  });

  it('is excluded even when newer than every published article', () => {
    setup();

    // The draft has the most recent date, so a sort-order bug would surface it
    // at the top of the News index rather than hide it.
    expect(getAllArticles().map((a) => a.title)).not.toContain('Draft Post');
    expect(getAllArticles()[0].slug).toBe('published-post');
  });

  it('cannot be reached by slug lookup, exactly like a typo', () => {
    setup();

    expect(getArticleBySlug('draft-post')).toBeNull();
    expect(getArticleBySlug('published-post')).not.toBeNull();
  });

  it('is reported as a load error naming the directory contract', () => {
    setup();

    const errors = getArticleLoadErrors();

    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe('draft-post.json');
    expect(errors[0].errors.join(' ')).toMatch(/does not match this directory/);
    expect(errors[0].errors.join(' ')).toMatch(/requires "published"/);
  });

  it('does not take the News page down with it', () => {
    loadRawArticles.mockReturnValue([
      asFile(article({ slug: 'draft-only', status: 'draft' })),
    ]);

    expect(() => loadArticles()).not.toThrow();
    expect(getAllArticles()).toEqual([]);
    expect(getArticleLoadErrors()).toHaveLength(1);
  });
});

describe('an empty content directory', () => {
  it('returns no articles instead of failing', () => {
    loadRawArticles.mockReturnValue([]);

    expect(getAllArticles()).toEqual([]);
    expect(getArticleLoadErrors()).toEqual([]);
    expect(getArticleBySlug('anything')).toBeNull();
  });
});

describe('adding a new article file', () => {
  it('appears automatically with no import list to update', () => {
    loadRawArticles.mockReturnValue([asFile(article({ slug: 'first-post' }))]);
    expect(getAllArticles()).toHaveLength(1);

    // Simulate dropping a second JSON file into src/content/news.
    resetArticleCache();
    loadRawArticles.mockReturnValue([
      asFile(article({ slug: 'first-post' })),
      asFile(article({ slug: 'second-post', publishedAt: '2026-02-02' })),
    ]);

    const slugs = getAllArticles().map((a) => a.slug);

    expect(slugs).toHaveLength(2);
    expect(slugs).toContain('second-post');
    expect(getArticleBySlug('second-post')).not.toBeNull();
  });
});
