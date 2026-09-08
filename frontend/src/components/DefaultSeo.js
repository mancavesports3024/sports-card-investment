import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
// Imported from siteMetadata rather than newsArticleSeo so this eagerly loaded
// component does not pull article validation into the main bundle.
import {
  SITE_DEFAULTS,
  SITE_NAME,
  canonicalUrlForPath,
  robotsForPath,
} from '../services/siteMetadata';

// Site-wide SEO baseline, rendered once above the route switch.
//
// Two problems this solves:
//
// 1. public/index.html hard-coded a homepage canonical, description and social
//    tags. react-helmet only manages its own tags, so every route that declared
//    a canonical ended up shipping *two* of them -- and Google discards all
//    canonical hints when it finds more than one. The static tags are now
//    stamped with data-react-helmet="true", which hands ownership to helmet:
//    on mount it replaces them instead of appending beside them.
//
// 2. Because helmet now owns those tags, something has to supply a value for
//    routes that do not declare their own. This component is that fallback, and
//    it derives the canonical from the current path so every route gets a
//    correct one for free rather than inheriting the homepage's.
//
// A route-level Helmet (NewsArticlePage, NewsPage, SearchPage, ...) mounts after
// this one and therefore wins: helmet keys meta on name/property and link on
// rel, and the last mounted instance takes precedence. The net effect is
// exactly one canonical and one effective value per field on every route.
// The robots value is path-aware. Private and utility routes (/admin/*,
// /auth-success) must not inherit the site default of `index, follow` just
// because they declare no SEO of their own -- see robotsForPath in
// services/siteMetadata.js. Because helmet keys meta tags on `name`, this
// single tag is replaced rather than duplicated, so those routes end up with
// exactly one robots tag reading `noindex, nofollow`.
const DefaultSeo = () => {
  const { pathname } = useLocation();
  const canonical = canonicalUrlForPath(pathname);
  const robots = robotsForPath(pathname);

  return (
    <Helmet>
      <title>{SITE_DEFAULTS.title}</title>
      <meta name="description" content={SITE_DEFAULTS.description} />
      <meta name="keywords" content={SITE_DEFAULTS.keywords} />
      <meta name="author" content={SITE_DEFAULTS.author} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={SITE_DEFAULTS.ogType} />
      <meta property="og:title" content={SITE_DEFAULTS.title} />
      <meta property="og:description" content={SITE_DEFAULTS.ogDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={SITE_DEFAULTS.image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={SITE_DEFAULTS.title} />
      <meta name="twitter:description" content={SITE_DEFAULTS.twitterDescription} />
      <meta name="twitter:image" content={SITE_DEFAULTS.image} />
    </Helmet>
  );
};

export default DefaultSeo;
