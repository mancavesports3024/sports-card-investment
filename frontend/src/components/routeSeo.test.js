// Proves the hydrated DOM ends up with exactly one of each route-varying tag.
//
// The bug this guards against: public/index.html hard-codes a homepage
// canonical and social tags, and react-helmet only manages its own tags, so
// every route that declared a canonical shipped two of them. Google discards
// all canonical hints when it finds more than one, which quietly nullified the
// article SEO work.
//
// The real index.html head is loaded into jsdom before each render so this
// exercises the actual static tags, not a fixture of them.

import fs from 'fs';
import path from 'path';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DefaultSeo from './DefaultSeo';
import NewsArticlePage from './NewsArticlePage';
import { getArticleBySlug } from '../services/newsArticleService';
import { SITE_DEFAULTS, articleUrl } from '../services/newsArticleSeo';

const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'index.html'),
  'utf8'
);

// The static head exactly as shipped, minus comments and third-party scripts
// (jsdom would only ignore them, and they are not route-varying anyway).
const STATIC_HEAD = INDEX_HTML.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/%PUBLIC_URL%/g, '');

const BOWMAN_SLUG = '2026-bowman-chrome-baseball-budget-guide';

const inHead = (selector) => Array.from(document.head.querySelectorAll(selector));
const contentOf = (selector) => inHead(selector).map((el) => el.getAttribute('content'));
const canonicalHrefs = () =>
  inHead('link[rel="canonical"]').map((el) => el.getAttribute('href'));

/**
 * react-helmet defers its DOM writes to requestAnimationFrame, so the head is
 * still the static markup immediately after render. Flushing a couple of frames
 * makes the assertions deterministic -- waiting on tag *counts* would not,
 * because the static head already contains exactly one of each tag.
 */
const settleHelmet = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 32));
  });
};

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
});

const renderAt = async (initialEntry, element) => {
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DefaultSeo />
      <Routes>{element}</Routes>
    </MemoryRouter>
  );
  await settleHelmet();
  return result;
};

const renderArticle = (slug = BOWMAN_SLUG) =>
  renderAt(`/news/${slug}`, <Route path="/news/:slug" element={<NewsArticlePage />} />);

describe('the static head starts out as the homepage default', () => {
  it('ships a homepage canonical that would otherwise collide', () => {
    expect(canonicalHrefs()).toEqual(['https://www.mancavesportscardsllc.com/']);
  });

  it('marks every route-varying tag as helmet-managed', () => {
    // If a route-varying tag were left unmanaged, helmet could not replace it
    // and the duplicate would come straight back.
    [
      'description',
      'keywords',
      'author',
      'robots',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
    ].forEach((name) => {
      expect(inHead(`meta[name="${name}"]`)).toHaveLength(1);
      expect(inHead(`meta[name="${name}"][data-react-helmet="true"]`)).toHaveLength(1);
    });

    [
      'og:title',
      'og:description',
      'og:type',
      'og:url',
      'og:site_name',
      'og:image',
    ].forEach((property) => {
      expect(inHead(`meta[property="${property}"]`)).toHaveLength(1);
      expect(
        inHead(`meta[property="${property}"][data-react-helmet="true"]`)
      ).toHaveLength(1);
    });

    expect(inHead('link[rel="canonical"][data-react-helmet="true"]')).toHaveLength(1);
  });
});

describe('an article route after React loads', () => {
  it('leaves exactly one canonical, pointing at the article', async () => {
    await renderArticle();

    expect(canonicalHrefs()).toEqual([articleUrl(BOWMAN_SLUG)]);
  });

  it('leaves one effective value for title, description and social tags', async () => {
    const article = getArticleBySlug(BOWMAN_SLUG);

    await renderArticle();

    expect(document.title).toBe(article.metaTitle);
    expect(contentOf('meta[name="description"]')).toEqual([article.metaDescription]);
    expect(contentOf('meta[property="og:title"]')).toEqual([article.title]);
    expect(contentOf('meta[property="og:type"]')).toEqual(['article']);
    expect(contentOf('meta[property="og:url"]')).toEqual([articleUrl(BOWMAN_SLUG)]);
    expect(contentOf('meta[property="og:image"]')).toHaveLength(1);
    expect(contentOf('meta[name="twitter:title"]')).toEqual([article.title]);
    expect(contentOf('meta[name="twitter:description"]')).toEqual([
      article.metaDescription,
    ]);
    expect(contentOf('meta[name="twitter:image"]')).toHaveLength(1);
  });

  it('no longer shows any homepage metadata on the article route', async () => {
    await renderArticle();

    const allContent = contentOf('meta').join(' | ');

    expect(document.title).not.toBe(SITE_DEFAULTS.title);
    expect(allContent).not.toContain(SITE_DEFAULTS.title);
    expect(allContent).not.toContain(SITE_DEFAULTS.description);
    expect(canonicalHrefs()).not.toContain('https://www.mancavesportscardsllc.com/');
  });

  it('emits exactly one BlogPosting JSON-LD block', async () => {
    await renderArticle();

    const scripts = inHead('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);

    const data = JSON.parse(scripts[0].textContent);
    expect(data['@type']).toBe('BlogPosting');
    expect(data.url).toBe(articleUrl(BOWMAN_SLUG));
  });

  it('gives a second article its own canonical, with no leftovers', async () => {
    const slug = 'the-national-2025-why-every-collector-should-be-watching';

    await renderArticle(slug);

    expect(canonicalHrefs()).toEqual([articleUrl(slug)]);
    expect(document.title).toBe(getArticleBySlug(slug).metaTitle);
  });
});

describe('a route with no SEO block of its own', () => {
  it('still gets exactly one canonical, derived from the path', async () => {
    await renderAt('/card-set-analysis', <Route path="/card-set-analysis" element={<div />} />);

    expect(canonicalHrefs()).toEqual([
      'https://www.mancavesportscardsllc.com/card-set-analysis',
    ]);
  });

  it('falls back to the site defaults for the homepage', async () => {
    await renderAt('/', <Route path="/" element={<div />} />);

    expect(canonicalHrefs()).toEqual(['https://www.mancavesportscardsllc.com/']);
    expect(document.title).toBe(SITE_DEFAULTS.title);
    expect(contentOf('meta[name="description"]')).toEqual([SITE_DEFAULTS.description]);
    expect(contentOf('meta[property="og:url"]')).toEqual([
      'https://www.mancavesportscardsllc.com/',
    ]);
  });
});
