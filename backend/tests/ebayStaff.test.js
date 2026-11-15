// Run from backend/: node --test --test-force-exit tests/ebayStaff.test.js
// Covers /api/staff/ebay access: a valid site sign-in token AND a staff email are both required.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const { createEbayStaffRouter } = require('../routes/ebayStaff');
const { itemXml, fakeTrading, memoryStockStore } = require('./ebayStockTestUtils');

const JWT_SECRET = 'staff-test-jwt-secret-0123456789';
const ITEM = '398443804414';
const sign = (email, secret = JWT_SECRET, opts = {}) => jwt.sign({ id: '1', email, provider: 'google' }, secret, { expiresIn: '1h', ...opts });

async function startStaff(env, store = memoryStockStore()) {
  const fake = fakeTrading(() => itemXml({ itemId: ITEM, variations: [{ card: '45 Pete Crow-Armstrong', qty: 2, price: '0.99' }] }));
  const app = express();
  app.use(express.json());
  app.use('/api/staff/ebay', createEbayStaffRouter({ env, trading: fake.trading, stockStore: store, log: () => {} }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/staff/ebay`;
  return {
    fake,
    store,
    get: (path, token) => fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    post: (path, token, body) => fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    close: () => new Promise((r) => server.close(r))
  };
}

test('staff access control', async (t) => {
  const app = await startStaff({ JWT_SECRET });
  t.after(() => app.close());

  await t.test('no token, bad signature, expired token: 401', async () => {
    assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`)).status, 401);
    assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`, sign('mancavesportscardsllc@gmail.com', 'dev_secret'))).status, 401);
    assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`, sign('mancavesportscardsllc@gmail.com', JWT_SECRET, { expiresIn: -10 }))).status, 401);
    assert.strictEqual((await app.get(`/ebay-stock?itemId=${ITEM}`, jwt.sign({ email: 'mancavesportscardsllc@gmail.com' }, null, { algorithm: 'none' }))).status, 401);
    assert.strictEqual(app.fake.calls.length, 0);
  });

  await t.test('signed in but not staff: 403 and no eBay call', async () => {
    const res = await app.get(`/ebay-stock?itemId=${ITEM}`, sign('random-shopper@gmail.com'));
    assert.strictEqual(res.status, 403);
    assert.strictEqual((await res.json()).error, 'FORBIDDEN');
    assert.strictEqual(app.fake.calls.length, 0);
  });

  await t.test('staff: stock works with no-store and noindex headers', async () => {
    const res = await app.get(`/ebay-stock?itemId=${ITEM}`, sign('MancaveSportsCardsLLC@gmail.com'));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    assert.strictEqual(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.strictEqual((await res.json()).picks[0].cardNumber, '45');
  });

  await t.test('staff price changes are logged under the staff email', async () => {
    const token = sign('mancavesportscardsllc@gmail.com');
    const preview = await (await app.post('/ebay-set-price', token, { itemId: ITEM, cardNumber: '45', newPrice: '1.99' })).json();
    assert.strictEqual(preview.status, 'preview');
    assert.strictEqual(app.store.state.changes.length, 0);
    // The fake listing does not change, so the read-back mismatches; what matters here is who is recorded.
    await app.post('/ebay-set-price', token, preview.confirmWith);
    assert.strictEqual(app.store.state.changes[0].requested_by, 'mancavesportscardsllc@gmail.com');
  });

  await t.test('/me echoes the staff identity', async () => {
    assert.deepStrictEqual(await (await app.get('/me', sign('mancavesportscardsllc@gmail.com'))).json(), { email: 'mancavesportscardsllc@gmail.com', staff: true });
  });
});

test('JWT_SECRET unset: fails closed even for a dev_secret admin token', async () => {
  const app = await startStaff({});
  try {
    const res = await app.get(`/ebay-stock?itemId=${ITEM}`, sign('mancavesportscardsllc@gmail.com', 'dev_secret'));
    assert.strictEqual(res.status, 503);
    assert.strictEqual(app.fake.calls.length, 0);
  } finally {
    await app.close();
  }
});

test('EBAY_STAFF_EMAILS narrows the staff list', async () => {
  const app = await startStaff({ JWT_SECRET, EBAY_STAFF_EMAILS: 'mancavesportscardsllc@gmail.com' });
  try {
    assert.strictEqual((await app.get('/me', sign('sparkmandrew@gmail.com'))).status, 403);
    assert.strictEqual((await app.get('/me', sign('mancavesportscardsllc@gmail.com'))).status, 200);
  } finally {
    await app.close();
  }
});
