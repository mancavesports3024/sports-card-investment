// Run from backend/: node --test --test-force-exit tests/ebayPullList.test.js
const test = require('node:test');
const assert = require('node:assert');

const { buildPullList, parsePick, comparePicks } = require('../services/ebayPullList');
const { SECRET, PII, amt, lineItem, order, fakeClient, startApp, auth } = require('./ebayInternalTestUtils');

const NOW = Date.parse('2026-11-09T20:00:00.000Z');

test('paginates with the documented filter until total is reached', async () => {
  const all = Array.from({ length: 450 }, (_, i) => order({
    id: `o-${i}`,
    created: new Date(NOW - i * 60000).toISOString(),
    items: [lineItem({ id: `li-${i}`, card: `${i} Player` })]
  }));
  const client = fakeClient((url) => {
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    return { total: all.length, orders: all.slice(offset, offset + limit) };
  });
  const result = await buildPullList(client, { lookbackDays: 90, now: NOW });

  assert.strictEqual(client.calls.length, 3);
  for (const c of client.calls) {
    assert.match(c.url, /filter=creationdate:\[2026-08-11T20:00:00\.000Z\.\.\],orderfulfillmentstatus:\{NOT_STARTED\|IN_PROGRESS\}/);
    assert.match(c.url, /limit=200/);
  }
  assert.deepStrictEqual(client.calls.map((c) => /offset=(\d+)/.exec(c.url)[1]), ['0', '200', '400']);
  assert.strictEqual(result.orderCount, 450);
  assert.strictEqual(result.orders[0].orderId, 'o-0');
  assert.strictEqual(result.orders[449].orderId, 'o-449');
});

test('short pages before total produce an error, not a partial list', async () => {
  const client = fakeClient(() => ({ total: 300, orders: [order({ id: 'only', items: [lineItem({ id: 'a', card: '1 A' })] })] }));
  await assert.rejects(buildPullList(client, { now: NOW }), (err) => err.kind === 'INCOMPLETE_DATA');
});

test('groups picks by listing id, sorts numerically, and keeps unusual or missing picks', async () => {
  const o = order({
    id: 'multi',
    items: [
      lineItem({ id: '1', itemId: '222', title: 'Same Title', card: '10 Ten Player' }),
      lineItem({ id: '2', itemId: '111', title: 'Same Title', card: '2 Two Player' }),
      lineItem({ id: '3', itemId: '222', title: 'Same Title', card: '9 Nine Player', qty: 3 }),
      lineItem({ id: '4', itemId: '222', title: 'Same Title', card: '100 Hundred Player' }),
      lineItem({ id: '5', itemId: '222', title: 'Same Title', card: 'Mystery Redemption' }),
      lineItem({ id: '6', itemId: '222', title: 'Same Title', aspects: [] }),
      lineItem({ id: '7', itemId: '333', title: 'Inserts', card: 'US12 Insert Guy' }),
      lineItem({ id: '8', itemId: '333', title: 'Inserts', card: 'BC-7 Bowman Guy' }),
      lineItem({ id: '9', itemId: '333', title: 'Inserts', card: 'US3 Other Guy', shipBy: '2026-11-10T07:59:59.000Z' }),
      lineItem({ id: '10', itemId: '444', title: 'Aspect Order', aspects: [{ name: 'Card', value: '5 Five' }, { name: 'Card Type', value: 'Base' }] }),
      lineItem({ id: '11', itemId: '444', title: 'Aspect Order', aspects: [{ name: 'Card Type', value: 'Base' }] })
    ]
  });
  const result = await buildPullList(fakeClient(() => ({ total: 1, orders: [o] })), { now: NOW });
  const [built] = result.orders;

  assert.strictEqual(built.shipByDate, '2026-11-10T07:59:59.000Z');
  assert.strictEqual(built.totalQuantity, 13);
  const same = built.listings.filter((l) => l.title === 'Same Title');
  assert.deepStrictEqual(same.map((l) => l.legacyItemId), ['111', '222']);

  const l222 = same[1];
  assert.deepStrictEqual(l222.picks.map((p) => p.cardNumber), ['9', '10', '100', null, null]);
  assert.strictEqual(l222.picks[0].quantity, 3);
  assert.strictEqual(l222.totalQuantity, 7);
  assert.deepStrictEqual(l222.picks.slice(3).map((p) => [p.pickStatus, p.raw]), [['MISSING', null], ['UNPARSED', 'Mystery Redemption']]);

  const inserts = built.listings.find((l) => l.legacyItemId === '333');
  assert.deepStrictEqual(inserts.picks.map((p) => p.cardNumber), ['BC-7', 'US3', 'US12']);
  assert.strictEqual(inserts.picks[2].name, 'Insert Guy');

  const aspectOrder = built.listings.find((l) => l.legacyItemId === '444');
  assert.deepStrictEqual(aspectOrder.picks.map((p) => [p.cardNumber, p.pickStatus]), [['5', 'PARSED'], [null, 'MISSING']]);
});

