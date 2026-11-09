// Run from backend/: node --test --test-force-exit tests/ebayInternalAuth.test.js
// Covers CRON_SECRET protection, safe error responses, and the seller client's token handling.
const test = require('node:test');
const assert = require('node:assert');

const { createEbaySellerClient, EbaySellerError, SCOPES } = require('../services/ebaySellerClient');
const { SECRET, fakeClient, startApp, auth } = require('./ebayInternalTestUtils');

const emptyClient = () => fakeClient(() => ({ total: 0, orders: [] }));

test('rejects missing, malformed, and wrong secrets with no-store', async () => {
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client: emptyClient() });
  try {
    for (const headers of [{}, { Authorization: SECRET }, { Authorization: 'Bearer wrong' }, { Authorization: `Basic ${SECRET}` }, { 'X-Cron-Secret': SECRET }]) {
      const res = await app.get('/ebay-pull-list', headers);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      assert.ok(!(await res.text()).includes(SECRET));
    }
    const ok = await app.get('/ebay-pull-list', auth);
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.headers.get('cache-control'), 'no-store');
  } finally { await app.close(); }
});

test('fails closed when CRON_SECRET is unset', async () => {
  const client = emptyClient();
  const app = await startApp({ env: {}, client });
  try {
    const res = await app.get('/ebay-pull-list', { Authorization: 'Bearer anything' });
    assert.strictEqual(res.status, 503);
    assert.strictEqual(client.calls.length, 0);
  } finally { await app.close(); }
});

test('rejects secrets sent in the query string even when the header is valid', async () => {
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client: emptyClient() });
  try {
    const res = await app.get(`/ebay-pull-list?secret=${SECRET}`, auth);
    assert.strictEqual(res.status, 400);
    const noHeader = await app.get(`/ebay-pull-list?token=${SECRET}`);
    assert.strictEqual(noHeader.status, 400);
  } finally { await app.close(); }
});

test('provider failures return sanitized errors, never an empty success', async () => {
  const cases = [
    [new EbaySellerError('PERMISSION_DENIED', { status: 403, ebayErrorIds: [1100] }), 502],
    [new EbaySellerError('TIMEOUT'), 504],
    [new EbaySellerError('INCOMPLETE_DATA'), 502],
    [Object.assign(new Error(`boom Bearer v^1.1#secret-token ${SECRET}`), { response: { data: { address: 'x' } } }), 500]
  ];
  for (const [err, status] of cases) {
    const logs = [];
    const app = await startApp({ env: { CRON_SECRET: SECRET }, client: fakeClient(() => { throw err; }), log: (m) => logs.push(m) });
    try {
      const res = await app.get('/ebay-pull-list', auth);
      const text = await res.text();
      assert.strictEqual(res.status, status);
      const body = JSON.parse(text);
      assert.ok(body.error && !('orders' in body));
      for (const s of [SECRET, 'v^1.1#', 'boom', 'address']) {
        assert.ok(!text.includes(s), `response leaked ${s}`);
        assert.ok(!logs.join('\n').includes(s), `log leaked ${s}`);
      }
    } finally { await app.close(); }
  }
});

test('validates bounded query parameters', async () => {
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client: emptyClient() });
  try {
    for (const q of ['?days=0', '?days=91', '?days=abc', '?days=1.5', '?days=-3']) {
      assert.strictEqual((await app.get(`/ebay-money${q}`, auth)).status, 400, q);
    }
    for (const q of ['?lookbackDays=0', '?lookbackDays=731', '?lookbackDays=x']) {
      assert.strictEqual((await app.get(`/ebay-pull-list${q}`, auth)).status, 400, q);
    }
  } finally { await app.close(); }
});

function fakeHttp(responder) {
  const calls = [];
  return {
    calls,
    async request(config) {
      calls.push(config);
      return responder(config, calls.length);
    }
  };
}

const ENV = { EBAY_CLIENT_ID: 'cid', EBAY_CLIENT_SECRET: 'csecret', EBAY_REFRESH_TOKEN: 'rtoken' };

test('seller client caches tokens until shortly before expiry and coalesces refreshes', async () => {
  let clock = 1_000_000;
  let tokenCalls = 0;
  const http = fakeHttp(async (config) => {
    if (config.method === 'post') {
      tokenCalls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return { status: 200, data: { access_token: `access-${tokenCalls}`, expires_in: 7200 } };
    }
    return { status: 200, data: { ok: config.headers.Authorization } };
  });
  const client = createEbaySellerClient({ env: ENV, http, now: () => clock });

  const results = await Promise.all([1, 2, 3].map(() => client.get('https://api.ebay.com/x', SCOPES.fulfillment)));
  assert.strictEqual(tokenCalls, 1);
  assert.ok(results.every((r) => r.ok === 'Bearer access-1'));

  const tokenReq = http.calls.find((c) => c.method === 'post');
  assert.ok(tokenReq.timeout > 0);
  assert.match(tokenReq.data, /scope=https%3A%2F%2Fapi\.ebay\.com%2Foauth%2Fapi_scope%2Fsell\.fulfillment\.readonly/);

  clock += 7200 * 1000 - 60 * 1000; // inside refresh margin
  await client.get('https://api.ebay.com/x', SCOPES.fulfillment);
  assert.strictEqual(tokenCalls, 2);
});

test('seller client retries once after a 401 and maps errors without raw data', async () => {
  let n = 0;
  const http = fakeHttp(async (config) => {
    if (config.method === 'post') return { status: 200, data: { access_token: `t${++n}`, expires_in: 7200 } };
    if (config.headers.Authorization === 'Bearer t1') return { status: 401, data: { errors: [{ errorId: 1001, message: 'Invalid access token' }] } };
    return { status: 403, data: { errors: [{ errorId: 1100, message: 'Access denied', longMessage: 'contains v^1.1#leak' }] } };
  });
  const client = createEbaySellerClient({ env: ENV, http });
  await assert.rejects(client.get('https://api.ebay.com/x', SCOPES.finances), (err) => {
    assert.strictEqual(err.kind, 'PERMISSION_DENIED');
    assert.deepStrictEqual(err.ebayErrorIds, [1100]);
    assert.ok(!JSON.stringify(err).includes('leak') && !err.message.includes('leak'));
    return true;
  });
  assert.strictEqual(n, 2);

  const timeoutClient = createEbaySellerClient({ env: ENV, http: { request: async () => { throw Object.assign(new Error('timeout of 20000ms exceeded csecret'), { code: 'ECONNABORTED' }); } } });
  await assert.rejects(timeoutClient.get('https://api.ebay.com/x', SCOPES.fulfillment), (err) => err.kind === 'TIMEOUT' && !err.message.includes('csecret'));

  const unconfigured = createEbaySellerClient({ env: {}, http: fakeHttp(() => { throw new Error('should not call'); }) });
  await assert.rejects(unconfigured.get('https://api.ebay.com/x', SCOPES.fulfillment), (err) => err.kind === 'NOT_CONFIGURED');
});

test('invalid_grant maps to AUTH_FAILED', async () => {
  const http = fakeHttp(() => ({ status: 400, data: { error: 'invalid_grant', error_description: 'bad' } }));
  const client = createEbaySellerClient({ env: ENV, http });
  await assert.rejects(client.get('https://api.ebay.com/x', SCOPES.fulfillment), (err) => err.kind === 'AUTH_FAILED' && err.status === 400);
});
