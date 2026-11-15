// Refreshes the stored stock index from eBay and answers player searches from it (no live eBay calls).
const { buildIndexSnapshot, normalizeName } = require('./ebayStock');

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

class IndexError extends Error {
  constructor(code, httpStatus, message) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function validName(value) {
  if (typeof value !== 'string' || value.trim().length > MAX_NAME_LENGTH) return null;
  const normalized = normalizeName(value);
  return normalized.length >= MIN_NAME_LENGTH ? { raw: value.trim(), normalized } : null;
}

// Drops duplicate variation keys within a listing (keeps the first) and adds the search column.
function toIndexRows(listings) {
  return listings.map((l) => {
    const seen = new Set();
    const picks = [];
    for (const p of l.picks) {
      const key = p.variationKey || '';
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push({ ...p, searchText: normalizeName(l.variationListing ? (p.cardName || p.card) : l.title) });
    }
    return { itemId: l.itemId, title: l.title, url: l.url, variationListing: l.variationListing, picks };
  });
}

async function refreshIndex({ trading, store, now = () => Date.now(), concurrency }) {
  const startedAt = now();
  const runId = await store.startRefresh();
  try {
    const { listings, stats } = await buildIndexSnapshot(trading, { now: startedAt, concurrency });
    if (!listings.length) throw new IndexError('EMPTY_RESULT', 502, 'eBay returned no active fixed-price listings; the existing index was kept.');
    const durationMs = now() - startedAt;
    const saved = await store.replaceIndex(runId, toIndexRows(listings), { durationMs, stats });
    return {
      refreshedAt: new Date(now()).toISOString(),
      durationMs,
      itemCount: saved.itemCount,
      pickCount: saved.pickCount,
      unparsedCount: stats.unparsedCount,
      sellerListEntries: stats.sellerListEntries,
      skipped: stats.skipped,
      tradingCalls: stats.tradingCalls,
      refreshId: runId
    };
  } catch (err) {
    await store.failRefresh(runId, { errorKind: (err && (err.kind || err.code)) || 'INTERNAL_ERROR', durationMs: now() - startedAt }).catch(() => {});
    throw err;
  }
}

function indexInfo(status, nowMs) {
  const s = status.lastSuccess;
  const lastRun = status.lastRun;
  return {
    refreshedAt: s.finished_at ? new Date(s.finished_at).toISOString() : null,
    ageMinutes: s.finished_at ? Math.max(0, Math.round((nowMs - new Date(s.finished_at).getTime()) / 60000)) : null,
    itemCount: s.item_count,
    pickCount: s.pick_count,
    refreshDurationMs: s.duration_ms,
    lastRunStatus: lastRun ? lastRun.status : null,
    ...(lastRun && lastRun.status === 'FAILED' ? { lastRunError: lastRun.error_kind } : {})
  };
}

async function indexStatus({ store, now = () => Date.now() }) {
  const status = await store.refreshStatus();
  if (!status.lastSuccess) return { built: false, lastRunStatus: status.lastRun ? status.lastRun.status : null };
  return { built: true, ...indexInfo(status, now()) };
}

async function findPlayer({ store, name, now = () => Date.now() }) {
  const status = await store.refreshStatus();
  if (!status.lastSuccess) throw new IndexError('INDEX_NOT_BUILT', 409, 'The stock index has not been built yet; run a refresh first.');
  const { rows, truncated } = await store.findPicks(name.normalized);
  const listings = new Map();
  for (const r of rows) {
    if (!listings.has(r.item_id)) listings.set(r.item_id, { itemId: r.item_id, title: r.title, url: r.url, picks: [] });
    listings.get(r.item_id).picks.push({
      cardNumber: r.card_number,
      cardName: r.card_name,
      card: r.card_raw,
      quantityAvailable: r.quantity_available,
      soldOut: r.sold_out,
      price: r.price_value === null ? null : { value: String(r.price_value), currency: r.currency },
      pickStatus: r.pick_status
    });
  }
  return {
    generatedAt: new Date(now()).toISOString(),
    source: 'Stored stock index (eBay Trading GetSellerList + GetItem)',
    name: name.raw,
    index: indexInfo(status, now()),
    listingCount: listings.size,
    matchCount: rows.length,
    availableCount: rows.filter((r) => r.sold_out === false).length,
    soldOutCount: rows.filter((r) => r.sold_out === true).length,
    truncated,
    listings: [...listings.values()],
    notes: ['Quantities and prices are as of index.refreshedAt; use ebay-stock for a live per-listing check.']
  };
}

module.exports = { refreshIndex, findPlayer, indexStatus, validName, toIndexRows, IndexError, MAX_NAME_LENGTH };
