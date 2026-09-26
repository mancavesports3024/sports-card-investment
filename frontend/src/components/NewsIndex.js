import React, { useState } from 'react';
import NewsArticleCard from './NewsArticleCard';
import { getAllArticles } from '../services/newsArticleService';

const ARTICLES_PER_PAGE = 12;

function filterArticlesByCategory(articles, categoryFilter) {
  if (categoryFilter === 'all') return articles;
  
  switch (categoryFilter) {
    case 'new-releases':
      return articles.filter(article =>
        article.tags.some(tag => ['Bowman Chrome', '1st Bowman Cards'].includes(tag)) ||
        article.title.toLowerCase().includes('release') ||
        article.title.toLowerCase().includes('2026') ||
        article.title.toLowerCase().includes('2025')
      );
    case 'set-building':
      return articles.filter(article =>
        article.category === 'Set Building' ||
        article.tags.includes('Set Building')
      );
    case 'buying-guides':
      return articles.filter(article =>
        article.category === 'Collecting Guides' ||
        article.tags.some(tag => ['eBay Buying', 'Budget Collecting'].includes(tag))
      );
    case 'selling-ebay':
      return articles.filter(article =>
        article.category === 'eBay Selling' ||
        article.tags.includes('eBay Selling')
      );
    case 'card-identification':
      return articles.filter(article =>
        article.tags.includes('Card Identification') ||
        article.title.toLowerCase().includes('identification') ||
        article.title.toLowerCase().includes('identify')
      );
    default:
      return articles;
  }
}

function searchArticles(articles, searchQuery) {
  if (!searchQuery.trim()) return articles;
  
  const query = searchQuery.toLowerCase().trim();
  
  return articles.filter(article => {
    const titleMatch = article.title.toLowerCase().includes(query);
    const excerptMatch = article.excerpt.toLowerCase().includes(query);
    const categoryMatch = article.category.toLowerCase().includes(query);
    const tagsMatch = article.tags.some(tag => tag.toLowerCase().includes(query));
    
    const bodyMatch = article.body.some(block => {
      if (block.type === 'paragraph' || block.type === 'heading') {
        return block.content.some(inline => 
          inline.type === 'text' && inline.text.toLowerCase().includes(query)
        );
      }
      if (block.type === 'list') {
        return block.items.some(item =>
          item.some(inline =>
            inline.type === 'text' && inline.text.toLowerCase().includes(query)
          )
        );
      }
      return false;
    });
    
    return titleMatch || excerptMatch || categoryMatch || tagsMatch || bodyMatch;
  });
}

const NewsIndex = ({ articles = getAllArticles() }) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const categoryFiltered = filterArticlesByCategory(articles, categoryFilter);
  const searchFiltered = searchArticles(categoryFiltered, searchQuery);
  const sorted = searchFiltered;
  const featuredSlug = sorted[0]?.slug;
  
  const totalPages = Math.ceil(sorted.length / ARTICLES_PER_PAGE);
  const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
  const endIndex = startIndex + ARTICLES_PER_PAGE;
  const paginatedArticles = sorted.slice(startIndex, endIndex);
  
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  
  const handleCategoryChange = (category) => {
    setCategoryFilter(category);
    setCurrentPage(1);
  };
  
  const availableFilters = [
    { key: 'all', label: 'All Articles', count: articles.length },
    { key: 'new-releases', label: 'New Releases', count: filterArticlesByCategory(articles, 'new-releases').length },
    { key: 'set-building', label: 'Set Building', count: filterArticlesByCategory(articles, 'set-building').length },
    { key: 'buying-guides', label: 'Buying Guides', count: filterArticlesByCategory(articles, 'buying-guides').length },
    { key: 'selling-ebay', label: 'Selling on eBay', count: filterArticlesByCategory(articles, 'selling-ebay').length },
    { key: 'card-identification', label: 'Card Identification', count: filterArticlesByCategory(articles, 'card-identification').length },
  ].filter(filter => filter.count > 0);

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
          padding: '1.5rem',
          borderRadius: 12,
          marginBottom: '2rem',
          border: '2px solid #000',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#000', fontSize: '1.2rem', fontWeight: 700 }}>
            📰 Blog &amp; Guides
          </h3>
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#000',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '0.25rem 0.75rem',
              background: 'rgba(0,0,0,0.1)',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title="Subscribe to RSS feed"
          >
            📡 RSS
          </a>
        </div>
        <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
          Read our latest articles on card releases, set building, and practical buying and selling.
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto 1.5rem' }}>
          <input
            type="search"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={handleSearch}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              border: '2px solid #374151',
              borderRadius: 8,
              background: '#1f2937',
              color: '#fff',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#ffd700'}
            onBlur={(e) => e.target.style.borderColor = '#374151'}
          />
          {searchQuery && (
            <div style={{ marginTop: '0.5rem', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' }}>
              Found {sorted.length} article{sorted.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {availableFilters.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {availableFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => handleCategoryChange(filter.key)}
                style={{
                  background: categoryFilter === filter.key ? '#ffd700' : '#374151',
                  color: categoryFilter === filter.key ? '#000' : '#fff',
                  border: categoryFilter === filter.key ? '2px solid #000' : '2px solid #374151',
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (categoryFilter !== filter.key) {
                    e.target.style.background = '#4b5563';
                  }
                }}
                onMouseLeave={(e) => {
                  if (categoryFilter !== filter.key) {
                    e.target.style.background = '#374151';
                  }
                }}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            background: '#1f2937',
            borderRadius: 12,
            padding: '2rem',
            textAlign: 'center',
            border: '2px solid #374151',
          }}
        >
          <div style={{ color: '#ffd700', fontSize: '1.2rem', marginBottom: '1rem' }}>
            📭 {searchQuery ? 'No articles match your search' : categoryFilter === 'all' ? 'No articles published yet' : 'No articles in this category'}
          </div>
          <div style={{ color: '#d1d5db' }}>
            {searchQuery 
              ? 'Try different keywords or clear your search.'
              : categoryFilter === 'all' 
              ? 'Check back soon for new releases and collecting guides.'
              : 'Try a different category or view all articles.'}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '2rem' }}>
            {paginatedArticles.map((article) => (
              <NewsArticleCard
                key={article.slug}
                article={article}
                featured={article.slug === featuredSlug && currentPage === 1}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === 1 ? '#374151' : '#ffd700',
                  color: currentPage === 1 ? '#9ca3af' : '#000',
                  border: 'none',
                  borderRadius: 6,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                First
              </button>
              
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === 1 ? '#374151' : '#ffd700',
                  color: currentPage === 1 ? '#9ca3af' : '#000',
                  border: 'none',
                  borderRadius: 6,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Previous
              </button>
              
              <div style={{ padding: '0.5rem 1rem', color: '#d1d5db', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === totalPages ? '#374151' : '#ffd700',
                  color: currentPage === totalPages ? '#9ca3af' : '#000',
                  border: 'none',
                  borderRadius: 6,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Next
              </button>
              
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  background: currentPage === totalPages ? '#374151' : '#ffd700',
                  color: currentPage === totalPages ? '#9ca3af' : '#000',
                  border: 'none',
                  borderRadius: 6,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Last
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewsIndex;
