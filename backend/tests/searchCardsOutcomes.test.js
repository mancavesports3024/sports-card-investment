// Run from backend/: node --test --test-force-exit tests/searchCardsOutcomes.test.js
// All provider HTTP calls are stubbed; no live requests are made.
delete process.env.REDIS_URL;
process.env.CARDSIGHT_API_KEY = 'test0000000000000000000000000000';
process.env.CARDSIGHT_DAILY_CALL_LIMIT = '1000';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const axios = require('axios');
const express = require('express');

const Point130Service = require('../services/130pointService');
const EbayScraperService = require('../services/ebayScraperService');
const cardsightService = require('../services/cardsightService');
const { router } = require('../routes/searchCards');

function stub(obj, name, impl) {
  const original = obj[name];
  obj[name] = impl;
  return () => { obj[name] = original; };
}

function httpError(status, body = { error: 'Internal server error', code: 'INTERNAL_ERROR' }) {
  const e = new Error(`Request failed with status code ${status}`);
  e.response = { status, data: body };
  return e;
}

const auctionRecord = (overrides = {}) => ({
  title: '2023 Topps Chrome Corbin Carroll RC #1',
  price: 12.5,
  date: '2026-10-20T18:00:00Z',
  source: 'ebay',
  listing_type: 'auction',
  url: 'https://www.ebay.com/itm/1',
  image_url: 'https://i.ebayimg.com/1.jpg',
  ...overrides
});

function stubCardsight(handler) {
  const calls = [];
  const restore = stub(axios, 'get', async (url, opts) => {
    calls.push({ url, params: opts?.params });
    return handler(url, opts);
  });
  return { calls, restore };
}

async function postSearch(searchQuery) {
  const app = express();
  app.use(express.json());
  app.use('/api/search-cards', router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/search-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery })
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test('130point Cloudflare block returns [] but records lastError', async () => {
  const restore = stub(axios, 'post', async () => ({ status: 403, data: '<!DOCTYPE html><title>Attention Required! | Cloudflare</title>' }));
  try {
    const svc = new Point130Service();
    assert.deepStrictEqual(await svc.searchSoldCards('Corbin Carroll'), []);
    assert.match(svc.lastError, /403/);
  } finally { restore(); }
});

test('eBay scraper HTTP failure is reported as an error, not an empty search', async () => {
  const svc = new EbayScraperService();
  svc.warmUpSession = async () => {};
  svc.httpClient = { get: async () => { throw httpError(500); } };
  const result = await svc.searchSoldCards('Corbin Carroll', null, 50, null, null, null, null, null, true);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'eBay HTTP 500');
});

test('CardSight search requests auction listings only and keeps sale details; missing grade stays unknown', async () => {
  const { calls, restore } = stubCardsight(async () => ({
    status: 200,
    data: {
      query: { q: 'x', listing_type: 'auction', as_of_date: '2026-10-25' },
      results: [
        auctionRecord(),
        auctionRecord({ title: 'Carroll PSA 10', price: 80, grade: { grade_value: '10', company_name: 'PSA' } }),
        auctionRecord({ title: 'Buy It Now ask', listing_type: 'fixed', price: 999 })
      ],
      meta: { total_records: 3 }
    }
  }));
  try {
    const { sales } = await cardsightService.searchAuctionSales('Corbin Carroll');
    assert.strictEqual(calls.length, 1);
    assert.match(calls[0].url, /\/v1\/pricing\/search$/);
    assert.strictEqual(calls[0].params.listing_type, 'auction');
    assert.strictEqual(sales.length, 2);
    assert.deepStrictEqual(
      { price: sales[0].price, soldDate: sales[0].soldDate, url: sales[0].url, imageUrl: sales[0].imageUrl, source: sales[0].source, grade: sales[0].grade },
      { price: 12.5, soldDate: '2026-10-20T18:00:00Z', url: 'https://www.ebay.com/itm/1', imageUrl: 'https://i.ebayimg.com/1.jpg', source: 'ebay', grade: null }
    );
    assert.deepStrictEqual(sales[1].grade, { company: 'PSA', value: '10' });
  } finally { restore(); }
});

