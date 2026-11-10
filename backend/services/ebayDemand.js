// Demand and competition signals for a card query (read-only, application tokens only).
// Browse = ACTIVE listings / asking prices. Marketplace Insights = SOLD listings (last 90 days), only when eBay granted access.
const { SCOPES } = require('./ebaySellerClient');
const { parseUnits, formatUnits, currencyDigits, SCALE: UNIT_SCALE } = require('../utils/decimalMoney');

const BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const INSIGHTS_URL = 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search';
const TAXONOMY_URL = 'https://api.ebay.com/commerce/taxonomy/v1';
const MARKETPLACE = 'EBAY_US';
const MARKETPLACE_HEADERS = { 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE };
const SPORTS_TRADING_CARDS_ID = '212';
const SINGLES_CATEGORY_NAME = 'Trading Card Singles';
const INSIGHTS_WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 100;
const SAMPLE_SIZE = 5;
const CATEGORY_RETRY_MS = 10 * 60 * 1000;
const NOT_GRANTED_RECHECK_MS = 60 * 60 * 1000;

// Query word -> eBay "Sport" aspect value in the Trading Card Singles category.
const SPORT_ASPECTS = {
  baseball: 'Baseball',
  basketball: 'Basketball',
  football: 'Football',
  hockey: 'Ice Hockey',
  soccer: 'Soccer',
  golf: 'Golf',
  tennis: 'Tennis',
  boxing: 'Boxing',
  wrestling: 'Wrestling'
};

function boundedLimit(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_LIMIT ? n : null;
}

// Returns the normalized query, or null when invalid.
function validQuery(value) {
  if (typeof value !== 'string') return null;
  const q = value.trim().replace(/\s+/g, ' ');
  if (q.length < 2 || q.length > MAX_QUERY_LENGTH || q.includes('*')) return null;
  return q;
}

function queryTerms(q) {
  const words = q.toLowerCase().split(' ');
  const sportWord = words.find((w) => SPORT_ASPECTS[w]);
  return { sport: sportWord ? SPORT_ASPECTS[sportWord] : null, tokens: words.filter((w) => !SPORT_ASPECTS[w]) };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Relevant = title contains every non-sport query word (sellers often omit the sport from titles).
function isRelevant(title, tokens) {
  const t = String(title || '').toLowerCase();
  return tokens.every((tok) => new RegExp(`(^|[^a-z0-9])${escapeRe(tok)}($|[^a-z0-9])`).test(t));
}

// Rounds a non-negative units/divisor quotient half-up to the currency's minor unit.
function roundedQuotient(units, divisor, currency) {
  const step = 10n ** BigInt(UNIT_SCALE - currencyDigits(currency));
  const scaledDivisor = divisor * step;
  return ((units + scaledDivisor / 2n) / scaledDivisor) * step;
}

function priceStats(unitsList, currency, { withAverage = false } = {}) {
  if (!unitsList.length) return null;
  const sorted = [...unitsList].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : roundedQuotient(sorted[mid - 1] + sorted[mid], 2n, currency);
  const stats = { currency, count: sorted.length, min: formatUnits(sorted[0], currency), median: formatUnits(median, currency) };
  if (withAverage) stats.avg = formatUnits(roundedQuotient(sorted.reduce((s, u) => s + u, 0n), BigInt(sorted.length), currency), currency);
  stats.max = formatUnits(sorted[sorted.length - 1], currency);
  return stats;
}

function usdUnits(amount) {
  if (!amount || amount.currency !== 'USD') return null;
  return parseUnits(amount.value);
}

function searchUrl(base, q, limit, category) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (category && category.categoryId) {
    params.set('category_ids', category.categoryId);
    if (category.sportAspect) params.set('aspect_filter', `categoryId:${category.categoryId},Sport:{${category.sportAspect}}`);
  }
  return `${base}?${params.toString()}`;
}

