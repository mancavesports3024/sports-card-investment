// Build-time behaviour: sitemap generation and static news-page generation.
//
// Every case runs against throwaway content directories rather than the real
// src/content/news and content/news-drafts, so draft handling and failure modes
// can be exercised without shipping fixture articles in the repo.
//
// Published and draft fixtures go in separate temp directories, mirroring
// production. Anything that does not involve drafts passes `draftDir: null`, so
// a test can never accidentally read the repository's real drafts.

const fs = require('fs');
const os = require('os');
const path = require('path');

const { PUBLISHED, DRAFT, validateArticleCollection } = require('./newsArticleSchema');
const { loadNewsContent, readArticleFiles } = require('../../../backend/news-content');
const {
  buildRoutes,
  buildSitemapXml,
  loadNewsArticles,
} = require('../../../backend/generate-sitemap');
const {
  assertAbsoluteAssetPaths,
  generateArticlePages,
  renderArticleHtml,
  renderNewsIndexHtml,
} = require('../../../backend/generate-article-pages');

const article = (overrides = {}) => ({
  slug: 'example-article',
  status: PUBLISHED,
  title: 'Example Article',
  excerpt: 'A short summary.',
  publishedAt: '2026-01-15',
  updatedAt: '2026-01-20',
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example', 'Budget'],
  readingTime: '4 min read',
  featured: false,
  metaTitle: 'Example Article | Scorecard',
  metaDescription: 'Meta description for the example article.',
  sourceLinks: [],
  body: [{ type: 'paragraph', content: 'Hello world.' }],
  ...overrides,
});

// Mirrors the shape of a real CRA-built index.html: whitespace collapsed,
// comments stripped, route-varying tags stamped as helmet-managed.
const TEMPLATE = [
  '<!doctype html><html lang="en"><head>',
  '<meta charset="utf-8"/>',
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5981606678113994" crossorigin="anonymous"></script>',
  '<title>Scorecard - Home</title>',
  '<meta data-react-helmet="true" name="description" content="Site default description."/>',
  '<meta data-react-helmet="true" property="og:title" content="Scorecard - Home"/>',
  '<meta data-react-helmet="true" name="twitter:title" content="Scorecard - Home"/>',
  '<link data-react-helmet="true" rel="canonical" href="https://www.mancavesportscardsllc.com/"/>',
  '<meta name="googlebot" content="index, follow"/>',
  '<link rel="manifest" href="/manifest.json"/>',
  '<script defer="defer" src="/static/js/main.abc123.js"></script>',
  '</head><body><div id="root"></div></body></html>',
].join('');

let tempDirs = [];

const makeDir = (prefix, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);

  Object.entries(files).forEach(([name, contents]) => {
    fs.writeFileSync(
      path.join(dir, name),
      typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2)
    );
  });

  return dir;
};

/** Stands in for frontend/src/content/news (published, inside the bundle). */
const makeContentDir = (files) => makeDir('news-content-', files);

/** Stands in for frontend/content/news-drafts (outside the bundle). */
const makeDraftDir = (files) => makeDir('news-drafts-', files);

const makeBuildDir = (indexHtml = TEMPLATE) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-build-'));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);
  return dir;
};

const silentLogger = { warn: () => {}, log: () => {}, error: () => {} };

// Default options for cases with no drafts. `draftDir: null` is what stops a
// temp published directory being paired with the repository's real drafts.
const noDrafts = { draftDir: null, logger: silentLogger };

afterEach(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  tempDirs = [];
});

