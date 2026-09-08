import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewsIndex from './NewsIndex';
import { getAllArticles } from '../services/newsArticleService';

const renderIndex = (props = {}) =>
  render(
    <MemoryRouter>
      <NewsIndex {...props} />
    </MemoryRouter>
  );

describe('NewsIndex article cards', () => {
  it('renders a card for every article', () => {
    renderIndex();

    const articles = getAllArticles();
    const cards = screen.getAllByRole('article');

    expect(cards).toHaveLength(articles.length);
  });

  it('shows title, date, excerpt, category, tags and reading time on a card', () => {
    const article = getAllArticles().find(
      (a) => a.slug === '2026-bowman-chrome-baseball-budget-guide'
    );

    renderIndex({ articles: [article] });

    const card = screen.getByRole('article');

    expect(within(card).getByRole('link', { name: article.title })).toBeInTheDocument();
    expect(within(card).getByText('September 7, 2026')).toBeInTheDocument();
    expect(within(card).getByText(article.excerpt)).toBeInTheDocument();
    expect(within(card).getByText('Collecting Guides')).toBeInTheDocument();
    expect(within(card).getByText('6 min read')).toBeInTheDocument();

    article.tags.forEach((tag) => {
      expect(within(card).getByText(tag)).toBeInTheDocument();
    });
  });

  it('links each card to the article route', () => {
    renderIndex();

    getAllArticles().forEach((article) => {
      const readLink = screen.getByRole('link', {
        name: `Read Article: ${article.title}`,
      });
      expect(readLink).toHaveAttribute('href', `/news/${article.slug}`);
    });
  });

  it('renders cards in newest-first order', () => {
    renderIndex();

    const renderedTitles = screen
      .getAllByRole('article')
      .map((card) => within(card).getByRole('heading', { level: 3 }).textContent);

    expect(renderedTitles).toEqual(getAllArticles().map((a) => a.title));
  });

  it('marks the newest featured article as featured', () => {
    renderIndex();

    expect(screen.getAllByText('FEATURED')).toHaveLength(1);

    const featuredCard = screen.getAllByRole('article')[0];
    expect(within(featuredCard).getByText('FEATURED')).toBeInTheDocument();
  });

  it('shows an empty state instead of crashing when no articles load', () => {
    renderIndex({ articles: [] });

    expect(screen.getByText(/No articles published yet/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('always renders the Industry News heading', () => {
    renderIndex();

    expect(screen.getByText(/Industry News & Analysis/i)).toBeInTheDocument();
  });
});
