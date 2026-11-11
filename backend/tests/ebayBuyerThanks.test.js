// Run from backend/: node --test --test-force-exit tests/ebayBuyerThanks.test.js
// Covers /ebay-send-thanks auth, validation, template/date handling, duplicate protection, and ambiguous sends.
// All eBay and database calls are mocked; nothing is sent.
const test = require('node:test');
const assert = require('node:assert');

const { EbaySellerError, SCOPES } = require('../services/ebaySellerClient');
const { buildThanks, cleanTitle, formatShipBy } = require('../services/ebayBuyerThanks');
const { createThanksStore } = require('../services/ebayThanksStore');
const { SECRET, PII, lineItem, order, startApp, auth } = require('./ebayInternalTestUtils');

const env = { CRON_SECRET: SECRET };
const ORDER_ID = '12-34567-89012';

// In-memory guard with the same claim semantics as the Postgres store.
function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async get(id) { return rows.get(id) || null; },
    async claim(id) {
      const row = rows.get(id);
      if (row && row.status !== 'FAILED_NOT_SENT') return false;
      rows.set(id, { status: 'PENDING' });
      return true;
    },
    async markSent(id, ids) { rows.set(id, { status: 'SENT', sentAt: new Date().toISOString(), ...ids }); },
    async markFailed(id) { if (rows.get(id).status === 'PENDING') rows.set(id, { status: 'FAILED_NOT_SENT' }); },
    async markUnknown(id) { if (rows.get(id).status === 'PENDING') rows.set(id, { status: 'UNKNOWN' }); }
  };
}

function thanksClient({ ebayOrder = order({ id: ORDER_ID, items: [lineItem({ id: 'L1', itemId: '3555', title: '2022 Topps Heritage #1-400 You Pick - Please Buy 2+ & Save', shipBy: '2026-11-11T07:59:59.000Z' })] }), send } = {}) {
  const calls = { get: [], post: [], tokens: [] };
  return {
    calls,
    async get(url, scope) {
      calls.get.push({ url, scope });
      await new Promise((r) => setTimeout(r, 5));
      if (ebayOrder instanceof Error) throw ebayOrder;
      return ebayOrder;
    },
    async getAccessToken(scope) { calls.tokens.push(scope); return 'token'; },
    async post(url, scope, body) {
      calls.post.push({ url, scope, body });
      return send ? send(body) : { messageId: 'MSG-1', createdDate: '2026-11-10T23:00:00.000Z', subject: 'eBay subject' };
    }
  };
}

