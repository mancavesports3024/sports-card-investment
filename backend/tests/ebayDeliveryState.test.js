// Run from backend/: node --test --test-force-exit tests/ebayDeliveryState.test.js
const test = require('node:test');
const assert = require('node:assert');
const { createDeliveryResolver, mapUspsStatus, STATES, CACHE_TTL_MS } = require('../services/ebayDeliveryState');

test('mapUspsStatus normalizes carrier text without inventing states from empty input', () => {
  assert.strictEqual(mapUspsStatus(''), STATES.UNKNOWN);
  assert.strictEqual(mapUspsStatus('Delivered'), STATES.DELIVERED);
  assert.strictEqual(mapUspsStatus('Out for Delivery'), STATES.OUT_FOR_DELIVERY);
  assert.strictEqual(mapUspsStatus('In Transit to Next Facility'), STATES.IN_TRANSIT);
  assert.strictEqual(mapUspsStatus('Accepted at USPS Origin Facility'), STATES.AT_USPS);
});

test('without tracking and not shipped → Awaiting shipment; never treats ship-create as transit', async () => {
  const delivery = createDeliveryResolver({ env: {} });
  const r = await delivery.resolve({ shipped: false });
  assert.strictEqual(r.deliveryState, STATES.AWAITING);
  assert.strictEqual(r.deliveryStateSource, 'none');
  assert.strictEqual(r.trackingUrl, null);
});

test('shipped + tracking without USPS credentials → Unknown + signup flag + tracking link', async () => {
  const delivery = createDeliveryResolver({ env: {} });
  const r = await delivery.resolve({ shipped: true, carrier: 'USPS', trackingNumber: '9400111899223033005282' });
  assert.strictEqual(r.deliveryState, STATES.UNKNOWN);
  assert.strictEqual(r.deliveryStateSource, 'ebay');
  assert.strictEqual(r.carrierSignupNeeded, true);
  assert.match(r.trackingUrl, /usps\.com/);
  assert.ok(delivery.signupFlag());
});

test('cache rechecks a tracking number at most every 6 hours, including force refresh', async () => {
  let now = 1_000_000;
  let uspsCalls = 0;
  const http = {
    async request(config) {
      if (String(config.url).includes('/oauth2/')) {
        return { status: 200, data: { access_token: 't', expires_in: 3600 } };
      }
      uspsCalls += 1;
      return { status: 200, data: { statusSummary: 'In Transit' } };
    }
  };
  const delivery = createDeliveryResolver({
    env: { USPS_CLIENT_ID: 'id', USPS_CLIENT_SECRET: 'secret' },
    http,
    now: () => now
  });

  const first = await delivery.resolve({ trackingNumber: '9400111899223033005282', carrier: 'USPS', shipped: true });
  assert.strictEqual(first.deliveryState, STATES.IN_TRANSIT);
  assert.strictEqual(first.deliveryStateSource, 'carrier');
  assert.strictEqual(uspsCalls, 1);

  now += 60_000;
  const cached = await delivery.resolve({ trackingNumber: '9400111899223033005282', carrier: 'USPS', shipped: true }, { force: true });
  assert.strictEqual(cached.cacheHit, true);
  assert.strictEqual(uspsCalls, 1);

  now += CACHE_TTL_MS;
  const refreshed = await delivery.resolve({ trackingNumber: '9400111899223033005282', carrier: 'USPS', shipped: true }, { force: true });
  assert.strictEqual(refreshed.cacheHit, false);
  assert.strictEqual(uspsCalls, 2);
});
