// Keeps private and utility routes out of the search index.
//
// The problem: DefaultSeo supplies the site-wide SEO baseline to any route that
// declares none of its own, and that baseline says `index, follow`. The admin
// screens and the OAuth landing page declare no SEO, so they inherited an
// invitation to be indexed. Keeping them out of the sitemap is not enough --
// that only means we do not advertise them, while a referrer header, a shared
// link or the OAuth redirect itself can still expose the URL.
//
// The admin components are not rendered here on purpose: they mount data grids
// and call the API. What decides the robots value is the *path*, so these tests
// drive DefaultSeo at each path and separately assert that the real components
// declare no robots tag that could override it.

import fs from 'fs';
import path from 'path';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DefaultSeo from './DefaultSeo';
import NotFoundPage from './NotFoundPage';
import {
  NOINDEX_ROBOTS,
  SITE_DEFAULTS,
  isNoindexPath,
  robotsForPath,
} from '../services/siteMetadata';

const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'index.html'),
  'utf8'
);

const STATIC_HEAD = INDEX_HTML.match(/<head>([\s\S]*?)<\/head>/i)[1]
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/%PUBLIC_URL%/g, '');

const PRIVATE_ROUTES = ['/admin/cards', '/admin/collections', '/auth-success'];

/** react-helmet writes to the DOM on a later frame; let it land. */
const settleHelmet = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 32));
  });
};

const robotsTags = () => Array.from(document.head.querySelectorAll('meta[name="robots"]'));

const renderAt = async (initialEntry, element = <div />) => {
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DefaultSeo />
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>
  );
  await settleHelmet();
  return result;
};

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
});

describe('robotsForPath', () => {
  it.each(PRIVATE_ROUTES)('marks %s as noindex, nofollow', (route) => {
    expect(isNoindexPath(route)).toBe(true);
    expect(robotsForPath(route)).toBe('noindex, nofollow');
  });

  it.each(['/', '/search', '/news', '/news/some-article', '/card-set-analysis', '/ebay-bidding'])(
    'leaves the public route %s indexable',
    (route) => {
      expect(isNoindexPath(route)).toBe(false);
      expect(robotsForPath(route)).toBe(SITE_DEFAULTS.robots);
      expect(robotsForPath(route)).toBe('index, follow');
    }
  );

  it('covers any future /admin subroute', () => {
    expect(isNoindexPath('/admin')).toBe(true);
    expect(isNoindexPath('/admin/anything/deeper')).toBe(true);
  });

  it('is not fooled by a trailing slash', () => {
    expect(isNoindexPath('/admin/cards/')).toBe(true);
    expect(isNoindexPath('/auth-success/')).toBe(true);
  });

  it('does not treat a lookalike public path as private', () => {
    // A public article whose slug merely starts with the same letters must stay
    // indexable; prefix matching is on path segments, not raw strings.
    expect(isNoindexPath('/administrator-guide')).toBe(false);
    expect(isNoindexPath('/news/admin-collecting-guide')).toBe(false);
  });

  it('handles a missing or empty path without throwing', () => {
    expect(isNoindexPath(undefined)).toBe(false);
    expect(isNoindexPath('')).toBe(false);
  });
});

describe('a private route in the rendered DOM', () => {
  it.each(PRIVATE_ROUTES)(
    '%s has exactly one robots tag, reading noindex, nofollow',
    async (route) => {
      await renderAt(route);

      const tags = robotsTags();

      expect(tags).toHaveLength(1);
      expect(tags[0].getAttribute('content')).toBe('noindex, nofollow');
    }
  );

  it('does not inherit index, follow from the site defaults', async () => {
    await renderAt('/admin/cards');

    expect(robotsTags().map((t) => t.getAttribute('content'))).not.toContain(
      'index, follow'
    );
  });

  it('leaves public routes with exactly one indexable robots tag', async () => {
    await renderAt('/search');

    const tags = robotsTags();

    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute('content')).toBe('index, follow');
  });
});

describe('the private route components', () => {
  const source = (file) =>
    fs.readFileSync(path.join(__dirname, file), 'utf8');

  it.each(['AdminCardDatabase.js', 'AdminCollections.js', 'AuthSuccess.js'])(
    '%s declares no robots tag that could override the noindex',
    (file) => {
      expect(source(file)).not.toMatch(/name="robots"/);
    }
  );
});

describe('the catch-all Not Found page', () => {
  it('declares noindex, nofollow of its own', async () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <NotFoundPage />
      </MemoryRouter>
    );
    await settleHelmet();

    const tags = robotsTags();

    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute('content')).toBe('noindex, nofollow');
  });

  it('still resolves to a single robots tag underneath DefaultSeo', async () => {
    // DefaultSeo would supply `index, follow` for an unrecognised path, so the
    // page has to win -- and win without leaving a second tag behind.
    await renderAt('/no-such-page', <NotFoundPage />);

    const tags = robotsTags();

    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute('content')).toBe('noindex, nofollow');
  });

  it('sets its own title rather than the homepage title', async () => {
    await renderAt('/no-such-page', <NotFoundPage />);

    expect(document.title).toBe('Page Not Found | Scorecard');
    expect(document.title).not.toBe(SITE_DEFAULTS.title);
  });

  it('uses the shared noindex constant, so the two cannot drift', () => {
    expect(NOINDEX_ROBOTS).toBe('noindex, nofollow');
    expect(fs.readFileSync(path.join(__dirname, 'NotFoundPage.js'), 'utf8')).toContain(
      'noindex, nofollow'
    );
  });
});
