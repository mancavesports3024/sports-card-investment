// Integration test against a REAL, disposable Postgres. Skipped unless TEST_DATABASE_URL is set.
// Never point this at a shared database: it drops and recreates ebay_buyer_thanks.
// Example (from backend/):
//   docker run --rm -d --name thanks-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16
//   $env:TEST_DATABASE_URL='postgres://postgres:test@127.0.0.1:55432/postgres'; node --test --test-force-exit tests/ebayThanksStore.pg.test.js
const test = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');

const { createThanksStore } = require('../services/ebayThanksStore');
const { sendThanks } = require('../services/ebayBuyerThanks');
const { EbaySellerError } = require('../services/ebaySellerClient');
const { lineItem, order } = require('./ebayInternalTestUtils');

const URL = process.env.TEST_DATABASE_URL;
const skip = URL ? false : 'TEST_DATABASE_URL not set';

const pools = [];
function newStore() {
  const pool = new Pool({ connectionString: URL, max: 5 });
  pools.push(pool);
  return createThanksStore({ env: {}, pool });
}

const ORDER = '12-34567-89012';
const ebayOrder = order({ id: ORDER, items: [lineItem({ id: 'L1', itemId: '3555', title: '2022 Topps Heritage You Pick' })] });
function mockClient(send) {
  const posts = [];
  return {
    posts,
    async get() { await new Promise((r) => setTimeout(r, 10)); return ebayOrder; },
    async getAccessToken() { return 'token'; },
    async post(url, scope, body) { posts.push(body); return send(); }
  };
}

test('real Postgres: migration, atomic claims, uncertain-send blocking', { skip }, async (t) => {
  const admin = new Pool({ connectionString: URL });
  pools.push(admin);
  await admin.query('DROP TABLE IF EXISTS ebay_buyer_thanks');
  const stores = Array.from({ length: 5 }, newStore); // separate pools behave like separate app instances

  t.after(async () => { await Promise.all(pools.map((p) => p.end())); });

  await t.test('concurrent first use creates the table once with the expected schema', async () => {
    await Promise.all(stores.map((s, i) => s.get(`warmup-${i}`)));
    const { rows: cols } = await admin.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'ebay_buyer_thanks' ORDER BY ordinal_position");
    assert.deepStrictEqual(cols.map((c) => c.column_name), ['order_id', 'status', 'claimed_at', 'sent_at', 'ebay_message_id', 'ebay_conversation_id', 'updated_at']);
    assert.strictEqual(cols.find((c) => c.column_name === 'sent_at').data_type, 'timestamp with time zone');
    const { rows: pk } = await admin.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'ebay_buyer_thanks'::regclass AND i.indisprimary");
    assert.deepStrictEqual(pk.map((r) => r.attname), ['order_id']);
    await assert.rejects(admin.query("INSERT INTO ebay_buyer_thanks (order_id, status) VALUES ('bad', 'NOPE')"), /check constraint/);
  });

  await t.test('25 concurrent claims across 5 pools: exactly one wins', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => stores[i % 5].claim('race-1')));
    assert.strictEqual(results.filter(Boolean).length, 1);
    assert.strictEqual((await stores[0].get('race-1')).status, 'PENDING');
  });

  await t.test('UNKNOWN and PENDING block every reclaim; SENT blocks too', async () => {
    assert.deepStrictEqual(await Promise.all(stores.map((s) => s.claim('race-1'))), [false, false, false, false, false]);
    await stores[1].markUnknown('race-1');
    assert.strictEqual((await stores[2].get('race-1')).status, 'UNKNOWN');
    assert.deepStrictEqual(await Promise.all(stores.map((s) => s.claim('race-1'))), [false, false, false, false, false]);

    assert.strictEqual(await stores[0].claim('sent-1'), true);
    await stores[0].markSent('sent-1', { messageId: 'MSG-9', conversationId: null });
    const sent = await stores[3].get('sent-1');
    assert.strictEqual(sent.status, 'SENT');
    assert.strictEqual(sent.ebay_message_id, 'MSG-9');
    assert.ok(sent.sent_at instanceof Date);
    await stores[3].markFailed('sent-1');
    await stores[3].markUnknown('sent-1');
    assert.strictEqual((await stores[4].get('sent-1')).status, 'SENT', 'terminal SENT is never downgraded');
    assert.deepStrictEqual(await Promise.all(stores.map((s) => s.claim('sent-1'))), [false, false, false, false, false]);
  });

  await t.test('FAILED_NOT_SENT allows exactly one concurrent reclaim', async () => {
    assert.strictEqual(await stores[0].claim('failed-1'), true);
    await stores[0].markFailed('failed-1');
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => stores[i % 5].claim('failed-1')));
    assert.strictEqual(results.filter(Boolean).length, 1);
  });

  await t.test('end to end with mocked eBay: concurrent sends post once; repeat is ALREADY_SENT', async () => {
    const client = mockClient(() => ({ messageId: 'MSG-E2E', createdDate: '2026-11-10T23:00:00.000Z' }));
    const outcomes = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => sendThanks({ client, store: stores[i % 5], orderId: ORDER })));
    assert.strictEqual(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
    assert.ok(outcomes.filter((o) => o.status === 'rejected').every((o) => ['ALREADY_SENT', 'SEND_STATUS_UNKNOWN'].includes(o.reason.code)));
    assert.strictEqual(client.posts.length, 1);
    await assert.rejects(sendThanks({ client, store: stores[2], orderId: ORDER }), (err) => err.code === 'ALREADY_SENT');
    assert.strictEqual(client.posts.length, 1);
    const row = await stores[0].get(ORDER);
    assert.strictEqual(row.status, 'SENT');
    assert.strictEqual(row.ebay_message_id, 'MSG-E2E');
  });

  await t.test('end to end: a timed-out send is recorded UNKNOWN in Postgres and never resent', async () => {
    const client = mockClient(() => { throw new EbaySellerError('TIMEOUT'); });
    await assert.rejects(sendThanks({ client, store: stores[0], orderId: '99-11111-22222' }), (err) => err.code === 'SEND_STATUS_UNKNOWN' && err.httpStatus === 502);
    assert.strictEqual((await stores[1].get('99-11111-22222')).status, 'UNKNOWN');
    await assert.rejects(sendThanks({ client, store: stores[4], orderId: '99-11111-22222' }), (err) => err.code === 'SEND_STATUS_UNKNOWN' && err.httpStatus === 409);
    assert.strictEqual(client.posts.length, 1);
  });
});
