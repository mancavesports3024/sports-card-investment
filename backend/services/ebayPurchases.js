// Buyer purchases board: Trading GetOrders OrderRole=Buyer (read-only).
// GetMyeBayBuying was verified live for the same user token; GetOrders supplies
// paid/shipped/carrier/tracking in one call. Never writes or messages.
const ordersTrading = require('./ebayOrdersTrading');
const { boundedDays, DEFAULT_DAYS, MAX_DAYS } = ordersTrading;

async function buildPurchases(sellerClient, delivery, { days = DEFAULT_DAYS, now = Date.now(), forceRefresh = false } = {}) {
  const createTo = new Date(now).toISOString();
  const createFrom = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  const trading = await ordersTrading.resolveTradingClient(sellerClient);
  const orders = await ordersTrading.fetchOrders(trading, { role: 'Buyer', createFrom, createTo });
  const lines = ordersTrading.flattenOrders(orders, 'Buyer');

  const purchases = [];
  for (const line of lines) {
    const deliveryState = await delivery.resolve(
      { trackingNumber: line.trackingNumber, carrier: line.carrier, shipped: line.shipped },
      { force: forceRefresh }
    );
    purchases.push({
      orderId: line.orderId,
      itemId: line.itemId,
      item: line.item,
      seller: line.otherParty,
      price: line.price,
      orderDate: line.orderDate,
      paid: line.paid,
      shipped: line.shipped,
      shipDate: line.shipDate,
      carrier: deliveryState.carrier || line.carrier,
      trackingNumber: line.trackingNumber,
      trackingUrl: deliveryState.trackingUrl,
      deliveryState: deliveryState.deliveryState,
      deliveryStateSource: deliveryState.deliveryStateSource,
      lastRefreshedAt: deliveryState.lastRefreshedAt
    });
  }

  purchases.sort((a, b) => Date.parse(b.orderDate || 0) - Date.parse(a.orderDate || 0));

  return {
    generatedAt: new Date(now).toISOString(),
    source: 'eBay Trading GetOrders OrderRole=Buyer',
    retrievalWindow: { createTimeFrom: createFrom, createTimeTo: createTo, days },
    purchaseCount: purchases.length,
    carrierSignupNeeded: delivery.signupFlag(),
    carrierSignupNote: delivery.signupFlag()
      ? 'USPS Web Tools retired Jan 25, 2026. Free scan states need a USPS APIs app (apis.usps.com) with Tracking access; set USPS_CLIENT_ID and USPS_CLIENT_SECRET. Until then deliveryState stays Unknown for shipped items and tracking links still work.'
      : null,
    purchases
  };
}

module.exports = { buildPurchases, boundedDays, DEFAULT_DAYS, MAX_DAYS };
