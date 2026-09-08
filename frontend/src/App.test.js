import { render, screen, within } from '@testing-library/react';
import App from './App';

// App loads its routes with React.lazy. Importing the article route eagerly
// here puts it in Jest's module cache, so lazy() resolves from cache instead of
// racing a first-time transform of the chunk (which can exceed the default
// 1s findBy timeout when suites run in parallel).
import './components/NewsArticlePage';

// Application smoke test.
//
// Replaces the stale Create React App default test ("renders learn react link"),
// which asserted on text this app has never contained and had been failing on
// every run since the project was scaffolded.
//
// What is worth smoke-testing here is the shell App itself owns: the global
// header, the navigation, the logged-out state, and that the router actually
// resolves a route into a page. Network- and timer-driven children are stubbed
// so the test asserts App's own composition and stays quiet -- FeaturedEbayRotator
// polls on an interval and AdSense talks to a third-party global, neither of
// which App is responsible for.

jest.mock('./services/tokenService', () => ({
  __esModule: true,
  default: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    isTokenExpired: () => true,
    clearTokens: () => {},
    setTokens: () => {},
    validateToken: () => Promise.resolve({ valid: false }),
    refreshToken: () => Promise.resolve(),
  },
}));

jest.mock('./components/FeaturedEbayRotator', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./components/AdSense', () => ({
  __esModule: true,
  default: () => null,
  HeaderAd: () => null,
  SidebarAd: () => null,
  InContentAd: () => null,
  FooterAd: () => null,
  MobileAd: () => null,
  SearchResultsAd: () => null,
}));

const at = (pathname) => {
  window.history.pushState({}, '', pathname);
};

afterEach(() => {
  at('/');
});

describe('application shell', () => {
  it('renders the global header and brand title', () => {
    render(<App />);

    const header = screen.getByRole('banner');

    expect(within(header).getByText('Scorecard')).toBeInTheDocument();
  });

  it('renders the primary navigation', () => {
    render(<App />);

    const header = screen.getByRole('banner');

    ['Home', 'Search Cards', 'Card Set Analysis', 'News', 'eBay Item Lookup'].forEach(
      (label) => {
        expect(within(header).getByRole('link', { name: label })).toBeInTheDocument();
      }
    );

    expect(within(header).getByRole('link', { name: 'News' })).toHaveAttribute(
      'href',
      '/news'
    );
  });

  it('shows the logged-out state and hides admin navigation', () => {
    render(<App />);

    const header = screen.getByRole('banner');

    expect(within(header).getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(
      within(header).queryByRole('button', { name: 'Log out' })
    ).not.toBeInTheDocument();
    expect(within(header).queryByText(/Card Database/)).not.toBeInTheDocument();
    expect(within(header).queryByText(/Collections/)).not.toBeInTheDocument();
  });
});

describe('routing', () => {
  it('renders the home page at /', () => {
    at('/');

    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Why Choose Scorecard?' })
    ).toBeInTheDocument();
  });

  it('resolves a lazily loaded article route to the article page', async () => {
    at('/news/2026-bowman-chrome-baseball-budget-guide');

    render(<App />);

    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: "2026 Bowman Chrome Baseball: A Budget Collector's Guide",
        },
        { timeout: 10000 }
      )
    ).toBeInTheDocument();
  });

  it('renders the not-found experience for an unknown article slug', async () => {
    at('/news/no-such-article');

    render(<App />);

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Article Not Found' },
        { timeout: 10000 }
      )
    ).toBeInTheDocument();
  });
});
