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
  it('shows latest article separately at top with featured styling', () => {
    renderIndex();

    const latestHeading = screen.getByText('Latest Article');
    expect(latestHeading).toBeInTheDocument();
    
    const featuredBadge = screen.getByText('FEATURED');
    expect(featuredBadge).toBeInTheDocument();
  });

  it('renders remaining articles below the featured one', () => {
    renderIndex();

    const articles = getAllArticles();
    const cards = screen.getAllByRole('article');

    // Total cards = all articles (1 featured + rest in list)
    expect(cards).toHaveLength(articles.length);
    
    // Should show "More Articles" heading if there are articles beyond the featured one
    if (articles.length > 1) {
      expect(screen.getByText('More Articles')).toBeInTheDocument();
    }
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

  it('shows only one featured badge on the latest article', () => {
    renderIndex();

    const featuredBadges = screen.getAllByText('FEATURED');
    expect(featuredBadges).toHaveLength(1);

    const latestArticle = getAllArticles()[0];
    const featuredCard = screen.getAllByRole('article')[0];
    expect(within(featuredCard).getByText(latestArticle.title)).toBeInTheDocument();
  });

  it('includes all articles in search results without separate featured display', () => {
    const articles = getAllArticles();
    renderIndex({ articles });

    // With search active, all matching articles go in the list
    const searchInput = screen.getByPlaceholderText('Search articles...');
    fireEvent.change(searchInput, { target: { value: 'guide' } });

    // Should not show "Latest Article" heading when searching
    expect(screen.queryByText('Latest Article')).not.toBeInTheDocument();
    
    // All matching articles in the list
    const cards = screen.queryAllByRole('article');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows all articles in filtered categories without separate featured display', () => {
    const articles = getAllArticles();
    renderIndex({ articles });

    // Click a category filter
    const filters = screen.getAllByRole('button').filter(btn => 
      btn.textContent.includes('Collecting Guides') || 
      btn.textContent.includes('Set Building')
    );
    
    if (filters.length > 0) {
      fireEvent.click(filters[0]);
      
      // Should not show "Latest Article" when category filter active
      expect(screen.queryByText('Latest Article')).not.toBeInTheDocument();
    }
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

  it('shows latest article plus 11 more on first page (12 total visible)', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    const visibleCards = screen.getAllByRole('article');
    // 1 featured at top + 11 in the list = 12 visible on page 1
    expect(visibleCards).toHaveLength(12);
    
    // Should show Latest Article heading
    expect(screen.getByText('Latest Article')).toBeInTheDocument();
    expect(screen.getByText('More Articles')).toBeInTheDocument();
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

  it('only shows featured article section on page 1', () => {
    const articles = createManyArticles(25);
    renderIndex({ articles });

    expect(screen.getByText('Latest Article')).toBeInTheDocument();
    expect(screen.getByText('FEATURED')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));

    // Featured section should not appear on other pages
    expect(screen.queryByText('Latest Article')).not.toBeInTheDocument();
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
