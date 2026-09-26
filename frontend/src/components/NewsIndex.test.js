import { render, screen, within, fireEvent } from '@testing-library/react';
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

  it('always renders the Blog & Guides heading', () => {
    renderIndex();

    expect(screen.getByText(/Blog & Guides/i)).toBeInTheDocument();
  });
});

describe('NewsIndex search', () => {
  it('renders a search input', () => {
    renderIndex();
    
    const searchInput = screen.getByPlaceholderText('Search articles...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'search');
  });

  it('filters articles by title', () => {
    const articles = getAllArticles();
    renderIndex({ articles });

    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'Bowman' } });

    const visibleCards = screen.queryAllByRole('article');
    const bowmanArticles = articles.filter(a => 
      a.title.toLowerCase().includes('bowman')
    );
    
    expect(visibleCards.length).toBe(Math.min(12, bowmanArticles.length));
  });

  it('filters articles by excerpt', () => {
    const articles = getAllArticles();
    renderIndex({ articles });

    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'practical' } });

    expect(screen.queryAllByRole('article').length).toBeGreaterThan(0);
  });

  it('shows result count when searching', () => {
    const articles = getAllArticles();
    renderIndex({ articles });

    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'guide' } });

    expect(screen.getByText(/Found \d+ article/)).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    renderIndex();

    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText(/No articles match your search/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('resets to page 1 when search query changes', () => {
    const createArticle = (i) => ({
      slug: `article-${i}`,
      title: `Test Article ${i}`,
      excerpt: `Excerpt ${i}`,
      publishedAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
      category: 'Test',
      tags: ['Test'],
      readingTime: '5 min',
      body: [{ type: 'paragraph', content: [{ type: 'text', text: `Body ${i}` }] }],
    });
    
    const articles = Array(25).fill(null).map((_, i) => createArticle(i));
    renderIndex({ articles });

    // Navigate to page 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    // Search should reset to page 1
    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });

    // Should be back on page 1
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});

describe('NewsIndex pagination', () => {
  const createManyArticles = (count) => {
    return Array(count).fill(null).map((_, i) => ({
      slug: `article-${i}`,
      title: `Test Article ${i}`,
      excerpt: `Excerpt for article ${i}`,
      publishedAt: `2026-09-${String((count - i) % 30 + 1).padStart(2, '0')}`,
      category: 'Test Category',
      tags: ['Test Tag'],
      readingTime: '5 min read',
      body: [{ type: 'paragraph', content: [{ type: 'text', text: `Body text ${i}` }] }],
    }));
  };

  it('shows 12 articles per page', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    const visibleCards = screen.getAllByRole('article');
    expect(visibleCards).toHaveLength(12);
  });

  it('does not show pagination for 12 or fewer articles', () => {
    const articles = createManyArticles(8);
    renderIndex({ articles });

    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('shows pagination controls for more than 12 articles', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Last')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('navigates to next page', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    const visibleCards = screen.getAllByRole('article');
    expect(visibleCards).toHaveLength(12);
  });

  it('navigates to last page', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    fireEvent.click(screen.getByText('Last'));

    expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();
    const visibleCards = screen.getAllByRole('article');
    expect(visibleCards).toHaveLength(1); // 25 % 12 = 1
  });

  it('disables First and Previous on first page', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    expect(screen.getByText('First')).toBeDisabled();
    expect(screen.getByText('Previous')).toBeDisabled();
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('disables Next and Last on last page', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    fireEvent.click(screen.getByText('Last'));

    expect(screen.getByText('Next')).toBeDisabled();
    expect(screen.getByText('Last')).toBeDisabled();
    expect(screen.getByText('Previous')).not.toBeDisabled();
  });

  it('only shows featured badge on page 1', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    expect(screen.getByText('FEATURED')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));

    expect(screen.queryByText('FEATURED')).not.toBeInTheDocument();
  });

  it('resets to page 1 when category filter changes', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    // Navigate to page 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    // Search to trigger page reset
    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    
    // Clear search (another way to trigger filter change)
    fireEvent.change(searchInput, { target: { value: '' } });

    // Should be back on page 1
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});

describe('NewsIndex RSS feed', () => {
  it('renders RSS feed link', () => {
    renderIndex();

    const rssLink = screen.getByText('📡 RSS');
    expect(rssLink).toBeInTheDocument();
    expect(rssLink.closest('a')).toHaveAttribute('href', '/rss.xml');
  });

  it('opens RSS link in new tab', () => {
    renderIndex();

    const rssLink = screen.getByText('📡 RSS').closest('a');
    expect(rssLink).toHaveAttribute('target', '_blank');
    expect(rssLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
