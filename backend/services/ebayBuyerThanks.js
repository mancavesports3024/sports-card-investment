// Sends Carl's approved thank-you message for ONE order via the Commerce Message API (test phase only).
// eBay's sendMessage has no subject field and only supports LISTING references, so the message carries
// the approved body and references the order's listing with the most unshipped units (approved Nov 10, 2026).
// Multi-listing orders name every listing ("A and B") in the item placeholder.
const { SCOPES, EbaySellerError } = require('./ebaySellerClient');

const ORDER_URL = 'https://api.ebay.com/sell/fulfillment/v1/order';
const SEND_URL = 'https://api.ebay.com/commerce/message/v1/send_message';
const MAX_MESSAGE_LENGTH = 2000;
const SHIP_BY_TIME_ZONE = 'America/Los_Angeles';
const ORDER_ID_RE = /^[A-Za-z0-9-]{5,40}$/;

// Approved by Carl Nov 10, 2026 (second sentence revised the same day). Verbatim apart from the placeholders;
// several items switch "is"/"It\u2019ll" to "are"/"They\u2019ll".
const TEMPLATE = [
  'Hi [buyer username],',
  '',
  'Thank you for your purchase from ManCave Sports Cards! Your [item / set name] is being pulled and packed with care. It\u2019ll ship by [ship-by date].',
  '',
  'If you enjoyed shopping with us, you can follow our eBay store, ManCaveSportsLLC, to see new cards as we list them.',
  '',
  'Thanks again \u2014 we appreciate your business!',
  '\u2014 Carl, ManCave Sports Cards'
].join('\n');

class ThanksError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.httpStatus = status;
  }
}

const SUFFIX_RE = /[\s\-\u2013\u2014|:,~*!]*\(?\s*please\s+buy\s+2\s*\+\s*(?:&|and)\s*save\s*!*\s*\)?[\s\-\u2013\u2014|:,~*!]*$/i;
const COMPLETE_YOUR_SET_RE = /[\s\-\u2013\u2014|:,~*!]*\(?\s*complete\s+your\s+set\s*!*\s*\)?(?=[\s\-\u2013\u2014|:,~*!]|$)/gi;
const EDGE_SEPARATORS_RE = /^[\s\-\u2013\u2014|:,~*]+|[\s\-\u2013\u2014|:,~*]+$/g;

