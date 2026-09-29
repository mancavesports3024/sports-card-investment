/**
 * Service Worker Cache Strategy Tests
 * 
 * These tests verify that the service worker:
 * 1. Uses network-first for HTML/navigation (prevents stale app shell)
 * 2. Uses cache-first for fingerprinted static assets
 * 3. Properly versions caches and cleans up old versions
 * 4. Provides offline fallback for navigation requests
 */

describe('Service Worker Cache Strategy', () => {
  let swCode;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    const swPath = path.join(__dirname, '../../public/sw.js');
    swCode = fs.readFileSync(swPath, 'utf-8');
  });

  describe('Cache Versioning', () => {
    it('defines a version constant', () => {
      expect(swCode).toMatch(/const SW_VERSION = ['"]v\d+['"]/);
    });

    it('includes version in cache names', () => {
      expect(swCode).toMatch(/const CACHE_VERSION = `scorecard-\$\{SW_VERSION\}`/);
      expect(swCode).toMatch(/const STATIC_CACHE = `\$\{CACHE_VERSION\}-static`/);
      expect(swCode).toMatch(/const API_CACHE = `\$\{CACHE_VERSION\}-api`/);
    });

    it('cleans up old caches on activation', () => {
      expect(swCode).toContain("addEventListener('activate'");
      expect(swCode).toMatch(/if \(!cacheName\.startsWith\(CACHE_VERSION\)\)/);
      expect(swCode).toContain('caches.delete(cacheName)');
    });

    it('immediately activates new service worker', () => {
      expect(swCode).toContain('self.skipWaiting()');
      expect(swCode).toContain('self.clients.claim()');
    });
  });

  describe('Navigation Requests (HTML)', () => {
    it('detects navigation requests', () => {
      expect(swCode).toMatch(/request\.mode === ['"]navigate['"]/);
      expect(swCode).toMatch(/request\.destination === ['"]document['"]/);
    });

    it('handles /news route with network-first strategy', () => {
      expect(swCode).toMatch(/url\.pathname\.startsWith\(['"]\/news['"]\)/);
    });

    it('uses handleNavigationRequest for HTML pages', () => {
      expect(swCode).toContain('handleNavigationRequest');
      expect(swCode).toMatch(/async function handleNavigationRequest/);
    });

    it('tries network first for navigation requests', () => {
      const navFunctionMatch = swCode.match(
        /async function handleNavigationRequest[\s\S]*?^\}/m
      );
      expect(navFunctionMatch).toBeTruthy();
      const navFunction = navFunctionMatch[0];
      
      // Should attempt fetch first
      expect(navFunction).toContain('await fetch(request)');
      
      // Should cache the response
      expect(navFunction).toContain('cache.put(request');
      
      // Should have fallback to cache on error
      expect(navFunction).toContain('catch');
      expect(navFunction).toContain('cachedResponse');
    });

    it('provides offline fallback HTML', () => {
      expect(swCode).toMatch(/<!DOCTYPE html>/);
      expect(swCode).toMatch(/Offline/i);
    });
  });

  describe('Static Assets (JS/CSS)', () => {
    it('detects static assets with fingerprints', () => {
      // Should match assets with content hashes (e.g., main.abc123.js)
      // Pattern is in a regex, so it will have escaped slashes
      expect(swCode).toContain('\\/static\\/');
      expect(swCode).toContain('[a-f0-9]{8,}');
      expect(swCode).toContain('content hashes');
    });

    it('uses cache-first for fingerprinted assets', () => {
      expect(swCode).toContain('handleStaticAsset');
      const staticFunctionMatch = swCode.match(
        /async function handleStaticAsset[\s\S]*?^\}/m
      );
      expect(staticFunctionMatch).toBeTruthy();
      const staticFunction = staticFunctionMatch[0];
      
      // Should check cache first
      expect(staticFunction).toContain('cache.match(request)');
      
      // Should return cached response before fetching
      expect(staticFunction).toMatch(/if \(cachedResponse\)/);
    });
  });

  describe('API Requests', () => {
    it('detects API routes', () => {
      expect(swCode).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
    });

    it('uses network-first for API requests', () => {
      expect(swCode).toContain('handleApiRequest');
      const apiFunctionMatch = swCode.match(
        /async function handleApiRequest[\s\S]*?^\}/m
      );
      expect(apiFunctionMatch).toBeTruthy();
      const apiFunction = apiFunctionMatch[0];
      
      // Should try network first
      expect(apiFunction).toContain('await fetch(request)');
      
      // Should have cache fallback
      expect(apiFunction).toContain('catch');
      expect(apiFunction).toContain('cachedResponse');
    });
  });

  describe('Development Mode', () => {
    it('skips interception in development', () => {
      expect(swCode).toMatch(/self\.location\.hostname === ['"]localhost['"]/);
      expect(swCode).toMatch(/self\.location\.hostname === ['"]127\.0\.0\.1['"]/);
    });
  });

  describe('Image Requests', () => {
    it('detects eBay image requests', () => {
      expect(swCode).toMatch(/url\.hostname\.includes\(['"]ebay\.com['"]\)/);
      expect(swCode).toMatch(/url\.hostname\.includes\(['"]i\.ebayimg\.com['"]\)/);
    });

    it('uses cache-first for images', () => {
      expect(swCode).toContain('handleImageRequest');
      const imgFunctionMatch = swCode.match(
        /async function handleImageRequest[\s\S]*?^\}/m
      );
      expect(imgFunctionMatch).toBeTruthy();
      const imgFunction = imgFunctionMatch[0];
      
      // Should check cache first
      expect(imgFunction).toContain('cache.match(request)');
    });

    it('provides SVG placeholder for failed images', () => {
      expect(swCode).toMatch(/<svg.*Image unavailable.*<\/svg>/s);
    });
  });

  describe('Non-GET Requests', () => {
    it('skips non-GET requests', () => {
      expect(swCode).toMatch(/request\.method !== ['"]GET['"]/);
    });
  });
});

describe('Service Worker Registration', () => {
  let indexJsCode;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.join(__dirname, '../index.js');
    indexJsCode = fs.readFileSync(indexPath, 'utf-8');
  });

  it('checks for service worker support', () => {
    expect(indexJsCode).toMatch(/['"]serviceWorker['"] in navigator/);
  });

  it('registers service worker on load', () => {
    expect(indexJsCode).toMatch(/addEventListener\(['"]load['"]/);
    expect(indexJsCode).toMatch(/navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/);
  });

  it('logs registration success and failure', () => {
    expect(indexJsCode).toMatch(/console\.log.*Service Worker registered/i);
    expect(indexJsCode).toMatch(/console\.log.*Service Worker.*failed/i);
  });
});
