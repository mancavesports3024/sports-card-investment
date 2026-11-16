// Seller shipped-sales board (read-only).
// Preferred path: Sell Fulfillment getOrders + shipping_fulfillment (same client/scopes as the pull list).
// Fallback: Trading GetOrders OrderRole=Seller when the refresh token cannot mint sell.fulfillment.readonly
// (verified: local token has only api_scope; production Railway token has fulfillment).
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');
const { amountOrNull } = require('../utils/decimalMoney');
const ordersTrading = require('./ebayOrdersTrading');
const { boundedDays, DEFAULT_DAYS, MAX_DAYS } = ordersTrading;

const ORDERS_URL = 'https://api.ebay.com/sell/fulfillment/v1/order';
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchFulfillmentOrders(client, { creationFrom }) {
  const filter = `creationdate:[${creationFrom}..],orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}`;
  const orders = [];
  let total = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_LIMIT;
    const url = `${ORDERS_URL}?filter=${encodeURIComponent(filter)}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await client.get(url, SCOPES.fulfillment);
    const batch = Array.isArray(data && data.orders) ? data.orders : [];
    if (typeof data.total === 'number') total = data.total;
    orders.push(...batch);
    if (batch.length < PAGE_LIMIT || (total !== null && orders.length >= total)) {
      if (total !== null && orders.length < total) throw new EbaySellerError('INCOMPLETE_DATA');
      return orders;
    }
  }
  throw new EbaySellerError('INCOMPLETE_DATA');
}

async function fetchFulfillments(client, orderId) {
  const url = `${ORDERS_URL}/${encodeURIComponent(orderId)}/shipping_fulfillment`;
  const data = await client.get(url, SCOPES.fulfillment);
  return Array.isArray(data && data.fulfillments) ? data.fulfillments : [];
}

function lineById(order) {
  const map = new Map();
  for (const li of order.lineItems || []) map.set(li.lineItemId, li);
  return map;
}

async function buildFromFulfillment(client, delivery, { days, now, forceRefresh }) {
  const creationFrom = new Date(now - days * DAY_MS).toISOString();
  const orders = await fetchFulfillmentOrders(client, { creationFrom });
  const shipments = [];

  for (const order of orders) {
    if (order.cancelStatus && order.cancelStatus.cancelState === 'CANCELED') continue;
    const needs = order.orderFulfillmentStatus === 'FULFILLED'
      || order.orderFulfillmentStatus === 'IN_PROGRESS'
      || (order.fulfillmentHrefs || []).length > 0;
    if (!needs) continue;
    const fulfillments = await fetchFulfillments(client, order.orderId);
    if (!fulfillments.length) continue;
    const lines = lineById(order);
    for (const f of fulfillments) {
      const trackingNumber = f.shipmentTrackingNumber || null;
      const carrier = f.shippingCarrierCode || null;
      const shipDate = f.shippedDate || null;
      if (!trackingNumber && !shipDate) continue;
      const refs = Array.isArray(f.lineItems) && f.lineItems.length ? f.lineItems : [{ lineItemId: null }];
      for (const ref of refs) {
        const li = ref.lineItemId ? lines.get(ref.lineItemId) : null;
        const deliveryState = await delivery.resolve(
          { trackingNumber, carrier, shipped: true },
          { force: forceRefresh }
        );
        shipments.push({
          orderId: order.orderId,
          itemId: (li && li.legacyItemId) || null,
          item: (li && li.title) || null,
          buyer: (order.buyer && order.buyer.username) || null,
          price: amountOrNull(li && li.lineItemCost),
          shipDate,
          carrier: deliveryState.carrier || carrier,
          trackingNumber,
          trackingUrl: deliveryState.trackingUrl,
          deliveryState: deliveryState.deliveryState,
          deliveryStateSource: deliveryState.deliveryStateSource,
          lastRefreshedAt: deliveryState.lastRefreshedAt
        });
      }
    }
  }
  return {
    source: 'eBay Sell Fulfillment getOrders + shipping_fulfillment',
    retrievalWindow: { creationDateFrom: creationFrom, days },
    shipments
  };
}

async function buildFromTrading(sellerClient, delivery, { days, now, forceRefresh }) {
  const createTo = new Date(now).toISOString();
  const createFrom = new Date(now - days * DAY_MS).toISOString();
  const trading = await ordersTrading.resolveTradingClient(sellerClient);
  const orders = await ordersTrading.fetchOrders(trading, { role: 'Seller', createFrom, createTo });
  const lines = ordersTrading.flattenOrders(orders, 'Seller').filter((l) => l.shipped || l.trackingNumber);
  const shipments = [];
  for (const line of lines) {
    const deliveryState = await delivery.resolve(
      { trackingNumber: line.trackingNumber, carrier: line.carrier, shipped: line.shipped },
      { force: forceRefresh }
    );
    shipments.push({
      orderId: line.orderId,
      itemId: line.itemId,
      item: line.item,
      buyer: line.otherParty,
      price: line.price,
      shipDate: line.shipDate,
      carrier: deliveryState.carrier || line.carrier,
      trackingNumber: line.trackingNumber,
      trackingUrl: deliveryState.trackingUrl,
      deliveryState: deliveryState.deliveryState,
      deliveryStateSource: deliveryState.deliveryStateSource,
      lastRefreshedAt: deliveryState.lastRefreshedAt
    });
  }
  return {
    source: 'eBay Trading GetOrders OrderRole=Seller (Fulfillment scope unavailable)',
    retrievalWindow: { createTimeFrom: createFrom, createTimeTo: createTo, days },
    shipments
  };
}

async function buildShipments(sellerClient, delivery, { days = DEFAULT_DAYS, now = Date.now(), forceRefresh = false } = {}) {
  let built;
  let fulfillmentError = null;
  try {
    built = await buildFromFulfillment(sellerClient, delivery, { days, now, forceRefresh });
  } catch (err) {
    if (err && (err.kind === 'PERMISSION_DENIED' || err.kind === 'AUTH_FAILED' || err.kind === 'NOT_CONFIGURED')) {
      fulfillmentError = {
        kind: err.kind,
        oauthError: err.oauthError || null,
        ebayStatus: err.status || null,
        missing: err.kind === 'PERMISSION_DENIED'
          ? 'sell.fulfillment.readonly (or sell.fulfillment) on the user refresh token'
          : null
      };
      built = await buildFromTrading(sellerClient, delivery, { days, now, forceRefresh });
    } else {
      throw err;
    }
  }

  built.shipments.sort((a, b) => Date.parse(b.shipDate || 0) - Date.parse(a.shipDate || 0));

  return {
    generatedAt: new Date(now).toISOString(),
    source: built.source,
    retrievalWindow: built.retrievalWindow,
    shipmentCount: built.shipments.length,
    fulfillmentFallback: fulfillmentError,
    carrierSignupNeeded: delivery.signupFlag(),
    carrierSignupNote: delivery.signupFlag()
      ? 'USPS Web Tools retired Jan 25, 2026. Free scan states need a USPS APIs app (apis.usps.com) with Tracking access; set USPS_CLIENT_ID and USPS_CLIENT_SECRET. Until then deliveryState stays Unknown for shipped items and tracking links still work.'
      : null,
    shipments: built.shipments
  };
}

module.exports = { buildShipments, boundedDays, DEFAULT_DAYS, MAX_DAYS };
