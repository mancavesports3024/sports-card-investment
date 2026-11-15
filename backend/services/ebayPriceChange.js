// Gated price change for ONE variation of one listing. Only ever run with Carl's approval of the exact change.
// Without confirm:true the call is a preview (live read, no write, no log row). With confirm:true the caller must
// echo expectedOldPrice from the preview; any drift on eBay since then refuses the change.
// Writer: ReviseInventoryStatus (price only) when the variation has a SKU unique in the listing; otherwise
// ReviseFixedPriceItem, which per eBay must resend SKU, StartPrice, available Quantity and all VariationSpecifics.
// Sold-out variations are refused: eBay only revises a variation price while its quantity is above zero, and a
// zero quantity in a revise can drop the variation.
const { fetchItem, sameCardNumber } = require('./ebayStock');
const { escapeXml } = require('./ebayTradingClient');
const { parseUnits, formatUnits } = require('../utils/decimalMoney');

const MIN_PRICE = parseUnits('0.99');
const MAX_PRICE = parseUnits('10000');
const STALE_PENDING_MS = 10 * 60 * 1000;
const BODY_KEYS = new Set(['itemId', 'cardNumber', 'newPrice', 'expectedOldPrice', 'card', 'confirm']);

class PriceChangeError extends Error {
  constructor(code, httpStatus, message, details = {}) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

// "1.5", 1.5, "$1.50" -> "1.50"; null when not a positive amount with at most 2 decimals.
function normalizePrice(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const textValue = String(value).trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(textValue)) return null;
  return formatUnits(parseUnits(textValue), 'USD');
}

const samePrice = (a, b) => a !== null && b !== null && parseUnits(a) === parseUnits(b);

// Returns { itemId, cardNumber, newPrice, expectedOldPrice, card, confirm } or throws PriceChangeError(400).
function validateRequest(body) {
  const bad = (code, message) => new PriceChangeError(code, 400, message);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !BODY_KEYS.has(k))) {
    throw bad('INVALID_BODY', 'Body must be {"itemId", "cardNumber", "newPrice", optional "card", and "expectedOldPrice" + "confirm": true to apply}.');
  }
  const itemId = typeof body.itemId === 'string' && /^\d{9,15}$/.test(body.itemId.trim()) ? body.itemId.trim() : null;
  if (!itemId) throw bad('INVALID_ITEM_ID', 'itemId must be one eBay item id (digits).');
  const cardNumber = typeof body.cardNumber === 'string' && /^#?\s*[A-Za-z]{0,6}-?\d+[A-Za-z]?(?:-\d+)?$/.test(body.cardNumber.trim()) ? body.cardNumber.trim().replace(/^#\s*/, '') : null;
  if (!cardNumber) throw bad('INVALID_CARD_NUMBER', 'cardNumber must be one card number, e.g. "45" or "US12".');
  const newPrice = normalizePrice(body.newPrice);
  if (!newPrice) throw bad('INVALID_PRICE', 'newPrice must be a dollar amount with at most 2 decimals.');
  const units = parseUnits(newPrice);
  if (units < MIN_PRICE || units > MAX_PRICE) throw bad('PRICE_OUT_OF_RANGE', 'newPrice must be from 0.99 to 10000.00.');
  if (body.card !== undefined && (typeof body.card !== 'string' || !body.card.trim() || body.card.length > 200)) throw bad('INVALID_CARD', 'card must be the exact variation text.');
  if (body.confirm !== undefined && body.confirm !== true) throw bad('INVALID_CONFIRM', 'confirm must be true or omitted (preview).');
  let expectedOldPrice = null;
  if (body.confirm === true) {
    expectedOldPrice = normalizePrice(body.expectedOldPrice);
    if (!expectedOldPrice) throw bad('EXPECTED_OLD_PRICE_REQUIRED', 'Applying a change requires expectedOldPrice from the preview.');
  }
  return { itemId, cardNumber, newPrice, expectedOldPrice, card: body.card === undefined ? null : body.card.trim(), confirm: body.confirm === true };
}

// Live read; returns { listing, pick } for exactly one matching, priceable variation.
async function locateVariation(trading, { itemId, cardNumber, card }) {
  let listing;
  try {
    listing = await fetchItem(trading, itemId);
  } catch (err) {
    if (err && err.itemNotFound) throw new PriceChangeError('ITEM_NOT_FOUND', 404, 'Listing not found for this seller.');
    throw err;
  }
  if (listing.listingStatus && listing.listingStatus !== 'Active') throw new PriceChangeError('LISTING_NOT_ACTIVE', 409, 'Listing is not active.');
  if (!listing.variationListing) throw new PriceChangeError('NOT_A_VARIATION_LISTING', 422, 'Listing has no card variations; this endpoint only changes one variation.');
  let matches = listing.picks.filter((p) => sameCardNumber(p.cardNumber, cardNumber));
  if (card) matches = matches.filter((p) => p.card === card);
  if (!matches.length) throw new PriceChangeError('CARD_NOT_FOUND', 404, `No variation with card number ${cardNumber}${card ? ' and that card text' : ''} in this listing.`);
  if (matches.length > 1) {
    throw new PriceChangeError('AMBIGUOUS_CARD', 409, 'More than one variation has this card number; resend with "card" set to the exact variation text.', { candidates: matches.map((p) => p.card) });
  }
  const pick = matches[0];
  if (!pick.price) throw new PriceChangeError('PRICE_UNAVAILABLE', 502, 'eBay did not return a price for this variation.');
  if (pick.quantityAvailable === null) throw new PriceChangeError('QUANTITY_UNAVAILABLE', 502, 'eBay did not return a quantity for this variation.');
  if (pick.soldOut) throw new PriceChangeError('VARIATION_SOLD_OUT', 409, 'This variation is sold out; eBay only revises a variation price while it has quantity.');
  return { listing, pick };
}

