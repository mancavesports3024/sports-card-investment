// Run from backend/: node --test --test-force-exit tests/ebayStock.test.js
// Covers the Trading client, per-listing stock, the stored index refresh, and player search. All eBay and
// database calls are mocked.
const test = require('node:test');
const assert = require('node:assert');

const { SCOPES } = require('../services/ebaySellerClient');
const { normalizeName, nameMatches, cardNumberQuery } = require('../services/ebayStock');
const { SECRET, startApp, auth } = require('./ebayInternalTestUtils');
const { itemXml, sellerListXml, failureXml, fakeTrading, itemIdOf, memoryStockStore } = require('./ebayStockTestUtils');

const env = { CRON_SECRET: SECRET };
const ITEM = '398443804414';

const chrome = itemXml({
  itemId: ITEM,
  variations: [
    { card: '45 Pete Crow-Armstrong Chicago Cubs', qty: 1, sold: 1, price: '0.99' },
    { card: '3 Yordan Alvarez Houston Astros', qty: 2, sold: 0, price: '1.49' },
    { card: '2 Cody Bellinger New York Yankees', qty: 3, sold: 1, price: '0.99' },
    { card: 'Checklist card', qty: 1, sold: 0 }
  ]
});

async function withApp(trading, store, fn) {
  const app = await startApp({ env, trading, stockStore: store });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

const post = (app, path, body, headers = auth) => fetch(app.base + path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

test('name normalization and matching', () => {
  assert.strictEqual(normalizeName('Pete Crow-Armstrong, Chicago Cubs'), 'pete crow armstrong chicago cubs');
  assert.strictEqual(normalizeName('José Ramírez'), 'jose ramirez');
  assert.ok(nameMatches('45 Pete Crow-Armstrong Chicago Cubs', 'pete crow armstrong'));
  assert.ok(nameMatches('3 Yordan Alvarez', 'alvarez'));
  assert.ok(nameMatches('3 Yordan Alvarez', 'yordan alv'));
  assert.ok(!nameMatches('3 Yordan Alvarez', 'varez'));
  assert.strictEqual(cardNumberQuery('#45'), '45');
  assert.strictEqual(cardNumberQuery('us164'), 'US164');
  assert.strictEqual(cardNumberQuery('Alvarez'), null);
});

test('GET /ebay-stock', async (t) => {
  const { trading, calls, tokens } = fakeTrading(() => chrome);
  await withApp(trading, memoryStockStore(), async (app) => {
    await t.test('requires the bearer secret', async () => {
      assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`)).status, 401);
      assert.strictEqual(calls.length, 0);
    });

    await t.test('returns every pick with available quantity and sold-out flag', async () => {
      const res = await app.get(`/ebay-stock?itemId=${ITEM}`, auth);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      const body = await res.json();
      assert.strictEqual(body.pickCount, 4);
      assert.strictEqual(body.unparsedCount, 1);
      assert.deepStrictEqual(body.picks.slice(0, 3).map((p) => [p.cardNumber, p.quantityAvailable, p.soldOut]), [['2', 2, false], ['3', 2, false], ['45', 0, true]]);
      const pca = body.picks.find((p) => p.cardNumber === '45');
      assert.strictEqual(pca.cardName, 'Pete Crow-Armstrong Chicago Cubs');
      assert.deepStrictEqual(pca.price, { value: '0.99', currency: 'USD' });
      assert.strictEqual(pca.specifics, undefined);
      assert.strictEqual(calls[0].call, 'GetItem');
      assert.strictEqual(calls[0].headers['X-EBAY-API-IAF-TOKEN'], 'test-user-token');
      assert.match(calls[0].body, new RegExp(`<ItemID>${ITEM}</ItemID>`));
      assert.strictEqual(tokens[0], SCOPES.trading);
    });

    await t.test('q narrows by card number or by name', async () => {
      const byNumber = await (await app.get(`/ebay-stock?itemId=${ITEM}&q=%2345`, auth)).json();
      assert.deepStrictEqual(byNumber.picks.map((p) => p.cardNumber), ['45']);
      assert.strictEqual(byNumber.soldOutCount, 1);
      const byName = await (await app.get(`/ebay-stock?itemId=${ITEM}&q=alvarez`, auth)).json();
      assert.deepStrictEqual(byName.picks.map((p) => p.cardNumber), ['3']);
      const none = await (await app.get(`/ebay-stock?itemId=${ITEM}&q=ohtani`, auth)).json();
      assert.strictEqual(none.matchCount, 0);
      assert.strictEqual(none.pickCount, 4);
    });

    await t.test('validates itemId', async () => {
      assert.strictEqual((await app.get('/ebay-stock?itemId=abc', auth)).status, 400);
      assert.strictEqual((await app.get('/ebay-stock', auth)).status, 400);
    });
  });
});

test('GET /ebay-stock maps eBay failures instead of returning an empty list', async (t) => {
  const cases = [
    ['AUTH_FAILED', () => failureXml('GetItem', '931'), 502],
    ['RATE_LIMITED', () => failureXml('GetItem', '518'), 503],
    ['PERMISSION_DENIED', () => ({ status: 403, data: '' }), 502],
    ['UPSTREAM_ERROR', () => ({ status: 500, data: 'oops' }), 502],
    ['TIMEOUT', () => { const e = new Error('t'); e.code = 'ECONNABORTED'; throw e; }, 504],
    ['ITEM_NOT_FOUND', () => failureXml('GetItem', '17'), 404]
  ];
  for (const [kind, handler, status] of cases) {
    await t.test(kind, async () => {
      const { trading } = fakeTrading(handler);
      await withApp(trading, memoryStockStore(), async (app) => {
        const res = await app.get(`/ebay-stock?itemId=${ITEM}`, auth);
        assert.strictEqual(res.status, status);
        const body = await res.json();
        assert.strictEqual(body.error, kind);
        assert.strictEqual(body.picks, undefined);
      });
    });
  }
  await t.test('a Warning ack is still a success', async () => {
    const warned = chrome.replace('<Ack>Success</Ack>', '<Ack>Warning</Ack><Errors><ErrorCode>21917236</ErrorCode><SeverityCode>Warning</SeverityCode></Errors>');
    const { trading } = fakeTrading(() => warned);
    await withApp(trading, memoryStockStore(), async (app) => assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`, auth)).status, 200));
  });
});

