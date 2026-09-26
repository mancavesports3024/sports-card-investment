import React, { useState } from 'react';
import NewsArticleCard from './NewsArticleCard';
import { getAllArticles } from '../services/newsArticleService';

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

const NewsIndex = ({ articles = getAllArticles() }) => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const filtered = filterArticlesByCategory(articles, categoryFilter);
  const sorted = filtered;
  const featuredSlug = sorted[0]?.slug;
  
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
        <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1.2rem', fontWeight: 700 }}>
          📰 Blog &amp; Guides
        </h3>
        <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
          Read our latest articles on card releases, set building, and practical buying and selling.
        </p>
      </div>

      {availableFilters.length > 1 && (
        <div style={{ marginBottom: '2rem' }}>
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
                onClick={() => setCategoryFilter(filter.key)}
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
        </div>
      )}

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
            📭 {categoryFilter === 'all' ? 'No articles published yet' : 'No articles in this category'}
          </div>
          <div style={{ color: '#d1d5db' }}>
            {categoryFilter === 'all' 
              ? 'Check back soon for new releases and collecting guides.'
              : 'Try a different category or view all articles.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {sorted.map((article) => (
            <NewsArticleCard
              key={article.slug}
              article={article}
              featured={article.slug === featuredSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsIndex;
