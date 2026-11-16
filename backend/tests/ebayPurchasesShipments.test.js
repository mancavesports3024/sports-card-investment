// Run from backend/: node --test --test-force-exit tests/ebayPurchasesShipments.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createDeliveryResolver, STATES } = require('../services/ebayDeliveryState');
const { SECRET, startApp, auth } = require('./ebayInternalTestUtils');
const { SCOPES } = require('../services/ebaySellerClient');

const NOW = Date.parse('2026-11-16T18:00:00.000Z');

function buyerOrderXml() {
  return {
    OrderArray: {
      Order: {
        OrderID: '11-1',
        CreatedTime: '2026-11-10T12:00:00.000Z',
        PaidTime: '2026-11-10T12:05:00.000Z',
        SellerUserID: 'seller_a',
        TransactionArray: {
          Transaction: {
            Item: { ItemID: '111', Title: 'Bought card lot' },
            TransactionPrice: { _: '2.99', $: { currencyID: 'USD' } }
          }
        }
      }
    },
    HasMoreOrders: 'false'
  };
}

function sellerOrderXml() {
  return {
    OrderArray: {
      Order: {
        OrderID: '22-2',
        CreatedTime: '2026-11-11T12:00:00.000Z',
        ShippedTime: '2026-11-12T09:00:00.000Z',
        BuyerUserID: 'buyer_b',
        TransactionArray: {
          Transaction: {
            Item: { ItemID: '222', Title: 'Sold pick' },
            TransactionPrice: { _: '0.99', $: { currencyID: 'USD' } },
            ShippingDetails: {
              ShipmentTrackingDetails: {
                ShippingCarrierUsed: 'USPS',
                ShipmentTrackingNumber: '9400108106244666787591'
              }
            }
          }
        }
      }
    },
    HasMoreOrders: 'false'
  };
}

test('purchases and shipments endpoints require CRON_SECRET and map responses', async () => {
  const delivery = createDeliveryResolver({ env: {}, now: () => NOW });
  const tradingDocs = { Buyer: buyerOrderXml(), Seller: sellerOrderXml() };
  const tradingCalls = [];

  const client = {
    async getAccessToken(scope) {
      if (scope === SCOPES.fulfillment) {
        const err = new Error('denied');
        err.kind = 'PERMISSION_DENIED';
        err.oauthError = 'invalid_scope';
        err.status = 400;
        throw err;
      }
      return 'access-token';
    },
    async get() {
      const err = new Error('denied');
      err.kind = 'PERMISSION_DENIED';
      err.status = 403;
      throw err;
    },
    invalidate() {}
  };

  // Stub Trading over HTTP by replacing createTradingClient usage: inject delivery and a custom build via
  // monkeypatch of ebayOrdersTrading through a thin seller client that still hits real createTradingClient.
  // Avoid live eBay: stub trading.read by injecting a prebuilt delivery + fake fetchOrders via module override.
  const ordersMod = require('../services/ebayOrdersTrading');
  const originalResolve = ordersMod.resolveTradingClient;
  const originalFetch = ordersMod.fetchOrders;
  ordersMod.resolveTradingClient = async () => ({
    read: async (callName, innerXml) => {
      tradingCalls.push({ callName, innerXml });
      const role = /<OrderRole>(\w+)<\/OrderRole>/.exec(innerXml)[1];
      return tradingDocs[role];
    }
  });
  ordersMod.fetchOrders = async (trading, args) => {
    const doc = await trading.read('GetOrders', `<OrderRole>${args.role}</OrderRole>`);
    return require('../services/ebayTradingClient').toArray(doc.OrderArray && doc.OrderArray.Order);
  };

  const app = await startApp({ env: { CRON_SECRET: SECRET }, client, delivery, now: () => NOW });
  try {
    assert.strictEqual((await app.get('/ebay-purchases?days=30')).status, 401);

    const purchasesRes = await app.get('/ebay-purchases?days=30', auth);
    assert.strictEqual(purchasesRes.status, 200);
    const purchases = await purchasesRes.json();
    assert.strictEqual(purchases.purchaseCount, 1);
    assert.strictEqual(purchases.purchases[0].item, 'Bought card lot');
    assert.strictEqual(purchases.purchases[0].seller, 'seller_a');
    assert.strictEqual(purchases.purchases[0].paid, true);
    assert.strictEqual(purchases.purchases[0].shipped, false);
    assert.strictEqual(purchases.purchases[0].deliveryState, STATES.AWAITING);
    assert.strictEqual(purchases.carrierSignupNeeded, true);
    assert.ok(!JSON.stringify(purchases).includes(SECRET));

    const shipmentsRes = await app.get('/ebay-shipments?days=30', auth);
    assert.strictEqual(shipmentsRes.status, 200);
    const shipments = await shipmentsRes.json();
    assert.strictEqual(shipments.shipmentCount, 1);
    assert.strictEqual(shipments.shipments[0].buyer, 'buyer_b');
    assert.strictEqual(shipments.shipments[0].trackingNumber, '9400108106244666787591');
    assert.strictEqual(shipments.shipments[0].deliveryState, STATES.UNKNOWN);
    assert.ok(shipments.shipments[0].trackingUrl.includes('usps.com'));
    assert.ok(shipments.fulfillmentFallback);
    assert.match(shipments.fulfillmentFallback.missing || '', /sell\.fulfillment/);

    // Existing pull-list still authorized the same way (regression: router still mounts).
    const pull = await app.get('/ebay-pull-list?lookbackDays=1', auth);
    // Fake client.get throws PERMISSION_DENIED → 502, not 401/404.
    assert.strictEqual(pull.status, 502);
  } finally {
    ordersMod.resolveTradingClient = originalResolve;
    ordersMod.fetchOrders = originalFetch;
    await app.close();
  }
});