function sellerListing(pages) {
  return ({ call, body }) => {
    if (call === 'GetSellerList') return pages[Number(/<PageNumber>(\d+)</.exec(body)[1]) - 1];
    const id = itemIdOf(body);
    if (id === '111111111') return chrome.replace(new RegExp(ITEM, 'g'), '111111111');
    if (id === '222222222') return itemXml({ itemId: '222222222', title: '2025 Topps Holiday You Pick', variations: [{ card: 'H41 Pete Crow-Armstrong  Chicago Cubs', qty: 6, sold: 6 }] });
    if (id === '333333333') return itemXml({ itemId: '333333333', title: 'Pete Crow-Armstrong 2023 Bowman Chrome Auto', qty: 1 });
    if (id === '444444444') return failureXml('GetItem', '17');
    throw new Error('unexpected');
  };
}

test('POST /ebay-stock-refresh and GET /ebay-find-player', async (t) => {
  const pages = [
    sellerListXml({ ids: ['111111111', '222222222'], page: 1, totalPages: 2, total: 5, more: true }),
    sellerListXml({ ids: ['333333333', '444444444', '555555555'], page: 2, totalPages: 2, total: 5, types: { 555555555: 'Chinese' } })
  ];
  const { trading, calls } = fakeTrading(sellerListing(pages));
  const store = memoryStockStore();
  let clock = Date.parse('2026-11-14T12:00:00Z');
  const now = () => { clock += 1000; return clock; };
  const app = await startApp({ env, trading, stockStore: store, now });
  t.after(() => app.close());

  await t.test('search before any refresh is an explicit error, not an empty list', async () => {
    const res = await app.get('/ebay-find-player?name=Pete%20Crow-Armstrong', auth);
    assert.strictEqual(res.status, 409);
    assert.strictEqual((await res.json()).error, 'INDEX_NOT_BUILT');
  });

  await t.test('refresh reads every page and listing, then reports duration and counts', async () => {
    const res = await post(app, '/ebay-stock-refresh');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.itemCount, 3);
    assert.strictEqual(body.pickCount, 6);
    assert.strictEqual(body.sellerListEntries, 5);
    assert.deepStrictEqual(body.skipped, { notActive: 0, notFixedPrice: 1, endedSinceList: 1 });
    assert.strictEqual(body.tradingCalls, 6);
    assert.ok(body.durationMs > 0);
    assert.strictEqual(calls.filter((c) => c.call === 'GetSellerList').length, 2);
  });

  await t.test('find-player returns every listing containing the player from the stored index', async () => {
    const before = calls.length;
    const res = await app.get('/ebay-find-player?name=Pete%20Crow-Armstrong', auth);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(calls.length, before, 'no live eBay calls');
    assert.strictEqual(body.listingCount, 3);
    assert.strictEqual(body.matchCount, 3);
    assert.strictEqual(body.soldOutCount, 2);
    const holiday = body.listings.find((l) => l.itemId === '222222222');
    assert.deepStrictEqual(holiday.picks[0], { cardNumber: 'H41', cardName: 'Pete Crow-Armstrong  Chicago Cubs', card: 'H41 Pete Crow-Armstrong  Chicago Cubs', quantityAvailable: 0, soldOut: true, price: { value: '0.99', currency: 'USD' }, pickStatus: 'PARSED' });
    assert.ok(body.listings.some((l) => l.itemId === '333333333' && l.picks[0].pickStatus === 'NOT_A_VARIATION'));
    assert.strictEqual(body.index.itemCount, 3);
    assert.ok(body.index.refreshedAt);
  });

  await t.test('find-player validates the name', async () => {
    assert.strictEqual((await app.get('/ebay-find-player?name=a', auth)).status, 400);
    assert.strictEqual((await app.get('/ebay-find-player', auth)).status, 400);
  });

  await t.test('GET /ebay-stock-refresh reports index status', async () => {
    const body = await (await app.get('/ebay-stock-refresh', auth)).json();
    assert.strictEqual(body.built, true);
    assert.strictEqual(body.itemCount, 3);
    assert.strictEqual(body.lastRunStatus, 'SUCCEEDED');
  });
});

