#!/usr/bin/env node
// Read-only access checks for the thank-you message and demand endpoints.
// Usage (from backend/): node scripts/ebay-thanks-demand-access-check.js
//   Part A: seller refresh token + commerce.message scope, then one getConversations call (limit 1).
//   Part B: client-credentials app tokens for Browse and Marketplace Insights, one search each.
// Prints only HTTP statuses, eBay error ids/messages (redacted), and counts. Sends no messages.
const path = require('path');
const UNDER_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);
if (!UNDER_RAILWAY) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const TEST_QUERY = '2022 Topps Heritage baseball';
const TIMEOUT_MS = 20000;

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

async function request(config) {
  try {
    const res = await axios({ timeout: TIMEOUT_MS, validateStatus: () => true, ...config });
    return { status: res.status, data: res.data };
  } catch (err) {
    return { status: 0, data: null, network: err.code || 'NETWORK_ERROR' };
  }
}

async function token(params) {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const res = await request({
    method: 'post',
    url: TOKEN_URL,
    data: new URLSearchParams(params).toString(),
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return { ...res, token: res.data && res.data.access_token };
}

const get = (url, accessToken) => request({ method: 'get', url, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
const failure = (r) => r.network || describeError(r.data);

async function partA() {
  console.log('\n=== Part A: Commerce Message (seller refresh token) ===');
  if (!process.env.EBAY_REFRESH_TOKEN) { console.log('BLOCKED: EBAY_REFRESH_TOKEN is not set.'); return; }
  const t = await token({ grant_type: 'refresh_token', refresh_token: process.env.EBAY_REFRESH_TOKEN, scope: 'https://api.ebay.com/oauth/api_scope/commerce.message' });
  console.log(`  token commerce.message: HTTP ${t.status} ${t.token ? 'GRANTED' : `FAILED (${failure(t)})`}`);
  if (!t.token) { console.log('  STOP Part A: scope not granted on the stored refresh token.'); return; }
  const r = await get('https://api.ebay.com/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&limit=1', t.token);
  console.log(`  getConversations limit=1: HTTP ${r.status}${r.status === 200 ? ` total=${r.data && r.data.total} returned=${((r.data && r.data.conversations) || []).length}` : ` (${failure(r)})`}`);
}

async function partB() {
  console.log('\n=== Part B: Browse + Marketplace Insights (client credentials) ===');
  const browse = await token({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' });
  console.log(`  token api_scope: HTTP ${browse.status} ${browse.token ? 'GRANTED' : `FAILED (${failure(browse)})`}`);
  if (browse.token) {
    const r = await get(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(TEST_QUERY)}&limit=1`, browse.token);
    console.log(`  Browse search limit=1: HTTP ${r.status}${r.status === 200 ? ` PASS total=${r.data.total} returned=${(r.data.itemSummaries || []).length}` : ` FAIL (${failure(r)})`}`);
    const tree = await get('https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US', browse.token);
    console.log(`  Taxonomy default tree: HTTP ${tree.status}${tree.status === 200 ? ` treeId=${tree.data.categoryTreeId}` : ` (${failure(tree)})`}`);
  }

  const mi = await token({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights' });
  if (!mi.token) {
    console.log(`  token buy.marketplace.insights: HTTP ${mi.status} MARKETPLACE_INSIGHTS_NOT_GRANTED (${failure(mi)})`);
    return;
  }
  console.log(`  token buy.marketplace.insights: HTTP ${mi.status} GRANTED`);
  const r = await get(`https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?q=${encodeURIComponent(TEST_QUERY)}&limit=3`, mi.token);
  if (r.status === 403) console.log(`  item_sales search limit=3: HTTP 403 MARKETPLACE_INSIGHTS_NOT_GRANTED (${failure(r)})`);
  else console.log(`  item_sales search limit=3: HTTP ${r.status}${r.status === 200 ? ` PASS total=${r.data.total} returned=${(r.data.itemSales || []).length}` : ` FAIL (${failure(r)})`}`);
}

async function main() {
  const missing = ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.log(`BLOCKED: missing environment variables: ${missing.join(', ')}`);
    process.exitCode = 2;
    return;
  }
  console.log(UNDER_RAILWAY ? `Variables: Railway injected (env=${process.env.RAILWAY_ENVIRONMENT_NAME})` : 'Variables: local environment / backend/.env');
  await partA();
  await partB();
}

main().catch((err) => {
  console.log(`Unexpected failure: ${err && err.name ? err.name : 'Error'}`);
  process.exitCode = 1;
});
