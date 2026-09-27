// Service Worker for Scorecard
// Version: Update this when making breaking changes to cache strategy
const SW_VERSION = 'v2';
const CACHE_VERSION = `scorecard-${SW_VERSION}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  // Skip waiting so new service worker activates immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that doesn't match current version
            if (!cacheName.startsWith(CACHE_VERSION)) {
              console.log(`[SW ${SW_VERSION}] Deleting old cache:`, cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log(`[SW ${SW_VERSION}] Activated and claiming clients`);
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // In development (localhost), don't intercept
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests (network-first with cache fallback)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests (HTML pages) - network-first
  if (request.mode === 'navigate' || 
      request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.startsWith('/news') ||
      url.pathname.startsWith('/search') ||
      url.pathname.startsWith('/card-set-analysis')) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets (JS, CSS with fingerprints) - cache-first
  if (url.origin === self.location.origin &&
      (url.pathname.includes('/static/') || 
       url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/))) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Handle images - cache-first with stale-while-revalidate
  if (url.hostname.includes('ebay.com') || 
      url.hostname.includes('i.ebayimg.com') ||
      request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(request).catch(() => {
      return new Response('Offline', { status: 503 });
    })
  );
});

// Handle navigation requests - network-first to always get latest HTML
async function handleNavigationRequest(request) {
  try {
    // Always try network first for HTML to avoid stale app shell
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW ${SW_VERSION}] Serving cached HTML:`, request.url);
      return cachedResponse;
    }
    
    // No cache available, return offline page
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Scorecard</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #111;
              color: #fff;
            }
            .offline {
              text-align: center;
              padding: 2rem;
            }
            h1 { color: #ffd700; }
          </style>
        </head>
        <body>
          <div class="offline">
            <h1>📡 You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
          </div>
        </body>
      </html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Handle static assets (fingerprinted JS/CSS) - cache-first, safe to cache long-term
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  // Try cache first for fingerprinted assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Cache miss, fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error(`[SW ${SW_VERSION}] Failed to fetch static asset:`, request.url);
    return new Response('Asset not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Handle API requests - network-first with cache fallback
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log(`[SW ${SW_VERSION}] API cache hit:`, request.url);
      return cachedResponse;
    }
    
    // No cache available
    return new Response(
      JSON.stringify({ error: 'Network unavailable and no cached data' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle image requests - cache-first with stale-while-revalidate
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Serve from cache immediately, revalidate in background
    fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch(() => {
      // Ignore background fetch errors
    });
    
    return cachedResponse;
  }
  
  // Cache miss, fetch from network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return placeholder for failed images
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#ddd" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="sans-serif" font-size="14">Image unavailable</text></svg>',
      {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Message handler for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
