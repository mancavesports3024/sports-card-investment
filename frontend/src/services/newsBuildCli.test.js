// Exit codes of the two build scripts, exercised as real processes.
//
// Why spawn instead of calling the exported functions: what actually gates a
// deploy is the process exit code, and that lives in each script's
// `require.main === module` block, not in the function it calls. A published
// article left in the draft directory was reported and then exited 0 -- the
// script printed a complaint and the deploy went ahead without the article.
// Asserting on a thrown Error would not have caught that, because the throw was
// never reached. These tests assert on the exit code itself.
//
// Fixture directories are supplied through the CLI-only environment overrides
// (see cliContentOverrides in backend/news-content.js), so nothing here touches
// the repository's real content, sitemap or build output.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DRAFT, PUBLISHED } = require('./newsArticleSchema');

const REPO = path.join(__dirname, '..', '..', '..');
const SITEMAP_SCRIPT = path.join(REPO, 'backend', 'generate-sitemap.js');
const PAGES_SCRIPT = path.join(REPO, 'backend', 'generate-article-pages.js');

const TEMPLATE = [
  '<!doctype html><html lang="en"><head>',
  '<meta charset="utf-8"/>',
  '<title>Scorecard - Home</title>',
  '<meta data-react-helmet="true" name="description" content="Site default description."/>',
  '<link data-react-helmet="true" rel="canonical" href="https://www.mancavesportscardsllc.com/"/>',
  '<script defer="defer" src="/static/js/main.abc123.js"></script>',
  '</head><body><div id="root"></div></body></html>',
].join('');

const article = (overrides = {}) => ({
  slug: 'example-article',
  status: PUBLISHED,
  title: 'Example Article',
  excerpt: 'A short summary.',
  publishedAt: '2026-01-15',
  updatedAt: '2026-01-20',
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example'],
  readingTime: '4 min read',
  metaTitle: 'Example Article | Scorecard',
  metaDescription: 'Meta description for the example article.',
  body: [{ type: 'paragraph', content: 'Hello world.' }],
  ...overrides,
});

let tempDirs = [];

const makeDir = (prefix, files = {}) => {
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

const makeBuildDir = () => makeDir('cli-build-', { 'index.html': TEMPLATE });

afterEach(() => {
  tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  tempDirs = [];
});

/** Runs a build script as its own process and returns { status, stdout, stderr }. */
const run = (script, { contentDir, draftDir, buildDir, sitemapOut }) => {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NEWS_CONTENT_DIR: contentDir,
      NEWS_DRAFT_DIR: draftDir,
      ...(buildDir ? { NEWS_BUILD_DIR: buildDir } : {}),
      ...(sitemapOut ? { NEWS_SITEMAP_OUT: sitemapOut } : {}),
    },
  });

  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
};

const runSitemap = (dirs) =>
  run(SITEMAP_SCRIPT, {
    ...dirs,
    sitemapOut: path.join(makeDir('cli-out-'), 'sitemap.xml'),
  });

const runPages = (dirs) => run(PAGES_SCRIPT, { ...dirs, buildDir: makeBuildDir() });

describe('a published article left behind in the draft directory', () => {
  const dirs = () => ({
    contentDir: makeDir('cli-content-', {
      'live-post.json': article({ slug: 'live-post' }),
    }),
    draftDir: makeDir('cli-drafts-', {
      'forgotten.json': article({ slug: 'forgotten', status: PUBLISHED }),
    }),
  });

  it('makes generate-sitemap.js exit nonzero', () => {
    const { status, output } = runSitemap(dirs());

    expect(status).not.toBe(0);
    expect(status).toBe(1);
    expect(output).toMatch(/Sitemap generation failed/);
    expect(output).toMatch(/requires "draft"/);
  }, 30000);

  it('makes generate-article-pages.js exit nonzero', () => {
    const { status, output } = runPages(dirs());

    expect(status).not.toBe(0);
    expect(status).toBe(1);
    expect(output).toMatch(/Article page generation failed/);
    expect(output).toMatch(/requires "draft"/);
  }, 30000);

  it('does not write a sitemap when it fails', () => {
    const outDir = makeDir('cli-out-');
    const outPath = path.join(outDir, 'sitemap.xml');

    const { status } = run(SITEMAP_SCRIPT, { ...dirs(), sitemapOut: outPath });

    expect(status).toBe(1);
    expect(fs.existsSync(outPath)).toBe(false);
  }, 30000);

  it('does not write any page shells when it fails', () => {
    const buildDir = makeBuildDir();

    const { status } = run(PAGES_SCRIPT, { ...dirs(), buildDir });

    expect(status).toBe(1);
    expect(fs.existsSync(path.join(buildDir, 'news'))).toBe(false);
  }, 30000);
});

