import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import NewsArticlePage from './NewsArticlePage';

// getAllArticles/getArticleBySlug read the real content files. Only
// getArticleBySlug is wrapped so a single test can vary the updated date.
jest.mock('../services/newsArticleService', () => {
  const actual = jest.requireActual('../services/newsArticleService');
  return { ...actual, getArticleBySlug: jest.fn() };
});

const articleService = require('../services/newsArticleService');
const actualService = jest.requireActual('../services/newsArticleService');

const BOWMAN_SLUG = '2026-bowman-chrome-baseball-budget-guide';

beforeEach(() => {
  // CRA enables resetMocks, so the pass-through has to be reinstalled.
  articleService.getArticleBySlug.mockImplementation(actualService.getArticleBySlug);
});

const renderArticleRoute = (slug) =>
  render(
    <MemoryRouter initialEntries={[`/news/${slug}`]}>
      <Routes>
        <Route path="/news/:slug" element={<NewsArticlePage />} />
      </Routes>
    </MemoryRouter>
  );

const meta = (key, value) =>
  (Helmet.peek().metaTags || []).find((tag) => tag[key] === value);

describe('rendering the Bowman Chrome article', () => {
  it('renders the title, byline and dates', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "2026 Bowman Chrome Baseball: A Budget Collector's Guide",
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/September 7, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/By ManCave Sports Cards LLC/)).toBeInTheDocument();
    expect(screen.getByText('6 min read')).toBeInTheDocument();
    expect(screen.getByText('Collecting Guides')).toBeInTheDocument();
  });

  it('renders the category and every tag', () => {
    renderArticleRoute(BOWMAN_SLUG);

    ['Bowman Chrome', 'Set Building', 'Budget Collecting', '1st Bowman Cards'].forEach(
      (tag) => expect(screen.getByText(tag)).toBeInTheDocument()
    );
  });

  it('preserves the approved article wording', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(
      screen.getByText(/2026 Bowman Chrome Baseball arrives on September 9/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Why Buying Singles May Be the Better Value' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Be patient, use completed sales, and collect with a plan\./)
    ).toBeInTheDocument();
  });

  it('renders the ordered release-week plan and the unordered goal list', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(
      screen.getByText('Download the official checklist and mark the cards you want.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Complete the 100-card major-league base set')
    ).toBeInTheDocument();
  });

  it('renders inline links safely, without raw HTML', () => {
    renderArticleRoute(BOWMAN_SLUG);

    const toppsLink = screen.getByRole('link', {
      name: 'official Topps product information',
    });

    expect(toppsLink).toHaveAttribute(
      'href',
      'https://www.topps.com/pages/bowman-chrome-baseball'
    );
    expect(toppsLink).toHaveAttribute('target', '_blank');
    expect(toppsLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders a Sources section with both approved source links', () => {
    renderArticleRoute(BOWMAN_SLUG);

    const sourcesHeading = screen.getByRole('heading', { name: 'Sources' });
    const sources = sourcesHeading.parentElement;

    const toppsSource = within(sources).getByRole('link', {
      name: 'Official Topps Bowman Chrome Baseball product information',
    });
    const ebaySource = within(sources).getByRole('link', {
      name: 'eBay Trading Card Price Guide',
    });

    expect(toppsSource).toHaveAttribute('rel', 'noopener noreferrer');
    expect(ebaySource).toHaveAttribute('href', 'https://pages.ebay.com/price-guide/');
  });

  it('links back to Industry News', () => {
    renderArticleRoute(BOWMAN_SLUG);

    const backLinks = screen.getAllByRole('link', { name: /Back to Industry News/ });

    expect(backLinks.length).toBeGreaterThan(0);
    expect(backLinks[0]).toHaveAttribute('href', '/news?tab=news');
  });

  it('omits the updated date when it matches the publication date', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it('shows the updated date when it differs from the publication date', () => {
    articleService.getArticleBySlug.mockReturnValue({
      ...actualService.getArticleBySlug(BOWMAN_SLUG),
      updatedAt: '2026-09-20',
    });

    renderArticleRoute(BOWMAN_SLUG);

    expect(screen.getByText(/September 20, 2026/)).toBeInTheDocument();
  });
});

