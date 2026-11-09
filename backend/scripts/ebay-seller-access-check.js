#!/usr/bin/env node
// Read-only eBay seller API access check.
// Usage (from backend/): node scripts/ebay-seller-access-check.js [orderId]
// Requires EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REFRESH_TOKEN in the environment (or backend/.env).
// Prints only HTTP statuses, eBay error ids/messages (redacted), counts, and field-presence facts.
// Never prints credentials, tokens, buyer data, or raw provider payloads. Makes no eBay writes.
const path = require('path');
const UNDER_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);
if (!UNDER_RAILWAY) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SCOPE = (s) => `https://api.ebay.com/oauth/api_scope/${s}`;
const TIMEOUT_MS = 20000;

const PROBES = [
  { api: 'Fulfillment', scopes: ['sell.fulfillment.readonly', 'sell.fulfillment'], url: 'https://api.ebay.com/sell/fulfillment/v1/order?limit=1' },
  { api: 'Finance', scopes: ['sell.finances'], url: 'https://apiz.ebay.com/sell/finances/v1/transaction?limit=1', marketplace: true },
  { api: 'Analytics', scopes: ['sell.analytics.readonly'], url: 'https://api.ebay.com/sell/analytics/v1/seller_standards_profile' },
  { api: 'Inventory', scopes: ['sell.inventory.readonly', 'sell.inventory'], url: 'https://api.ebay.com/sell/inventory/v1/inventory_item?limit=1' },
  { api: 'Marketing', scopes: ['sell.marketing.readonly', 'sell.marketing'], url: 'https://api.ebay.com/sell/marketing/v1/ad_campaign?limit=1' },
  { api: 'Account', scopes: ['sell.account.readonly', 'sell.account'], url: 'https://api.ebay.com/sell/account/v1/privilege' }
];