test('parsePick handles common formats and preserves raw text', () => {
  assert.deepStrictEqual(parsePick('12 Mike Trout'), { raw: '12 Mike Trout', cardNumber: '12', name: 'Mike Trout', pickStatus: 'PARSED' });
  assert.strictEqual(parsePick('45 - Name Here').name, 'Name Here');
  assert.strictEqual(parsePick('#7 Name').cardNumber, '7');
  assert.strictEqual(parsePick('T88-3 Name').cardNumber, 'T88-3');
  assert.strictEqual(parsePick('  ').pickStatus, 'MISSING');
  const sorted = ['100 a', '20 b', '3 c', 'zzz', '3a d'].map(parsePick).sort(comparePicks).map((p) => p.raw);
  assert.deepStrictEqual(sorted, ['3 c', '3a d', '20 b', '100 a', 'zzz']);
});

test('excludes cancelled, refunded, and fulfilled orders; partial orders only return remaining picks', async () => {
  const orders = [
    order({ id: 'cancelled', cancel: 'CANCELED', items: [lineItem({ id: 'c1', card: '1 A' })] }),
    order({ id: 'refunded', payment: 'FULLY_REFUNDED', items: [lineItem({ id: 'r1', card: '1 A' })] }),
    order({ id: 'fulfilled', status: 'FULFILLED', items: [lineItem({ id: 'f1', card: '1 A', status: 'FULFILLED' })] }),
    order({
      id: 'partial',
      status: 'IN_PROGRESS',
      hrefs: ['https://api.ebay.com/sell/fulfillment/v1/order/partial/shipping_fulfillment/F1'],
      items: [
        lineItem({ id: 'p1', card: '1 Shipped', status: 'FULFILLED' }),
        lineItem({ id: 'p2', card: '2 Half Shipped', qty: 4, status: 'IN_PROGRESS' }),
        lineItem({ id: 'p3', card: '3 Not Shipped', qty: 2 }),
        lineItem({ id: 'p4', card: '4 Unknown Shipped Qty', qty: 2, status: 'IN_PROGRESS' })
      ]
    }),
    order({ id: 'label-bought', status: 'IN_PROGRESS', hrefs: ['x'], items: [lineItem({ id: 'l1', card: '9 All Labeled', qty: 1, status: 'IN_PROGRESS' })] }),
    order({ id: 'cancel-requested', cancel: 'CANCEL_REQUESTED', items: [lineItem({ id: 'q1', card: '5 Q' })] })
  ];
  const client = fakeClient((url) => {
    if (url.pathname.endsWith('/partial/shipping_fulfillment')) {
      return { fulfillments: [{ fulfillmentId: 'F1', shipmentTrackingNumber: 'TRACK-1', lineItems: [{ lineItemId: 'p1', quantity: 1 }, { lineItemId: 'p2', quantity: 3 }, { lineItemId: 'p4' }] }] };
    }
    if (url.pathname.endsWith('/label-bought/shipping_fulfillment')) {
      return { fulfillments: [{ fulfillmentId: 'F2', lineItems: [{ lineItemId: 'l1', quantity: 1 }] }] };
    }
    return { total: orders.length, orders };
  });
  const result = await buildPullList(client, { now: NOW });

  assert.deepStrictEqual(result.orders.map((o) => o.orderId).sort(), ['cancel-requested', 'partial']);
  assert.deepStrictEqual(result.excluded, { cancelled: 1, fullyRefunded: 1, fullyFulfilled: 1, noRemainingItems: 1 });
  assert.strictEqual(result.orders.find((o) => o.orderId === 'cancel-requested').cancelRequested, true);

  const partial = result.orders.find((o) => o.orderId === 'partial');
  const picks = partial.listings[0].picks;
  assert.deepStrictEqual(picks.map((p) => [p.cardNumber, p.quantity]), [['2', 1], ['3', 2], ['4', 2]]);
  assert.strictEqual(picks[0].alreadyShippedQuantity, 3);
  assert.strictEqual(picks[2].shippedQuantityUnknown, true);
  assert.strictEqual(partial.totalQuantity, 5);
  assert.ok(!JSON.stringify(result).includes('TRACK-1'));
});