test('CardSight 500, timeout, and malformed responses raise provider errors', async () => {
  for (const [handler, code] of [
    [async () => { throw httpError(500); }, 'PROVIDER_ERROR'],
    [async () => { const e = new Error('timeout'); e.code = 'ECONNABORTED'; throw e; }, 'PROVIDER_TIMEOUT'],
    [async () => { throw httpError(429, { error: 'Too many', code: 'RATE_LIMIT' }); }, 'PROVIDER_RATE_LIMIT'],
    [async () => ({ status: 200, data: { unexpected: true } }), 'PROVIDER_MALFORMED']
  ]) {
    const { restore } = stubCardsight(handler);
    try {
      await assert.rejects(cardsightService.searchAuctionSales('Corbin Carroll'), err => err.code === code);
    } finally { restore(); }
  }
});

test('route returns recent auction sales for a matching search', async () => {
  const { restore } = stubCardsight(async () => ({ status: 200, data: { query: {}, results: [auctionRecord()], meta: { total_records: 1 } } }));
  try {
    const { status, body } = await postSearch('route match Corbin Carroll');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.provider, 'cardsight');
    assert.strictEqual(body.listingType, 'auction');
    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.sales[0].url, 'https://www.ebay.com/itm/1');
    assert.strictEqual(body.sales[0].grade, null);
  } finally { restore(); }
});

test('route returns a normal 0-result response for a genuine no-match', async () => {
  const { restore } = stubCardsight(async () => ({ status: 200, data: { query: {}, results: [], meta: { total_records: 0 } } }));
  try {
    const { status, body } = await postSearch('zzqx flurble wombat');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.total, 0);
    assert.deepStrictEqual(body.sales, []);
  } finally { restore(); }
});

test('route returns 502 (never 0 results) when CardSight returns 500, without leaking details', async () => {
  const { restore } = stubCardsight(async () => { throw httpError(500); });
  try {
    const { status, body } = await postSearch('route error Charizard');
    assert.strictEqual(status, 502);
    assert.strictEqual(body.code, 'SALES_PROVIDER_UNAVAILABLE');
    assert.strictEqual(body.sales, undefined);
    assert.doesNotMatch(JSON.stringify(body), /INTERNAL_ERROR|500|api\.cardsight|X-API-Key/i);
  } finally { restore(); }
});

test('repeat and concurrent identical searches make one upstream call; errors are not cached', async () => {
  let fail = true;
  const { calls, restore } = stubCardsight(async () => {
    if (fail) throw httpError(500);
    await new Promise(r => setTimeout(r, 50));
    return { status: 200, data: { query: {}, results: [auctionRecord()], meta: { total_records: 1 } } };
  });
  try {
    assert.strictEqual((await postSearch('cache check Judge')).status, 502);
    fail = false;
    const [a, b] = await Promise.all([postSearch('cache check Judge'), postSearch('Cache  Check judge')]);
    const c = await postSearch('cache check Judge');
    assert.deepStrictEqual([a.status, b.status, c.status], [200, 200, 200]);
    assert.strictEqual(c.body.cached, true);
    assert.strictEqual(calls.length, 2);
  } finally { restore(); }
});

test('daily call budget returns a distinct 503 error without calling CardSight', async () => {
  const { calls, restore } = stubCardsight(async () => ({ status: 200, data: { query: {}, results: [], meta: {} } }));
  process.env.CARDSIGHT_DAILY_CALL_LIMIT = '0';
  try {
    const { status, body } = await postSearch('budget check Ohtani');
    assert.strictEqual(status, 503);
    assert.strictEqual(body.code, 'DAILY_LIMIT_REACHED');
    assert.strictEqual(calls.length, 0);
  } finally {
    process.env.CARDSIGHT_DAILY_CALL_LIMIT = '1000';
    restore();
  }
});

test('exclusions are stripped from the provider query and applied to titles', async () => {
  const { calls, restore } = stubCardsight(async () => ({
    status: 200,
    data: { query: {}, results: [auctionRecord(), auctionRecord({ title: 'Carroll reprint lot', url: 'https://www.ebay.com/itm/2' })], meta: {} }
  }));
  try {
    const { body } = await postSearch('exclusion check Carroll -(reprint)');
    assert.strictEqual(calls[0].params.q, 'exclusion check Carroll');
    assert.strictEqual(body.total, 1);
  } finally { restore(); }
});
