// End-to-end proof that a draft article stays out of every public surface.
//
// This is the second line of defence. The first is physical: drafts live in
// frontend/content/news-drafts, outside src, so Webpack cannot bundle them and
// the components below could not render one even if they tried. These tests
// cover what happens if that separation is subverted -- a draft file placed in
// src/content/news by a half-finished approval move -- and prove it renders
// nowhere.
//
// Sitemap and static-HTML exclusion are covered by
// services/newsContentBuild.test.js; this covers the rendered app.

jest.mock('../services/newsArticleContext', () => ({
  loadRawArticles: jest.fn(),
}));

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import NewsIndex from './NewsIndex';
import NewsPage from './NewsPage';
import NewsArticlePage from './NewsArticlePage';
import { loadRawArticles } from '../services/newsArticleContext';
import {
  getAllArticles,
  getArticleBySlug,
  getArticleLoadErrors,
  resetArticleCache,
} from '../services/newsArticleService';

const article = (overrides = {}) => ({
  slug: 'published-post',
  status: 'published',
  title: 'Published Post',
  excerpt: 'This one is live.',
  publishedAt: '2026-01-01',
  author: 'ManCave Sports Cards LLC',
  category: 'Collecting Guides',
  tags: ['Example'],
  readingTime: '3 min read',
  featured: false,
  metaTitle: 'Published Post | Scorecard',
  metaDescription: 'Description of the published post.',
  sourceLinks: [],
  body: [{ type: 'paragraph', content: 'Body copy.' }],
  ...overrides,
});

const DRAFT_SLUG = 'secret-draft-post';
const DRAFT_TITLE = 'Secret Draft Post';

beforeEach(() => {
  resetArticleCache();

  // The draft is deliberately the newest article, so an ordering bug would
  // surface it at the very top of the index rather than hide it at the bottom.
  loadRawArticles.mockReturnValue([
    { source: 'published-post.json', data: article() },
    {
      source: `${DRAFT_SLUG}.json`,
      data: article({
        slug: DRAFT_SLUG,
        status: 'draft',
        title: DRAFT_TITLE,
        excerpt: 'This one is not ready.',
        publishedAt: '2026-12-25',
        metaTitle: 'Secret Draft Post | Scorecard',
      }),
    },
  ]);

  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, releases: [], data: [] }),
    })
  );
});

describe('the loader itself', () => {
  it('publishes only the published fixture and rejects the misplaced draft', () => {
    expect(getAllArticles().map((a) => a.slug)).toEqual(['published-post']);

    const errors = getArticleLoadErrors();

    expect(errors.map((e) => e.source)).toEqual([`${DRAFT_SLUG}.json`]);
    expect(errors[0].errors.join(' ')).toMatch(/does not match this directory/);
  });
});

describe('the News index', () => {
  it('renders no card for the draft', () => {
    render(
      <MemoryRouter>
        <NewsIndex />
      </MemoryRouter>
    );

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Published Post')).toBeInTheDocument();
    expect(screen.queryByText(DRAFT_TITLE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: `Read Article: ${DRAFT_TITLE}` })
    ).not.toBeInTheDocument();
  });
});

describe('the /news page', () => {
  const renderNewsPage = async () => {
    const result = render(
      <MemoryRouter initialEntries={['/news?tab=news']}>
        <NewsPage />
      </MemoryRouter>
    );
    await act(async () => {});
    return result;
  };

  it('does not list the draft', async () => {
    await renderNewsPage();

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByText(DRAFT_TITLE)).not.toBeInTheDocument();
  });

  it('leaves the draft out of the CollectionPage structured data', async () => {
    await renderNewsPage();

    const script = (Helmet.peek().scriptTags || []).find(
      (tag) => tag.type === 'application/ld+json'
    );
    const data = JSON.parse(script.innerHTML);
    const listed = data.mainEntity.itemListElement;

    expect(data['@type']).toBe('CollectionPage');
    expect(listed).toHaveLength(1);
    expect(listed[0].url).toBe(
      'https://www.mancavesportscardsllc.com/news/published-post'
    );
    expect(JSON.stringify(data)).not.toContain(DRAFT_SLUG);
    expect(JSON.stringify(data)).not.toContain(DRAFT_TITLE);
  });
});

describe('the article route', () => {
  const renderArticleRoute = (slug) =>
    render(
      <MemoryRouter initialEntries={[`/news/${slug}`]}>
        <Routes>
          <Route path="/news/:slug" element={<NewsArticlePage />} />
        </Routes>
      </MemoryRouter>
    );

  it('serves the published article', () => {
    renderArticleRoute('published-post');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Published Post' })
    ).toBeInTheDocument();
  });

  it('treats a draft slug exactly like a typo', () => {
    expect(getArticleBySlug(DRAFT_SLUG)).toBeNull();

    renderArticleRoute(DRAFT_SLUG);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Article Not Found' })
    ).toBeInTheDocument();
    expect(screen.queryByText(DRAFT_TITLE)).not.toBeInTheDocument();
  });

  it('marks the draft URL noindex rather than exposing its metadata', () => {
    renderArticleRoute(DRAFT_SLUG);

    const robots = (Helmet.peek().metaTags || []).find(
      (tag) => tag.name === 'robots'
    );

    expect(Helmet.peek().title).toBe('Article Not Found | Scorecard');
    expect(robots.content).toBe('noindex, follow');
  });
});
