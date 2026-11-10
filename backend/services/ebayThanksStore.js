// Postgres duplicate guard for buyer thank-you messages: one row per order_id.
// status: PENDING (claimed, send in flight) | SENT | FAILED_NOT_SENT (eBay rejected; retry allowed) | UNKNOWN (no resend).
// The claim is a single INSERT ... ON CONFLICT statement, so concurrent calls for one order cannot both send.
const { Pool } = require('pg');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ebay_buyer_thanks (
  order_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED_NOT_SENT', 'UNKNOWN')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  ebay_message_id TEXT,
  ebay_conversation_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

// Concurrent CREATE TABLE IF NOT EXISTS can still collide in pg_type, so the migration runs under this lock.
const MIGRATION_LOCK_KEY = 724501001;

const CLAIM_SQL = `
INSERT INTO ebay_buyer_thanks (order_id, status) VALUES ($1, 'PENDING')
ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', claimed_at = now(), updated_at = now()
  WHERE ebay_buyer_thanks.status = 'FAILED_NOT_SENT'
RETURNING order_id`;

class StoreUnavailableError extends Error {
  constructor() {
    super('Duplicate guard database is not configured.');
    this.code = 'DUPLICATE_GUARD_UNAVAILABLE';
  }
}

function createThanksStore({ env = process.env, pool = null } = {}) {
  let db = pool;
  let ready = null;

  function connection() {
    if (!db) {
      if (!env.DATABASE_URL) throw new StoreUnavailableError();
      db = new Pool({ connectionString: env.DATABASE_URL, ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 2 });
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

  async function query(sql, params) {
    const conn = connection();
    if (!ready) ready = migrate(conn).catch((err) => { ready = null; throw err; });
    await ready;
    return conn.query(sql, params);
  }

  return {
    async get(orderId) {
      const { rows } = await query('SELECT order_id, status, sent_at, ebay_message_id, ebay_conversation_id FROM ebay_buyer_thanks WHERE order_id = $1', [orderId]);
      return rows[0] || null;
    },
    async claim(orderId) {
      const { rows } = await query(CLAIM_SQL, [orderId]);
      return rows.length === 1;
    },
    async markSent(orderId, { messageId, conversationId }) {
      await query("UPDATE ebay_buyer_thanks SET status = 'SENT', sent_at = now(), ebay_message_id = $2, ebay_conversation_id = $3, updated_at = now() WHERE order_id = $1", [orderId, messageId, conversationId]);
    },
    async markFailed(orderId) {
      await query("UPDATE ebay_buyer_thanks SET status = 'FAILED_NOT_SENT', updated_at = now() WHERE order_id = $1 AND status = 'PENDING'", [orderId]);
    },
    async markUnknown(orderId) {
      await query("UPDATE ebay_buyer_thanks SET status = 'UNKNOWN', updated_at = now() WHERE order_id = $1 AND status = 'PENDING'", [orderId]);
    }
  };
}

module.exports = { createThanksStore, StoreUnavailableError, SCHEMA_SQL, CLAIM_SQL };