describe('reading the content directory', () => {
  it('fails loudly on invalid JSON, naming the file', () => {
    const dir = makeContentDir({ 'broken-article.json': '{ "slug": "broken-article",' });

    expect(() => readArticleFiles(dir)).toThrow(/Invalid article JSON in broken-article\.json/);
  });

  it('fails loudly when a published article is invalid', () => {
    const dir = makeContentDir({
      'bad-article.json': article({ slug: 'bad-article', publishedAt: '2026-02-30' }),
    });

    expect(() => loadNewsContent(dir, noDrafts)).toThrow(
      /failed validation and blocked the build/
    );
  });

  it('does not fail the build for an invalid draft', () => {
    const contentDir = makeContentDir({
      'good-article.json': article({ slug: 'good-article' }),
    });
    const draftDir = makeDraftDir({
      'bad-draft.json': article({
        slug: 'bad-draft',
        status: DRAFT,
        publishedAt: '2026-02-30',
      }),
    });

    const result = loadNewsContent(contentDir, { draftDir, logger: silentLogger });

    expect(result.published.map((a) => a.slug)).toEqual(['good-article']);
    expect(result.draftErrors).toHaveLength(1);
  });

  it('fails loudly on a filename that disagrees with the slug', () => {
    const dir = makeContentDir({ 'renamed.json': article({ slug: 'example-article' }) });

    expect(() => loadNewsContent(dir, noDrafts)).toThrow(/does not match slug/);
  });

  it('reads valid drafts from the draft directory without publishing them', () => {
    const contentDir = makeContentDir({ 'live-post.json': article({ slug: 'live-post' }) });
    const draftDir = makeDraftDir({
      'pending-post.json': article({ slug: 'pending-post', status: DRAFT }),
    });

    const result = loadNewsContent(contentDir, { draftDir, logger: silentLogger });

    expect(result.published.map((a) => a.slug)).toEqual(['live-post']);
    expect(result.drafts.map((a) => a.slug)).toEqual(['pending-post']);
    expect(result.invalid).toEqual([]);
  });

  it('tolerates a missing draft directory', () => {
    const contentDir = makeContentDir({ 'live-post.json': article({ slug: 'live-post' }) });

    const result = loadNewsContent(contentDir, {
      draftDir: path.join(os.tmpdir(), 'news-drafts-does-not-exist'),
      logger: silentLogger,
    });

    expect(result.published.map((a) => a.slug)).toEqual(['live-post']);
    expect(result.drafts).toEqual([]);
  });
});

