// Integration test against a REAL, disposable Postgres. Skipped unless TEST_DATABASE_URL is set.
// Never point this at a shared database: it drops and recreates the ebay_stock_* and ebay_price_changes tables.
// Example (from backend/):
//   docker run --rm -d --name stock-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55433:5432 postgres:16
//   $env:TEST_DATABASE_URL='postgres://postgres:test@127.0.0.1:55433/postgres'; node --test --test-force-exit tests/ebayStockStore.pg.test.js
const test = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');

const { createStockStore, RefreshInProgressError } = require('../services/ebayStockStore');
const { refreshIndex, findPlayer, validName } = require('../services/ebayStockIndex');
const { setPrice, validateRequest } = require('../services/ebayPriceChange');
const { itemXml, sellerListXml, failureXml, successXml, fakeTrading, itemIdOf } = require('./ebayStockTestUtils');

const URL = process.env.TEST_DATABASE_URL;
const skip = URL ? false : 'TEST_DATABASE_URL not set';

const pools = [];
function newStore() {
  const pool = new Pool({ connectionString: URL, max: 5 });
  pools.push(pool);
  return createStockStore({ env: {}, pool });
}

function catalog(ids, priceOf = () => '0.99') {
  return ({ call, body }) => {
    if (call === 'GetSellerList') return sellerListXml({ ids });
    const id = itemIdOf(body);
    return itemXml({ itemId: id, title: `Set ${id}`, variations: Array.from({ length: 300 }, (_, i) => ({ card: `${i + 1} ${i === 44 ? 'Pete Crow-Armstrong' : `Player ${id}-${i + 1}`} Team`, qty: 2, sold: i % 3 === 0 ? 2 : 0, price: priceOf(id, i) })) });
  };
}