async function setup(opts = {}) {
  const client = opts.client || thanksClient(opts);
  const store = opts.store || memoryStore();
  const logs = [];
  const app = await startApp({ env, client, thanksStore: store, log: (m) => logs.push(m) });
  const post = (body, headers = auth) => fetch(`${app.base}/ebay-send-thanks`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { app, client, store, logs, post };
}

const EXPECTED_TEXT = [
  `Hi buyer_${ORDER_ID},`,
  '',
  "Thank you for your purchase from ManCave Sports Cards! Your 2022 Topps Heritage #1-400 You Pick is being pulled and packed with care, and it'll ship by Tuesday, November 10, 2026.",
  '',
  'If you enjoyed shopping with us, you can follow our eBay store, ManCaveSportsLLC, to see new cards as we list them.',
  '',
  'Thanks again \u2014 we appreciate your business!',
  '\u2014 Carl, ManCave Sports Cards'
].join('\n');

test('requires the bearer secret; nothing is looked up or sent without it', async () => {
  const { app, client, post } = await setup();
  try {
    for (const headers of [{}, { Authorization: 'Bearer wrong' }]) {
      assert.strictEqual((await post({ orderId: ORDER_ID, test: true }, headers)).status, 401);
    }
    assert.strictEqual(client.calls.get.length + client.calls.post.length, 0);
  } finally { await app.close(); }
});

test('requires test === true, one order id, and no extra fields', async () => {
  const { app, client, post } = await setup();
  try {
    const cases = [
      [{ orderId: ORDER_ID }, 'TEST_MODE_REQUIRED'],
      [{ orderId: ORDER_ID, test: false }, 'TEST_MODE_REQUIRED'],
      [{ orderId: ORDER_ID, test: 'true' }, 'TEST_MODE_REQUIRED'],
      [{ orderId: [ORDER_ID, '99-99999-99999'], test: true }, 'INVALID_ORDER_ID'],
      [{ orderId: '../x', test: true }, 'INVALID_ORDER_ID'],
      [{ orderId: ORDER_ID, test: true, orderIds: ['a'] }, 'INVALID_BODY'],
      [[{ orderId: ORDER_ID, test: true }], 'INVALID_BODY']
    ];
    for (const [body, error] of cases) {
      const res = await post(body);
      assert.strictEqual(res.status, 400, JSON.stringify(body));
      assert.strictEqual((await res.json()).error, error);
    }
    assert.strictEqual(client.calls.get.length + client.calls.post.length, 0);
  } finally { await app.close(); }
});

test('sends the approved text verbatim with placeholders filled, referencing the listing', async () => {
  const { app, client, store, logs, post } = await setup();
  try {
    const res = await post({ orderId: ORDER_ID, test: true });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.deepStrictEqual(body, {
      orderId: ORDER_ID,
      buyerUsername: `buyer_${ORDER_ID}`,
      status: 'sent',
      ebay: { messageId: 'MSG-1', createdDate: '2026-11-10T23:00:00.000Z', conversationId: null, referenceType: 'LISTING', referenceId: '3555' }
    });
    assert.strictEqual(client.calls.get[0].url, `https://api.ebay.com/sell/fulfillment/v1/order/${ORDER_ID}`);
    assert.strictEqual(client.calls.post.length, 1);
    const sent = client.calls.post[0];
    assert.strictEqual(sent.url, 'https://api.ebay.com/commerce/message/v1/send_message');
    assert.strictEqual(sent.scope, SCOPES.message);
    assert.deepStrictEqual(sent.body, { otherPartyUsername: `buyer_${ORDER_ID}`, messageText: EXPECTED_TEXT, reference: { referenceId: '3555', referenceType: 'LISTING' } });
    assert.deepStrictEqual(store.rows.get(ORDER_ID).status, 'SENT');
    assert.strictEqual(store.rows.get(ORDER_ID).messageId, 'MSG-1');
    const text = JSON.stringify(body) + logs.join('\n');
    for (const s of ['pulled and packed', PII.email, PII.address, PII.fullName]) assert.ok(!text.includes(s), `leaked ${s}`);
  } finally { await app.close(); }
});

test('second call for the same order returns 409 ALREADY_SENT and sends nothing', async () => {
  const { app, client, post } = await setup();
  try {
    assert.strictEqual((await post({ orderId: ORDER_ID, test: true })).status, 201);
    const again = await post({ orderId: ORDER_ID, test: true });
    assert.strictEqual(again.status, 409);
    assert.strictEqual((await again.json()).error, 'ALREADY_SENT');
    assert.strictEqual(client.calls.post.length, 1);
    assert.strictEqual(client.calls.get.length, 1);
  } finally { await app.close(); }
});

test('concurrent calls for one order send exactly once', async () => {
  const { app, client, post } = await setup();
  try {
    const results = await Promise.all([1, 2, 3].map(() => post({ orderId: ORDER_ID, test: true })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepStrictEqual(statuses, [201, 409, 409]);
    assert.strictEqual(client.calls.post.length, 1);
  } finally { await app.close(); }
});

test('ambiguous outcomes are recorded UNKNOWN and never retried automatically', async () => {
  const ambiguous = [
    () => { throw new EbaySellerError('TIMEOUT'); },
    () => { throw new EbaySellerError('NETWORK_ERROR'); },
    () => { throw new EbaySellerError('UPSTREAM_ERROR', { status: 503 }); },
    () => ({ createdDate: '2026-11-10T23:00:00.000Z' })
  ];
  for (const send of ambiguous) {
    const { app, client, store, post } = await setup({ send });
    try {
      const res = await post({ orderId: ORDER_ID, test: true });
      assert.strictEqual(res.status, 502);
      assert.strictEqual((await res.json()).error, 'SEND_STATUS_UNKNOWN');
      assert.strictEqual(store.rows.get(ORDER_ID).status, 'UNKNOWN');
      const retry = await post({ orderId: ORDER_ID, test: true });
      assert.strictEqual(retry.status, 409);
      assert.strictEqual((await retry.json()).error, 'SEND_STATUS_UNKNOWN');
      assert.strictEqual(client.calls.post.length, 1);
    } finally { await app.close(); }
  }
});

test('eBay 4xx rejection is recorded FAILED_NOT_SENT and a later call may send', async () => {
  let attempt = 0;
  const { app, client, store, post } = await setup({ send: () => { attempt += 1; if (attempt === 1) throw new EbaySellerError('PERMISSION_DENIED', { status: 403, ebayErrorIds: [1100] }); return { messageId: 'MSG-2' }; } });
  try {
    const first = await post({ orderId: ORDER_ID, test: true });
    assert.strictEqual(first.status, 502);
    assert.strictEqual((await first.json()).error, 'PERMISSION_DENIED');
    assert.strictEqual(store.rows.get(ORDER_ID).status, 'FAILED_NOT_SENT');
    assert.strictEqual((await post({ orderId: ORDER_ID, test: true })).status, 201);
    assert.strictEqual(store.rows.get(ORDER_ID).status, 'SENT');
    assert.strictEqual(client.calls.post.length, 2);
  } finally { await app.close(); }
});

test('ineligible or missing orders are rejected before claiming or sending', async () => {
  const cases = [
    [order({ id: ORDER_ID, status: 'FULFILLED', items: [lineItem({ id: 'A' })] }), 409, 'ORDER_NOT_ELIGIBLE'],
    [order({ id: ORDER_ID, cancel: 'CANCELED', items: [lineItem({ id: 'A' })] }), 409, 'ORDER_NOT_ELIGIBLE'],
    [order({ id: ORDER_ID, payment: 'FULLY_REFUNDED', items: [lineItem({ id: 'A' })] }), 409, 'ORDER_NOT_ELIGIBLE'],
    [order({ id: ORDER_ID, items: [lineItem({ id: 'A', shipBy: null })] }), 422, 'MISSING_SHIP_BY'],
    [order({ id: ORDER_ID, items: [lineItem({ id: 'A', title: 'x'.repeat(2000) })] }), 422, 'MESSAGE_TOO_LONG'],
    [new EbaySellerError('UPSTREAM_ERROR', { status: 404 }), 404, 'ORDER_NOT_FOUND']
  ];
  for (const [ebayOrder, status, error] of cases) {
    const { app, client, store, post } = await setup({ ebayOrder });
    try {
      const res = await post({ orderId: ORDER_ID, test: true });
      assert.strictEqual(res.status, status, error);
      assert.strictEqual((await res.json()).error, error);
      assert.strictEqual(client.calls.post.length, 0);
      assert.strictEqual(store.rows.size, 0);
    } finally { await app.close(); }
  }
});

test('missing DATABASE_URL fails closed with 503 before any send', async () => {
  const { app, client, post } = await setup({ store: createThanksStore({ env: {} }) });
  try {
    const res = await post({ orderId: ORDER_ID, test: true });
    assert.strictEqual(res.status, 503);
    assert.strictEqual((await res.json()).error, 'DUPLICATE_GUARD_UNAVAILABLE');
    assert.strictEqual(client.calls.post.length + client.calls.get.length, 0);
  } finally { await app.close(); }
});

test('title suffix removal and Pacific ship-by day formatting', () => {
  for (const t of ['2022 Topps Heritage You Pick Please Buy 2+ & Save', '2022 Topps Heritage You Pick - Please Buy 2+ & Save!', '2022 Topps Heritage You Pick (PLEASE BUY 2+ & SAVE)', '2022 Topps Heritage You Pick | please buy 2 + and save']) {
    assert.strictEqual(cleanTitle(t), '2022 Topps Heritage You Pick', t);
  }
  assert.strictEqual(cleanTitle('Please Buy 2+ & Save Topps lot'), 'Please Buy 2+ & Save Topps lot');
  for (const [t, want] of [
    ['2021 Topps Baseball #1-#165 Complete your set Please Buy 2+ & Save', '2021 Topps Baseball #1-#165'],
    ['2022 Topps Heritage - COMPLETE YOUR SET - You Pick', '2022 Topps Heritage - You Pick'],
    ['2023 Topps Series 2 (Complete Your Set!)', '2023 Topps Series 2'],
    ['Complete your set: 2020 Topps Update', '2020 Topps Update']
  ]) assert.strictEqual(cleanTitle(t), want, t);
  assert.strictEqual(cleanTitle('Topps set completers'), 'Topps set completers');
  assert.strictEqual(formatShipBy('2026-11-11T07:59:59.000Z'), 'Tuesday, November 10, 2026');
  assert.strictEqual(formatShipBy('2026-11-11T08:00:00.000Z'), 'Wednesday, November 11, 2026');
  assert.strictEqual(formatShipBy('2026-07-01T06:59:59.000Z'), 'Tuesday, June 30, 2026');
  assert.strictEqual(formatShipBy('2026-07-01T07:00:00.000Z'), 'Wednesday, July 1, 2026');
  assert.strictEqual(formatShipBy('not a date'), null);
});

test('multi-listing orders name each listing once and reference the listing with the most unshipped units', () => {
  const t = (id, itemId, title, qty = 1) => lineItem({ id, itemId, qty, title, shipBy: '2026-11-13T07:59:59.000Z' });
  const two = buildThanks(order({ id: ORDER_ID, items: [
    t('A', '304413', '2021 Topps Baseball #1-#165 Complete your set Please Buy 2+ & Save'),
    t('B', '317569', '2021 Topps Baseball #166-#330 Complete your set Please Buy 2+ & Save'),
    t('C', '304413', '2021 Topps Baseball #1-#165 Complete your set Please Buy 2+ & Save', 3)
  ] }));
  assert.strictEqual(two.legacyItemId, '304413');
  assert.match(two.messageText, /Your 2021 Topps Baseball #1-#165 and 2021 Topps Baseball #166-#330 are being pulled and packed with care, and it'll ship by Thursday, November 12, 2026\./);
  assert.ok(!/complete your set/i.test(two.messageText));

  const three = buildThanks(order({ id: ORDER_ID, items: [t('A', '1', 'Set A'), t('B', '2', 'Set B', 2), t('C', '3', 'Set C')] }));
  assert.strictEqual(three.legacyItemId, '2');
  assert.match(three.messageText, /Your Set A, Set B, and Set C are being/);

  const sameName = buildThanks(order({ id: ORDER_ID, items: [t('A', '1', 'Set A'), t('B', '2', 'Set A')] }));
  assert.match(sameName.messageText, /Your Set A is being/);
});

test('uses the earliest ship-by among unshipped lines of the one listing', () => {
  const o = order({ id: ORDER_ID, items: [
    lineItem({ id: 'A', itemId: '9', shipBy: '2026-11-14T07:59:59.000Z' }),
    lineItem({ id: 'B', itemId: '9', shipBy: '2026-11-12T07:59:59.000Z' }),
    lineItem({ id: 'C', itemId: '8', status: 'FULFILLED', shipBy: '2026-11-01T07:59:59.000Z' })
  ] });
  const built = buildThanks(o);
  assert.match(built.messageText, /ship by Wednesday, November 11, 2026\./);
  assert.strictEqual(built.legacyItemId, '9', 'fulfilled lines are ignored');
});

test('Postgres store claims atomically with ON CONFLICT and only reclaims FAILED_NOT_SENT rows', async () => {
  const sql = [];
  let released = 0;
  const record = async (text, params) => { sql.push({ text, params }); return { rows: [] }; };
  const pool = { query: record, async connect() { return { query: record, release: () => { released += 1; } }; }, on() {} };
  const store = createThanksStore({ env: {}, pool });
  assert.strictEqual(await store.claim(ORDER_ID), false);
  assert.deepStrictEqual(sql.slice(0, 2).map((s) => s.text), ['BEGIN', 'SELECT pg_advisory_xact_lock($1)']);
  assert.match(sql[2].text, /CREATE TABLE IF NOT EXISTS ebay_buyer_thanks[\s\S]*order_id TEXT PRIMARY KEY[\s\S]*sent_at TIMESTAMPTZ[\s\S]*ebay_message_id TEXT[\s\S]*ebay_conversation_id TEXT/);
  assert.strictEqual(sql[3].text, 'COMMIT');
  assert.strictEqual(released, 1);
  assert.match(sql[4].text, /ON CONFLICT \(order_id\) DO UPDATE[\s\S]*WHERE ebay_buyer_thanks\.status = 'FAILED_NOT_SENT'[\s\S]*RETURNING order_id/);
  assert.deepStrictEqual(sql[4].params, [ORDER_ID]);
  await store.markUnknown(ORDER_ID);
  assert.match(sql[5].text, /status = 'UNKNOWN'[\s\S]*AND status = 'PENDING'/);
  assert.strictEqual(sql.filter((s) => /CREATE TABLE/.test(s.text)).length, 1);
});
