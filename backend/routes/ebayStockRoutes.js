// Stock-check, player search, index refresh, and gated price-change handlers.
// Mounted twice: on /api/internal (CRON_SECRET bearer) and on /api/staff/ebay (Google sign-in + staff allowlist).
// Responses never include buyer data or credentials.
const express = require('express');
const { buildStock, validItemId, validQuery, MAX_QUERY_LENGTH } = require('../services/ebayStock');
const { refreshIndex, findPlayer, indexStatus, validName, IndexError, MAX_NAME_LENGTH } = require('../services/ebayStockIndex');
const { setPrice, validateRequest, changeLogView, PriceChangeError } = require('../services/ebayPriceChange');
const { StockStoreUnavailableError, RefreshInProgressError } = require('../services/ebayStockStore');

const REFRESH_TIMEOUT_MS = 14 * 60 * 1000;
const MAX_CHANGE_LOG = 200;

function mountStockRoutes(router, { trading, store, actor, sendProviderError, now = () => Date.now(), log = console.warn, refreshConcurrency }) {
  function fail(res, err) {
    if (err instanceof PriceChangeError || err instanceof IndexError) {
      return res.status(err.httpStatus).json({ error: err.code, message: err.message, ...(err.details || {}) });
    }
    if (err instanceof StockStoreUnavailableError) return res.status(503).json({ error: err.code, message: err.message });
    if (err instanceof RefreshInProgressError) return res.status(409).json({ error: err.code, message: err.message });
    if (err && err.kind) return sendProviderError(res, err, log);
    log(`[ebay-stock] internal error ${(err && err.code) || ''}`.trim());
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal error.' });
  }

  router.get('/ebay-stock', async (req, res) => {
    const itemId = validItemId(req.query.itemId);
    if (!itemId) return res.status(400).json({ error: 'INVALID_ITEM_ID', message: 'itemId must be one eBay item id (digits).' });
    const q = validQuery(req.query.q);
    if (q === null) return res.status(400).json({ error: 'INVALID_QUERY', message: `q must be at most ${MAX_QUERY_LENGTH} characters.` });
    try {
      return res.json(await buildStock(trading, { itemId, q, now: now() }));
    } catch (err) {
      if (err && err.itemNotFound) return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Listing not found for this seller.', itemId });
      return fail(res, err);
    }
  });

  router.get('/ebay-find-player', async (req, res) => {
    const name = validName(req.query.name);
    if (!name) return res.status(400).json({ error: 'INVALID_NAME', message: `name is required: 2 to ${MAX_NAME_LENGTH} characters.` });
    try {
      return res.json(await findPlayer({ store, name, now }));
    } catch (err) {
      return fail(res, err);
    }
  });

  router.get('/ebay-stock-refresh', async (req, res) => {
    try {
      return res.json(await indexStatus({ store, now }));
    } catch (err) {
      return fail(res, err);
    }
  });

  router.post('/ebay-stock-refresh', async (req, res) => {
    req.setTimeout(REFRESH_TIMEOUT_MS);
    res.setTimeout(REFRESH_TIMEOUT_MS);
    try {
      return res.json(await refreshIndex({ trading, store, now, concurrency: refreshConcurrency }));
    } catch (err) {
      return fail(res, err);
    }
  });

  router.post('/ebay-set-price', express.json({ limit: '2kb' }), async (req, res) => {
    let request;
    try {
      request = validateRequest(req.body);
    } catch (err) {
      return fail(res, err);
    }
    try {
      const out = await setPrice({ trading, store, request, requestedBy: actor(req), now, log });
      return res.status(out.httpStatus).json(out.body);
    } catch (err) {
      return fail(res, err);
    }
  });

  router.get('/ebay-price-changes', async (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CHANGE_LOG) return res.status(400).json({ error: 'INVALID_LIMIT', message: `limit must be an integer from 1 to ${MAX_CHANGE_LOG}.` });
    const itemId = req.query.itemId === undefined ? null : validItemId(req.query.itemId);
    if (req.query.itemId !== undefined && !itemId) return res.status(400).json({ error: 'INVALID_ITEM_ID', message: 'itemId must be one eBay item id (digits).' });
    try {
      return res.json({ changes: changeLogView(await store.listChanges({ limit, itemId })) });
    } catch (err) {
      return fail(res, err);
    }
  });

  return router;
}

module.exports = { mountStockRoutes };