function summarizeActive(data, tokens) {
  const items = Array.isArray(data && data.itemSummaries) ? data.itemSummaries : [];
  const excluded = { notRelevant: 0, auctionOnly: 0, noUsdPrice: 0 };
  const priced = [];
  const sellers = new Set();
  let sellerFieldSeen = false;
  for (const item of items) {
    if (!isRelevant(item.title, tokens)) { excluded.notRelevant += 1; continue; }
    if (item.seller && item.seller.username) { sellerFieldSeen = true; sellers.add(item.seller.username); }
    if (!(item.buyingOptions || []).includes('FIXED_PRICE')) { excluded.auctionOnly += 1; continue; }
    const units = usdUnits(item.price);
    if (units === null) { excluded.noUsdPrice += 1; continue; }
    priced.push({ item, units });
  }
  return {
    source: 'eBay Browse item_summary search (ACTIVE listings)',
    priceType: 'ASKING_PRICE',
    totalMatches: typeof data.total === 'number' ? data.total : null,
    returnedCount: items.length,
    relevantCount: items.length - excluded.notRelevant,
    excluded,
    askingPrice: priceStats(priced.map((p) => p.units), 'USD'),
    distinctSellers: sellerFieldSeen ? sellers.size : null,
    samples: priced.slice(0, SAMPLE_SIZE).map(({ item }) => ({
      title: item.title || null,
      askingPrice: { value: formatUnits(usdUnits(item.price), 'USD'), currency: 'USD' },
      buyingOptions: item.buyingOptions || []
    }))
  };
}

function summarizeSold(data, tokens) {
  const items = Array.isArray(data && data.itemSales) ? data.itemSales : [];
  const relevant = items.filter((i) => isRelevant(i.title, tokens));
  const priced = relevant.map((item) => ({ item, units: usdUnits(item.lastSoldPrice) })).filter((p) => p.units !== null);
  const dates = relevant.map((i) => i.lastSoldDate).filter((d) => d && !Number.isNaN(Date.parse(d))).sort((a, b) => Date.parse(b) - Date.parse(a));
  const byRecent = [...priced].sort((a, b) => (Date.parse(b.item.lastSoldDate) || 0) - (Date.parse(a.item.lastSoldDate) || 0));
  return {
    source: 'eBay Marketplace Insights item_sales search (SOLD listings)',
    priceType: 'SOLD_PRICE',
    windowDays: INSIGHTS_WINDOW_DAYS,
    totalMatches: typeof data.total === 'number' ? data.total : null,
    returnedCount: items.length,
    relevantCount: relevant.length,
    excluded: { notRelevant: items.length - relevant.length, noUsdPrice: relevant.length - priced.length },
    soldPrice: priceStats(priced.map((p) => p.units), 'USD', { withAverage: true }),
    mostRecentSoldDate: dates[0] || null,
    samples: byRecent.slice(0, SAMPLE_SIZE).map(({ item, units }) => ({
      title: item.title || null,
      lastSoldPrice: { value: formatUnits(units, 'USD'), currency: 'USD' },
      lastSoldDate: item.lastSoldDate || null,
      totalSoldQuantity: Number.isInteger(item.totalSoldQuantity) ? item.totalSoldQuantity : null
    }))
  };
}

function errorDetail(err) {
  const detail = { error: (err && err.kind) || 'INTERNAL_ERROR' };
  if (err && err.status) detail.httpStatus = err.status;
  if (err && err.oauthError) detail.oauthError = err.oauthError;
  if (err && err.ebayErrorIds && err.ebayErrorIds.length) detail.ebayErrorIds = err.ebayErrorIds;
  return detail;
}

const notGranted = (err) => err && err.kind === 'PERMISSION_DENIED';

