import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NewsPage from './NewsPage';
import { getAllArticles } from '../services/newsArticleService';
import { buildNewsIndexSeo } from '../services/newsArticleSeo';

jest.mock('../services/releaseCalendar', () => ({
  ...jest.requireActual('../services/releaseCalendar'),
  todayInCalendarZone: () => '2026-11-07',
}));

// Let calendar requests settle inside act() before checking the rendered page.
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

describe('separate guides and calendar pages', () => {
  it('opens guides directly without a tab bar or trending requests', async () => {
    await renderNewsPage();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('old trending links now show guides without fetching trends', async () => {
    await renderNewsPage('/news?tab=trending');
    expect(screen.getByRole('heading', { name: 'Collecting Guides' })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the Release Calendar working', async () => {
    await renderNewsPage('/release-calendar');

    // The calendar grid renders once the releases request settles.
    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });

});

describe('Release Calendar data display', () => {
  const releases = [
    { id: 159, title: 'Yu-Gi-Oh! Beyond the Brave', brand: 'Yu-Gi-Oh!', sport: 'Gaming', releaseDate: '2026-10-09', hobbyPrice: null, retailPrice: '$4.49 per pack', status: 'Released' },
    { title: '2026 Topps Chrome Football', brand: 'Topps', sport: 'Football', releaseDate: '2026-11-18', hobbyPrice: '$439.99', retailPrice: null, status: 'Released' },
    { id: 132, title: '2026 Leaf Seasons In The Sun Baseball', brand: 'Leaf', sport: 'Baseball', releaseDate: '2026-08-07', hobbyPrice: null, retailPrice: null, status: 'Released' },
  ];

  const openCalendar = async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, releases, data: [] }) })
    );
    await renderNewsPage('/release-calendar');
    await screen.findByText('November 2026 Releases');
  };

  it('derives status from the date and shows only published prices', async () => {
    await openCalendar();

    expect(screen.getByRole('heading', { name: '2026 Topps Chrome Football' })).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('$439.99')).toBeInTheDocument();
    expect(screen.queryByText('Retail Price:')).not.toBeInTheDocument();
    expect(screen.queryByText('TBD')).not.toBeInTheDocument();
  });

  it('renders a date-only release on its calendar day', async () => {
    await openCalendar();
    await userEvent.click(screen.getByRole('button', { name: '← October' }));

    expect(screen.getByText('Friday, October 9, 2026')).toBeInTheDocument();
    expect(screen.getByText('$4.49 per pack')).toBeInTheDocument();
    expect(screen.queryByText('Hobby Price:')).not.toBeInTheDocument();
  });

  it('keeps releases older than 30 days in the archive', async () => {
    await openCalendar();
    for (const label of ['← October', '← September', '← August']) {
      await userEvent.click(screen.getByRole('button', { name: label }));
    }

    expect(screen.getByText(/No releases for August 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View archive' }));
    expect(screen.getByRole('heading', { name: '2026 Leaf Seasons In The Sun Baseball' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a clear empty-month state', async () => {
    await openCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'December →' }));

    expect(screen.getByText(/No releases for December 2026/)).toBeInTheDocument();
    expect(screen.getByText('No verified release dates are listed for this month yet.')).toBeInTheDocument();
  });
});

describe('Guides page', () => {
  it('lists article cards when selected', async () => {
    await renderNewsPage();


    expect(screen.getAllByRole('article')).toHaveLength(Math.min(12, getAllArticles().length));
    expect(
      screen.getByRole('link', {
        name: getAllArticles()[0].title,
      })
    ).toBeInTheDocument();
  });

  it('can be deep-linked with ?tab=news so article pages can link back', async () => {
    await renderNewsPage('/news?tab=news');

    expect(screen.getByRole('heading', { name: 'Collecting Guides' })).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('no longer contains article bodies in the page itself', async () => {
    await renderNewsPage();


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
    // published-only accessor, with the first page capped at 12 articles.
    expect(screen.getAllByRole('article')).toHaveLength(Math.min(12, getAllArticles().length));
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
