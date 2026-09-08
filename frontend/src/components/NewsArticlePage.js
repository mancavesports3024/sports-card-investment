import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import NewsArticleBody from './NewsArticleBody';
import { formatArticleDate, getArticleBySlug } from '../services/newsArticleService';
import { buildArticleSeo } from '../services/newsArticleSeo';

const BACK_TO_NEWS_STYLE = {
  color: '#ffd700',
  fontWeight: 600,
  textDecoration: 'none',
};

// KNOWN LIMITATION: an unknown slug still returns HTTP 200. Only published
// articles get a generated static shell, so anything else falls through
// vercel.json's SPA rewrite to index.html, which the platform serves as 200.
// The `noindex, follow` tag below is what keeps those URLs out of search
// results. Returning a real 404 status would need server-side rendering or an
// edge function, which is deliberately out of scope for this change.
function ArticleNotFound() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>Article Not Found | Scorecard</title>
        <meta
          name="description"
          content="The article you are looking for is not available. Browse the latest sports card industry news and analysis."
        />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div
        style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2.5rem',
          border: '2px solid #374151',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#ffd700', fontSize: '1.8rem', marginBottom: '1rem' }}>
          Article Not Found
        </h1>
        <p style={{ color: '#d1d5db', marginBottom: '2rem', lineHeight: 1.6 }}>
          We could not find that article. It may have been moved or the link may be
          incorrect.
        </p>
        <Link
          to="/news?tab=news"
          style={{
            display: 'inline-block',
            background: '#ffd700',
            color: '#000',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Browse Industry News
        </Link>
      </div>
    </div>
  );
}

const NewsArticlePage = ({ slug: slugProp }) => {
  const params = useParams();
  const slug = slugProp || params.slug;
  const article = getArticleBySlug(slug);

  if (!article) {
    return <ArticleNotFound />;
  }

  const wasUpdated = article.updatedAt !== article.publishedAt;

  // Single source of truth for this article's metadata. The static HTML shell
  // written by backend/generate-article-pages.js serialises the very same
  // descriptor, so the crawler-visible tags and the hydrated DOM always match.
  const seo = buildArticleSeo(article);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>{seo.title}</title>
        {seo.meta.map((tag) => (
          <meta
            key={`${tag.name || tag.property}=${tag.content}`}
            {...(tag.name ? { name: tag.name } : { property: tag.property })}
            content={tag.content}
          />
        ))}
        <link rel="canonical" href={seo.canonical} />
        <script type="application/ld+json">{JSON.stringify(seo.jsonLd)}</script>
      </Helmet>

      <nav style={{ marginBottom: '1.5rem' }}>
        <Link to="/news?tab=news" style={BACK_TO_NEWS_STYLE}>
          ← Back to Industry News
        </Link>
      </nav>

      <article
        style={{
          background: '#1f2937',
          borderRadius: 12,
          padding: '2rem',
          border: '2px solid #374151',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <header style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff',
              padding: '0.4rem 0.9rem',
              borderRadius: 6,
              display: 'inline-block',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            {article.category}
          </div>

          <h1
            style={{
              color: '#ffd700',
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0 0 0.75rem 0',
              lineHeight: '1.3',
            }}
          >
            {article.title}
          </h1>

          <div
            style={{
              color: '#9ca3af',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span>
              Published{' '}
              <time dateTime={article.publishedAt}>
                {formatArticleDate(article.publishedAt)}
              </time>
            </span>
            {wasUpdated && (
              <span>
                Updated{' '}
                <time dateTime={article.updatedAt}>
                  {formatArticleDate(article.updatedAt)}
                </time>
              </span>
            )}
            <span>By {article.author}</span>
            <span>{article.readingTime}</span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
            }}
          >
            {article.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: '#374151',
                  color: '#d1d5db',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 12,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        {article.heroImage && (
          <img
            src={article.heroImage}
            alt={article.imageAlt}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: 8,
              marginBottom: '1.5rem',
            }}
          />
        )}

        <NewsArticleBody body={article.body} />

        {article.cta && (
          <div style={{ marginTop: '2rem' }}>
            <a
              href={article.cta.url}
              style={{
                display: 'inline-block',
                background: '#ffd700',
                color: '#000',
                padding: '0.75rem 1.25rem',
                borderRadius: 8,
                fontWeight: 700,
                textDecoration: 'none',
              }}
              {...(/^https?:\/\//i.test(article.cta.url)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {article.cta.label}
            </a>
          </div>
        )}

        {article.sourceLinks.length > 0 && (
          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ color: '#ffd700', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Sources
            </h2>
            <ul style={{ paddingLeft: '1.5rem', color: '#d1d5db', lineHeight: 1.8 }}>
              {article.sourceLinks.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#93c5fd' }}
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <nav style={{ marginTop: '2rem' }}>
        <Link to="/news?tab=news" style={BACK_TO_NEWS_STYLE}>
          ← Back to Industry News
        </Link>
      </nav>
    </div>
  );
};

export default NewsArticlePage;
