// Run from backend/: node --test --test-force-exit tests/ebayPriceChange.test.js
// Covers POST /ebay-set-price: exact-change confirmation, single-variation validation, the revise payloads,
// duplicate protection, audit rows, and eBay read-back. eBay and the database are mocked; nothing is changed.
const test = require('node:test');
const assert = require('node:assert');

const { SECRET, startApp, auth } = require('./ebayInternalTestUtils');
const { itemXml, failureXml, successXml, fakeTrading, memoryStockStore } = require('./ebayStockTestUtils');

const env = { CRON_SECRET: SECRET };
const ITEM = '398443804414';

// A mutable fake listing: revise calls change the stored price unless told otherwise.
function listing({ variations, status = 'Active', reviseResult = 'apply', readBack = null } = {}) {
  const state = {
    variations: variations || [
      { card: '45 Pete Crow-Armstrong Chicago Cubs', qty: 3, sold: 1, price: '0.99', extra: [['Parallel', 'Base']] },
      { card: '3 Yordan Alvarez Houston Astros', qty: 1, sold: 1, price: '1.49' },
      { card: '2 Cody Bellinger', qty: 2, sold: 0, price: '0.99', sku: 'SKU-2' }
    ],
    reviseResult,
    readBack
  };
  const handler = ({ call, body }) => {
    if (call === 'GetItem') {
      if (state.readBack && state.revised) return state.readBack(state);
      return itemXml({ itemId: ITEM, status, variations: state.variations });
    }
    if (typeof state.reviseResult === 'function') return state.reviseResult(body);
    if (state.reviseResult === 'apply') {
      const price = /<StartPrice>([\d.]+)<\/StartPrice>/.exec(body)[1];
      const sku = (/<SKU>([^<]+)<\/SKU>/.exec(body) || [])[1];
      const card = (/<Name>Card<\/Name><Value>([^<]+)<\/Value>/.exec(body) || [])[1];
      const v = state.variations.find((x) => (sku && x.sku === sku) || (card && x.card === card));
      v.price = price;
      state.revised = true;
      return successXml(call);
    }
    return state.reviseResult;
  };
  return { state, ...fakeTrading(handler) };
}

async function withApp(fake, store, fn) {
  const app = await startApp({ env, trading: fake.trading, stockStore: store });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

const post = (app, body, headers = auth) => fetch(`${app.base}/ebay-set-price`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const confirm = (extra = {}) => ({ itemId: ITEM, cardNumber: '45', newPrice: '2.49', expectedOldPrice: '0.99', confirm: true, ...extra });

test('validation rejects malformed requests before any eBay call', async (t) => {
  const fake = listing();
  await withApp(fake, memoryStockStore(), async (app) => {
    const cases = [
      [{ itemId: ITEM, cardNumber: '45' }, 'INVALID_PRICE'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: '0.50' }, 'PRICE_OUT_OF_RANGE'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: '1.999' }, 'INVALID_PRICE'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: -2 }, 'INVALID_PRICE'],
      [{ itemId: 'abc', cardNumber: '45', newPrice: '2' }, 'INVALID_ITEM_ID'],
      [{ itemId: ITEM, cardNumber: '45,46', newPrice: '2' }, 'INVALID_CARD_NUMBER'],
      [{ itemId: ITEM, cardNumber: ['45', '46'], newPrice: '2' }, 'INVALID_CARD_NUMBER'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: '2', confirm: true }, 'EXPECTED_OLD_PRICE_REQUIRED'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: '2', confirm: 'yes' }, 'INVALID_CONFIRM'],
      [{ itemId: ITEM, cardNumber: '45', newPrice: '2', variations: [] }, 'INVALID_BODY']
    ];
    for (const [body, code] of cases) {
      const res = await post(app, body);
      assert.strictEqual(res.status, 400, JSON.stringify(body));
      assert.strictEqual((await res.json()).error, code);
    }
    assert.strictEqual((await post(app, confirm(), {})).status, 401);
    assert.strictEqual(fake.calls.length, 0);
  });
});

