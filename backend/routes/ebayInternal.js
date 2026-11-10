// Internal, read-only eBay seller endpoints for automations.
// Auth: header `Authorization: Bearer <CRON_SECRET>`. Secrets in query strings are rejected.
//   GET /api/internal/ebay-pull-list[?lookbackDays=1..730]
//   GET /api/internal/ebay-money[?days=1..90]
//   GET /api/internal/ebay-demand?q=<query>[&limit=1..50]   (application token, not the seller token)
//   POST /api/internal/ebay-send-thanks {"orderId": "...", "test": true}   (one order; the only write endpoint)
const crypto = require('crypto');
const express = require('express');
const { createEbaySellerClient } = require('../services/ebaySellerClient');
const { sendThanks, validOrderId, ThanksError } = require('../services/ebayBuyerThanks');
const { createThanksStore, StoreUnavailableError } = require('../services/ebayThanksStore');
const { buildPullList, boundedLookbackDays, MAX_LOOKBACK_DAYS } = require('../services/ebayPullList');
const { buildMoneyView, boundedDays, MAX_DAYS } = require('../services/ebayMoney');
const { createDemandService, boundedLimit, validQuery, MAX_LIMIT, MAX_QUERY_LENGTH } = require('../services/ebayDemand');

const SECRET_QUERY_KEYS = /^(secret|token|key|auth|authorization|cron_secret|api_key|access_token)$/i;

const ERROR_RESPONSES = {
  NOT_CONFIGURED: [503, 'eBay seller API credentials are not configured.'],
  AUTH_FAILED: [502, 'eBay rejected the seller credentials.'],
  PERMISSION_DENIED: [502, 'The eBay token lacks the required scope.'],
  RATE_LIMITED: [503, 'eBay rate limit reached; retry later.'],
  TIMEOUT: [504, 'eBay did not respond in time.'],
  NETWORK_ERROR: [502, 'Could not reach eBay.'],
  INCOMPLETE_DATA: [502, 'eBay returned incomplete paginated data; no partial result returned.'],
  UPSTREAM_ERROR: [502, 'eBay returned an error.']
};

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function requireCronSecret(env) {
  return (req, res, next) => {
    const expected = env.CRON_SECRET;
    if (!expected) return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'Endpoint is not configured.' });
    if (Object.keys(req.query || {}).some((k) => SECRET_QUERY_KEYS.test(k))) {
      return res.status(400).json({ error: 'SECRET_IN_QUERY', message: 'Send the secret in the Authorization header only.' });
    }
    const header = req.get('authorization') || '';
    const m = /^Bearer (.+)$/.exec(header);
    if (!m || !crypto.timingSafeEqual(digest(m[1]), digest(expected))) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid credentials.' });
    }
    return next();
  };
}

function sendProviderError(res, err, log) {
  const kind = err && err.kind && ERROR_RESPONSES[err.kind] ? err.kind : 'INTERNAL_ERROR';
  const [status, message] = ERROR_RESPONSES[kind] || [500, 'Internal error.'];
  log(`[ebay-internal] ${kind}${err && err.status ? ` http=${err.status}` : ''}${err && err.ebayErrorIds && err.ebayErrorIds.length ? ` ebayErrorIds=${err.ebayErrorIds.join(',')}` : ''}`);
  const body = { error: kind, message };
  if (err && err.status) body.ebayStatus = err.status;
  if (err && err.ebayErrorIds && err.ebayErrorIds.length) body.ebayErrorIds = err.ebayErrorIds;
  return res.status(status).json(body);
}

function createEbayInternalRouter({
  env = process.env,
  client = createEbaySellerClient({ env }),
  appClient = createEbaySellerClient({ env, grantType: 'client_credentials' }),
  thanksStore = createThanksStore({ env }),
  now = () => Date.now(),
  log = console.warn
} = {}) {
  const demand = createDemandService({ client: appClient, now });
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireCronSecret(env));

  router.get('/ebay-pull-list', async (req, res) => {
    const lookbackDays = boundedLookbackDays(req.query.lookbackDays);
    if (lookbackDays === null) return res.status(400).json({ error: 'INVALID_LOOKBACK_DAYS', message: `lookbackDays must be an integer from 1 to ${MAX_LOOKBACK_DAYS}.` });
    try {
      return res.json(await buildPullList(client, { lookbackDays, now: now() }));
    } catch (err) {
      return sendProviderError(res, err, log);
    }
  });

  router.get('/ebay-money', async (req, res) => {
    const days = boundedDays(req.query.days);
    if (days === null) return res.status(400).json({ error: 'INVALID_DAYS', message: `days must be an integer from 1 to ${MAX_DAYS}.` });
    try {
      return res.json(await buildMoneyView(client, { days, now: now() }));
    } catch (err) {
      return sendProviderError(res, err, log);
    }
  });

  router.get('/ebay-demand', async (req, res) => {
    const q = validQuery(req.query.q);
    if (q === null) return res.status(400).json({ error: 'INVALID_QUERY', message: `q is required: 2 to ${MAX_QUERY_LENGTH} characters, no * wildcard.` });
    const limit = boundedLimit(req.query.limit);
    if (limit === null) return res.status(400).json({ error: 'INVALID_LIMIT', message: `limit must be an integer from 1 to ${MAX_LIMIT}.` });
    try {
      return res.json(await demand.buildDemand({ q, limit }));
    } catch (err) {
      return sendProviderError(res, err, log);
    }
  });

  router.post('/ebay-send-thanks', express.json({ limit: '2kb' }), async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => k !== 'orderId' && k !== 'test')) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'Body must be {"orderId": "<order id>", "test": true}.' });
    }
    if (body.test !== true) return res.status(400).json({ error: 'TEST_MODE_REQUIRED', message: 'This endpoint is test-only; send "test": true.' });
    const orderId = validOrderId(body.orderId);
    if (!orderId) return res.status(400).json({ error: 'INVALID_ORDER_ID', message: 'orderId must be a single eBay order id.' });
    try {
      return res.status(201).json(await sendThanks({ client, store: thanksStore, orderId, log }));
    } catch (err) {
      if (err instanceof ThanksError) return res.status(err.httpStatus).json({ error: err.code, message: err.message, orderId });
      if (err instanceof StoreUnavailableError) return res.status(503).json({ error: err.code, message: err.message });
      return sendProviderError(res, err, log);
    }
  });

  router.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  return router;
}

module.exports = { createEbayInternalRouter, requireCronSecret };
