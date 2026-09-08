// Deterministic verification of the deployed routing configuration.
//
// A direct hit on /news/<slug> used to depend on Vercel's framework default
// rather than anything committed, which is exactly the kind of thing that
// silently regresses. These tests pin the contract in vercel.json: the API
// proxy stays first, a SPA fallback exists, and neither one shadows static
// assets.
//
// Vercel evaluates requests in this order:
//   1. redirects
//   2. the filesystem (static files in the build output)
//   3. vercel.json rewrites, in the order they are declared
// `resolve` below models exactly that, so the assertions describe real
// production behaviour rather than just the file's shape.

const fs = require('fs');
const path = require('path');

const VERCEL_CONFIG_PATH = path.join(__dirname, '..', '..', 'vercel.json');
const API_DESTINATION = 'https://web-production-9efa.up.railway.app/api/$1';

const config = JSON.parse(fs.readFileSync(VERCEL_CONFIG_PATH, 'utf8'));

/**
 * @param {string} pathname          incoming request path
 * @param {string[]} staticFiles     paths served straight off the filesystem
 */
const resolve = (pathname, staticFiles = []) => {
  if (staticFiles.includes(pathname)) {
    return { type: 'static', target: pathname };
  }

  for (const rewrite of config.rewrites) {
    const pattern = new RegExp(`^${rewrite.source}$`);
    if (pattern.test(pathname)) {
      return { type: 'rewrite', target: pathname.replace(pattern, rewrite.destination) };
    }
  }

  return { type: 'notFound', target: null };
};

describe('vercel.json shape', () => {
  it('declares the API proxy before the SPA fallback', () => {
    const sources = config.rewrites.map((r) => r.source);

    expect(sources.indexOf('/api/(.*)')).toBe(0);
    expect(sources.indexOf('/(.*)')).toBe(sources.length - 1);
  });

  it('preserves the existing API proxy destination exactly', () => {
    const apiRewrite = config.rewrites.find((r) => r.source === '/api/(.*)');

    expect(apiRewrite).toBeDefined();
    expect(apiRewrite.destination).toBe(API_DESTINATION);
  });

  it('declares a SPA fallback to index.html', () => {
    const fallback = config.rewrites.find((r) => r.source === '/(.*)');

    expect(fallback).toBeDefined();
    expect(fallback.destination).toBe('/index.html');
  });
});

describe('direct article URLs', () => {
  const SLUG = '2026-bowman-chrome-baseball-budget-guide';

  it('serves the generated static shell when postbuild produced one', () => {
    // What backend/generate-article-pages.js writes into the build output.
    const result = resolve(`/news/${SLUG}`, [`/news/${SLUG}`]);

    expect(result.type).toBe('static');
  });

  it('falls back to the SPA instead of a platform 404 when no shell exists', () => {
    const result = resolve(`/news/${SLUG}`);

    expect(result.type).toBe('rewrite');
    expect(result.target).toBe('/index.html');
    expect(result.type).not.toBe('notFound');
  });

  it('handles a refresh of any nested route without a 404', () => {
    ['/news', '/search', '/card-set-analysis', '/ebay-bidding', '/news/anything'].forEach(
      (route) => {
        expect(resolve(route).target).toBe('/index.html');
      }
    );
  });
});

describe('the fallback does not shadow anything', () => {
  it('still proxies API requests to the backend', () => {
    expect(resolve('/api/news/releases').target).toBe(
      'https://web-production-9efa.up.railway.app/api/news/releases'
    );
    expect(resolve('/api/auth/google').target).toBe(
      'https://web-production-9efa.up.railway.app/api/auth/google'
    );
  });

  it('never rewrites API requests to index.html', () => {
    expect(resolve('/api/anything').target).not.toBe('/index.html');
  });

  it('serves static assets from the filesystem, ahead of the fallback', () => {
    const assets = [
      '/static/js/main.abc123.js',
      '/static/css/main.abc123.css',
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      '/sitemap.xml',
      '/ads.txt',
    ];

    assets.forEach((asset) => {
      expect(resolve(asset, assets).type).toBe('static');
    });
  });
});