// The directory/status contract. A half-finished approval move -- file relocated
// without its status changing, or the reverse -- is a hard error rather than a
// silent leak or a silently missing article.
describe('the directory/status contract at build time', () => {
  it('fails the build when a draft sits in the published directory', () => {
    const contentDir = makeContentDir({
      'sneaky-draft.json': article({ slug: 'sneaky-draft', status: DRAFT }),
    });

    expect(() => loadNewsContent(contentDir, noDrafts)).toThrow(
      /does not match this directory/
    );
  });

  it('names the fix in the failure message', () => {
    const contentDir = makeContentDir({
      'sneaky-draft.json': article({ slug: 'sneaky-draft', status: DRAFT }),
    });

    expect(() => loadNewsContent(contentDir, noDrafts)).toThrow(/news-drafts/);
  });

  // This direction used to be treated as a mere warning, so the build exited 0
  // and deployed without the article -- the exact silent omission the contract
  // exists to prevent. It blocks now.
  it('fails the build for a published article left behind in the draft directory', () => {
    const contentDir = makeContentDir({ 'live-post.json': article({ slug: 'live-post' }) });
    const draftDir = makeDraftDir({
      'forgotten.json': article({ slug: 'forgotten', status: PUBLISHED }),
    });

    expect(() =>
      loadNewsContent(contentDir, { draftDir, logger: silentLogger })
    ).toThrow(/requires "draft"/);
    expect(() =>
      loadNewsContent(contentDir, { draftDir, logger: silentLogger })
    ).toThrow(/failed validation and blocked the build/);
  });

  it('classifies that mismatch as blocking rather than a draft warning', () => {
    const result = validateArticleCollection([
      {
        source: 'forgotten.json',
        label: 'news-drafts/forgotten.json',
        data: article({ slug: 'forgotten', status: PUBLISHED }),
        expectedStatus: DRAFT,
      },
    ]);

    expect(result.blockingErrors).toHaveLength(1);
    expect(result.blockingErrors[0].source).toBe('news-drafts/forgotten.json');
    expect(result.draftErrors).toEqual([]);
  });

  it('blocks the mismatch in the other direction too', () => {
    const result = validateArticleCollection([
      {
        source: 'sneaky.json',
        data: article({ slug: 'sneaky', status: DRAFT }),
        expectedStatus: PUBLISHED,
      },
    ]);

    expect(result.blockingErrors).toHaveLength(1);
    expect(result.draftErrors).toEqual([]);
  });

  it('still only warns for a genuinely-draft file that is merely malformed', () => {
    // The distinction that matters: this file says "draft" and sits in the draft
    // directory, so nothing is being dropped from the site. It is unfinished
    // authoring work, and unfinished authoring work must not block a release.
    const contentDir = makeContentDir({ 'live-post.json': article({ slug: 'live-post' }) });
    const draftDir = makeDraftDir({
      'wip.json': article({ slug: 'wip', status: DRAFT, publishedAt: '2026-02-30' }),
    });

    const result = loadNewsContent(contentDir, { draftDir, logger: silentLogger });

    expect(result.blockingErrors).toEqual([]);
    expect(result.draftErrors).toHaveLength(1);
    expect(result.published.map((a) => a.slug)).toEqual(['live-post']);
  });

  it('does not treat a missing status in the draft directory as a mismatch', () => {
    // It claims nothing, so nothing is silently dropped; it is an ordinary
    // malformed draft and warns like one.
    const raw = article({ slug: 'statusless' });
    delete raw.status;

    const result = validateArticleCollection([
      { source: 'statusless.json', data: raw, expectedStatus: DRAFT },
    ]);

    expect(result.blockingErrors).toEqual([]);
    expect(result.draftErrors).toHaveLength(1);
    expect(result.draftErrors[0].errors.join(' ')).toMatch(/status is required/);
    expect(result.draftErrors[0].errors.join(' ')).not.toMatch(/does not match this directory/);
  });

  it('catches a draft reusing a published slug across the directory boundary', () => {
    const contentDir = makeContentDir({ 'clash.json': article({ slug: 'clash' }) });
    const draftDir = makeDraftDir({
      'clash.json': article({ slug: 'clash', status: DRAFT }),
    });

    const result = loadNewsContent(contentDir, { draftDir, logger: silentLogger });

    expect(result.published.map((a) => a.slug)).toEqual(['clash']);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].errors.join(' ')).toMatch(/duplicate slug "clash"/);
    expect(result.invalid[0].source).toBe('news-drafts/clash.json');
  });

  it('labels draft files distinctly so error messages are unambiguous', () => {
    const contentDir = makeContentDir({ 'live-post.json': article({ slug: 'live-post' }) });
    const draftDir = makeDraftDir({
      'wrong-name.json': article({ slug: 'pending-post', status: DRAFT }),
    });

    const result = loadNewsContent(contentDir, { draftDir, logger: silentLogger });

    expect(result.draftErrors[0].source).toBe('news-drafts/wrong-name.json');
  });
});

describe('sitemap article discovery', () => {
  it('includes published articles and excludes drafts', () => {
    const contentDir = makeContentDir({
      'live-post.json': article({ slug: 'live-post' }),
    });
    const draftDir = makeDraftDir({
      'hidden-post.json': article({ slug: 'hidden-post', status: DRAFT }),
    });

    const entries = loadNewsArticles(contentDir, { draftDir, logger: silentLogger });
    const locations = buildRoutes(entries).map((route) => route.loc);
    const xml = buildSitemapXml(buildRoutes(entries));

    expect(entries.map((e) => e.slug)).toEqual(['live-post']);
    expect(locations).toContain('/news/live-post');
    expect(locations).not.toContain('/news/hidden-post');
    expect(xml).not.toContain('hidden-post');
  });

  it('uses updatedAt for lastmod and falls back to publishedAt', () => {
    const dir = makeContentDir({
      'with-update.json': article({
        slug: 'with-update',
        publishedAt: '2026-01-15',
        updatedAt: '2026-03-01',
      }),
      'no-update.json': (() => {
        const raw = article({ slug: 'no-update', publishedAt: '2026-02-10' });
        delete raw.updatedAt;
        return raw;
      })(),
    });

    const byslug = Object.fromEntries(
      loadNewsArticles(dir, noDrafts).map((e) => [e.slug, e.lastmod])
    );

    expect(byslug['with-update']).toBe('2026-03-01');
    expect(byslug['no-update']).toBe('2026-02-10');
  });
});