test('preview reads live, writes nothing, and returns the exact change to approve', async () => {
  const fake = listing();
  const store = memoryStockStore();
  await withApp(fake, store, async (app) => {
    const res = await post(app, { itemId: ITEM, cardNumber: '#45', newPrice: '2.5' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'preview');
    assert.deepStrictEqual(body.change.oldPrice, { value: '0.99', currency: 'USD' });
    assert.deepStrictEqual(body.change.newPrice, { value: '2.50', currency: 'USD' });
    assert.strictEqual(body.change.card, '45 Pete Crow-Armstrong Chicago Cubs');
    assert.strictEqual(body.change.quantityAvailable, 2);
    assert.strictEqual(body.change.method, 'ReviseFixedPriceItem');
    assert.deepStrictEqual(body.confirmWith, { itemId: ITEM, cardNumber: '45', newPrice: '2.50', expectedOldPrice: '0.99', confirm: true });
    assert.strictEqual(fake.writes().length, 0);
    assert.strictEqual(store.state.changes.length, 0);
  });
});

test('confirmed change: one ReviseFixedPriceItem for one variation, read back, logged', async () => {
  const fake = listing();
  const store = memoryStockStore();
  await withApp(fake, store, async (app) => {
    const res = await post(app, confirm());
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    assert.strictEqual(body.status, 'applied');
    assert.deepStrictEqual(body.oldPrice, { value: '0.99', currency: 'USD' });
    assert.deepStrictEqual(body.newPrice, { value: '2.49', currency: 'USD' });
    assert.deepStrictEqual(body.readBack, { price: { value: '2.49', currency: 'USD' }, quantityAvailable: 2 });
    assert.deepStrictEqual(body.warnings, []);

    const writes = fake.writes();
    assert.strictEqual(writes.length, 1);
    const xml = writes[0].body;
    assert.strictEqual(writes[0].call, 'ReviseFixedPriceItem');
    assert.strictEqual((xml.match(/<Variation>/g) || []).length, 1, 'exactly one variation');
    assert.match(xml, /<StartPrice>2\.49<\/StartPrice>/);
    assert.match(xml, /<Quantity>2<\/Quantity>/, 'available quantity (3 - 1 sold), never the GetItem total');
    assert.match(xml, /<NameValueList><Name>Parallel<\/Name><Value>Base<\/Value><\/NameValueList><NameValueList><Name>Card<\/Name><Value>45 Pete Crow-Armstrong Chicago Cubs<\/Value><\/NameValueList>/);
    assert.doesNotMatch(xml, /<SKU>/);
    assert.doesNotMatch(xml, /Yordan|Bellinger/);
    assert.strictEqual(fake.calls.filter((c) => c.call === 'GetItem').length, 2, 'one read before, one read-back after');

    assert.strictEqual(store.state.changes.length, 1);
    const row = store.state.changes[0];
    assert.strictEqual(row.status, 'APPLIED');
    assert.strictEqual(row.old_price, '0.99');
    assert.strictEqual(row.new_price, '2.49');
    assert.strictEqual(row.read_back_price, '2.49');
    assert.strictEqual(row.requested_by, 'internal-api');
    assert.strictEqual(row.quantity_before, 2);
    assert.strictEqual(row.quantity_after, 2);
    assert.deepStrictEqual(store.state.priceUpdates, [{ itemId: ITEM, variationKey: 'Card=45 Pete Crow-Armstrong Chicago Cubs;Parallel=Base', price: '2.49' }]);

    const log = await (await app.get('/ebay-price-changes', auth)).json();
    assert.strictEqual(log.changes[0].status, 'APPLIED');
    assert.strictEqual(log.changes[0].newPrice, '2.49');

    const again = await post(app, confirm());
    assert.strictEqual(again.status, 409);
    assert.strictEqual((await again.json()).error, 'NO_CHANGE', 'the same change is never re-applied');
    assert.strictEqual(fake.writes().length, 1);
  });
});

test('a variation with a unique SKU is revised by price only (ReviseInventoryStatus, no quantity)', async () => {
  const fake = listing();
  await withApp(fake, memoryStockStore(), async (app) => {
    const res = await post(app, { itemId: ITEM, cardNumber: '2', newPrice: '1.25', expectedOldPrice: '0.99', confirm: true });
    assert.strictEqual(res.status, 200);
    const [write] = fake.writes();
    assert.strictEqual(write.call, 'ReviseInventoryStatus');
    assert.strictEqual(write.body.match(/<InventoryStatus>.*<\/InventoryStatus>/)[0], `<InventoryStatus><ItemID>${ITEM}</ItemID><SKU>SKU-2</SKU><StartPrice>1.25</StartPrice></InventoryStatus>`);
  });
});

test('refusals that never write', async (t) => {
  const refusals = [
    ['live price drifted since preview', {}, confirm({ expectedOldPrice: '0.89' }), 409, 'PRICE_CHANGED_SINCE_PREVIEW'],
    ['sold-out variation', {}, confirm({ cardNumber: '3', expectedOldPrice: '1.49' }), 409, 'VARIATION_SOLD_OUT'],
    ['card not in listing', {}, confirm({ cardNumber: '99' }), 404, 'CARD_NOT_FOUND'],
    ['same as live price', {}, confirm({ newPrice: '0.99' }), 409, 'NO_CHANGE'],
    ['listing ended', { status: 'Completed' }, confirm(), 409, 'LISTING_NOT_ACTIVE'],
    ['not a variation listing', { variations: null }, confirm(), 422, 'NOT_A_VARIATION_LISTING']
  ];
  for (const [name, opts, body, status, code] of refusals) {
    await t.test(name, async () => {
      const fake = listing(opts);
      if (opts.variations === null) fake.state.variations = null;
      const store = memoryStockStore();
      await withApp(fake, store, async (app) => {
        const res = await post(app, body);
        assert.strictEqual(res.status, status);
        assert.strictEqual((await res.json()).error, code);
        assert.strictEqual(fake.writes().length, 0);
        assert.strictEqual(store.state.changes.length, 0);
      });
    });
  }

  await t.test('two variations share the card number: ambiguous unless card text is given', async () => {
    const fake = listing({ variations: [{ card: '45 Pete Crow-Armstrong', qty: 1 }, { card: '45 Pete Crow-Armstrong Refractor', qty: 1, price: '2.99' }] });
    await withApp(fake, memoryStockStore(), async (app) => {
      const res = await post(app, confirm());
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.error, 'AMBIGUOUS_CARD');
      assert.deepStrictEqual(body.candidates, ['45 Pete Crow-Armstrong', '45 Pete Crow-Armstrong Refractor']);
      assert.strictEqual(fake.writes().length, 0);
      const ok = await post(app, confirm({ card: '45 Pete Crow-Armstrong Refractor', expectedOldPrice: '2.99' }));
      assert.strictEqual(ok.status, 200);
      assert.match(fake.writes()[0].body, /Refractor/);
    });
  });
});