test('invalid days rejected; refresh respects delivery cache TTL', async () => {
  let now = NOW;
  let carrierCalls = 0;
  const http = {
    async request(config) {
      if (String(config.url).includes('/oauth2/')) return { status: 200, data: { access_token: 't', expires_in: 3600 } };
      carrierCalls += 1;
      return { status: 200, data: { statusSummary: 'Delivered' } };
    }
  };
  const delivery = createDeliveryResolver({
    env: { USPS_CLIENT_ID: 'id', USPS_CLIENT_SECRET: 'secret' },
    http,
    now: () => now
  });

  const first = await delivery.resolve({ trackingNumber: '9400108106244666787591', carrier: 'USPS', shipped: true });
  assert.strictEqual(first.deliveryState, STATES.DELIVERED);
  assert.strictEqual(carrierCalls, 1);
  now += 1000;
  await delivery.resolve({ trackingNumber: '9400108106244666787591', carrier: 'USPS', shipped: true }, { force: true });
  assert.strictEqual(carrierCalls, 1);

  const ordersMod = require('../services/ebayOrdersTrading');
  const originalResolve = ordersMod.resolveTradingClient;
  const originalFetch = ordersMod.fetchOrders;
  ordersMod.resolveTradingClient = async () => ({ read: async () => sellerOrderXml() });
  ordersMod.fetchOrders = async (trading) => {
    const doc = await trading.read();
    return require('../services/ebayTradingClient').toArray(doc.OrderArray && doc.OrderArray.Order);
  };
  const client = {
    async getAccessToken(scope) {
      if (scope === SCOPES.fulfillment) {
        const err = new Error('denied');
        err.kind = 'PERMISSION_DENIED';
        err.oauthError = 'invalid_scope';
        throw err;
      }
      return 't';
    },
    async get() {
      const err = new Error('denied');
      err.kind = 'PERMISSION_DENIED';
      throw err;
    }
  };
  const app = await startApp({ env: { CRON_SECRET: SECRET }, client, delivery, now: () => now });
  try {
    assert.strictEqual((await app.get('/ebay-purchases?days=0', auth)).status, 400);
    assert.strictEqual((await app.get('/ebay-shipments?days=abc', auth)).status, 400);
    const res = await app.get('/ebay-shipments?days=30&refresh=1', auth);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(carrierCalls, 1); // still cached
  } finally {
    ordersMod.resolveTradingClient = originalResolve;
    ordersMod.fetchOrders = originalFetch;
    await app.close();
  }
});

test('staff board routes require Google staff auth', async () => {
  const http = require('node:http');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { createEbayStaffRouter } = require('../routes/ebayStaff');
  const JWT_SECRET = 'staff-board-secret-0123456789';
  const delivery = createDeliveryResolver({ env: {} });
  const client = { async getAccessToken() { return 't'; }, async get() { return { orders: [], total: 0 }; } };
  const ordersMod = require('../services/ebayOrdersTrading');
  const originalResolve = ordersMod.resolveTradingClient;
  const originalFetch = ordersMod.fetchOrders;
  ordersMod.resolveTradingClient = async () => ({ read: async () => buyerOrderXml() });
  ordersMod.fetchOrders = async (trading) => {
    const doc = await trading.read();
    return require('../services/ebayTradingClient').toArray(doc.OrderArray && doc.OrderArray.Order);
  };

  const app = express();
  app.use('/api/staff/ebay', createEbayStaffRouter({ env: { JWT_SECRET }, client, delivery, log: () => {} }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api/staff/ebay`;
  const sign = (email) => jwt.sign({ id: '1', email, provider: 'google' }, JWT_SECRET, { expiresIn: '1h' });
  try {
    assert.strictEqual((await fetch(`${base}/ebay-purchases?days=30`)).status, 401);
    assert.strictEqual((await fetch(`${base}/ebay-purchases?days=30`, { headers: { Authorization: `Bearer ${sign('random@gmail.com')}` } })).status, 403);
    const ok = await fetch(`${base}/ebay-purchases?days=30`, { headers: { Authorization: `Bearer ${sign('mancavesportscardsllc@gmail.com')}` } });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    ordersMod.resolveTradingClient = originalResolve;
    ordersMod.fetchOrders = originalFetch;
    await new Promise((r) => server.close(r));
  }
});