function createDemandService({ client, now = () => Date.now() }) {
  let category = null; // { categoryId, categoryName, resolvedAt } once resolved
  let categoryRetryAt = 0;
  let insightsDenied = null; // { detail, until }

  async function resolveSinglesCategory() {
    if (category) return category;
    if (now() < categoryRetryAt) return null;
    try {
      const tree = await client.get(`${TAXONOMY_URL}/get_default_category_tree_id?marketplace_id=${MARKETPLACE}`, SCOPES.publicApp);
      const treeId = tree && tree.categoryTreeId;
      if (!/^\d+$/.test(String(treeId))) throw new Error('no tree id');
      const sub = await client.get(`${TAXONOMY_URL}/category_tree/${treeId}/get_category_subtree?category_id=${SPORTS_TRADING_CARDS_ID}`, SCOPES.publicApp);
      const children = (sub && sub.categorySubtreeNode && sub.categorySubtreeNode.childCategoryTreeNodes) || [];
      const leaf = children.find((n) => n.leafCategoryTreeNode && n.category && n.category.categoryName === SINGLES_CATEGORY_NAME);
      if (!leaf) throw new Error('leaf not found');
      category = { categoryId: leaf.category.categoryId, categoryName: leaf.category.categoryName, categoryTreeId: String(treeId), resolvedAt: new Date(now()).toISOString() };
      return category;
    } catch (err) {
      if (err && err.kind === 'NOT_CONFIGURED') throw err;
      categoryRetryAt = now() + CATEGORY_RETRY_MS;
      return null;
    }
  }

  async function active(q, limit, cat, tokens) {
    try {
      const data = await client.get(searchUrl(BROWSE_URL, q, limit, cat), SCOPES.publicApp, { headers: MARKETPLACE_HEADERS });
      return { access: 'ok', result: summarizeActive(data || {}, tokens) };
    } catch (err) {
      if (err && err.kind === 'NOT_CONFIGURED') throw err;
      return { access: err.kind || 'INTERNAL_ERROR', detail: errorDetail(err), result: null };
    }
  }

  async function sold(q, limit, cat, tokens) {
    if (insightsDenied && now() < insightsDenied.until) return { access: 'not_granted', detail: insightsDenied.detail, result: null };
    try {
      const data = await client.get(searchUrl(INSIGHTS_URL, q, limit, cat), SCOPES.marketplaceInsights, { headers: MARKETPLACE_HEADERS });
      insightsDenied = null;
      return { access: 'ok', result: summarizeSold(data || {}, tokens) };
    } catch (err) {
      if (err && err.kind === 'NOT_CONFIGURED') throw err;
      const detail = errorDetail(err);
      if (notGranted(err)) {
        detail.code = 'MARKETPLACE_INSIGHTS_NOT_GRANTED';
        insightsDenied = { detail, until: now() + NOT_GRANTED_RECHECK_MS };
        return { access: 'not_granted', detail, result: null };
      }
      return { access: err.kind || 'INTERNAL_ERROR', detail, result: null };
    }
  }

  async function buildDemand({ q, limit = DEFAULT_LIMIT }) {
    const { sport, tokens } = queryTerms(q);
    const leaf = await resolveSinglesCategory();
    const cat = leaf ? { ...leaf, sportAspect: sport } : null;
    const [a, s] = await Promise.all([active(q, limit, cat, tokens), sold(q, limit, cat, tokens)]);
    const accessDetail = {};
    if (a.detail) accessDetail.browse = a.detail;
    if (s.detail) accessDetail.marketplaceInsights = s.detail;
    return {
      query: q,
      marketplace: MARKETPLACE,
      generatedAt: new Date(now()).toISOString(),
      limit,
      category: cat
        ? { categoryId: cat.categoryId, categoryName: cat.categoryName, sportAspect: cat.sportAspect, source: 'eBay Taxonomy API', resolvedAt: cat.resolvedAt }
        : { categoryId: null, note: 'Category could not be resolved via the Taxonomy API; searched all categories.' },
      active: a.result,
      sold: s.result,
      access: { browse: a.access, marketplaceInsights: s.access },
      ...(Object.keys(accessDetail).length ? { accessDetail } : {}),
      notes: [
        'active = current ASKING prices on live listings (fixed-price only). They are not sold prices.',
        'sold = actual last-sold prices from Marketplace Insights (last 90 days); null means eBay has not granted this app access, never zero sales.',
        'Neither API reports buyer-search volume; nothing here measures how many buyers searched.',
        `Price statistics, seller counts, and samples come from the first ${limit} results in eBay Best Match order, filtered to titles containing every non-sport query word; they are a sample, not all matches.`,
        'eBay keyword search is loose (it also matches item specifics and related terms); totalMatches is indicative, not an exact count of matching cards.',
        'Multi-variation ("you pick") listings report one representative price, which may not match a specific card.'
      ]
    };
  }

  return { buildDemand };
}

module.exports = { createDemandService, boundedLimit, validQuery, queryTerms, isRelevant, priceStats, summarizeActive, summarizeSold, MAX_LIMIT, MAX_QUERY_LENGTH };