describe('sitemap routes', () => {
  it('includes /card-set-analysis with the other public routes', () => {
    const locations = buildRoutes([]).map((route) => route.loc);

    expect(locations).toContain('/');
    expect(locations).toContain('/search');
    expect(locations).toContain('/card-set-analysis');
    expect(locations).toContain('/news');
    expect(locations).toContain('/ebay-bidding');
  });

  it('excludes /history, which has no route in App.js', () => {
    expect(buildRoutes([]).map((route) => route.loc)).not.toContain('/history');
  });

  it('omits lastmod for static pages instead of stamping the build date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const routes = buildRoutes([]);

    ['/', '/search', '/card-set-analysis', '/ebay-bidding'].forEach((loc) => {
      const route = routes.find((r) => r.loc === loc);
      expect(route.lastmod).toBeUndefined();
    });

    const xml = buildSitemapXml(routes);
    expect(xml).not.toContain(`<lastmod>${today}</lastmod>`);
  });

  it('emits no <lastmod> element at all for a route without one', () => {
    const xml = buildSitemapXml([
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/news/x', changefreq: 'monthly', priority: '0.7', lastmod: '2026-01-01' },
    ]);

    const blocks = xml.split('<url>').slice(1);

    expect(blocks[0]).not.toContain('<lastmod>');
    expect(blocks[0]).toContain('<loc>https://www.mancavesportscardsllc.com/</loc>');
    expect(blocks[1]).toContain('<lastmod>2026-01-01</lastmod>');
    expect((xml.match(/<lastmod>/g) || []).length).toBe(1);
  });

  it('dates the /news index from the newest published article', () => {
    const entries = [
      { slug: 'older', lastmod: '2025-05-05' },
      { slug: 'newer', lastmod: '2026-04-04' },
    ];

    const newsRoute = buildRoutes(entries).find((r) => r.loc === '/news');

    expect(newsRoute.lastmod).toBe('2026-04-04');
  });

  it('leaves /news without a lastmod when nothing is published', () => {
    expect(buildRoutes([]).find((r) => r.loc === '/news').lastmod).toBeUndefined();
  });

  it('escapes XML-significant characters in locations', () => {
    const xml = buildSitemapXml([
      { loc: '/news/a&b', changefreq: 'monthly', priority: '0.7' },
    ]);

    expect(xml).toContain('/news/a&amp;b');
    expect(xml).not.toContain('/news/a&b');
  });
});

