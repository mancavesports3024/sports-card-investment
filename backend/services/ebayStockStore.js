// Postgres storage for the eBay stock index and the price-change guard/audit log.
// The index is replaced in ONE transaction only after a complete eBay read, so a failed or partial
// refresh never replaces the last good index; readers keep seeing the old rows until COMMIT.
// ebay_price_changes: one row per attempted change. status:
//   PENDING (claimed, revise in flight) | APPLIED (eBay read-back shows the new price)
//   | FAILED_NOT_APPLIED (eBay rejected the revise) | UNKNOWN (outcome unconfirmed; blocks that variation until reconciled)
// A partial unique index allows at most one PENDING/UNKNOWN row per variation, so concurrent requests cannot both write.
const { Pool } = require('pg');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ebay_stock_refresh_runs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  item_count INTEGER,
  pick_count INTEGER,
  error_kind TEXT,
  stats JSONB
);
CREATE TABLE IF NOT EXISTS ebay_stock_listings (
  item_id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT,
  variation_listing BOOLEAN NOT NULL,
  refresh_id BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS ebay_stock_picks (
  item_id TEXT NOT NULL REFERENCES ebay_stock_listings (item_id) ON DELETE CASCADE,
  variation_key TEXT NOT NULL,
  card_number TEXT,
  card_name TEXT,
  card_raw TEXT,
  pick_status TEXT NOT NULL,
  quantity_available INTEGER,
  quantity_sold INTEGER,
  sold_out BOOLEAN,
  price_value NUMERIC(12, 2),
  currency TEXT,
  search_text TEXT NOT NULL,
  PRIMARY KEY (item_id, variation_key)
);
CREATE TABLE IF NOT EXISTS ebay_price_changes (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  variation_key TEXT NOT NULL,
  card_number TEXT,
  card_raw TEXT,
  listing_title TEXT,
  old_price NUMERIC(12, 2) NOT NULL,
  new_price NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPLIED', 'FAILED_NOT_APPLIED', 'UNKNOWN')),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  read_back_price NUMERIC(12, 2),
  quantity_before INTEGER,
  quantity_after INTEGER,
  error_kind TEXT,
  ebay_error_codes TEXT,
  note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ebay_price_changes_one_open
  ON ebay_price_changes (item_id, variation_key) WHERE status IN ('PENDING', 'UNKNOWN');
CREATE INDEX IF NOT EXISTS ebay_price_changes_requested_at ON ebay_price_changes (requested_at DESC)`;

// Separate from ebay_buyer_thanks's key (724501001).
const MIGRATION_LOCK_KEY = 724501002;
const REFRESH_LOCK_KEY = 724501003;
const STALE_RUN_MINUTES = 30;
const INSERT_BATCH = 2000;
const SEARCH_LIMIT = 2000;

const PICK_COLUMNS = 'p.item_id, l.title, l.url, p.card_number, p.card_name, p.card_raw, p.pick_status, p.quantity_available, p.quantity_sold, p.sold_out, p.price_value, p.currency, p.variation_key';
const CHANGE_COLUMNS = 'id, item_id, variation_key, card_number, card_raw, listing_title, old_price, new_price, currency, method, status, requested_by, requested_at, finished_at, read_back_price, quantity_before, quantity_after, error_kind, ebay_error_codes, note';

class StockStoreUnavailableError extends Error {
  constructor() {
    super('Stock index database is not configured.');
    this.code = 'DATABASE_UNAVAILABLE';
  }
}

class RefreshInProgressError extends Error {
  constructor() {
    super('A stock refresh is already running; retry when it finishes.');
    this.code = 'REFRESH_IN_PROGRESS';
  }
}

function createStockStore({ env = process.env, pool = null } = {}) {
  let db = pool;
  let ready = null;

  function connection() {
    if (!db) {
      if (!env.DATABASE_URL) throw new StockStoreUnavailableError();
      db = new Pool({ connectionString: env.DATABASE_URL, ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 3 });
      db.on('error', () => {});
    }
    return db;
  }

  async function migrate(conn) {
    const c = await conn.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
      await c.query(SCHEMA_SQL);
      await c.query('COMMIT');
    } catch (err) {
      await c.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  async function conn() {
    const c = connection();
    if (!ready) ready = migrate(c).catch((err) => { ready = null; throw err; });
    await ready;
    return c;
  }

  async function query(sql, params) {
    return (await conn()).query(sql, params);
  }

  async function transaction(fn) {
    const c = await (await conn()).connect();
    try {
      await c.query('BEGIN');
      const out = await fn(c);
      await c.query('COMMIT');
      return out;
    } catch (err) {
      await c.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  return {
    // Returns the new run id, or throws RefreshInProgressError when another recent run is RUNNING.
    async startRefresh() {
      return transaction(async (c) => {
        await c.query('SELECT pg_advisory_xact_lock($1)', [REFRESH_LOCK_KEY]);
        await c.query(`UPDATE ebay_stock_refresh_runs SET status = 'FAILED', error_kind = 'ABANDONED', finished_at = now()
          WHERE status = 'RUNNING' AND started_at < now() - ($1::int * interval '1 minute')`, [STALE_RUN_MINUTES]);
        const { rows: running } = await c.query("SELECT id FROM ebay_stock_refresh_runs WHERE status = 'RUNNING' LIMIT 1");
        if (running.length) throw new RefreshInProgressError();
        const { rows } = await c.query("INSERT INTO ebay_stock_refresh_runs (status) VALUES ('RUNNING') RETURNING id");
        return Number(rows[0].id);
      });
    },

    async failRefresh(runId, { errorKind, durationMs }) {
      await query("UPDATE ebay_stock_refresh_runs SET status = 'FAILED', error_kind = $2, duration_ms = $3, finished_at = now() WHERE id = $1 AND status = 'RUNNING'", [runId, errorKind, durationMs]);
    },

    // Atomically replaces the whole index with rows: [{ itemId, title, url, variationListing, picks: [{..., searchText}] }].
    async replaceIndex(runId, listings, { durationMs, stats }) {
      return transaction(async (c) => {
        await c.query('SELECT pg_advisory_xact_lock($1)', [REFRESH_LOCK_KEY]);
        const { rows: run } = await c.query('SELECT status FROM ebay_stock_refresh_runs WHERE id = $1 FOR UPDATE', [runId]);
        if (!run.length || run[0].status !== 'RUNNING') throw new RefreshInProgressError();
        await c.query('DELETE FROM ebay_stock_picks');
        await c.query('DELETE FROM ebay_stock_listings');
        for (let i = 0; i < listings.length; i += INSERT_BATCH) {
          const chunk = listings.slice(i, i + INSERT_BATCH);
          await c.query(`INSERT INTO ebay_stock_listings (item_id, title, url, variation_listing, refresh_id)
            SELECT t.*, $5::bigint FROM unnest($1::text[], $2::text[], $3::text[], $4::boolean[]) AS t(item_id, title, url, variation_listing)`,
          [chunk.map((l) => l.itemId), chunk.map((l) => l.title), chunk.map((l) => l.url), chunk.map((l) => l.variationListing), runId]);
        }
        const picks = listings.flatMap((l) => l.picks.map((p) => ({ itemId: l.itemId, ...p })));
        for (let i = 0; i < picks.length; i += INSERT_BATCH) {
          const chunk = picks.slice(i, i + INSERT_BATCH);
          const col = (f) => chunk.map(f);
          await c.query(`INSERT INTO ebay_stock_picks (item_id, variation_key, card_number, card_name, card_raw, pick_status, quantity_available, quantity_sold, sold_out, price_value, currency, search_text)
            SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[], $8::int[], $9::boolean[], $10::numeric[], $11::text[], $12::text[])`,
          [col((p) => p.itemId), col((p) => p.variationKey || ''), col((p) => p.cardNumber), col((p) => p.cardName), col((p) => p.card), col((p) => p.pickStatus),
            col((p) => p.quantityAvailable), col((p) => p.quantitySold), col((p) => p.soldOut), col((p) => (p.price ? p.price.value : null)),
            col((p) => (p.price ? p.price.currency : null)), col((p) => p.searchText)]);
        }
        await c.query(`UPDATE ebay_stock_refresh_runs SET status = 'SUCCEEDED', finished_at = now(), duration_ms = $2, item_count = $3, pick_count = $4, stats = $5 WHERE id = $1`,
          [runId, durationMs, listings.length, picks.length, JSON.stringify(stats || {})]);
        return { itemCount: listings.length, pickCount: picks.length };
      });
    },

    async refreshStatus() {
      const { rows: good } = await query("SELECT id, finished_at, duration_ms, item_count, pick_count FROM ebay_stock_refresh_runs WHERE status = 'SUCCEEDED' ORDER BY finished_at DESC LIMIT 1");
      const { rows: last } = await query('SELECT id, status, started_at, finished_at, error_kind FROM ebay_stock_refresh_runs ORDER BY id DESC LIMIT 1');
      return { lastSuccess: good[0] || null, lastRun: last[0] || null };
    },

    // normalizedName: output of normalizeName(); matched at word starts.
    async findPicks(normalizedName) {
      const { rows } = await query(`SELECT ${PICK_COLUMNS} FROM ebay_stock_picks p JOIN ebay_stock_listings l USING (item_id)
        WHERE (' ' || p.search_text) LIKE ('% ' || $1 || '%') ORDER BY l.title, p.item_id, p.card_number LIMIT $2`, [normalizedName, SEARCH_LIMIT + 1]);
      return { rows: rows.slice(0, SEARCH_LIMIT), truncated: rows.length > SEARCH_LIMIT };
    },

    // Keeps the stored row in step after a confirmed price change, so search shows the new price before the next refresh.
    async updateIndexedPrice(itemId, variationKey, price) {
      await query('UPDATE ebay_stock_picks SET price_value = $3 WHERE item_id = $1 AND variation_key = $2', [itemId, variationKey, price]);
    },

    async openChange(itemId, variationKey) {
      const { rows } = await query(`SELECT ${CHANGE_COLUMNS} FROM ebay_price_changes WHERE item_id = $1 AND variation_key = $2 AND status IN ('PENDING', 'UNKNOWN') LIMIT 1`, [itemId, variationKey]);
      return rows[0] || null;
    },

    // Returns the claimed row id, or null when another PENDING/UNKNOWN change exists for this variation.
    async claimChange(change) {
      try {
        const { rows } = await query(`INSERT INTO ebay_price_changes (item_id, variation_key, card_number, card_raw, listing_title, old_price, new_price, currency, method, status, requested_by, quantity_before)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11) RETURNING id`,
        [change.itemId, change.variationKey, change.cardNumber, change.card, change.title, change.oldPrice, change.newPrice, change.currency, change.method, change.requestedBy, change.quantityBefore]);
        return Number(rows[0].id);
      } catch (err) {
        if (err && err.code === '23505') return null;
        throw err;
      }
    },

    // Moves an open (PENDING/UNKNOWN) row to its final state; terminal rows are never rewritten.
    async finishChange(id, { status, readBackPrice = null, quantityAfter = null, errorKind = null, errorCodes = null, note = null }) {
      await query(`UPDATE ebay_price_changes SET status = $2, read_back_price = $3, quantity_after = $4, error_kind = $5, ebay_error_codes = $6, note = $7, finished_at = now()
        WHERE id = $1 AND status IN ('PENDING', 'UNKNOWN')`, [id, status, readBackPrice, quantityAfter, errorKind, errorCodes, note]);
    },

    async listChanges({ limit = 50, itemId = null } = {}) {
      const { rows } = itemId
        ? await query(`SELECT ${CHANGE_COLUMNS} FROM ebay_price_changes WHERE item_id = $1 ORDER BY requested_at DESC LIMIT $2`, [itemId, limit])
        : await query(`SELECT ${CHANGE_COLUMNS} FROM ebay_price_changes ORDER BY requested_at DESC LIMIT $1`, [limit]);
      return rows;
    }
  };
}

module.exports = { createStockStore, StockStoreUnavailableError, RefreshInProgressError, SCHEMA_SQL, SEARCH_LIMIT };
