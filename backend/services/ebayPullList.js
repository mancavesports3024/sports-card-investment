// Builds the seller pull list from the Sell Fulfillment API (read-only).
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');
const { amountOrNull } = require('../utils/decimalMoney');

const ORDERS_URL = 'https://api.ebay.com/sell/fulfillment/v1/order';
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;
const DEFAULT_LOOKBACK_DAYS = 90;
const MAX_LOOKBACK_DAYS = 730;
const DAY_MS = 24 * 60 * 60 * 1000;

// "<number> <name>" where number may carry a letter prefix/suffix or range, e.g. "12", "US12", "BC-7", "T88-3", "45a".
const PICK_RE = /^\s*#?\s*([A-Za-z]{0,6}-?\d+[A-Za-z]?(?:-\d+)?)\b[\s,:\-–]*(.*?)\s*$/;

function parsePick(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { raw: null, cardNumber: null, name: null, pickStatus: 'MISSING' };
  }
  const text = String(raw);
  const m = PICK_RE.exec(text);
  if (!m) return { raw: text, cardNumber: null, name: null, pickStatus: 'UNPARSED' };
  return { raw: text, cardNumber: m[1], name: m[2] || null, pickStatus: 'PARSED' };
}

function cardSortKey(cardNumber) {
  const m = /^([A-Za-z]*)-?(\d+)([A-Za-z]?)(?:-(\d+))?$/.exec(cardNumber || '');
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), num: Number(m[2]), suffix: m[3].toUpperCase(), sub: m[4] ? Number(m[4]) : -1 };
}

function comparePicks(a, b) {
  const ka = cardSortKey(a.cardNumber);
  const kb = cardSortKey(b.cardNumber);
  if (ka && !kb) return -1;
  if (!ka && kb) return 1;
  if (ka && kb) {
    if (ka.prefix !== kb.prefix) return ka.prefix.localeCompare(kb.prefix);
    if (ka.num !== kb.num) return ka.num - kb.num;
    if (ka.sub !== kb.sub) return ka.sub - kb.sub;
    if (ka.suffix !== kb.suffix) return ka.suffix.localeCompare(kb.suffix);
  }
  return String(a.raw || '').localeCompare(String(b.raw || ''));
}

function findCardAspect(lineItem) {
  const aspects = Array.isArray(lineItem.variationAspects) ? lineItem.variationAspects : [];
  const hit = aspects.find((a) => a && typeof a.name === 'string' && a.name.trim().toLowerCase() === 'card');
  return hit ? hit.value : undefined;
}

function boundedLookbackDays(value) {
  if (value === undefined) return DEFAULT_LOOKBACK_DAYS;
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_LOOKBACK_DAYS ? n : null;
}

async function fetchUnfulfilledOrders(client, { creationFrom }) {
  const filter = `creationdate:[${creationFrom}..],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`;
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
      return { orders, total: total === null ? orders.length : total };
    }
  }
  throw new EbaySellerError('INCOMPLETE_DATA');
}

// Sums explicitly shipped quantities per lineItemId from the order's shipping fulfillments.
async function fetchShippedQuantities(client, orderId) {
  const url = `${ORDERS_URL}/${encodeURIComponent(orderId)}/shipping_fulfillment`;
  const data = await client.get(url, SCOPES.fulfillment);
  const shipped = new Map(); // lineItemId -> { qty, unknown }
  for (const f of (data && data.fulfillments) || []) {
    for (const ref of f.lineItems || []) {
      const entry = shipped.get(ref.lineItemId) || { qty: 0, unknown: false };
      if (Number.isInteger(ref.quantity) && ref.quantity > 0) entry.qty += ref.quantity;
      else entry.unknown = true;
      shipped.set(ref.lineItemId, entry);
    }
  }
  return shipped;
}

function money(order) {
  const ps = order.pricingSummary || {};
  const pay = order.paymentSummary || {};
  return {
    priceSubtotal: amountOrNull(ps.priceSubtotal),
    priceDiscount: amountOrNull(ps.priceDiscount),
    total: amountOrNull(ps.total),
    totalDueSeller: amountOrNull(pay.totalDueSeller),
    totalMarketplaceFee: amountOrNull(order.totalMarketplaceFee)
  };
}

