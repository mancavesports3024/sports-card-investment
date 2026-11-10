// Run from backend/: node --test --test-force-exit tests/ebayDemand.test.js
// Covers /ebay-demand auth, validation, statistics, category handling, access failures, and app-token caching.
const test = require('node:test');
const assert = require('node:assert');

const { createEbaySellerClient, EbaySellerError, SCOPES } = require('../services/ebaySellerClient');
const { createDemandService, isRelevant } = require('../services/ebayDemand');
const { SECRET, fakeClient, startApp, auth } = require('./ebayInternalTestUtils');

const usd = (value) => ({ value, currency: 'USD' });
const listing = (title, price, { options = ['FIXED_PRICE'], seller = 'seller_a' } = {}) => ({ title, price, buyingOptions: options, seller: seller ? { username: seller } : undefined });

const TREE = { categoryTreeId: '0' };
const SUBTREE = {
  categorySubtreeNode: {
    category: { categoryId: '212', categoryName: 'Sports Trading Cards' },
    childCategoryTreeNodes: [
      { category: { categoryId: '261329', categoryName: 'Trading Card Lots' }, leafCategoryTreeNode: true },
      { category: { categoryId: '261328', categoryName: 'Trading Card Singles' }, leafCategoryTreeNode: true }
    ]
  }
};
const BROWSE = {
  total: 298511,
  itemSummaries: [
    listing('2022 Topps Heritage #1 Shohei Ohtani', usd('10.00'), { seller: 's1' }),
    listing('2022 Topps Heritage #2 Aaron Judge', usd('2.00'), { seller: 's2' }),
    listing('2022 Topps Heritage #3 Mike Trout', usd('4.00'), { seller: 's1' }),
    listing('2022 Topps Heritage #4 Juan Soto', usd('6.00'), { seller: 's3' }),
    listing('2022 Topps Heritage auction lot', usd('1.00'), { options: ['AUCTION'], seller: 's4' }),
    listing('2022 Topps Heritage #5 CAD', { value: '3.00', currency: 'CAD' }, { seller: 's5' }),
    listing('2021 Topps Series 1 #9 unrelated', usd('99.00'), { seller: 's6' }),
    listing('2022 Topps Heritage #6 Bobby Witt', usd('8.00'), { seller: 's1' }),
    listing('2022 Topps Heritage #7 Bo Bichette', usd('5.00'), { seller: 's2' })
  ]
};
const SOLD = {
  total: 40,
  itemSales: [
    { title: '2022 Topps Heritage #1 Ohtani', lastSoldPrice: usd('12.00'), lastSoldDate: '2026-11-01T10:00:00.000Z', totalSoldQuantity: 2 },
    { title: '2022 Topps Heritage #2 Judge', lastSoldPrice: usd('3.00'), lastSoldDate: '2026-11-08T10:00:00.000Z', totalSoldQuantity: 1 },
    { title: '2022 Topps Heritage #3 Trout', lastSoldPrice: usd('5.50'), lastSoldDate: '2026-10-20T10:00:00.000Z', totalSoldQuantity: 4 },
    { title: '2019 Bowman unrelated', lastSoldPrice: usd('500.00'), lastSoldDate: '2026-11-09T10:00:00.000Z', totalSoldQuantity: 1 }
  ]
};

// Routes fake app-client calls by path; `insights` decides the Marketplace Insights outcome.
function demandClient({ insights = () => { throw new EbaySellerError('PERMISSION_DENIED', { status: 400, oauthError: 'invalid_scope' }); }, browse = () => BROWSE, taxonomy = true } = {}) {
  return fakeClient((url, scope) => {
    if (url.pathname.endsWith('/get_default_category_tree_id')) { if (!taxonomy) throw new EbaySellerError('UPSTREAM_ERROR', { status: 500 }); return TREE; }
    if (url.pathname.endsWith('/get_category_subtree')) return SUBTREE;
    if (url.pathname === '/buy/browse/v1/item_summary/search') { assert.strictEqual(scope, SCOPES.publicApp); return browse(url); }
    if (url.pathname === '/buy/marketplace_insights/v1_beta/item_sales/search') { assert.strictEqual(scope, SCOPES.marketplaceInsights); return insights(url); }
    throw new Error(`unexpected ${url}`);
  });
}

const env = { CRON_SECRET: SECRET };
const q = (s) => `?q=${encodeURIComponent(s)}`;

test('demand endpoint requires the bearer secret and makes no eBay calls without it', async () => {
  const appClient = demandClient();
  const app = await startApp({ env, appClient });
  try {
    assert.strictEqual((await app.get(`/ebay-demand${q('2022 Topps Heritage baseball')}`)).status, 401);
    assert.strictEqual((await app.get(`/ebay-demand${q('x y')}&token=${SECRET}`, auth)).status, 400);
    assert.strictEqual(appClient.calls.length, 0);
  } finally { await app.close(); }
});

