// Purchases & shipments board handlers.
// Mounted on /api/internal (CRON_SECRET) and /api/staff/ebay (Google staff sign-in).
const { buildPurchases, boundedDays: purchaseDays, MAX_DAYS: PURCHASE_MAX } = require('../services/ebayPurchases');
const { buildShipments, boundedDays: shipmentDays, MAX_DAYS: SHIPMENT_MAX } = require('../services/ebayShipments');

function truthy(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function mountBoardRoutes(router, { client, delivery, sendProviderError, now = () => Date.now(), log = console.warn }) {
  router.get('/ebay-purchases', async (req, res) => {
    const days = purchaseDays(req.query.days);
    if (days === null) return res.status(400).json({ error: 'INVALID_DAYS', message: `days must be an integer from 1 to ${PURCHASE_MAX}.` });
    try {
      return res.json(await buildPurchases(client, delivery, { days, now: now(), forceRefresh: truthy(req.query.refresh) }));
    } catch (err) {
      if (err && err.kind === 'PERMISSION_DENIED') {
        log('[ebay-purchases] buyer Trading access denied');
        return res.status(502).json({
          error: 'PERMISSION_DENIED',
          message: 'Buyer-side Trading access failed for this eBay token.',
          missing: 'User OAuth token that can call Trading GetOrders with OrderRole=Buyer (IAF). buy.order.readonly is not required for Trading; token must belong to mancavesportscardsllc24.',
          oauthError: err.oauthError || null,
          ebayErrorIds: err.ebayErrorIds || err.errorCodes || null
        });
      }
      return sendProviderError(res, err, log);
    }
  });

  router.get('/ebay-shipments', async (req, res) => {
    const days = shipmentDays(req.query.days);
    if (days === null) return res.status(400).json({ error: 'INVALID_DAYS', message: `days must be an integer from 1 to ${SHIPMENT_MAX}.` });
    try {
      return res.json(await buildShipments(client, delivery, { days, now: now(), forceRefresh: truthy(req.query.refresh) }));
    } catch (err) {
      return sendProviderError(res, err, log);
    }
  });
}

module.exports = { mountBoardRoutes };
