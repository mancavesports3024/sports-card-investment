// Recent Auction Sales (Recent Sales Search) backed by CardSight pricing search.
// Free-tier usage controls: response cache, in-flight de-duplication, and a daily upstream call budget.
// The budget is stored through cacheService: shared across instances only when REDIS_URL is set,
// otherwise per process (reset on restart). It is not an account-wide guarantee of the CardSight monthly cap.

const cardsight = require('./cardsightService');
const cacheService = require('./cacheService');

const RESULTS_TTL_SECONDS = 6 * 60 * 60;
const EMPTY_TTL_SECONDS = 60 * 60;
const DEFAULT_DAILY_CALL_LIMIT = 20;
const MAX_QUERY_LENGTH = 300;

const inFlight = new Map();

class RecentSalesError extends Error {
  constructor(code, message, httpStatus) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function dailyCallLimit() {
  const n = parseInt(process.env.CARDSIGHT_DAILY_CALL_LIMIT, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_CALL_LIMIT;
}

// "Topps Judge -(lot, reprint)" -> searchText "Topps Judge", exclusions ["lot", "reprint"]
function parseQuery(raw) {
  const text = String(raw || '');
  const exclusionMatch = text.match(/-\s*\(([^)]*)\)/);
  const exclusions = exclusionMatch
    ? exclusionMatch[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const searchText = text.replace(/-\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return { searchText, exclusions };
}

async function reserveUpstreamCall() {
  const key = `cardsight:auction:budget:${new Date().toISOString().slice(0, 10)}`;
  const used = (await cacheService.get(key)) || 0;
  if (used >= dailyCallLimit()) return false;
  await cacheService.set(key, used + 1, 2 * 24 * 60 * 60);
  return true;
}

async function fetchAndCache(searchText, cacheKey) {
  if (!(await reserveUpstreamCall())) {
    throw new RecentSalesError('DAILY_LIMIT_REACHED', 'Daily recent-sales lookup limit reached', 503);
  }
  const started = Date.now();
  const result = await cardsight.searchAuctionSales(searchText);
  console.log(`[RECENT AUCTION SALES] CardSight search ok: ${result.sales.length} sales in ${Date.now() - started}ms`);
  await cacheService.set(cacheKey, result, result.sales.length > 0 ? RESULTS_TTL_SECONDS : EMPTY_TTL_SECONDS);
  return result;
}

async function getRecentAuctionSales(rawQuery) {
  const { searchText, exclusions } = parseQuery(rawQuery);
  if (searchText.length < 2 || searchText.length > MAX_QUERY_LENGTH) {
    throw new RecentSalesError('INVALID_QUERY', `Search must be 2-${MAX_QUERY_LENGTH} characters`, 400);
  }
  const cacheKey = `cardsight:auction:v1:${searchText.toLowerCase()}`;

  let result = await cacheService.get(cacheKey);
  const cached = Boolean(result);
  if (!result) {
    if (!inFlight.has(cacheKey)) {
      inFlight.set(cacheKey, fetchAndCache(searchText, cacheKey).finally(() => inFlight.delete(cacheKey)));
    }
    result = await inFlight.get(cacheKey);
  }

  const sales = exclusions.length
    ? result.sales.filter(s => !exclusions.some(ex => (s.title || '').toLowerCase().includes(ex)))
    : result.sales;
  return { sales, cached, searchText, exclusions };
}

module.exports = { getRecentAuctionSales, parseQuery, RecentSalesError };