describe('article-specific SEO metadata', () => {
  it('sets the article title and description', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(Helmet.peek().title).toBe(
      '2026 Bowman Chrome Baseball Budget Collector Guide | Scorecard'
    );
    expect(meta('name', 'description').content).toMatch(
      /2026 Bowman Chrome Baseball arrives September 9/
    );
  });

  it('uses the production domain for the canonical URL', () => {
    renderArticleRoute(BOWMAN_SLUG);

    const canonical = (Helmet.peek().linkTags || []).find(
      (tag) => tag.rel === 'canonical'
    );

    expect(canonical.href).toBe(
      `https://www.mancavesportscardsllc.com/news/${BOWMAN_SLUG}`
    );
    expect(canonical.href).not.toMatch(/railway\.app/);
  });

  it('sets Open Graph and Twitter card metadata', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(meta('property', 'og:type').content).toBe('article');
    expect(meta('property', 'og:title').content).toBe(
      "2026 Bowman Chrome Baseball: A Budget Collector's Guide"
    );
    expect(meta('property', 'og:url').content).toBe(
      `https://www.mancavesportscardsllc.com/news/${BOWMAN_SLUG}`
    );
    expect(meta('name', 'twitter:card').content).toBe('summary_large_image');
    expect(meta('name', 'twitter:title').content).toBeTruthy();
    expect(meta('name', 'twitter:description').content).toBeTruthy();
  });

  it('sets article publication, modification, section and tag metadata', () => {
    renderArticleRoute(BOWMAN_SLUG);

    expect(meta('property', 'article:published_time').content).toBe(
      '2026-09-07T00:00:00.000Z'
    );
    expect(meta('property', 'article:modified_time').content).toBe(
      '2026-09-07T00:00:00.000Z'
    );
    expect(meta('property', 'article:section').content).toBe('Collecting Guides');

    const tags = (Helmet.peek().metaTags || [])
      .filter((tag) => tag.property === 'article:tag')
      .map((tag) => tag.content);

    expect(tags).toEqual(
      expect.arrayContaining(['Bowman Chrome', 'Set Building', '1st Bowman Cards'])
    );
  });

  it('emits BlogPosting JSON-LD structured data', () => {
    renderArticleRoute(BOWMAN_SLUG);

    const script = (Helmet.peek().scriptTags || []).find(
      (tag) => tag.type === 'application/ld+json'
    );
    const data = JSON.parse(script.innerHTML);

    expect(data['@type']).toBe('BlogPosting');
    expect(data.headline).toBe(
      "2026 Bowman Chrome Baseball: A Budget Collector's Guide"
    );
    expect(data.url).toBe(
      `https://www.mancavesportscardsllc.com/news/${BOWMAN_SLUG}`
    );
    expect(data.datePublished).toBe('2026-09-07T00:00:00.000Z');
    expect(data.dateModified).toBe('2026-09-07T00:00:00.000Z');
    expect(data.articleSection).toBe('Collecting Guides');
    expect(data.author.name).toBe('ManCave Sports Cards LLC');
  });

  it('gives each article a distinct title and canonical URL', () => {
    renderArticleRoute(BOWMAN_SLUG);
    const firstTitle = Helmet.peek().title;

    renderArticleRoute('the-national-2025-why-every-collector-should-be-watching');
    const secondTitle = Helmet.peek().title;

    expect(secondTitle).toBe(
      'The National 2025: Why Every Collector Should Be Watching | Scorecard'
    );
    expect(secondTitle).not.toBe(firstTitle);
  });
});

describe('invalid slug', () => {
  it('renders a useful not-found experience instead of crashing', () => {
    renderArticleRoute('no-such-article');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Article Not Found' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse Industry News' })).toHaveAttribute(
      'href',
      '/news?tab=news'
    );
  });

  it('marks the not-found page noindex', () => {
    renderArticleRoute('no-such-article');

    expect(Helmet.peek().title).toBe('Article Not Found | Scorecard');
    expect(meta('name', 'robots').content).toBe('noindex, follow');
  });
});
