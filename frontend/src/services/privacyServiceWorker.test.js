/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function worker() {
  const handlers = {};
  const cache = { put: jest.fn(), match: jest.fn().mockResolvedValue(null) };
  const caches = {
    keys: jest.fn().mockResolvedValue(['scorecard-v1-static', 'scorecard-v2-api', 'scorecard-v2-images', 'scorecard-v3-static', 'another-app-cache']),
    delete: jest.fn().mockResolvedValue(true),
    open: jest.fn().mockResolvedValue(cache),
    match: jest.fn().mockResolvedValue(null),
  };
  const fetch = jest.fn().mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });
  const self = {
    location: { hostname: 'cards.example', origin: 'https://cards.example' },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    skipWaiting: jest.fn(),
    clients: { claim: jest.fn().mockResolvedValue(undefined) },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8'), { self, caches, fetch, URL, console: { log: jest.fn(), error: jest.fn() }, Response: class {} });
  return { handlers, caches, fetch, self, cache };
}

test.each([
  ['https://cards.example/api/user/profile', 'cors', { Authorization: 'Bearer secret' }],
  ['https://railway.example/api/user/watchlist', 'cors', { Authorization: 'Bearer secret' }],
  ['https://railway.example/api/ebay/auth', 'navigate', {}],
  ['https://cards.example/auth-success', 'navigate', {}],
  ['https://cards.example/auth-success?token=secret', 'navigate', {}],
  ['https://cards.example/other-callback?code=secret', 'navigate', {}],
])('never intercepts or caches private request %s', (url, mode, headers) => {
  const { handlers, caches, fetch } = worker();
  const event = { request: { url, mode, headers, method: 'GET', destination: mode === 'navigate' ? 'document' : '' }, respondWith: jest.fn() };
  handlers.fetch(event);
  // No respondWith means the browser handles this request directly, outside SW caches.
  expect(event.respondWith).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(caches.open).not.toHaveBeenCalled();
  expect(caches.match).not.toHaveBeenCalled();
});

test('activation removes previous Scorecard caches including stored API data and preserves current/unrelated caches', async () => {
  const { handlers, caches, self } = worker();
  let activation;
  handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  expect(caches.delete.mock.calls.map(([name]) => name)).toEqual(['scorecard-v1-static', 'scorecard-v2-api', 'scorecard-v2-images']);
  expect(self.clients.claim).toHaveBeenCalledTimes(1);
});

test('ordinary public navigation still uses the current v3 static cache', async () => {
  const { handlers, caches, fetch, cache } = worker();
  const request = { url: 'https://cards.example/news/public-card-article', method: 'GET', mode: 'navigate', destination: 'document' };
  let response;
  handlers.fetch({ request, respondWith: promise => { response = promise; } });
  await response;
  expect(fetch).toHaveBeenCalledWith(request);
  expect(caches.open).toHaveBeenCalledWith('scorecard-v3-static');
  expect(cache.put).toHaveBeenCalledWith(request, expect.objectContaining({ ok: true }));
});