// Removes the "Please Buy 2+ & Save" suffix and the "Complete your set" phrase (Carl, Nov 10, 2026).
function cleanTitle(title) {
  return String(title || '')
    .replace(SUFFIX_RE, '')
    .replace(COMPLETE_YOUR_SET_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(EDGE_SEPARATORS_RE, '')
    .trim();
}

function joinNames(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

const NUMBER_RANGE_RE = /(#?\d+)-(#?\d+)/g;
const enDashRanges = (s) => s.replace(NUMBER_RANGE_RE, '$1\u2013$2');

// One name: "X". Several sharing a 2+ word lead: "cards from the 2021 Topps Baseball (#1–#165 and #166–#330)".
function describeItems(names) {
  if (names.length === 1) return enDashRanges(names[0]);
  const words = names.map((n) => n.split(' '));
  let shared = 0;
  while (words.every((w) => shared < w.length - 1 && w[shared] === words[0][shared])) shared += 1;
  if (shared < 2) return enDashRanges(joinNames(names));
  const lead = words[0].slice(0, shared).join(' ');
  const rests = words.map((w) => w.slice(shared).join(' '));
  return enDashRanges(`cards from the ${lead} (${joinNames(rests)})`);
}

const SHIP_BY_FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: SHIP_BY_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

// eBay shipByDate is a UTC instant; the ship-by DAY is its calendar date in Pacific time.
function formatShipBy(isoInstant) {
  const ms = Date.parse(isoInstant);
  if (!isoInstant || Number.isNaN(ms)) return null;
  return SHIP_BY_FORMAT.format(new Date(ms));
}

function renderMessage({ buyerUsername, itemName, shipBy, plural = false }) {
  const text = plural
    ? TEMPLATE.replace('is being pulled', 'are being pulled').replace('It\u2019ll ship', 'They\u2019ll ship')
    : TEMPLATE;
  return text
    .replace('[buyer username]', () => buyerUsername)
    .replace('[item / set name]', () => itemName)
    .replace('[ship-by date]', () => shipBy);
}

function validOrderId(value) {
  return typeof value === 'string' && ORDER_ID_RE.test(value) ? value : null;
}

// Pure: order -> { buyerUsername, legacyItemId, messageText } or ThanksError.
function buildThanks(order) {
  if (order.cancelStatus && ['CANCELED', 'CANCEL_REQUESTED', 'IN_PROGRESS'].includes(order.cancelStatus.cancelState)) {
    throw new ThanksError('ORDER_NOT_ELIGIBLE', 409, 'Order is cancelled or has a cancellation in progress.');
  }
  if (order.orderPaymentStatus === 'FULLY_REFUNDED') throw new ThanksError('ORDER_NOT_ELIGIBLE', 409, 'Order is fully refunded.');
  if (order.orderFulfillmentStatus === 'FULFILLED') throw new ThanksError('ORDER_NOT_ELIGIBLE', 409, 'Order is already fulfilled.');
  const buyerUsername = order.buyer && order.buyer.username;
  if (!buyerUsername) throw new ThanksError('MISSING_BUYER', 422, 'Order has no buyer username.');

  const lines = (order.lineItems || []).filter((li) => li.lineItemFulfillmentStatus !== 'FULFILLED');
  const listings = new Map(); // legacyItemId -> { name, units }, in order of first appearance
  for (const li of lines) {
    if (!li.legacyItemId) continue;
    const entry = listings.get(li.legacyItemId) || { name: cleanTitle(li.title), units: 0 };
    entry.units += Number.isInteger(li.quantity) ? li.quantity : 0;
    listings.set(li.legacyItemId, entry);
  }
  if (!listings.size) throw new ThanksError('MISSING_LISTING', 422, 'Order has no unshipped listing.');
  if ([...listings.values()].some((l) => !l.name)) throw new ThanksError('MISSING_TITLE', 422, 'Listing title is empty.');
  const names = [...new Set([...listings.values()].map((l) => l.name))];
  const itemName = describeItems(names);
  // sendMessage accepts one LISTING reference: use the listing with the most unshipped units (first on ties).
  const legacyItemId = [...listings.entries()].reduce((best, cur) => (cur[1].units > best[1].units ? cur : best))[0];

  const shipBys = lines.map((li) => li.lineItemFulfillmentInstructions && li.lineItemFulfillmentInstructions.shipByDate).filter((d) => d && !Number.isNaN(Date.parse(d)));
  if (!shipBys.length) throw new ThanksError('MISSING_SHIP_BY', 422, 'Order has no ship-by date.');
  const earliest = shipBys.sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  const messageText = renderMessage({ buyerUsername, itemName, shipBy: formatShipBy(earliest), plural: names.length > 1 });
  if (messageText.length > MAX_MESSAGE_LENGTH) throw new ThanksError('MESSAGE_TOO_LONG', 422, `Message exceeds ${MAX_MESSAGE_LENGTH} characters.`);
  return { buyerUsername, legacyItemId, messageText };
}

// eBay answered with a 4xx: the message was not accepted. Anything else after the request left is ambiguous.
const definitelyNotSent = (err) => err instanceof EbaySellerError && err.status >= 400 && err.status < 500;

async function sendThanks({ client, store, orderId, log = () => {} }) {
  const existing = await store.get(orderId);
  if (existing && existing.status === 'SENT') throw new ThanksError('ALREADY_SENT', 409, 'A thank-you message was already sent for this order.');
  if (existing && existing.status !== 'FAILED_NOT_SENT') throw new ThanksError('SEND_STATUS_UNKNOWN', 409, 'A previous send for this order has an unconfirmed outcome; check eBay Messages before any manual retry.');

  let order;
  try {
    order = await client.get(`${ORDER_URL}/${encodeURIComponent(orderId)}`, SCOPES.fulfillment);
  } catch (err) {
    if (err && err.status === 404) throw new ThanksError('ORDER_NOT_FOUND', 404, 'Order not found for this seller.');
    throw err;
  }
  const { buyerUsername, legacyItemId, messageText } = buildThanks(order || {});
  await client.getAccessToken(SCOPES.message);

  if (!(await store.claim(orderId))) {
    const now = await store.get(orderId);
    if (now && now.status === 'SENT') throw new ThanksError('ALREADY_SENT', 409, 'A thank-you message was already sent for this order.');
    throw new ThanksError('SEND_STATUS_UNKNOWN', 409, 'Another send for this order is in progress or unconfirmed.');
  }

  let response;
  try {
    response = await client.post(SEND_URL, SCOPES.message, {
      otherPartyUsername: buyerUsername,
      messageText,
      reference: { referenceId: legacyItemId, referenceType: 'LISTING' }
    });
  } catch (err) {
    if (definitelyNotSent(err)) {
      await store.markFailed(orderId);
      throw err;
    }
    await store.markUnknown(orderId);
    log(`[ebay-send-thanks] outcome unknown kind=${(err && err.kind) || 'INTERNAL_ERROR'}`);
    throw new ThanksError('SEND_STATUS_UNKNOWN', 502, 'eBay did not confirm the send; it will not be retried automatically. Check eBay Messages.');
  }

  const messageId = response && typeof response.messageId === 'string' ? response.messageId : null;
  if (!messageId) {
    await store.markUnknown(orderId);
    throw new ThanksError('SEND_STATUS_UNKNOWN', 502, 'eBay returned no message id; it will not be retried automatically. Check eBay Messages.');
  }
  let recorded = true;
  try {
    await store.markSent(orderId, { messageId, conversationId: null });
  } catch {
    recorded = false;
    log('[ebay-send-thanks] sent but duplicate record not updated; row stays PENDING (blocks resends)');
  }
  return {
    orderId,
    buyerUsername,
    status: 'sent',
    ebay: { messageId, createdDate: response.createdDate || null, conversationId: null, referenceType: 'LISTING', referenceId: legacyItemId },
    ...(recorded ? {} : { warning: 'DUPLICATE_RECORD_NOT_UPDATED' })
  };
}

module.exports = { sendThanks, buildThanks, cleanTitle, formatShipBy, renderMessage, validOrderId, ThanksError, TEMPLATE, MAX_MESSAGE_LENGTH };
