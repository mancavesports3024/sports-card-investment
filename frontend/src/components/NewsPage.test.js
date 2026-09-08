import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NewsPage from './NewsPage';
import { getAllArticles } from '../services/newsArticleService';
import { buildNewsIndexSeo } from '../services/newsArticleSeo';

// The Release Calendar and Trending tabs both fetch on mount. Letting those
// promises settle inside act() is what keeps the output free of "an update was
// not wrapped in act(...)" warnings.
const flushRequests = () => act(async () => {});

const renderNewsPage = async (initialEntry = '/news') => {
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NewsPage />
    </MemoryRouter>
  );

  await flushRequests();

  return result;
};

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, releases: [], data: [] }),
    })
  );
});

describe('the three News tabs are preserved', () => {
  it('renders Release Calendar, Industry News and Trending tabs', async () => {
    await renderNewsPage();

    const tabs = screen.getAllByRole('tab');

    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Release Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Industry News/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Trending/ })).toBeInTheDocument();
  });

  it('shows the Release Calendar by default', async () => {
    await renderNewsPage();

    expect(screen.getByRole('tab', { name: /Release Calendar/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(/Card Release Calendar/)).toBeInTheDocument();
  });

  it('keeps the Release Calendar working', async () => {
    await renderNewsPage();

    // The calendar grid renders once the releases request settles.
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });

  it('keeps the Trending tab and its sub-tabs working', async () => {
    await renderNewsPage();

    await userEvent.click(screen.getByRole('tab', { name: /Trending/ }));
    await flushRequests();

    expect(screen.getByRole('tab', { name: /Trending/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('button', { name: /Players/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sets/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cards/ })).toBeInTheDocument();
  });
});

describe('Industry News tab', () => {
  it('lists article cards when selected', async () => {
    await renderNewsPage();

    await userEvent.click(screen.getByRole('tab', { name: /Industry News/ }));

    expect(screen.getAllByRole('article')).toHaveLength(getAllArticles().length);
    expect(
      screen.getByRole('link', {
        name: "2026 Bowman Chrome Baseball: A Budget Collector's Guide",
      })
    ).toBeInTheDocument();
  });

  it('can be deep-linked with ?tab=news so article pages can link back', async () => {
    await renderNewsPage('/news?tab=news');

    expect(screen.getByRole('tab', { name: /Industry News/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('no longer contains article bodies in the page itself', async () => {
    await renderNewsPage();

    await userEvent.click(screen.getByRole('tab', { name: /Industry News/ }));

    // Body copy lives on /news/:slug now; the index shows excerpts only.
    expect(
      screen.queryByText(/Prospecting can be fun, but predicting which young players/)
    ).not.toBeInTheDocument();
  });

  it('lists only published articles', async () => {
    await renderNewsPage('/news?tab=news');

    // Drafts live outside src and are not in the bundle at all, so there is no
    // draft list to compare against here. Injecting one is the job of
    // newsDraftExclusion.test.js; this asserts the index is driven by the
    // published-only accessor and renders exactly those articles.
    expect(screen.getAllByRole('article')).toHaveLength(getAllArticles().length);
  });
});

describe('News index metadata', () => {
  it('is general News-page metadata rather than the newest article', async () => {
    const { Helmet } = require('react-helmet');

    await renderNewsPage();

    expect(Helmet.peek().title).toBe(
      'Sports Card News, Releases & Market Insights | Scorecard'
    );

    const canonical = (Helmet.peek().linkTags || []).find(
      (tag) => tag.rel === 'canonical'
    );
    expect(canonical.href).toBe('https://www.mancavesportscardsllc.com/news');

    const ogType = (Helmet.peek().metaTags || []).find(
      (tag) => tag.property === 'og:type'
    );
    expect(ogType.content).toBe('website');
  });

  it('lists only published articles in the CollectionPage structured data', async () => {
    const { Helmet } = require('react-helmet');

    await renderNewsPage();

    const script = (Helmet.peek().scriptTags || []).find(
      (tag) => tag.type === 'application/ld+json'
    );
    const data = JSON.parse(script.innerHTML);
    const listedUrls = data.mainEntity.itemListElement.map((item) => item.url);

    expect(data['@type']).toBe('CollectionPage');
    expect(listedUrls).toHaveLength(getAllArticles().length);

    getAllArticles().forEach((article) => {
      expect(listedUrls).toContain(
        `https://www.mancavesportscardsllc.com/news/${article.slug}`
      );
    });
  });
});

// The static build/news/index.html shell is serialised from buildNewsIndexSeo
// by backend/generate-article-pages.js. If this component ever went back to
// hard-coding its own tags, the raw HTML a crawler sees and the hydrated DOM
// would drift apart silently -- which is exactly what happened before the shell
// existed. These assertions tie the two to the one descriptor.
describe('the News index metadata comes from the shared descriptor', () => {
  it('renders exactly the descriptor title and canonical', async () => {
    const { Helmet } = require('react-helmet');
    const seo = buildNewsIndexSeo(getAllArticles());

    await renderNewsPage();

    expect(Helmet.peek().title).toBe(seo.title);

    const canonical = (Helmet.peek().linkTags || []).find((tag) => tag.rel === 'canonical');
    expect(canonical.href).toBe(seo.canonical);
  });

  it('renders every meta tag the descriptor declares, with matching values', async () => {
    const { Helmet } = require('react-helmet');
    const seo = buildNewsIndexSeo(getAllArticles());

    await renderNewsPage();

    const rendered = Helmet.peek().metaTags || [];

    seo.meta.forEach((tag) => {
      const key = tag.name !== undefined ? 'name' : 'property';
      const match = rendered.find((r) => r[key] === tag[key]);

      expect(match).toBeDefined();
      expect(match.content).toBe(tag.content);
    });
  });

  it('renders the descriptor JSON-LD verbatim', async () => {
    const { Helmet } = require('react-helmet');
    const seo = buildNewsIndexSeo(getAllArticles());

    await renderNewsPage();

    const script = (Helmet.peek().scriptTags || []).find(
      (tag) => tag.type === 'application/ld+json'
    );

    expect(JSON.parse(script.innerHTML)).toEqual(seo.jsonLd);
  });

  it('does not hard-code the metadata in the component', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, 'NewsPage.js'), 'utf8');

    expect(source).toContain('buildNewsIndexSeo');
    expect(source).not.toContain('CollectionPage');
    expect(source).not.toContain('og:site_name');
  });
});