test('money fields keep currency and distinguish absent from zero', async () => {
  const orders = [
    order({ id: 'm1', items: [lineItem({ id: 'a', card: '1 A' })], money: { priceSubtotal: amt('31.10'), priceDiscount: amt('-1.54'), total: amt('29.56'), totalDueSeller: amt('25.65'), totalMarketplaceFee: amt('3.91') } }),
    order({ id: 'm2', items: [lineItem({ id: 'b', card: '1 B' })], money: { priceSubtotal: amt('10.00', 'CAD'), priceDiscount: amt('0.00', 'CAD'), total: amt('10.00', 'CAD') } })
  ];
  const result = await buildPullList(fakeClient(() => ({ total: 2, orders })), { now: NOW });
  const m1 = result.orders.find((o) => o.orderId === 'm1').money;
  assert.deepStrictEqual(m1, {
    priceSubtotal: { value: '31.10', currency: 'USD' },
    priceDiscount: { value: '-1.54', currency: 'USD' },
    total: { value: '29.56', currency: 'USD' },
    totalDueSeller: { value: '25.65', currency: 'USD' },
    totalMarketplaceFee: { value: '3.91', currency: 'USD' }
  });
  const m2 = result.orders.find((o) => o.orderId === 'm2').money;
  assert.deepStrictEqual(m2.priceDiscount, { value: '0.00', currency: 'CAD' });
  assert.strictEqual(m2.totalDueSeller, null);
  assert.strictEqual(m2.totalMarketplaceFee, null);
  assert.ok(result.notes.some((n) => /not final profit/.test(n)));
});

test('serialized endpoint response contains only allowlisted data', async () => {
  const orders = [order({ id: 'pii', items: [lineItem({ id: 'a', card: '1 A' })], money: { total: amt('5.00') } })];
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client: fakeClient(() => ({ total: 1, orders })), now: () => NOW });
  try {
    const res = await app.get('/ebay-pull-list', auth);
    const text = await res.text();
    assert.strictEqual(res.status, 200);
    for (const value of [...Object.values(PII), SECRET]) assert.ok(!text.includes(value), `leaked ${value}`);
    const body = JSON.parse(text);
    assert.deepStrictEqual(Object.keys(body.orders[0]).sort(), ['buyerUsername', 'cancelRequested', 'creationDate', 'listings', 'money', 'orderFulfillmentStatus', 'orderId', 'shipByDate', 'totalQuantity']);
    assert.strictEqual(body.orders[0].buyerUsername, 'buyer_pii');
  } finally { await app.close(); }
});