test('a failed or partial refresh keeps the previous index', async (t) => {
  const good = [{ itemId: '999999999', title: 'Old', url: null, variationListing: true, picks: [{ cardNumber: '1', cardName: 'Old Player', card: '1 Old Player', pickStatus: 'PARSED', quantityAvailable: 1, quantitySold: 0, soldOut: false, price: { value: '0.99', currency: 'USD' }, variationKey: 'Card=1 Old Player', searchText: 'old player' }] }];
  const lastSuccess = { id: 0, finished_at: new Date('2026-11-13T12:00:00Z'), duration_ms: 1, item_count: 1, pick_count: 1 };

  const scenarios = {
    'one GetItem fails': sellerListing([sellerListXml({ ids: ['111111111', '666666666'] })]),
    'pagination comes up short': () => sellerListXml({ ids: ['111111111'], total: 4 }),
    'no active listings': () => sellerListXml({ ids: [] })
  };
  for (const [name, handler] of Object.entries(scenarios)) {
    await t.test(name, async () => {
      const store = memoryStockStore({ index: { listings: good, lastSuccess } });
      const { trading } = fakeTrading((req) => { if (itemIdOf(req.body) === '666666666') return failureXml('GetItem', '518'); return handler(req); });
      await withApp(trading, store, async (app) => {
        const res = await post(app, '/ebay-stock-refresh');
        assert.ok(res.status >= 500, `status ${res.status}`);
        assert.strictEqual(store.state.listings, good);
        assert.strictEqual(store.state.runs[0].status, 'FAILED');
        const search = await (await app.get('/ebay-find-player?name=old%20player', auth)).json();
        assert.strictEqual(search.matchCount, 1);
        assert.strictEqual(search.index.lastRunStatus, 'FAILED');
      });
    });
  }

  await t.test('a second refresh while one is running is refused', async () => {
    const store = memoryStockStore();
    await store.startRefresh();
    const { trading, calls } = fakeTrading(() => sellerListXml({ ids: [] }));
    await withApp(trading, store, async (app) => {
      const res = await post(app, '/ebay-stock-refresh');
      assert.strictEqual(res.status, 409);
      assert.strictEqual((await res.json()).error, 'REFRESH_IN_PROGRESS');
      assert.strictEqual(calls.length, 0);
    });
  });

  await t.test('missing DATABASE_URL is a 503, not an empty result', async () => {
    const { createStockStore } = require('../services/ebayStockStore');
    const { trading } = fakeTrading(() => chrome);
    await withApp(trading, createStockStore({ env: {} }), async (app) => {
      const res = await app.get('/ebay-find-player?name=alvarez', auth);
      assert.strictEqual(res.status, 503);
      assert.strictEqual((await res.json()).error, 'DATABASE_UNAVAILABLE');
    });
  });
});
