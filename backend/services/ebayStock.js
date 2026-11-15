// Per-card stock for Carl's "You Pick" listings from the Trading API (read-only).
// A pick is one variation; its "Card" specific is parsed exactly like the pull list ("<number> <name>").
// Available quantity = Variation.Quantity - Variation.SellingStatus.QuantitySold (eBay's documented formula).
const { parsePick, comparePicks } = require('./ebayPullList');
const { parseUnits, formatUnits } = require('../utils/decimalMoney');
const { escapeXml, toArray, text, TradingCallError } = require('./ebayTradingClient');

const ITEM_ID_RE = /^\d{9,15}$/;
const CARD_NUMBER_RE = /^#?\s*([A-Za-z]{0,6}-?\d+[A-Za-z]?(?:-\d+)?)$/;
const MAX_QUERY_LENGTH = 80;
const SELLER_LIST_PAGE_SIZE = 200;
const SELLER_LIST_MAX_PAGES = 100;
const SELLER_LIST_WINDOW_DAYS = 120; // GetSellerList's maximum EndTime range
const DEFAULT_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_PRICE_TYPES = new Set(['FixedPriceItem', 'StoresFixedPrice']);

const GET_ITEM_SELECTORS = [
  'Item.ItemID', 'Item.Title', 'Item.ListingType', 'Item.ListingDetails.ViewItemURL', 'Item.SellingStatus',
  'Item.Quantity', 'Item.StartPrice', 'Item.SKU', 'Item.Variations.Variation'
];
const SELLER_LIST_SELECTORS = [
  'ItemArray.Item.ItemID', 'ItemArray.Item.ListingType', 'ItemArray.Item.SellingStatus.ListingStatus',
  'PaginationResult', 'HasMoreItems', 'PageNumber'
];

function validItemId(value) {
  return typeof value === 'string' && ITEM_ID_RE.test(value.trim()) ? value.trim() : null;
}

function validQuery(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string') return null;
  const q = value.trim();
  return q.length <= MAX_QUERY_LENGTH ? q : null;
}

// Lowercase, accents stripped, punctuation collapsed to single spaces: "Pete Crow-Armstrong" -> "pete crow armstrong".
function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Word-start match, so "alvarez" and "crow arm" hit but "varez" does not.
function nameMatches(haystack, query) {
  const q = normalizeName(query);
  return Boolean(q) && ` ${normalizeName(haystack)}`.includes(` ${q}`);
}

function cardNumberQuery(q) {
  const m = CARD_NUMBER_RE.exec(String(q || '').trim());
  return m ? m[1].toUpperCase() : null;
}