test('eBay rejects the revise: logged FAILED_NOT_APPLIED and a retry is allowed', async () => {
  const fake = listing({ reviseResult: failureXml('ReviseFixedPriceItem', '21916750') });
  const store = memoryStockStore();
  await withApp(fake, store, async (app) => {
    const res = await post(app, confirm());
    assert.strictEqual(res.status, 502);
    assert.strictEqual((await res.json()).error, 'UPSTREAM_ERROR');
    assert.strictEqual(store.state.changes[0].status, 'FAILED_NOT_APPLIED');
    assert.strictEqual(store.state.changes[0].ebay_error_codes, '21916750');
    fake.state.reviseResult = 'apply';
    assert.strictEqual((await post(app, confirm())).status, 200);
    assert.strictEqual(fake.writes().length, 2);
  });
});

test('unconfirmed outcome: UNKNOWN blocks repeats until a later read reconciles it', async (t) => {
  await t.test('timeout, eBay never applied it: next request reconciles to FAILED_NOT_APPLIED then proceeds', async () => {
    const fake = listing({ reviseResult: () => { const e = new Error('t'); e.code = 'ECONNABORTED'; throw e; } });
    const store = memoryStockStore();
    await withApp(fake, store, async (app) => {
      const res = await post(app, confirm());
      assert.strictEqual(res.status, 502);
      assert.strictEqual((await res.json()).error, 'PRICE_CHANGE_STATUS_UNKNOWN');
      assert.strictEqual(store.state.changes[0].status, 'UNKNOWN');
      fake.state.reviseResult = 'apply';
      assert.strictEqual((await post(app, confirm())).status, 200);
      assert.strictEqual(store.state.changes[0].status, 'FAILED_NOT_APPLIED');
      assert.strictEqual(store.state.changes[0].note, 'RECONCILED_BY_LATER_READ');
      assert.strictEqual(store.state.changes[1].status, 'APPLIED');
    });
  });

  await t.test('timeout but eBay did apply it: reconciled to APPLIED and the repeat is NO_CHANGE', async () => {
    const fake = listing();
    fake.state.reviseResult = (body) => {
      fake.state.variations[0].price = /<StartPrice>([\d.]+)</.exec(body)[1];
      const e = new Error('t'); e.code = 'ETIMEDOUT'; throw e;
    };
    const store = memoryStockStore();
    await withApp(fake, store, async (app) => {
      assert.strictEqual((await post(app, confirm())).status, 502);
      const again = await post(app, confirm());
      assert.strictEqual(again.status, 409);
      const body = await again.json();
      assert.strictEqual(body.error, 'NO_CHANGE');
      assert.strictEqual(store.state.changes[0].status, 'APPLIED');
      assert.strictEqual(store.state.changes[0].note, 'RECONCILED_BY_LATER_READ');
      assert.strictEqual(fake.writes().length, 1);
    });
  });

  await t.test('read-back shows a different price: UNKNOWN, and further changes are blocked', async () => {
    const fake = listing({ readBack: (s) => itemXml({ itemId: ITEM, variations: s.variations.map((v, i) => (i === 0 ? { ...v, price: '1.11' } : v)) }) });
    const store = memoryStockStore();
    await withApp(fake, store, async (app) => {
      const res = await post(app, confirm());
      assert.strictEqual(res.status, 502);
      const body = await res.json();
      assert.strictEqual(body.error, 'PRICE_CHANGE_STATUS_UNKNOWN');
      assert.strictEqual(body.readBackPrice, '1.11');
      assert.strictEqual(store.state.changes[0].status, 'UNKNOWN');
      assert.strictEqual(store.state.changes[0].note, 'READ_BACK_MISMATCH');
      const blocked = await post(app, confirm({ expectedOldPrice: '1.11', newPrice: '3.00' }));
      assert.strictEqual(blocked.status, 409);
      assert.strictEqual((await blocked.json()).error, 'CHANGE_STATUS_UNKNOWN');
      assert.strictEqual(fake.writes().length, 1);
    });
  });

  await t.test('read-back fails: UNKNOWN with a clear message', async () => {
    const fake = listing({ readBack: () => ({ status: 500, data: '' }) });
    const store = memoryStockStore();
    await withApp(fake, store, async (app) => {
      const res = await post(app, confirm());
      assert.strictEqual(res.status, 502);
      assert.match((await res.json()).message, /read-back failed/);
      assert.strictEqual(store.state.changes[0].note, 'READ_BACK_FAILED');
    });
  });

  await t.test('quantity moved during the update is applied with a warning', async () => {
    const fake = listing({ readBack: (s) => itemXml({ itemId: ITEM, variations: s.variations.map((v, i) => (i === 0 ? { ...v, sold: 2 } : v)) }) });
    await withApp(fake, memoryStockStore(), async (app) => {
      const body = await (await post(app, confirm())).json();
      assert.strictEqual(body.status, 'applied');
      assert.deepStrictEqual(body.warnings, ['QUANTITY_CHANGED_DURING_UPDATE']);
    });
  });
});

test('concurrent confirmed requests for one variation write once', async () => {
  const fake = listing();
  fake.state.reviseResult = async (body) => {
    await new Promise((r) => setTimeout(r, 30));
    fake.state.variations[0].price = /<StartPrice>([\d.]+)</.exec(body)[1];
    fake.state.revised = true;
    return successXml('ReviseFixedPriceItem');
  };
  const store = memoryStockStore();
  await withApp(fake, store, async (app) => {
    const results = await Promise.all(Array.from({ length: 5 }, () => post(app, confirm())));
    const statuses = results.map((r) => r.status).sort();
    assert.deepStrictEqual(statuses, [200, 409, 409, 409, 409]);
    assert.strictEqual(fake.writes().length, 1);
    assert.strictEqual(store.state.changes.length, 1);
  });
});