describe('static article page generation', () => {
  const setup = () => {
    const contentDir = makeContentDir({ 'example-article.json': article() });
    const draftDir = makeDraftDir({
      'hidden-post.json': article({ slug: 'hidden-post', status: DRAFT }),
    });
    const buildDir = makeBuildDir();

    const result = generateArticlePages({
      buildDir,
      contentDir,
      draftDir,
      logger: silentLogger,
    });

    return { buildDir, contentDir, draftDir, result };
  };

  it('writes one shell per published article at /news/<slug>/index.html', () => {
    const { buildDir, result } = setup();

    expect(result.written.map((w) => w.route)).toEqual([
      '/news',
      '/news/example-article',
    ]);
    expect(
      fs.existsSync(path.join(buildDir, 'news', 'example-article', 'index.html'))
    ).toBe(true);
  });

  it('generates nothing for a draft article', () => {
    const { buildDir, result } = setup();

    expect(result.skippedDrafts).toEqual(['hidden-post']);
    expect(fs.existsSync(path.join(buildDir, 'news', 'hidden-post'))).toBe(false);
  });

  it('leaves no trace of draft content anywhere in the build output', () => {
    const contentDir = makeContentDir({ 'example-article.json': article() });
    const draftDir = makeDraftDir({
      'hidden-post.json': article({
        slug: 'hidden-post',
        status: DRAFT,
        title: 'UNPUBLISHEDSENTINELTITLE',
        excerpt: 'UNPUBLISHEDSENTINELEXCERPT',
        metaDescription: 'UNPUBLISHEDSENTINELMETA',
        body: [{ type: 'paragraph', content: 'UNPUBLISHEDSENTINELBODY' }],
      }),
    });
    const buildDir = makeBuildDir();

    generateArticlePages({ buildDir, contentDir, draftDir, logger: silentLogger });

    const everyFile = [];
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else everyFile.push(fs.readFileSync(full, 'utf8'));
      });
    walk(buildDir);

    const allText = everyFile.join('\n');

    expect(allText).not.toContain('UNPUBLISHEDSENTINELTITLE');
    expect(allText).not.toContain('UNPUBLISHEDSENTINELEXCERPT');
    expect(allText).not.toContain('UNPUBLISHEDSENTINELMETA');
    expect(allText).not.toContain('UNPUBLISHEDSENTINELBODY');
    expect(allText).not.toContain('hidden-post');
  });

  it('puts article-specific metadata in the raw HTML', () => {
    const { buildDir } = setup();
    const html = fs.readFileSync(
      path.join(buildDir, 'news', 'example-article', 'index.html'),
      'utf8'
    );

    expect(html).toContain('<title>Example Article | Scorecard</title>');
    expect(html).toContain(
      'content="Meta description for the example article."'
    );
    expect(html).toContain(
      'rel="canonical" href="https://www.mancavesportscardsllc.com/news/example-article"'
    );
    expect(html).toContain('property="og:title" content="Example Article"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(
      'property="og:url" content="https://www.mancavesportscardsllc.com/news/example-article"'
    );
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title" content="Example Article"');
    expect(html).toContain('name="twitter:image"');
    expect(html).toContain('application/ld+json');
  });

  it('embeds parseable BlogPosting JSON-LD', () => {
    const { buildDir } = setup();
    const html = fs.readFileSync(
      path.join(buildDir, 'news', 'example-article', 'index.html'),
      'utf8'
    );

    const match = html.match(
      /<script data-react-helmet="true" type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    const data = JSON.parse(match[1]);

    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBe('Example Article');
    expect(data.url).toBe(
      'https://www.mancavesportscardsllc.com/news/example-article'
    );
    expect(data.datePublished).toBe('2026-01-15T00:00:00.000Z');
    expect(data.dateModified).toBe('2026-01-20T00:00:00.000Z');
  });

  it('replaces the default tags rather than appending beside them', () => {
    const html = renderArticleHtml(TEMPLATE, article());

    expect((html.match(/<title/g) || []).length).toBe(1);
    expect((html.match(/rel="canonical"/g) || []).length).toBe(1);
    expect((html.match(/property="og:title"/g) || []).length).toBe(1);
    expect((html.match(/name="twitter:title"/g) || []).length).toBe(1);
    expect((html.match(/name="description"/g) || []).length).toBe(1);

    expect(html).not.toContain('Site default description.');
    expect(html).not.toContain('content="Scorecard - Home"');
  });

  it('keeps the app bundle, AdSense and unmanaged tags untouched', () => {
    const html = renderArticleHtml(TEMPLATE, article());

    expect(html).toContain('src="/static/js/main.abc123.js"');
    expect(html).toContain('adsbygoogle.js?client=ca-pub-5981606678113994');
    expect(html).toContain('<meta charset="utf-8"/>');
    expect(html).toContain('<meta name="googlebot" content="index, follow"/>');
    expect(html).toContain('<link rel="manifest" href="/manifest.json"/>');
    expect(html).toContain('<div id="root"></div>');
  });

  it('marks generated tags as helmet-managed so hydration cannot duplicate them', () => {
    const html = renderArticleHtml(TEMPLATE, article());

    expect(html).toMatch(
      /<link data-react-helmet="true" rel="canonical" href="[^"]*\/news\/example-article"/
    );
  });

  it('refuses to generate when the build references assets relatively', () => {
    const relativeTemplate = TEMPLATE.replace(
      'src="/static/js/main.abc123.js"',
      'src="./static/js/main.abc123.js"'
    );

    expect(() => assertAbsoluteAssetPaths(relativeTemplate)).toThrow(
      /relative paths/
    );
  });

  it('fails when there is no build to read', () => {
    const contentDir = makeContentDir({ 'example-article.json': article() });
    const emptyBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'news-empty-'));
    tempDirs.push(emptyBuild);

    expect(() =>
      generateArticlePages({ buildDir: emptyBuild, contentDir, ...noDrafts })
    ).toThrow(/No built index\.html/);
  });

  it('fails the build when a published article is invalid', () => {
    const contentDir = makeContentDir({
      'bad-article.json': article({ slug: 'bad-article', updatedAt: '2020-01-01' }),
    });
    const buildDir = makeBuildDir();

    expect(() =>
      generateArticlePages({ buildDir, contentDir, ...noDrafts })
    ).toThrow(/failed validation/);
  });
});