function sameCardNumber(a, b) {
  return Boolean(a && b) && String(a).replace(/^#/, '').toUpperCase() === String(b).replace(/^#/, '').toUpperCase();
}

function money(node) {
  const value = text(node);
  const currency = node && node.$ && node.$.currencyID;
  const units = parseUnits(value);
  if (units === null || !currency) return null;
  return { value: formatUnits(units, currency), currency };
}

function int(node) {
  const v = text(node);
  return v !== null && /^\d+$/.test(v) ? Number(v) : null;
}

function specificsOf(variation) {
  const lists = toArray(variation && variation.VariationSpecifics && variation.VariationSpecifics.NameValueList);
  return lists
    .map((nv) => ({ name: text(nv.Name), values: toArray(nv.Value).map(text).filter((v) => v !== null) }))
    .filter((nv) => nv.name);
}

// Stable identity for a variation within its listing: its full set of specifics.
function variationKey(specifics) {
  return specifics
    .map((s) => `${s.name}=${s.values.join('|')}`)
    .sort()
    .join(';');
}

function quantities(quantityNode, sellingStatus) {
  const total = int(quantityNode);
  const sold = int(sellingStatus && sellingStatus.QuantitySold) || 0;
  if (total === null) return { quantityAvailable: null, quantitySold: sold, soldOut: null };
  const available = Math.max(0, total - sold);
  return { quantityAvailable: available, quantitySold: sold, soldOut: available === 0 };
}

function pickFromVariation(variation) {
  const specifics = specificsOf(variation);
  const card = specifics.find((s) => s.name.trim().toLowerCase() === 'card');
  const parsed = parsePick(card ? card.values[0] : undefined);
  return {
    cardNumber: parsed.cardNumber,
    cardName: parsed.name,
    card: parsed.raw,
    pickStatus: parsed.pickStatus,
    ...quantities(variation.Quantity, variation.SellingStatus),
    price: money(variation.StartPrice),
    sku: text(variation.SKU),
    variationKey: variationKey(specifics),
    specifics
  };
}

// Trading Item -> { itemId, title, url, listingType, listingStatus, variationListing, picks[] }.
function parseItem(item) {
  const variations = toArray(item && item.Variations && item.Variations.Variation);
  const base = {
    itemId: text(item.ItemID),
    title: text(item.Title),
    url: text(item.ListingDetails && item.ListingDetails.ViewItemURL),
    listingType: text(item.ListingType),
    listingStatus: text(item.SellingStatus && item.SellingStatus.ListingStatus),
    variationListing: variations.length > 0
  };
  if (variations.length) return { ...base, picks: variations.map(pickFromVariation).sort(comparePicks) };
  const single = {
    cardNumber: null,
    cardName: base.title,
    card: null,
    pickStatus: 'NOT_A_VARIATION',
    ...quantities(item.Quantity, item.SellingStatus),
    price: money(item.StartPrice) || money(item.SellingStatus && item.SellingStatus.CurrentPrice),
    sku: text(item.SKU),
    variationKey: null,
    specifics: []
  };
  return { ...base, picks: [single] };
}

async function fetchItem(trading, itemId) {
  const selectors = GET_ITEM_SELECTORS.map((s) => `<OutputSelector>${s}</OutputSelector>`).join('');
  const doc = await trading.read('GetItem', `<ItemID>${escapeXml(itemId)}</ItemID><IncludeItemSpecifics>false</IncludeItemSpecifics>${selectors}`);
  const item = doc && doc.Item;
  if (!item || text(item.ItemID) !== itemId) throw new TradingCallError('UPSTREAM_ERROR');
  return parseItem(item);
}

function filterPicks(picks, q) {
  if (!q) return picks;
  const number = cardNumberQuery(q);
  return picks.filter((p) => (number && sameCardNumber(p.cardNumber, number)) || nameMatches(p.cardName || p.card, q));
}

const publicPick = ({ specifics, ...rest }) => rest;

// GET /ebay-stock: live lookup of one listing.
async function buildStock(trading, { itemId, q = '', now = Date.now() }) {
  const listing = await fetchItem(trading, itemId);
  const matches = filterPicks(listing.picks, q);
  return {
    generatedAt: new Date(now).toISOString(),
    source: 'eBay Trading GetItem (live)',
    itemId: listing.itemId,
    title: listing.title,
    url: listing.url,
    listingStatus: listing.listingStatus,
    variationListing: listing.variationListing,
    query: q || null,
    pickCount: listing.picks.length,
    matchCount: matches.length,
    availableCount: matches.filter((p) => p.soldOut === false).length,
    soldOutCount: matches.filter((p) => p.soldOut === true).length,
    unparsedCount: listing.picks.filter((p) => p.pickStatus === 'UNPARSED' || p.pickStatus === 'MISSING').length,
    picks: matches.map(publicPick),
    notes: [
      'quantityAvailable = eBay variation quantity minus quantity sold; soldOut means 0 available.',
      'A pick absent from this list is not offered in the listing.'
    ]
  };
}

async function fetchActiveItemIds(trading, { now }) {
  const from = new Date(now).toISOString();
  const to = new Date(now + SELLER_LIST_WINDOW_DAYS * DAY_MS).toISOString();
  const selectors = SELLER_LIST_SELECTORS.map((s) => `<OutputSelector>${s}</OutputSelector>`).join('');
  const ids = new Set();
  const skipped = { notActive: 0, notFixedPrice: 0 };
  let entries = 0;
  let totalEntries = null;
  let calls = 0;
  for (let page = 1; page <= SELLER_LIST_MAX_PAGES; page += 1) {
    const doc = await trading.read('GetSellerList', `<EndTimeFrom>${from}</EndTimeFrom><EndTimeTo>${to}</EndTimeTo><GranularityLevel>Coarse</GranularityLevel><Pagination><EntriesPerPage>${SELLER_LIST_PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>${selectors}`);
    calls += 1;
    const items = toArray(doc && doc.ItemArray && doc.ItemArray.Item);
    const pr = doc && doc.PaginationResult;
    if (pr && int(pr.TotalNumberOfEntries) !== null) totalEntries = int(pr.TotalNumberOfEntries);
    const totalPages = pr ? int(pr.TotalNumberOfPages) : null;
    for (const item of items) {
      entries += 1;
      const id = text(item.ItemID);
      if (!id) continue;
      const status = text(item.SellingStatus && item.SellingStatus.ListingStatus);
      if (status && status !== 'Active') { skipped.notActive += 1; continue; }
      const type = text(item.ListingType);
      if (type && !FIXED_PRICE_TYPES.has(type)) { skipped.notFixedPrice += 1; continue; }
      ids.add(id);
    }
    const more = text(doc && doc.HasMoreItems) === 'true' || (totalPages !== null && page < totalPages);
    if (!more) {
      if (totalEntries !== null && entries < totalEntries) throw new TradingCallError('INCOMPLETE_DATA');
      return { itemIds: [...ids], sellerListEntries: entries, skipped, calls };
    }
  }
  throw new TradingCallError('INCOMPLETE_DATA');
}

async function mapLimit(values, limit, fn) {
  const out = new Array(values.length);
  let next = 0;
  let failed = null;
  async function worker() {
    while (next < values.length && !failed) {
      const i = next;
      next += 1;
      try {
        out[i] = await fn(values[i]);
      } catch (err) {
        failed = failed || err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  if (failed) throw failed;
  return out;
}

// Reads every active fixed-price listing. Any failed read fails the whole build (no partial index),
// except a listing that ended between GetSellerList and GetItem, which is skipped and counted.
async function buildIndexSnapshot(trading, { now = Date.now(), concurrency = DEFAULT_CONCURRENCY } = {}) {
  const list = await fetchActiveItemIds(trading, { now });
  let endedSinceList = 0;
  const listings = (await mapLimit(list.itemIds, concurrency, async (id) => {
    try {
      const listing = await fetchItem(trading, id);
      if (listing.listingStatus && listing.listingStatus !== 'Active') { endedSinceList += 1; return null; }
      return listing;
    } catch (err) {
      if (err && err.itemNotFound) { endedSinceList += 1; return null; }
      throw err;
    }
  })).filter(Boolean);
  const picks = listings.reduce((n, l) => n + l.picks.length, 0);
  return {
    listings,
    stats: {
      sellerListEntries: list.sellerListEntries,
      itemCount: listings.length,
      pickCount: picks,
      unparsedCount: listings.reduce((n, l) => n + l.picks.filter((p) => p.pickStatus === 'UNPARSED' || p.pickStatus === 'MISSING').length, 0),
      skipped: { ...list.skipped, endedSinceList },
      tradingCalls: list.calls + list.itemIds.length
    }
  };
}

module.exports = {
  buildStock,
  buildIndexSnapshot,
  fetchItem,
  parseItem,
  filterPicks,
  normalizeName,
  nameMatches,
  cardNumberQuery,
  sameCardNumber,
  validItemId,
  validQuery,
  publicPick,
  MAX_QUERY_LENGTH
};
