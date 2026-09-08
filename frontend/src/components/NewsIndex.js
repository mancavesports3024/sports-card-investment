import React from 'react';
import NewsArticleCard from './NewsArticleCard';
import { getAllArticles } from '../services/newsArticleService';

// Industry News tab: the list of article cards, newest first.
//
// `articles` is injectable so tests (and any future filtered view) can supply
// their own list; by default it comes from the file-based content loader.

const NewsIndex = ({ articles = getAllArticles() }) => {
  const sorted = articles;
  const featuredSlug = sorted.find((article) => article.featured)?.slug;

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
          📰 Industry News &amp; Analysis
        </h3>
        <p style={{ margin: 0, color: '#333', fontSize: '0.95rem' }}>
          Stay updated with the latest news, trends, and insights from the trading card industry.
          Expert analysis and market insights for collectors and investors.
        </p>
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
            📭 No articles published yet
          </div>
          <div style={{ color: '#d1d5db' }}>
            Check back soon for industry news and market analysis.
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