// A raw request to /news used to receive the homepage title, description and
// canonical, because only /news/<slug> had a generated shell. Crawlers that do
// not run JavaScript therefore saw the News index as a duplicate of the
// homepage.
describe('static News index generation', () => {
  const setup = () => {
    const contentDir = makeContentDir({
      'example-article.json': article(),
      'second-article.json': article({
        slug: 'second-article',
        title: 'Second Article',
        publishedAt: '2026-02-02',
        updatedAt: '2026-02-02',
        metaTitle: 'Second Article | Scorecard',
      }),
    });
    const buildDir = makeBuildDir();

    generateArticlePages({ buildDir, contentDir, ...noDrafts });

    return {
      buildDir,
      html: fs.readFileSync(path.join(buildDir, 'news', 'index.html'), 'utf8'),
    };
  };

  it('writes build/news/index.html', () => {
    const { buildDir } = setup();

    expect(fs.existsSync(path.join(buildDir, 'news', 'index.html'))).toBe(true);
  });

  it('carries the News index title and description, not the homepage default', () => {
    const { html } = setup();

    expect(html).toContain(
      '<title>Sports Card News, Releases &amp; Market Insights | Scorecard</title>'
    );
    expect(html).toContain('Sports card release calendar, industry news');
    expect(html).not.toContain('<title>Scorecard - Home</title>');
    expect(html).not.toContain('Site default description.');
  });

  it('canonicalises to /news', () => {
    const { html } = setup();

    expect(html).toContain(
      'rel="canonical" href="https://www.mancavesportscardsllc.com/news"'
    );
    expect(html).not.toContain('rel="canonical" href="https://www.mancavesportscardsllc.com/"');
  });

  it('declares website Open Graph and Twitter metadata', () => {
    const { html } = setup();

    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain(
      'property="og:url" content="https://www.mancavesportscardsllc.com/news"'
    );
    expect(html).toContain('property="og:site_name" content="Scorecard"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:image"');
  });

  it('embeds CollectionPage JSON-LD listing every published article', () => {
    const { html } = setup();

    const match = html.match(
      /<script data-react-helmet="true" type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    const data = JSON.parse(match[1]);

    expect(data['@type']).toBe('CollectionPage');
    expect(data.url).toBe('https://www.mancavesportscardsllc.com/news');
    expect(data.mainEntity['@type']).toBe('ItemList');
    expect(data.mainEntity.itemListElement.map((i) => i.url)).toEqual([
      'https://www.mancavesportscardsllc.com/news/second-article',
      'https://www.mancavesportscardsllc.com/news/example-article',
    ]);
    expect(data.mainEntity.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });

  it('lists published articles only in the ItemList', () => {
    const contentDir = makeContentDir({ 'example-article.json': article() });
    const draftDir = makeDraftDir({
      'hidden-post.json': article({ slug: 'hidden-post', status: DRAFT }),
    });
    const buildDir = makeBuildDir();

    generateArticlePages({ buildDir, contentDir, draftDir, logger: silentLogger });

    const html = fs.readFileSync(path.join(buildDir, 'news', 'index.html'), 'utf8');

    expect(html).not.toContain('hidden-post');
  });

  it('replaces the default tags rather than appending beside them', () => {
    const html = renderNewsIndexHtml(TEMPLATE, [article()]);

    expect((html.match(/<title/g) || []).length).toBe(1);
    expect((html.match(/rel="canonical"/g) || []).length).toBe(1);
    expect((html.match(/property="og:title"/g) || []).length).toBe(1);
    expect((html.match(/name="description"/g) || []).length).toBe(1);
  });

  it('still boots the React app so the index renders normally', () => {
    const { html } = setup();

    expect(html).toContain('src="/static/js/main.abc123.js"');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('adsbygoogle.js?client=ca-pub-5981606678113994');
  });

  it('handles an empty ItemList without breaking the document', () => {
    const html = renderNewsIndexHtml(TEMPLATE, []);
    const match = html.match(
      /<script data-react-helmet="true" type="application\/ld\+json">([\s\S]*?)<\/script>/
    );

    expect(JSON.parse(match[1]).mainEntity.itemListElement).toEqual([]);
  });
});