function buildOrder(order, shipped) {
  const groups = new Map();
  let earliestShipBy = null;
  let remainingTotal = 0;

  for (const li of order.lineItems || []) {
    if (li.lineItemFulfillmentStatus === 'FULFILLED') continue;
    const ordered = Number.isInteger(li.quantity) ? li.quantity : 0;
    const s = shipped && shipped.get(li.lineItemId);
    let remaining = ordered;
    let shippedQuantityUnknown = false;
    if (s) {
      if (s.unknown) shippedQuantityUnknown = true;
      else remaining = ordered - s.qty;
    }
    if (remaining <= 0) continue;

    const shipBy = li.lineItemFulfillmentInstructions && li.lineItemFulfillmentInstructions.shipByDate;
    if (shipBy && (!earliestShipBy || Date.parse(shipBy) < Date.parse(earliestShipBy))) earliestShipBy = shipBy;

    const key = li.legacyItemId ? `id:${li.legacyItemId}` : `line:${li.lineItemId}`;
    if (!groups.has(key)) {
      groups.set(key, { legacyItemId: li.legacyItemId || null, title: li.title || null, listingIdentity: li.legacyItemId ? 'LEGACY_ITEM_ID' : 'UNKNOWN', picks: [] });
    }
    const pick = parsePick(findCardAspect(li));
    const extra = {};
    if (shippedQuantityUnknown) extra.shippedQuantityUnknown = true;
    if (s && !s.unknown && s.qty > 0) extra.alreadyShippedQuantity = s.qty;
    groups.get(key).picks.push({ ...pick, quantity: remaining, orderedQuantity: ordered, lineItemFulfillmentStatus: li.lineItemFulfillmentStatus || null, ...extra });
    remainingTotal += remaining;
  }

  const listings = [...groups.values()]
    .map((g) => ({ ...g, picks: g.picks.sort(comparePicks), totalQuantity: g.picks.reduce((n, p) => n + p.quantity, 0) }))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')) || String(a.legacyItemId || '').localeCompare(String(b.legacyItemId || '')));

  return {
    orderId: order.orderId,
    buyerUsername: (order.buyer && order.buyer.username) || null,
    creationDate: order.creationDate || null,
    shipByDate: earliestShipBy,
    orderFulfillmentStatus: order.orderFulfillmentStatus || null,
    cancelRequested: Boolean(order.cancelStatus && ['CANCEL_REQUESTED', 'IN_PROGRESS'].includes(order.cancelStatus.cancelState)),
    totalQuantity: remainingTotal,
    listings,
    money: money(order)
  };
}

async function buildPullList(client, { lookbackDays = DEFAULT_LOOKBACK_DAYS, now = Date.now() } = {}) {
  const creationFrom = new Date(now - lookbackDays * DAY_MS).toISOString();
  const { orders, total } = await fetchUnfulfilledOrders(client, { creationFrom });
  const excluded = { cancelled: 0, fullyRefunded: 0, fullyFulfilled: 0, noRemainingItems: 0 };
  const result = [];

  const sorted = [...orders].sort((a, b) => Date.parse(b.creationDate || 0) - Date.parse(a.creationDate || 0));
  for (const order of sorted) {
    if (order.cancelStatus && order.cancelStatus.cancelState === 'CANCELED') { excluded.cancelled += 1; continue; }
    if (order.orderPaymentStatus === 'FULLY_REFUNDED') { excluded.fullyRefunded += 1; continue; }
    if (order.orderFulfillmentStatus === 'FULFILLED') { excluded.fullyFulfilled += 1; continue; }
    const needsShipments = order.orderFulfillmentStatus === 'IN_PROGRESS' || (order.fulfillmentHrefs || []).length > 0;
    const shipped = needsShipments ? await fetchShippedQuantities(client, order.orderId) : null;
    const built = buildOrder(order, shipped);
    if (built.totalQuantity === 0) { excluded.noRemainingItems += 1; continue; }
    result.push(built);
  }

  return {
    generatedAt: new Date(now).toISOString(),
    source: 'eBay Sell Fulfillment getOrders',
    retrievalWindow: {
      creationDateFrom: creationFrom,
      lookbackDays,
      fulfillmentStatusFilter: ['NOT_STARTED', 'IN_PROGRESS'],
      note: 'Orders created before creationDateFrom are not retrieved; getOrders cannot return orders older than two years.'
    },
    ordersRetrieved: total,
    orderCount: result.length,
    excluded,
    orders: result,
    notes: [
      'totalDueSeller is eBay\'s amount due before shipping labels, refunds, and other later charges; it is not final profit.',
      'A null money field means eBay did not return it; it is not zero.',
      'Labels bought through eBay add a shipping fulfillment and are excluded; labels bought elsewhere are only excluded once tracking is uploaded to eBay.'
    ]
  };
}

module.exports = { buildPullList, parsePick, comparePicks, boundedLookbackDays, MAX_LOOKBACK_DAYS };