test('validates q and limit (1..50, default 25)', async () => {
  const appClient = demandClient();
  const app = await startApp({ env, appClient });
  try {
    for (const bad of ['', '?q=', '?q=a', `?q=${'x'.repeat(101)}`, `?q=${encodeURIComponent('topps*')}`, '?q=a1&q=b2']) {
      const res = await app.get(`/ebay-demand${bad}`, auth);
      assert.strictEqual(res.status, 400, bad);
      assert.strictEqual((await res.json()).error, 'INVALID_QUERY');
    }
    for (const bad of ['0', '51', 'abc', '1.5', '-3', '']) {
      const res = await app.get(`/ebay-demand${q('2022 Topps Heritage')}&limit=${bad}`, auth);
      assert.strictEqual(res.status, 400, bad);
      assert.strictEqual((await res.json()).error, 'INVALID_LIMIT');
    }
    assert.strictEqual(appClient.calls.length, 0);

    const ok = await app.get(`/ebay-demand${q('  2022 Topps Heritage baseball ')}`, auth);
    assert.strictEqual(ok.status, 200);
    const body = await ok.json();
    assert.strictEqual(body.limit, 25);
    assert.strictEqual(body.query, '2022 Topps Heritage baseball');
    const browseCall = appClient.calls.find((c) => c.url.includes('/buy/browse/'));
    assert.match(browseCall.url, /limit=25/);
    assert.strictEqual(browseCall.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');
    assert.strictEqual((await app.get(`/ebay-demand${q('2022 Topps Heritage')}&limit=50`, auth)).status, 200);
  } finally { await app.close(); }
});

test('active stats use only relevant fixed-price USD asking prices and label them honestly', async () => {
  const appClient = demandClient();
  const app = await startApp({ env, appClient });
  try {
    const body = await (await app.get(`/ebay-demand${q('2022 Topps Heritage baseball')}`, auth)).json();
    assert.strictEqual(body.marketplace, 'EBAY_US');
    assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
    assert.deepStrictEqual({ id: body.category.categoryId, sport: body.category.sportAspect }, { id: '261328', sport: 'Baseball' });

    const browseUrl = new URL(appClient.calls.find((c) => c.url.includes('/buy/browse/')).url);
    assert.strictEqual(browseUrl.searchParams.get('category_ids'), '261328');
    assert.strictEqual(browseUrl.searchParams.get('aspect_filter'), 'categoryId:261328,Sport:{Baseball}');

    const a = body.active;
    assert.strictEqual(a.priceType, 'ASKING_PRICE');
    assert.strictEqual(a.totalMatches, 298511);
    assert.strictEqual(a.returnedCount, 9);
    assert.strictEqual(a.relevantCount, 8);
    assert.deepStrictEqual(a.excluded, { notRelevant: 1, auctionOnly: 1, noUsdPrice: 1 });
    // Priced: 10, 2, 4, 6, 8, 5 -> sorted 2,4,5,6,8,10; median (5+6)/2
    assert.deepStrictEqual(a.askingPrice, { currency: 'USD', count: 6, min: '2.00', median: '5.50', max: '10.00' });
    assert.strictEqual(a.distinctSellers, 5);
    assert.strictEqual(a.samples.length, 5);
    assert.ok(a.samples.every((s) => s.askingPrice.currency === 'USD' && s.title.includes('2022 Topps Heritage')));
    assert.ok(body.notes.some((n) => /buyer-search volume/.test(n)));
    assert.ok(body.notes.some((n) => /loose/.test(n)));
    assert.ok(body.notes.some((n) => /sample/.test(n)));
  } finally { await app.close(); }
});

test('Insights invalid_scope returns sold null with not_granted and the exact error, without re-minting every call', async () => {
  let insightsCalls = 0;
  const appClient = demandClient({ insights: () => { insightsCalls += 1; throw new EbaySellerError('PERMISSION_DENIED', { status: 400, oauthError: 'invalid_scope' }); } });
  const app = await startApp({ env, appClient });
  try {
    for (let i = 0; i < 2; i += 1) {
      const res = await app.get(`/ebay-demand${q('2022 Topps Heritage baseball')}`, auth);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.sold, null);
      assert.deepStrictEqual(body.access, { browse: 'ok', marketplaceInsights: 'not_granted' });
      assert.deepStrictEqual(body.accessDetail.marketplaceInsights, { error: 'PERMISSION_DENIED', httpStatus: 400, oauthError: 'invalid_scope', code: 'MARKETPLACE_INSIGHTS_NOT_GRANTED' });
      assert.ok(body.active);
    }
    assert.strictEqual(insightsCalls, 1);
  } finally { await app.close(); }
});

test('Insights 403 also maps to not_granted; other Insights errors are reported, not hidden', async () => {
  const forbidden = await createDemandService({ client: demandClient({ insights: () => { throw new EbaySellerError('PERMISSION_DENIED', { status: 403, ebayErrorIds: [1100] }); } }) }).buildDemand({ q: '2022 Topps Heritage' });
  assert.strictEqual(forbidden.access.marketplaceInsights, 'not_granted');
  assert.deepStrictEqual(forbidden.accessDetail.marketplaceInsights.ebayErrorIds, [1100]);

  const limited = await createDemandService({ client: demandClient({ insights: () => { throw new EbaySellerError('RATE_LIMITED', { status: 429 }); } }) }).buildDemand({ q: '2022 Topps Heritage' });
  assert.strictEqual(limited.sold, null);
  assert.strictEqual(limited.access.marketplaceInsights, 'RATE_LIMITED');
});