describe('a draft left behind in the published directory', () => {
  const dirs = () => ({
    contentDir: makeDir('cli-content-', {
      'sneaky.json': article({ slug: 'sneaky', status: DRAFT }),
    }),
    draftDir: makeDir('cli-drafts-'),
  });

  it('makes generate-sitemap.js exit nonzero', () => {
    const { status, output } = runSitemap(dirs());

    expect(status).toBe(1);
    expect(output).toMatch(/requires "published"/);
  }, 30000);

  it('makes generate-article-pages.js exit nonzero', () => {
    const { status, output } = runPages(dirs());

    expect(status).toBe(1);
    expect(output).toMatch(/requires "published"/);
  }, 30000);
});

// The other half of the contract: authoring work in progress must not be able to
// block a release, or nobody will keep drafts in the repository.
describe('an invalid draft that is genuinely marked draft', () => {
  const dirs = () => ({
    contentDir: makeDir('cli-content-', {
      'live-post.json': article({ slug: 'live-post' }),
    }),
    draftDir: makeDir('cli-drafts-', {
      'wip.json': article({ slug: 'wip', status: DRAFT, publishedAt: '2026-02-30' }),
    }),
  });

  it('lets generate-sitemap.js exit 0, with a warning', () => {
    const { status, output } = runSitemap(dirs());

    expect(status).toBe(0);
    expect(output).toMatch(/draft article\(s\) are invalid and were skipped/);
    expect(output).toMatch(/Generated sitemap/);
  }, 30000);

  it('lets generate-article-pages.js exit 0, with a warning', () => {
    const { status, output } = runPages(dirs());

    expect(status).toBe(0);
    expect(output).toMatch(/draft article\(s\) are invalid and were skipped/);
    expect(output).toMatch(/Generated \d+ static news page\(s\)/);
  }, 30000);
});

// Positive control. Without this, every assertion above could be passing because
// the scripts fail for some unrelated reason, such as a bad fixture path.
describe('valid content in the right directories', () => {
  const dirs = () => ({
    contentDir: makeDir('cli-content-', {
      'example-article.json': article(),
    }),
    draftDir: makeDir('cli-drafts-', {
      'pending.json': article({ slug: 'pending', status: DRAFT }),
    }),
  });

  it('lets generate-sitemap.js exit 0', () => {
    const { status, output } = runSitemap(dirs());

    expect(status).toBe(0);
    expect(output).toMatch(/1 published news articles/);
  }, 30000);

  it('lets generate-article-pages.js exit 0 and skip the draft', () => {
    const { status, output } = runPages(dirs());

    expect(status).toBe(0);
    expect(output).toMatch(/skipped 1 draft\(s\): pending/);
  }, 30000);

  it('writes the sitemap and the page shells', () => {
    const outDir = makeDir('cli-out-');
    const outPath = path.join(outDir, 'sitemap.xml');
    const buildDir = makeBuildDir();
    const fixtures = dirs();

    expect(run(SITEMAP_SCRIPT, { ...fixtures, sitemapOut: outPath }).status).toBe(0);
    expect(run(PAGES_SCRIPT, { ...fixtures, buildDir }).status).toBe(0);

    expect(fs.readFileSync(outPath, 'utf8')).toContain('/news/example-article');
    expect(fs.existsSync(path.join(buildDir, 'news', 'index.html'))).toBe(true);
    expect(
      fs.existsSync(path.join(buildDir, 'news', 'example-article', 'index.html'))
    ).toBe(true);
    expect(fs.existsSync(path.join(buildDir, 'news', 'pending'))).toBe(false);
  }, 30000);
});
