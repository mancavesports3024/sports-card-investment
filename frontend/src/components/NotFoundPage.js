import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';

// Catch-all for any path with no route.
//
// Before this existed, an unmatched URL rendered the site header above a
// completely empty content area: no explanation, no way onward, and -- because
// DefaultSeo supplies the site baseline to routes that declare nothing -- an
// `index, follow` robots tag inviting crawlers to index the blank page.
//
// KNOWN LIMITATION, unchanged by this component: the response status is still
// HTTP 200, not 404. vercel.json rewrites unmatched paths to index.html, so the
// platform answers 200 before React ever runs and nothing client-side can alter
// that. `noindex, nofollow` below is what actually keeps these URLs out of
// search results. A truthful 404 status would need server-side rendering or an
// edge function, which is deliberately out of scope. This page is only here to
// stop blank unmatched pages and accidental indexing -- it does not claim to
// produce a real 404.

const CARD_STYLE = {
  background: '#1f2937',
  borderRadius: 12,
  padding: '2.5rem',
  border: '2px solid #374151',
  textAlign: 'center',
};

const LINK_STYLE = {
  display: 'inline-block',
  background: '#ffd700',
  color: '#000',
  padding: '0.75rem 1.5rem',
  borderRadius: 8,
  fontWeight: 700,
  textDecoration: 'none',
};

const NotFoundPage = () => {
  const { pathname } = useLocation();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <Helmet>
        <title>Page Not Found | Scorecard</title>
        <meta
          name="description"
          content="That page does not exist. Browse trading card price data and sports card industry news on Scorecard."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div style={CARD_STYLE}>
        <h1 style={{ color: '#ffd700', fontSize: '1.8rem', marginBottom: '1rem' }}>
          Page Not Found
        </h1>
        <p style={{ color: '#d1d5db', marginBottom: '0.75rem', lineHeight: 1.6 }}>
          There is nothing at <code style={{ color: '#ffd700' }}>{pathname}</code>. The
          page may have been moved, or the link may be incorrect.
        </p>
        <p style={{ color: '#9ca3af', marginBottom: '2rem', lineHeight: 1.6 }}>
          Try one of these instead:
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/" style={LINK_STYLE}>
            Go to Home
          </Link>
          <Link to="/news" style={{ ...LINK_STYLE, background: '#374151', color: '#ffd700' }}>
            Browse News
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
