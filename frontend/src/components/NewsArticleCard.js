import React from 'react';
import { Link } from 'react-router-dom';
import { formatArticleDate } from '../services/newsArticleService';

// Summary card shown in the Industry News tab. `featured` gives the newest
// featured article a stronger treatment without changing the layout.

const TAG_STYLE = {
  background: '#374151',
  color: '#d1d5db',
  padding: '0.2rem 0.6rem',
  borderRadius: 12,
  fontSize: '0.75rem',
  fontWeight: 500,
};

const NewsArticleCard = ({ article, featured = false }) => (
  <article
    style={{
      background: '#1f2937',
      borderRadius: 12,
      padding: featured ? '2rem' : '1.5rem',
      border: featured ? '2px solid #ffd700' : '2px solid #374151',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}
  >
    <header style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}
      >
        <span
          style={{
            background: featured
              ? 'linear-gradient(135deg, #059669, #047857)'
              : '#374151',
            color: '#fff',
            padding: '0.35rem 0.75rem',
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {article.category}
        </span>
        {featured && (
          <span style={{ color: '#ffd700', fontSize: '0.75rem', fontWeight: 700 }}>
            FEATURED
          </span>
        )}
      </div>

      <h3
        style={{
          margin: '0 0 0.5rem 0',
          lineHeight: '1.3',
        }}
      >
        <Link
          to={`/news/${article.slug}`}
          style={{
            color: '#ffd700',
            fontSize: featured ? '1.6rem' : '1.3rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {article.title}
        </Link>
      </h3>

      <div
        style={{
          color: '#9ca3af',
          fontSize: '0.9rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <time dateTime={article.publishedAt}>
          {formatArticleDate(article.publishedAt)}
        </time>
        <span>{article.readingTime}</span>
      </div>
    </header>

    <p
      style={{
        color: '#d1d5db',
        lineHeight: '1.6',
        fontSize: featured ? '1.05rem' : '1rem',
        marginBottom: '1rem',
      }}
    >
      {article.excerpt}
    </p>

    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem',
      }}
    >
      {article.tags.map((tag) => (
        <span key={tag} style={TAG_STYLE}>
          {tag}
        </span>
      ))}
    </div>

    <Link
      to={`/news/${article.slug}`}
      style={{
        display: 'inline-block',
        background: '#ffd700',
        color: '#000',
        padding: '0.6rem 1.1rem',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: '0.9rem',
        textDecoration: 'none',
      }}
      aria-label={`Read Article: ${article.title}`}
    >
      Read Article
    </Link>
  </article>
);

export default NewsArticleCard;