function chooseMethod(listing, pick) {
  if (!pick.sku) return 'ReviseFixedPriceItem';
  const sameSku = listing.picks.filter((p) => p.sku === pick.sku).length;
  return sameSku === 1 ? 'ReviseInventoryStatus' : 'ReviseFixedPriceItem';
}

function reviseXml(method, itemId, pick, newPrice) {
  if (method === 'ReviseInventoryStatus') {
    return `<InventoryStatus><ItemID>${escapeXml(itemId)}</ItemID><SKU>${escapeXml(pick.sku)}</SKU><StartPrice>${newPrice}</StartPrice></InventoryStatus>`;
  }
  const specifics = pick.specifics
    .map((s) => `<NameValueList><Name>${escapeXml(s.name)}</Name>${s.values.map((v) => `<Value>${escapeXml(v)}</Value>`).join('')}</NameValueList>`)
    .join('');
  return `<Item><ItemID>${escapeXml(itemId)}</ItemID><Variations><Variation>${pick.sku ? `<SKU>${escapeXml(pick.sku)}</SKU>` : ''}<StartPrice>${newPrice}</StartPrice><Quantity>${pick.quantityAvailable}</Quantity><VariationSpecifics>${specifics}</VariationSpecifics></Variation></Variations></Item>`;
}

// The revise definitely did not apply: eBay answered with an error, or it never left (token/config failure).
function definitelyNotApplied(err) {
  if (!err || !err.kind) return false;
  if (['NOT_CONFIGURED', 'AUTH_FAILED', 'PERMISSION_DENIED', 'RATE_LIMITED'].includes(err.kind)) return true;
  if (err.kind === 'UPSTREAM_ERROR' && Array.isArray(err.errorCodes) && err.errorCodes.length) return true;
  return err.status >= 400 && err.status < 500;
}

// Settles a PENDING/UNKNOWN row for this variation against the live price before any new change.
async function reconcileOpenChange(store, open, livePrice, nowMs) {
  if (!open) return;
  if (open.status === 'PENDING' && nowMs - new Date(open.requested_at).getTime() < STALE_PENDING_MS) {
    throw new PriceChangeError('CHANGE_IN_PROGRESS', 409, 'Another price change for this card is in progress.', { changeId: Number(open.id) });
  }
  if (samePrice(livePrice, String(open.new_price))) {
    await store.finishChange(open.id, { status: 'APPLIED', readBackPrice: livePrice, note: 'RECONCILED_BY_LATER_READ' });
    return;
  }
  if (samePrice(livePrice, String(open.old_price))) {
    await store.finishChange(open.id, { status: 'FAILED_NOT_APPLIED', readBackPrice: livePrice, note: 'RECONCILED_BY_LATER_READ' });
    return;
  }
  throw new PriceChangeError('CHANGE_STATUS_UNKNOWN', 409, 'An earlier change for this card has an unconfirmed outcome and the live price matches neither side; check Seller Hub.', { changeId: Number(open.id) });
}

function changeView(listing, pick, method, oldPrice, newPrice) {
  return {
    itemId: listing.itemId,
    title: listing.title,
    cardNumber: pick.cardNumber,
    cardName: pick.cardName,
    card: pick.card,
    oldPrice: { value: oldPrice, currency: pick.price.currency },
    newPrice: { value: newPrice, currency: pick.price.currency },
    quantityAvailable: pick.quantityAvailable,
    method
  };
}

