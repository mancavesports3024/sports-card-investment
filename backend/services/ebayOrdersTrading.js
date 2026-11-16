// Read-only Trading GetOrders helpers for buyer purchases and seller shipments.
// Official Trading API (supported; GetOrders deprecates 2027-06-30). Uses the existing
// trading client (IAF user token). Never writes.
const { toArray, text, escapeXml } = require('./ebayTradingClient');
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');
const { createTradingClient } = require('./ebayTradingClient');

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function boundedDays(value) {
  if (value === undefined) return DEFAULT_DAYS;
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_DAYS ? n : null;
}

function moneyNode(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'object') {
    const value = v._ !== undefined ? String(v._) : null;
    const currency = v.$ && v.$.currencyID ? String(v.$.currencyID) : null;
    if (value === null) return null;
    return { value, currency };
  }
  return { value: String(v), currency: null };
}

function trackingFrom(node) {
  if (!node) return [];
  const details = node.ShippingDetails || node;
  return toArray(details && details.ShipmentTrackingDetails)
    .map((t) => ({
      carrier: text(t.ShippingCarrierUsed),
      trackingNumber: text(t.ShipmentTrackingNumber) || text(t.TrackingNumber)
    }))
    .filter((t) => t.trackingNumber);
}

async function resolveTradingClient(sellerClient, { preferredScope = SCOPES.trading, fallbackScope = SCOPES.publicApp } = {}) {
  try {
    await sellerClient.getAccessToken(preferredScope);
    return createTradingClient({ sellerClient, scope: preferredScope });
  } catch (err) {
    if (err && err.kind === 'PERMISSION_DENIED' && (err.oauthError === 'invalid_scope' || !err.status || err.status === 400)) {
      await sellerClient.getAccessToken(fallbackScope);
      return createTradingClient({ sellerClient, scope: fallbackScope });
    }
    throw err;
  }
}

async function fetchOrders(trading, { role, createFrom, createTo }) {
  const orders = [];
  let hasMore = true;
  for (let page = 1; page <= MAX_PAGES && hasMore; page += 1) {
    const inner = [
      `<OrderRole>${escapeXml(role)}</OrderRole>`,
      `<CreateTimeFrom>${escapeXml(createFrom)}</CreateTimeFrom>`,
      `<CreateTimeTo>${escapeXml(createTo)}</CreateTimeTo>`,
      `<DetailLevel>ReturnAll</DetailLevel>`,
      `<Pagination><EntriesPerPage>${PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`
    ].join('');
    const doc = await trading.read('GetOrders', inner);
    const batch = toArray(doc && doc.OrderArray && doc.OrderArray.Order);
    orders.push(...batch);
    hasMore = text(doc && doc.HasMoreOrders) === 'true';
    if (!hasMore) return orders;
  }
  if (hasMore) throw new EbaySellerError('INCOMPLETE_DATA');
  return orders;
}

function mapLine(order, tx, role) {
  const tracks = [...trackingFrom(tx), ...trackingFrom(order)];
  const seen = new Set();
  const unique = [];
  for (const t of tracks) {
    if (seen.has(t.trackingNumber)) continue;
    seen.add(t.trackingNumber);
    unique.push(t);
  }
  const primary = unique[0] || { carrier: null, trackingNumber: null };
  const paidTime = text(order.PaidTime) || text(tx.PaidTime);
  const shippedTime = text(order.ShippedTime) || text(tx.ShippedTime);
  const item = tx.Item || {};
  const seller = text(order.SellerUserID) || text(item.Seller && item.Seller.UserID);
  const buyer = text(order.BuyerUserID) || text(tx.Buyer && tx.Buyer.UserID);
  return {
    orderId: text(order.OrderID),
    itemId: text(item.ItemID),
    item: text(item.Title),
    otherParty: role === 'Buyer' ? seller : buyer,
    price: moneyNode(tx.TransactionPrice) || moneyNode(order.Subtotal) || moneyNode(order.Total),
    orderDate: text(order.CreatedTime) || text(tx.CreatedDate),
    paid: Boolean(paidTime),
    paidTime: paidTime || null,
    shipped: Boolean(shippedTime) || Boolean(primary.trackingNumber),
    shipDate: shippedTime || null,
    carrier: primary.carrier,
    trackingNumber: primary.trackingNumber
  };
}

function flattenOrders(orders, role) {
  const rows = [];
  for (const order of orders) {
    const txs = toArray(order.TransactionArray && order.TransactionArray.Transaction);
    if (!txs.length) {
      rows.push(mapLine(order, {}, role));
      continue;
    }
    for (const tx of txs) rows.push(mapLine(order, tx, role));
  }
  return rows;
}

module.exports = {
  boundedDays,
  DEFAULT_DAYS,
  MAX_DAYS,
  resolveTradingClient,
  fetchOrders,
  flattenOrders,
  moneyNode,
  trackingFrom
};