test('real Postgres: migration, atomic index replace, search, price-change guard', { skip }, async (t) => {
  const admin = new Pool({ connectionString: URL });
  pools.push(admin);
  await admin.query('DROP TABLE IF EXISTS ebay_stock_picks, ebay_stock_listings, ebay_stock_refresh_runs, ebay_price_changes CASCADE');
  const stores = Array.from({ length: 4 }, newStore);
  t.after(async () => { await Promise.all(pools.map((p) => p.end())); });

  await t.test('concurrent first use migrates once', async () => {
    await Promise.all(stores.map((s) => s.refreshStatus()));
    const { rows } = await admin.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'ebay_stock_%' OR table_name = 'ebay_price_changes' ORDER BY 1");
    assert.deepStrictEqual(rows.map((r) => r.table_name), ['ebay_price_changes', 'ebay_stock_listings', 'ebay_stock_picks', 'ebay_stock_refresh_runs']);
    await assert.rejects(admin.query("INSERT INTO ebay_price_changes (item_id, variation_key, old_price, new_price, currency, method, status, requested_by) VALUES ('1','k',1,2,'USD','m','NOPE','x')"), /check constraint/);
  });

  const ids = Array.from({ length: 40 }, (_, i) => String(900000000 + i));

  await t.test('refresh stores 40 listings x 300 picks and search finds every listing', async () => {
    const { trading } = fakeTrading(catalog(ids));
    const out = await refreshIndex({ trading, store: stores[0] });
    assert.strictEqual(out.itemCount, 40);
    assert.strictEqual(out.pickCount, 12000);
    const found = await findPlayer({ store: stores[1], name: validName('pete crow-armstrong') });
    assert.strictEqual(found.listingCount, 40);
    assert.strictEqual(found.matchCount, 40);
    assert.ok(found.listings.every((l) => l.picks[0].cardNumber === '45' && l.picks[0].soldOut === false && l.picks[0].price.value === '0.99'));
    const none = await findPlayer({ store: stores[1], name: validName('crow armstrongx') });
    assert.strictEqual(none.matchCount, 0);
  });

  await t.test('a failing refresh leaves the stored index untouched and is recorded FAILED', async () => {
    const { trading } = fakeTrading((req) => (itemIdOf(req.body) === ids[17] ? failureXml('GetItem', '518') : catalog(ids, () => '5.00')(req)));
    await assert.rejects(refreshIndex({ trading, store: stores[2] }), (err) => err.kind === 'RATE_LIMITED');
    const { rows } = await admin.query('SELECT count(*)::int AS n, min(price_value)::text AS p FROM ebay_stock_picks');
    assert.deepStrictEqual(rows[0], { n: 12000, p: '0.99' });
    const status = await stores[3].refreshStatus();
    assert.strictEqual(status.lastRun.status, 'FAILED');
    assert.strictEqual(status.lastRun.error_kind, 'RATE_LIMITED');
    assert.strictEqual(status.lastSuccess.item_count, 40);
  });

  await t.test('readers see the old index during a replace, then the new one', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const handler = catalog(ids.slice(0, 2), () => '7.00');
    const { trading } = fakeTrading(async (req) => { if (req.call === 'GetItem') await gate; return handler(req); });
    const pending = refreshIndex({ trading, store: stores[0] });
    await new Promise((r) => setTimeout(r, 50));
    await assert.rejects(stores[1].startRefresh(), RefreshInProgressError);
    assert.strictEqual((await findPlayer({ store: stores[2], name: validName('pete crow armstrong') })).listingCount, 40);
    release();
    await pending;
    const after = await findPlayer({ store: stores[2], name: validName('pete crow armstrong') });
    assert.strictEqual(after.listingCount, 2);
    assert.strictEqual(after.listings[0].picks[0].price.value, '7.00');
  });

  await t.test('concurrent confirmed price changes across pools: one revise, one APPLIED row', async () => {
    const item = ids[0];
    let price = '7.00';
    let writes = 0;
    const { trading } = fakeTrading(async ({ call, body }) => {
      if (call === 'GetItem') return itemXml({ itemId: item, variations: [{ card: '45 Pete Crow-Armstrong Team', qty: 2, price }] });
      writes += 1;
      await new Promise((r) => setTimeout(r, 40));
      price = /<StartPrice>([\d.]+)</.exec(body)[1];
      return successXml(call);
    });
    const request = validateRequest({ itemId: item, cardNumber: '45', newPrice: '9.99', expectedOldPrice: '7.00', confirm: true });
    const results = await Promise.allSettled(stores.map((store) => setPrice({ trading, store, request, requestedBy: 'carl@example.com' })));
    assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['CHANGE_IN_PROGRESS', 'NO_CHANGE', 'PRICE_CHANGED_SINCE_PREVIEW'].includes(r.reason.code)));
    assert.strictEqual(writes, 1);
    const { rows } = await admin.query('SELECT status, old_price::text, new_price::text, read_back_price::text, requested_by FROM ebay_price_changes');
    assert.deepStrictEqual(rows, [{ status: 'APPLIED', old_price: '7.00', new_price: '9.99', read_back_price: '9.99', requested_by: 'carl@example.com' }]);
    const { rows: idx } = await admin.query("SELECT price_value::text AS p FROM ebay_stock_picks WHERE item_id = $1 AND card_number = '45'", [item]);
    assert.strictEqual(idx[0].p, '9.99');
    const log = await stores[3].listChanges({ limit: 5 });
    assert.strictEqual(log.length, 1);
  });

  await t.test('the partial unique index allows only one open change per variation', async () => {
    const base = { itemId: '1', variationKey: 'Card=1 X', cardNumber: '1', card: '1 X', title: 't', oldPrice: '1.00', newPrice: '2.00', currency: 'USD', method: 'ReviseFixedPriceItem', requestedBy: 'x', quantityBefore: 1 };
    const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => stores[i % 4].claimChange(base)));
    assert.strictEqual(claims.filter(Boolean).length, 1);
    const id = claims.find(Boolean);
    await stores[0].finishChange(id, { status: 'UNKNOWN' });
    assert.strictEqual(await stores[1].claimChange(base), null, 'UNKNOWN still blocks');
    await stores[0].finishChange(id, { status: 'FAILED_NOT_APPLIED' });
    assert.ok(await stores[1].claimChange(base), 'a settled row frees the variation');
    await stores[0].finishChange(id, { status: 'APPLIED' });
    const { rows } = await admin.query('SELECT status FROM ebay_price_changes WHERE id = $1', [id]);
    assert.strictEqual(rows[0].status, 'FAILED_NOT_APPLIED', 'terminal rows are never rewritten');
  });
});
