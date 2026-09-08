// Proves unapproved article text cannot reach the public JavaScript bundle.
//
// The leak these tests lock down, in full: article discovery uses Webpack's
// `require.context(dir)`, which is resolved at *build* time and bundles every
// file matching the pattern. While drafts lived in src/content/news beside the
// published articles, their entire contents -- title, excerpt, body, meta
// description -- were compiled into a public lazy chunk and served to anyone who
// opened it. This was reproduced by adding a draft with a unique marker, running
// `npm run build`, and finding the marker in static/js/*.chunk.js. Filtering by
// `status` at runtime cannot fix it, because the bytes have already shipped.
//
// The fix is physical, not conditional: drafts live in
// frontend/content/news-drafts, outside src, which Webpack has no path to. These
// tests assert that separation structurally rather than by behaviour, because
// behaviour tests cannot see what a bundler included.
//
// The runtime half of the story (a draft that slips into the published directory
// renders nowhere) is in components/newsDraftExclusion.test.js. The build half
// (no draft page, sitemap entry or bundle text) is in newsContentBuild.test.js
// and the draft-leak build check.

const fs = require('fs');
const path = require('path');

const { DRAFT, PUBLISHED, validateArticle } = require('./newsArticleSchema');

const SRC_DIR = path.join(__dirname, '..');
const SERVICES_DIR = __dirname;

// Assembled rather than written literally so the source scan below does not
// match this test file's own text if the exclusions are ever loosened.
const DRAFT_DIR_NAME = ['news', 'drafts'].join('-');

const PUBLISHED_DIR = path.join(SRC_DIR, 'content', 'news');
const DRAFT_DIR = path.join(SRC_DIR, '..', 'content', DRAFT_DIR_NAME);

const read = (file) => fs.readFileSync(file, 'utf8');

/**
 * Source with comments removed.
 *
 * These files *describe* the draft directory at length -- that documentation is
 * the point, and it must not be what trips the scan. What matters is whether any
 * executable line reaches for the directory, so comments are stripped before
 * looking.
 */
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** Module specifiers a file actually imports or requires. */
const moduleSpecifiers = (source) => {
  const code = codeOnly(source);
  const patterns = [
    /require\.context\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  return patterns.flatMap((pattern) => [...code.matchAll(pattern)].map((m) => m[1]));
};

const BROWSER_CONTEXT = read(path.join(SERVICES_DIR, 'newsArticleContext.js'));
const NODE_CONTEXT = read(path.join(SERVICES_DIR, 'newsArticleContext.node.js'));
const SERVICE = read(path.join(SERVICES_DIR, 'newsArticleService.js'));

/** Every source file that can end up in the browser bundle. */
const bundledSourceFiles = () => {
  const found = [];

  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        return;
      }
      // Test files are not part of a production build, and they legitimately
      // need to name the draft directory in order to test it.
      if (/\.test\.(js|jsx)$/.test(entry.name)) return;
      if (/\.(js|jsx|json)$/.test(entry.name)) found.push(full);
    });
  };

  walk(SRC_DIR);
  return found;
};

const article = (overrides = {}) => ({
  slug: 'contract-article',
  status: PUBLISHED,
  title: 'Contract Article',
  excerpt: 'An article used to exercise the directory contract.',
  publishedAt: '2026-03-03',
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example'],
  readingTime: '3 min read',
  metaTitle: 'Contract Article | Scorecard',
  metaDescription: 'Meta description.',
  body: [{ type: 'paragraph', content: 'Body copy.' }],
  ...overrides,
});