async function setPrice({ trading, store, request, requestedBy, now = () => Date.now(), log = () => {} }) {
  const { listing, pick } = await locateVariation(trading, request);
  const oldPrice = pick.price.value;
  if (pick.price.currency !== 'USD') throw new PriceChangeError('UNSUPPORTED_CURRENCY', 422, 'Only USD listings are supported.');
  await reconcileOpenChange(store, await store.openChange(listing.itemId, pick.variationKey), oldPrice, now());
  if (samePrice(oldPrice, request.newPrice)) throw new PriceChangeError('NO_CHANGE', 409, `The live price is already ${oldPrice}.`);

  const method = chooseMethod(listing, pick);
  const change = changeView(listing, pick, method, oldPrice, request.newPrice);
  if (!request.confirm) {
    return {
      httpStatus: 200,
      body: {
        status: 'preview',
        change,
        confirmWith: { itemId: listing.itemId, cardNumber: pick.cardNumber, ...(request.card ? { card: request.card } : {}), newPrice: request.newPrice, expectedOldPrice: oldPrice, confirm: true },
        note: 'Nothing was changed. Send confirmWith only after the exact change is approved.'
      }
    };
  }
  if (!samePrice(oldPrice, request.expectedOldPrice)) {
    throw new PriceChangeError('PRICE_CHANGED_SINCE_PREVIEW', 409, `The live price is ${oldPrice}, not the approved ${request.expectedOldPrice}; nothing was changed.`, { livePrice: oldPrice });
  }

  const changeId = await store.claimChange({
    itemId: listing.itemId, variationKey: pick.variationKey, cardNumber: pick.cardNumber, card: pick.card, title: listing.title,
    oldPrice, newPrice: request.newPrice, currency: pick.price.currency, method, requestedBy, quantityBefore: pick.quantityAvailable
  });
  if (!changeId) throw new PriceChangeError('CHANGE_IN_PROGRESS', 409, 'Another price change for this card is in progress or unconfirmed.');

  try {
    await trading.write(method, reviseXml(method, listing.itemId, pick, request.newPrice));
  } catch (err) {
    const codes = Array.isArray(err && err.errorCodes) ? err.errorCodes.join(',') : null;
    if (definitelyNotApplied(err)) {
      await store.finishChange(changeId, { status: 'FAILED_NOT_APPLIED', errorKind: err.kind, errorCodes: codes });
      throw err;
    }
    await store.finishChange(changeId, { status: 'UNKNOWN', errorKind: (err && err.kind) || 'INTERNAL_ERROR', errorCodes: codes, note: 'NO_CONFIRMATION' });
    log(`[ebay-set-price] outcome unknown change=${changeId} kind=${(err && err.kind) || 'INTERNAL_ERROR'}`);
    throw new PriceChangeError('PRICE_CHANGE_STATUS_UNKNOWN', 502, 'eBay did not confirm the revise; it will not be retried automatically. Check Seller Hub.', { changeId });
  }

  let after;
  try {
    after = (await fetchItem(trading, listing.itemId)).picks.find((p) => p.variationKey === pick.variationKey) || null;
  } catch (err) {
    after = undefined;
  }
  if (!after || !after.price) {
    await store.finishChange(changeId, { status: 'UNKNOWN', note: after === undefined ? 'READ_BACK_FAILED' : 'READ_BACK_VARIATION_MISSING' });
    throw new PriceChangeError('PRICE_CHANGE_STATUS_UNKNOWN', 502, 'eBay accepted the revise but the read-back failed; check Seller Hub before any retry.', { changeId });
  }
  if (!samePrice(after.price.value, request.newPrice)) {
    await store.finishChange(changeId, { status: 'UNKNOWN', readBackPrice: after.price.value, quantityAfter: after.quantityAvailable, note: 'READ_BACK_MISMATCH' });
    throw new PriceChangeError('PRICE_CHANGE_STATUS_UNKNOWN', 502, `eBay accepted the revise but reads back ${after.price.value}; check Seller Hub.`, { changeId, readBackPrice: after.price.value });
  }

  const warnings = [];
  if (after.quantityAvailable !== pick.quantityAvailable) warnings.push('QUANTITY_CHANGED_DURING_UPDATE');
  if ((after.sku || null) !== (pick.sku || null)) warnings.push('SKU_CHANGED');
  await store.finishChange(changeId, { status: 'APPLIED', readBackPrice: after.price.value, quantityAfter: after.quantityAvailable, note: warnings.join(',') || null });
  await store.updateIndexedPrice(listing.itemId, pick.variationKey, after.price.value).catch(() => {});
  return {
    httpStatus: 200,
    body: {
      status: 'applied',
      changeId,
      ...change,
      newPrice: after.price,
      readBack: { price: after.price, quantityAvailable: after.quantityAvailable },
      warnings
    }
  };
}

// Read-only listing of the change log for the staff page and helpers.
function changeLogView(rows) {
  return rows.map((r) => ({
    id: Number(r.id),
    itemId: r.item_id,
    title: r.listing_title,
    cardNumber: r.card_number,
    card: r.card_raw,
    oldPrice: String(r.old_price),
    newPrice: String(r.new_price),
    readBackPrice: r.read_back_price === null ? null : String(r.read_back_price),
    currency: r.currency,
    status: r.status,
    method: r.method,
    requestedBy: r.requested_by,
    requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : null,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    quantityBefore: r.quantity_before,
    quantityAfter: r.quantity_after,
    errorKind: r.error_kind,
    note: r.note
  }));
}

module.exports = { setPrice, validateRequest, normalizePrice, locateVariation, chooseMethod, reviseXml, changeLogView, PriceChangeError };
