/**
 * Service Worker Behavioral Tests
 * 
 * These tests verify the actual runtime behavior of the service worker
 * by mocking the fetch and cache APIs and invoking the handlers.
 */

describe('Service Worker Behavioral Tests', () => {
  let swCode;
  let globalScope;
  let mockCaches;
  let mockFetch;
  let fetchHandler;

  beforeEach(() => {
    // Read and execute the service worker code in a sandboxed scope
    const fs = require('fs');
    const path = require('path');
    const swPath = path.join(__dirname, '../../public/sw.js');
    swCode = fs.readFileSync(swPath, 'utf-8');

    // Create a mock global scope that mimics the service worker environment
    mockCaches = {
      storage: new Map(),
      open: jest.fn(async (name) => {
        if (!mockCaches.storage.has(name)) {
          mockCaches.storage.set(name, new Map());
        }
        const cacheMap = mockCaches.storage.get(name);
        return {
          match: jest.fn(async (request) => {
            const key = typeof request === 'string' ? request : request.url;
            return cacheMap.get(key) || null;
          }),
          put: jest.fn(async (request, response) => {
            const key = typeof request === 'string' ? request : request.url;
            cacheMap.set(key, response);
          }),
          delete: jest.fn(async (request) => {
            const key = typeof request === 'string' ? request : request.url;
            return cacheMap.delete(key);
          }),
        };
      }),
      match: jest.fn(async (request) => {
        // Search all caches for a match
        for (const [cacheName, cacheMap] of mockCaches.storage) {
          const key = typeof request === 'string' ? request : request.url;
          const cached = cacheMap.get(key);
          if (cached) return cached;
        }
        return null;
      }),
      keys: jest.fn(async () => {
        return Array.from(mockCaches.storage.keys());
      }),
      delete: jest.fn(async (name) => {
        return mockCaches.storage.delete(name);
      }),
    };

    mockFetch = jest.fn();

    globalScope = {
      caches: mockCaches,
      fetch: mockFetch,
      self: {
        location: { hostname: 'example.com', origin: 'https://example.com' },
        skipWaiting: jest.fn(),
        clients: { claim: jest.fn() },
        addEventListener: jest.fn((event, handler) => {
          if (event === 'fetch') {
            fetchHandler = handler;
          }
        }),
      },
      Request: class MockRequest {
        constructor(url, options = {}) {
          const urlObj = new URL(url, 'https://example.com');
          this.url = urlObj.href;
          this.method = options.method || 'GET';
          this.mode = options.mode || 'cors';
          this.destination = options.destination || '';
        }
      },
      Response: class MockResponse {
        constructor(body, init = {}) {
          this.body = body;
          this.status = init.status || 200;
          this.ok = this.status >= 200 && this.status < 300;
          this.headers = init.headers || {};
        }
        clone() {
          return new globalScope.Response(this.body, {
            status: this.status,
            headers: this.headers,
          });
        }
      },
      URL: URL,
      console,
    };

    // Execute the service worker code in the mock scope
    const swFunction = new Function(
      'self',
      'caches',
      'fetch',
      'Request',
      'Response',
      'URL',
      'console',
      swCode
    );
    swFunction(
      globalScope.self,
      globalScope.caches,
      globalScope.fetch,
      globalScope.Request,
      globalScope.Response,
      globalScope.URL,
      globalScope.console
    );
  });

  describe('Navigation requests (HTML)', () => {
    it('returns fresh network HTML even when old HTML is cached', async () => {
      const request = new globalScope.Request('https://example.com/news', {
        mode: 'navigate',
        destination: 'document',
      });

      // Put old HTML in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      await cache.put(
        request.url,
        new globalScope.Response('<html><body>OLD</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      // Mock fetch to return new HTML
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('<html><body>NEW</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return fresh network content, not cached
      expect(mockFetch).toHaveBeenCalledWith(request);
      expect(result.body).toContain('NEW');
      expect(result.body).not.toContain('OLD');
    });

    it('falls back to cached HTML when offline', async () => {
      const request = new globalScope.Request('https://example.com/news', {
        mode: 'navigate',
        destination: 'document',
      });

      // Put HTML in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      await cache.put(
        request.url,
        new globalScope.Response('<html><body>CACHED</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      // Mock fetch to fail (offline)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return cached HTML
      expect(result.body).toContain('CACHED');
    });

    it('returns offline page when no cache available and network fails', async () => {
      const request = new globalScope.Request('https://example.com/news', {
        mode: 'navigate',
        destination: 'document',
      });

      // Mock fetch to fail (offline)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return offline fallback page
      expect(result.body).toContain('Offline');
      expect(result.body).toContain('<!DOCTYPE html>');
      expect(result.status).toBe(503);
    });
  });

  describe('Fingerprinted static assets', () => {
    it('uses cache-first for fingerprinted JS files', async () => {
      const request = new globalScope.Request(
        'https://example.com/static/js/main.fa935057.js',
        { method: 'GET' }
      );

      // Put asset in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      const cachedResponse = new globalScope.Response('CACHED_JS_CONTENT', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
      await cache.put(request.url, cachedResponse);

      // Mock fetch (should not be called for cached asset)
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('NETWORK_JS_CONTENT', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return cached content without fetching
      expect(result.body).toBe('CACHED_JS_CONTENT');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses cache-first for fingerprinted CSS files', async () => {
      const request = new globalScope.Request(
        'https://example.com/static/css/main.a4b979ea.css',
        { method: 'GET' }
      );

      // Put asset in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      const cachedResponse = new globalScope.Response('CACHED_CSS_CONTENT', {
        status: 200,
        headers: { 'Content-Type': 'text/css' },
      });
      await cache.put(request.url, cachedResponse);

      // Mock fetch
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('NETWORK_CSS_CONTENT', {
          status: 200,
          headers: { 'Content-Type': 'text/css' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return cached content
      expect(result.body).toBe('CACHED_CSS_CONTENT');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches fingerprinted assets from network when not cached', async () => {
      const request = new globalScope.Request(
        'https://example.com/static/js/main.fa935057.js',
        { method: 'GET' }
      );

      // Mock fetch to return new content
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('NEW_JS_CONTENT', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should fetch and return network content
      expect(mockFetch).toHaveBeenCalledWith(request);
      expect(result.body).toBe('NEW_JS_CONTENT');
    });
  });

  describe('Non-fingerprinted assets', () => {
    it('does NOT use cache-first for unhashed JS files', async () => {
      const request = new globalScope.Request(
        'https://example.com/static/js/bundle.js',
        { method: 'GET' }
      );

      // Put old content in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      await cache.put(
        request.url,
        new globalScope.Response('OLD_JS', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        })
      );

      // Mock fetch to return new content
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('NEW_JS', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      
      // For unhashed assets, the service worker should use default behavior
      // which is network-first (fetch is called)
      if (response) {
        const result = await response;
        // If the fetch handler responded, it should have fetched
        expect(mockFetch).toHaveBeenCalled();
      } else {
        // If no respondWith was called, browser handles it (network request)
        expect(event.respondWith).not.toHaveBeenCalled();
      }
    });

    it('does NOT use cache-first for unhashed CSS files', async () => {
      const request = new globalScope.Request(
        'https://example.com/styles.css',
        { method: 'GET' }
      );

      // Put old content in cache
      const cache = await mockCaches.open('scorecard-v2-static');
      await cache.put(
        request.url,
        new globalScope.Response('OLD_CSS', {
          status: 200,
          headers: { 'Content-Type': 'text/css' },
        })
      );

      // Mock fetch
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response('NEW_CSS', {
          status: 200,
          headers: { 'Content-Type': 'text/css' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);

      // Should not intercept unhashed assets with cache-first
      if (response) {
        const result = await response;
        expect(mockFetch).toHaveBeenCalled();
      } else {
        expect(event.respondWith).not.toHaveBeenCalled();
      }
    });
  });

  describe('API requests', () => {
    it('uses network-first for API requests', async () => {
      const request = new globalScope.Request('https://example.com/api/news', {
        method: 'GET',
      });

      // Put old data in cache
      const cache = await mockCaches.open('scorecard-v2-api');
      await cache.put(
        request.url,
        new globalScope.Response(JSON.stringify({ data: 'OLD' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Mock fetch to return new data
      mockFetch.mockResolvedValueOnce(
        new globalScope.Response(JSON.stringify({ data: 'NEW' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return fresh network data
      expect(mockFetch).toHaveBeenCalledWith(request);
      expect(result.body).toContain('"NEW"');
    });

    it('falls back to cached API response when offline', async () => {
      const request = new globalScope.Request('https://example.com/api/news', {
        method: 'GET',
      });

      // Put data in cache
      const cache = await mockCaches.open('scorecard-v2-api');
      await cache.put(
        request.url,
        new globalScope.Response(JSON.stringify({ data: 'CACHED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Mock fetch to fail
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Simulate fetch event
      let response;
      const event = {
        request,
        respondWith: jest.fn((promise) => {
          response = promise;
        }),
      };

      fetchHandler(event);
      const result = await response;

      // Should return cached data
      expect(result.body).toContain('"CACHED"');
    });
  });
});