function redact(text) {
  return String(text || '')
    .replace(/v\^1\.1#[^\s"']+/g, '[REDACTED]')
    .replace(/[A-Za-z0-9+/=_\-.#^|]{32,}/g, '[REDACTED]')
    .slice(0, 300);
}

function describeError(data) {
  if (!data || typeof data !== 'object') return 'no structured error body';
  if (data.error) return `oauth error=${redact(data.error)} description=${redact(data.error_description)}`;
  if (Array.isArray(data.errors) && data.errors.length) {
    return data.errors.slice(0, 3).map((e) => `errorId=${e.errorId} category=${redact(e.category)} message=${redact(e.message)}`).join(' | ');
  }
  return 'unrecognized error body';
}

function classify(status, data) {
  if (status >= 200 && status < 300) return 'SUCCESS';
  const ids = (data && Array.isArray(data.errors) ? data.errors.map((e) => e.errorId) : []);
  if (status === 403 || data?.error === 'invalid_scope' || ids.includes(1100)) return 'PERMISSION_DENIED';
  if (status === 401 && ids.includes(1001)) return 'INCONCLUSIVE (invalid/expired token)';
  return 'INCONCLUSIVE';
}

async function request(config) {
  try {
    const res = await axios({ timeout: TIMEOUT_MS, validateStatus: () => true, ...config });
    return { status: res.status, data: res.data };
  } catch (err) {
    return { status: 0, data: null, network: err.code || 'NETWORK_ERROR' };
  }
}

async function getToken(scopes) {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.EBAY_REFRESH_TOKEN,
    scope: scopes.map(SCOPE).join(' ')
  }).toString();
  const res = await request({
    method: 'post',
    url: TOKEN_URL,
    data: body,
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return { status: res.status, token: res.data && res.data.access_token, data: res.data, network: res.network };
}

async function call(url, token, marketplace) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (marketplace) headers['X-EBAY-C-MARKETPLACE-ID'] = 'EBAY_US';
  return request({ method: 'get', url, headers });
}

function count(values) {
  return values.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
}

async function inspectFulfillment(token, requestedOrderId) {
  const filter = encodeURIComponent('orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}');
  const list = await call(`https://api.ebay.com/sell/fulfillment/v1/order?filter=${filter}&limit=200`, token);
  console.log(`\n[Fulfillment getOrders NOT_STARTED|IN_PROGRESS] HTTP ${list.status}${list.network ? ` network=${list.network}` : ''}`);
  if (list.status !== 200) { console.log(`  ${describeError(list.data)}`); return; }
  const orders = list.data.orders || [];
  console.log(`  total=${list.data.total} returnedOnPage=${orders.length} hasNext=${Boolean(list.data.next)}`);
  console.log(`  orderFulfillmentStatus=${JSON.stringify(count(orders.map((o) => o.orderFulfillmentStatus)))}`);
  console.log(`  cancelState=${JSON.stringify(count(orders.map((o) => o.cancelStatus && o.cancelStatus.cancelState)))}`);
  console.log(`  ordersWithFulfillmentHrefs=${orders.filter((o) => (o.fulfillmentHrefs || []).length).length}`);
  const lineStatuses = orders.flatMap((o) => (o.lineItems || []).map((li) => li.lineItemFulfillmentStatus));
  console.log(`  lineItemFulfillmentStatus=${JSON.stringify(count(lineStatuses))}`);

  const sorted = [...orders].sort((a, b) => String(b.creationDate).localeCompare(String(a.creationDate)));
  const multi = sorted.find((o) => (o.lineItems || []).length > 1);
  const orderId = requestedOrderId || (multi || sorted[0] || {}).orderId;
  if (!orderId) { console.log('  No current unshipped order available for getOrder.'); return; }

  const one = await call(`https://api.ebay.com/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}`, token);
  console.log(`\n[Fulfillment getOrder ${orderId}] HTTP ${one.status}`);
  if (one.status !== 200) { console.log(`  ${describeError(one.data)}`); return; }
  const o = one.data;
  const items = o.lineItems || [];
  const aspectNames = count(items.flatMap((li) => (li.variationAspects || []).map((a) => a.name)));
  const cardValues = items.map((li) => ((li.variationAspects || []).find((a) => String(a.name).trim().toLowerCase() === 'card') || {}).value);
  console.log(`  orderFulfillmentStatus=${o.orderFulfillmentStatus} cancelState=${o.cancelStatus && o.cancelStatus.cancelState} paymentStatus=${o.orderPaymentStatus}`);
  console.log(`  lineItems=${items.length} totalQuantity=${items.reduce((s, li) => s + (li.quantity || 0), 0)} distinctListings=${new Set(items.map((li) => li.legacyItemId)).size}`);
  console.log(`  lineItemFulfillmentStatus=${JSON.stringify(count(items.map((li) => li.lineItemFulfillmentStatus)))}`);
  console.log(`  variationAspect names=${JSON.stringify(aspectNames)}`);
  console.log(`  cardAspect present=${cardValues.filter(Boolean).length}/${items.length}; matches "<number> <name>"=${cardValues.filter((v) => /^\s*#?\d+[A-Za-z]?\s+\S/.test(v || '')).length}`);
  console.log(`  shipByDate present=${items.filter((li) => li.lineItemFulfillmentInstructions && li.lineItemFulfillmentInstructions.shipByDate).length}/${items.length}`);
  console.log(`  fulfillmentHrefs=${(o.fulfillmentHrefs || []).length}`);
  const present = (v) => (v && v.value !== undefined ? `present(${v.currency})` : 'absent');
  console.log(`  money: priceSubtotal=${present(o.pricingSummary && o.pricingSummary.priceSubtotal)} priceDiscount=${present(o.pricingSummary && o.pricingSummary.priceDiscount)} total=${present(o.pricingSummary && o.pricingSummary.total)} totalDueSeller=${present(o.paymentSummary && o.paymentSummary.totalDueSeller)} totalMarketplaceFee=${present(o.totalMarketplaceFee)}`);
}

async function main() {
  const missing = ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_REFRESH_TOKEN'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.log(`BLOCKED: missing environment variables: ${missing.join(', ')}`);
    process.exitCode = 2;
    return;
  }
  const requestedOrderId = process.argv[2];
  console.log(UNDER_RAILWAY
    ? `Variables: Railway injected (project=${process.env.RAILWAY_PROJECT_NAME} env=${process.env.RAILWAY_ENVIRONMENT_NAME} service=${process.env.RAILWAY_SERVICE_NAME}); backend/.env not loaded`
    : 'Variables: local environment / backend/.env');

  for (const probe of PROBES) {
    console.log(`\n=== ${probe.api} ===`);
    let token = null;
    for (const scope of probe.scopes) {
      const t = await getToken([scope]);
      const verdict = t.token ? 'GRANTED' : classify(t.status, t.data);
      console.log(`  scope ${scope}: HTTP ${t.status} ${verdict}${t.token ? '' : ` (${t.network || describeError(t.data)})`}`);
      if (t.data && t.data.error === 'invalid_grant') {
        console.log('STOPPED: invalid_grant is a refresh-token problem, not a scope problem; remaining probes skipped.');
        process.exitCode = 3;
        return;
      }
      if (t.token && !token) token = t.token;
    }
    if (!token) { console.log('  API probe skipped: no token for this API.'); continue; }
    const r = await call(probe.url, token, probe.marketplace);
    console.log(`  probe GET ${probe.url.replace(/\?.*$/, '')}: HTTP ${r.status} ${classify(r.status, r.data)}${r.status >= 300 || r.network ? ` (${r.network || describeError(r.data)})` : ''}`);
    if (probe.api === 'Fulfillment' && r.status === 200) await inspectFulfillment(token, requestedOrderId);
  }
}

main().catch((err) => {
  console.log(`Unexpected failure: ${err && err.name ? err.name : 'Error'}`);
  process.exitCode = 1;
});