describe('the browser content context', () => {
  it('points require.context at the published directory only', () => {
    const calls = [...BROWSER_CONTEXT.matchAll(/require\.context\(\s*'([^']+)'/g)].map(
      (m) => m[1]
    );

    expect(calls).toEqual(['../content/news']);
  });

  it('never loads anything from the draft directory', () => {
    // The files explain the split in comments, which is deliberate; what must
    // not exist is an import or require that reaches the directory.
    [BROWSER_CONTEXT, NODE_CONTEXT].forEach((source) => {
      expect(codeOnly(source)).not.toContain(DRAFT_DIR_NAME);
      expect(moduleSpecifiers(source).filter((s) => s.includes(DRAFT_DIR_NAME))).toEqual(
        []
      );
    });
  });

  it('reaches outside src for nothing at all', () => {
    // `../content/news` stays inside src. A context argument starting with
    // ../.. would escape src and could pull the draft directory into the bundle.
    const escaping = [...BROWSER_CONTEXT.matchAll(/require\.context\(\s*'([^']+)'/g)]
      .map((m) => m[1])
      .filter((dir) => dir.startsWith('../../'));

    expect(escaping).toEqual([]);
  });

  it('is the Jest stand-in for the same directory, so tests share the blind spot', () => {
    const { CONTENT_DIR, loadRawArticles } = require('./newsArticleContext');

    expect(path.resolve(CONTENT_DIR)).toBe(path.resolve(PUBLISHED_DIR));
    expect(loadRawArticles().length).toBeGreaterThanOrEqual(3);
  });
});

describe('no bundled source file can reach the drafts', () => {
  it('finds source files to scan', () => {
    // Guards the scan below against silently passing on an empty list.
    expect(bundledSourceFiles().length).toBeGreaterThan(20);
  });

  it('has no executable line naming the draft directory', () => {
    const offenders = bundledSourceFiles()
      .filter((file) => codeOnly(read(file)).includes(DRAFT_DIR_NAME))
      .map((file) => path.relative(SRC_DIR, file).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });

  it('imports or requires nothing that resolves outside src/content', () => {
    // The tighter version of the rule: no module specifier anywhere under src
    // points at the draft directory, so Webpack has no edge to follow to it.
    const offenders = bundledSourceFiles()
      .filter((file) => /\.jsx?$/.test(file))
      .flatMap((file) =>
        moduleSpecifiers(read(file))
          .filter((spec) => spec.includes(DRAFT_DIR_NAME))
          .map((spec) => `${path.relative(SRC_DIR, file).replace(/\\/g, '/')} -> ${spec}`)
      );

    expect(offenders).toEqual([]);
  });

  it('has no draft JSON file inside src', () => {
    const strays = bundledSourceFiles()
      .filter((file) => file.endsWith('.json'))
      .filter((file) => {
        try {
          return JSON.parse(read(file)).status === DRAFT;
        } catch {
          return false;
        }
      })
      .map((file) => path.relative(SRC_DIR, file).replace(/\\/g, '/'));

    expect(strays).toEqual([]);
  });
});

describe('the draft directory itself', () => {
  it('lives outside src, where Webpack cannot follow', () => {
    const resolvedSrc = path.resolve(SRC_DIR);
    const resolvedDrafts = path.resolve(DRAFT_DIR);

    expect(resolvedDrafts.startsWith(resolvedSrc + path.sep)).toBe(false);
    expect(fs.existsSync(resolvedDrafts)).toBe(true);
  });

  it('documents the approval workflow for whoever moves a file', () => {
    const readme = read(path.join(DRAFT_DIR, 'README.md'));

    expect(readme).toMatch(/require\.context/);
    expect(readme).toMatch(/src[/\\]content[/\\]news/);
    expect(readme).toMatch(/published/);
  });
});

describe('the browser service exposes no draft API', () => {
  it('has no getDraftArticles export', () => {
    const service = require('./newsArticleService');

    expect(service.getDraftArticles).toBeUndefined();
    expect(SERVICE).not.toMatch(/export function getDraftArticles/);
  });

  it('explains why draft inspection is Node-side only', () => {
    expect(SERVICE).toMatch(/list-news-drafts/);
  });
});

describe('the directory/status contract', () => {
  it('accepts a published article in the published directory', () => {
    const { article: parsed, errors } = validateArticle(
      article(),
      'contract-article.json',
      PUBLISHED
    );

    expect(errors).toEqual([]);
    expect(parsed.status).toBe(PUBLISHED);
  });

  it('accepts a draft in the draft directory', () => {
    const { errors } = validateArticle(
      article({ status: DRAFT }),
      'contract-article.json',
      DRAFT
    );

    expect(errors).toEqual([]);
  });

  it('rejects a draft sitting in the published directory', () => {
    const { article: parsed, errors } = validateArticle(
      article({ status: DRAFT }),
      'contract-article.json',
      PUBLISHED
    );

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toMatch(/does not match this directory/);
    expect(errors.join(' ')).toMatch(/requires "published"/);
  });

  it('rejects a published article sitting in the draft directory', () => {
    const { article: parsed, errors } = validateArticle(
      article({ status: PUBLISHED }),
      'contract-article.json',
      DRAFT
    );

    expect(parsed).toBeNull();
    expect(errors.join(' ')).toMatch(/does not match this directory/);
    expect(errors.join(' ')).toMatch(/requires "draft"/);
  });

  it('still requires an explicit status when no directory is given', () => {
    const { errors } = validateArticle(
      article({ status: undefined }),
      'contract-article.json'
    );

    expect(errors.join(' ')).toMatch(/status is required/);
  });
});
