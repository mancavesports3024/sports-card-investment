// Run from backend/: node --test --test-force-exit tests/ebayRefreshTokenHelper.test.js
// Guards the consent scopes so a regenerated seller token keeps pull-list, money, and messaging access.
const test = require('node:test');
const assert = require('node:assert');

const { SELLER_CONSENT_SCOPES } = require('../services/ebaySellerClient');
const { SCOPES, consentUrl, createRailwayVariables, saveWithRollback } = require('../scripts/ebay-refresh-token-helper');

const REQUIRED = [
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  'https://api.ebay.com/oauth/api_scope/commerce.message'
];

test('helper requests exactly the three required seller scopes', () => {
  assert.deepStrictEqual([...SCOPES].sort(), [...REQUIRED].sort());
  assert.strictEqual(SCOPES, SELLER_CONSENT_SCOPES);
});

test('consent URL carries all required scopes, space-separated, to the production authorize endpoint', () => {
  const url = new URL(consentUrl({ ruName: 'Example-RuName', state: 'state123' }));
  assert.strictEqual(url.origin + url.pathname, 'https://auth.ebay.com/oauth2/authorize');
  assert.deepStrictEqual(url.searchParams.get('scope').split(' ').sort(), [...REQUIRED].sort());
  assert.strictEqual(url.searchParams.get('response_type'), 'code');
  assert.strictEqual(url.searchParams.get('redirect_uri'), 'Example-RuName');
  assert.strictEqual(url.searchParams.get('state'), 'state123');
});

// Fake Railway GraphQL endpoint holding variables in memory.
function fakeRailway({ failOn } = {}) {
  const store = { EBAY_REFRESH_TOKEN: 'old-token' };
  const calls = [];
  return {
    store,
    calls,
    async post(url, body, opts) {
      calls.push({ url, body, auth: opts.headers.Authorization });
      if (body.query.startsWith('mutation')) {
        const { name, value } = body.variables.input;
        if (name === failOn) return { status: 200, data: { errors: [{ message: 'denied' }] } };
        store[name] = value;
        return { status: 200, data: { data: { variableUpsert: true } } };
      }
      return { status: 200, data: { data: { variables: { ...store } } } };
    }
  };
}

const ids = { token: 'rw', projectId: 'p', environmentId: 'e', serviceId: 's' };

test('save writes the rollback copy first, then the new token, with skipDeploys, and verifies both', async () => {
  const rw = fakeRailway();
  const result = await saveWithRollback(createRailwayVariables({ ...ids, httpClient: rw }), { current: 'old-token', next: 'new-token' });
  assert.deepStrictEqual(result, { tokenVerified: true, rollbackVerified: true });
  assert.deepStrictEqual(rw.store, { EBAY_REFRESH_TOKEN: 'new-token', EBAY_REFRESH_TOKEN_PREVIOUS: 'old-token' });
  const mutations = rw.calls.filter((c) => c.body.query.startsWith('mutation')).map((c) => c.body.variables.input);
  assert.deepStrictEqual(mutations.map((m) => m.name), ['EBAY_REFRESH_TOKEN_PREVIOUS', 'EBAY_REFRESH_TOKEN']);
  assert.ok(mutations.every((m) => m.skipDeploys === true && m.projectId === 'p' && m.environmentId === 'e' && m.serviceId === 's'));
  assert.ok(rw.calls.every((c) => c.url === 'https://backboard.railway.com/graphql/v2' && c.auth === 'Bearer rw'));
});

test('if the rollback copy cannot be saved, the live token is left untouched', async () => {
  const rw = fakeRailway({ failOn: 'EBAY_REFRESH_TOKEN_PREVIOUS' });
  await assert.rejects(saveWithRollback(createRailwayVariables({ ...ids, httpClient: rw }), { current: 'old-token', next: 'new-token' }), (err) => {
    assert.ok(!err.message.includes('new-token') && !err.message.includes('old-token'));
    return true;
  });
  assert.strictEqual(rw.store.EBAY_REFRESH_TOKEN, 'old-token');
});

test('verification compares fingerprints, so a mismatched saved value is reported', async () => {
  const rw = fakeRailway();
  const vars = createRailwayVariables({ ...ids, httpClient: rw });
  const original = vars.upsert;
  vars.upsert = (name, value) => original(name, name === 'EBAY_REFRESH_TOKEN' ? `${value} ` : value);
  const result = await saveWithRollback(vars, { current: 'old-token', next: 'new-token' });
  assert.strictEqual(result.tokenVerified, false);
});