test('granted Insights returns sold-price stats from relevant sales only', async () => {
  const result = await createDemandService({ client: demandClient({ insights: () => SOLD }) }).buildDemand({ q: '2022 Topps Heritage baseball', limit: 10 });
  assert.strictEqual(result.access.marketplaceInsights, 'ok');
  const s = result.sold;
  assert.strictEqual(s.priceType, 'SOLD_PRICE');
  assert.strictEqual(s.windowDays, 90);
  assert.strictEqual(s.totalMatches, 40);
  assert.strictEqual(s.relevantCount, 3);
  assert.deepStrictEqual(s.soldPrice, { currency: 'USD', count: 3, min: '3.00', median: '5.50', avg: '6.83', max: '12.00' });
  assert.strictEqual(s.mostRecentSoldDate, '2026-11-08T10:00:00.000Z');
  assert.strictEqual(s.samples[0].lastSoldDate, '2026-11-08T10:00:00.000Z');
  assert.ok(s.samples.every((x) => !x.title.includes('Bowman')));
});

test('browse failure is reported in access with active null; unresolved category falls back to null', async () => {
  const result = await createDemandService({ client: demandClient({ browse: () => { throw new EbaySellerError('RATE_LIMITED', { status: 429 }); }, taxonomy: false }) }).buildDemand({ q: '2022 Topps Heritage' });
  assert.strictEqual(result.active, null);
  assert.strictEqual(result.access.browse, 'RATE_LIMITED');
  assert.strictEqual(result.category.categoryId, null);

  const client = demandClient({ taxonomy: false });
  await createDemandService({ client }).buildDemand({ q: '2022 Topps Heritage' });
  const browseUrl = new URL(client.calls.find((c) => c.url.includes('/buy/browse/')).url);
  assert.strictEqual(browseUrl.searchParams.get('category_ids'), null);
});

test('missing app credentials fail closed with 503', async () => {
  const appClient = createEbaySellerClient({ env: {}, grantType: 'client_credentials', http: { request: async () => { throw new Error('should not call'); } } });
  const app = await startApp({ env, appClient });
  try {
    const res = await app.get(`/ebay-demand${q('2022 Topps Heritage')}`, auth);
    assert.strictEqual(res.status, 503);
    assert.strictEqual((await res.json()).error, 'NOT_CONFIGURED');
  } finally { await app.close(); }
});

test('app client uses client_credentials (no refresh token) and caches tokens per scope until expiry', async () => {
  let clock = 1_000_000;
  const tokenBodies = [];
  const http = {
    async request(config) {
      if (config.method === 'post') {
        tokenBodies.push(new URLSearchParams(config.data));
        return { status: 200, data: { access_token: `app-${tokenBodies.length}`, expires_in: 7200 } };
      }
      return { status: 200, data: { auth: config.headers.Authorization } };
    }
  };
  const client = createEbaySellerClient({ env: { EBAY_CLIENT_ID: 'cid', EBAY_CLIENT_SECRET: 'cs' }, grantType: 'client_credentials', http, now: () => clock });
  await client.get('https://api.ebay.com/a', SCOPES.publicApp);
  await client.get('https://api.ebay.com/a', SCOPES.publicApp);
  await client.get('https://api.ebay.com/b', SCOPES.marketplaceInsights);
  assert.strictEqual(tokenBodies.length, 2);
  assert.deepStrictEqual(tokenBodies.map((b) => [b.get('grant_type'), b.get('scope'), b.get('refresh_token')]), [
    ['client_credentials', SCOPES.publicApp, null],
    ['client_credentials', SCOPES.marketplaceInsights, null]
  ]);
  clock += 7200 * 1000;
  await client.get('https://api.ebay.com/a', SCOPES.publicApp);
  assert.strictEqual(tokenBodies.length, 3);

  const denied = createEbaySellerClient({ env: { EBAY_CLIENT_ID: 'cid', EBAY_CLIENT_SECRET: 'cs' }, grantType: 'client_credentials', http: { request: async () => ({ status: 400, data: { error: 'invalid_scope', error_description: 'exceeds scope v^1.1#leak' } }) } });
  await assert.rejects(denied.get('https://api.ebay.com/b', SCOPES.marketplaceInsights), (err) => {
    assert.strictEqual(err.kind, 'PERMISSION_DENIED');
    assert.strictEqual(err.oauthError, 'invalid_scope');
    assert.ok(!JSON.stringify(err).includes('leak'));
    return true;
  });
});

test('relevance requires every non-sport query word as a whole word', () => {
  assert.ok(isRelevant('2022 TOPPS HERITAGE #12 Judge', ['2022', 'topps', 'heritage']));
  assert.ok(!isRelevant('2022 Topps Heritage High Number', ['2023', 'topps', 'heritage']));
  assert.ok(!isRelevant('20221 Toppsy Heritage', ['2022', 'topps', 'heritage']));
});
