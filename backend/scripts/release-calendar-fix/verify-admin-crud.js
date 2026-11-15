#!/usr/bin/env node
// Local DB verification of add → edit date → delete for a throwaway release.
// Requires DATABASE_URL. Does not touch the public four Part-1 titles.
const { Pool } = require('pg');
const { toDateOnly, deriveStatus } = require('../../utils/releaseCalendar');

const TITLE = `TEMP Admin CRUD Probe ${Date.now()}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1
  });
  const client = await pool.connect();
  let id;
  try {
    const insert = await client.query(
      `INSERT INTO releases (title, brand, sport, release_date, year, description,
                            retail_price, hobby_price, source, status, created_by)
       VALUES ($1, 'Topps', 'Baseball', $2, '2026', 'temp probe', null, null, 'Manual', $3, 'release-calendar-fix')
       RETURNING id, release_date`,
      [TITLE, '2099-01-15', deriveStatus('2099-01-15')]
    );
    id = insert.rows[0].id;
    console.log('ADD', { id, releaseDate: toDateOnly(insert.rows[0].release_date), title: TITLE });

    const updated = await client.query(
      `UPDATE releases SET release_date = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_active = TRUE
       RETURNING id, release_date, status`,
      ['2099-02-20', deriveStatus('2099-02-20'), id]
    );
    console.log('EDIT', {
      id,
      releaseDate: toDateOnly(updated.rows[0].release_date),
      status: updated.rows[0].status
    });

    const deleted = await client.query(
      `UPDATE releases SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = TRUE RETURNING id`,
      [id]
    );
    console.log('DELETE', { id, removed: deleted.rowCount === 1 });

    const still = await client.query(
      `SELECT COUNT(*)::int AS c FROM releases WHERE id = $1 AND is_active = TRUE`,
      [id]
    );
    if (still.rows[0].c !== 0) throw new Error('temp release still active after delete');
    console.log(JSON.stringify({ success: true, id, title: TITLE }, null, 2));
  } catch (err) {
    if (id) {
      await client.query(`UPDATE releases SET is_active = FALSE WHERE id = $1`, [id]).catch(() => {});
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
