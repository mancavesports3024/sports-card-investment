#!/usr/bin/env node
// Idempotent insert of the 4 Part-1 releases from release-calendar-add-4-plus-admin-form.md.
// Dry-run by default (title checks only). Apply with --apply.
//
//   node scripts/release-calendar-fix/add-four-missing.js
//   node scripts/release-calendar-fix/add-four-missing.js --apply
//
// Prefer the admin form when available. createdBy is always "release-calendar-fix".
const { Pool } = require('pg');
const { deriveStatus, normalizePrice, toDateOnly } = require('../../utils/releaseCalendar');

const RELEASES = [
  {
    title: '2026 Topps Update Series Baseball',
    brand: 'Topps',
    sport: 'Baseball',
    releaseDate: '2026-10-14',
    year: '2026',
    description: 'Final flagship release of 2026. 350-card base set; hobby boxes include one autograph or relic.',
    retailPrice: 'Value Blaster $24.99',
    hobbyPrice: '$119.99',
    source: 'Topps',
    createdBy: 'release-calendar-fix'
  },
  {
    title: '2026 Topps Holiday Baseball',
    brand: 'Topps',
    sport: 'Baseball',
    releaseDate: '2026-10-21',
    year: '2026',
    description: 'Holiday-themed flagship design. 200-card base set with Hidden Elf variations; Mega, Tin and Advent Calendar formats.',
    retailPrice: 'Mega $29.99, Tin $44.99, Advent Calendar $59.99',
    hobbyPrice: null,
    source: 'Topps',
    createdBy: 'release-calendar-fix'
  },
  {
    title: '2026-27 Topps Flagship Basketball',
    brand: 'Topps',
    sport: 'Basketball',
    releaseDate: '2026-11-05',
    year: '2026',
    description: '300-card base set. Hobby boxes include one autograph or relic; headlined by the 2026 rookie class.',
    retailPrice: 'Mega $59.99',
    hobbyPrice: '$169.99',
    source: 'Topps',
    createdBy: 'release-calendar-fix'
  },
  {
    title: '2026 Topps Inception Football',
    brand: 'Topps',
    sport: 'Football',
    releaseDate: '2026-11-06',
    year: '2026',
    description: 'First NFL-licensed Inception since 2015. 200-card base set; one pack of 7 cards per hobby box with one autograph.',
    retailPrice: null,
    hobbyPrice: '$379.99',
    source: 'Topps',
    createdBy: 'release-calendar-fix'
  }
];

async function loadActiveByTitle(client) {
  const { rows } = await client.query(
    `SELECT id, title, release_date, is_active FROM releases WHERE is_active = TRUE`
  );
  const map = new Map();
  for (const row of rows) {
    const key = row.title;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      id: row.id,
      title: row.title,
      releaseDate: toDateOnly(row.release_date)
    });
  }
  return map;
}

async function main() {
  const apply = process.argv.includes('--apply');
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
  const inserted = [];
  const skipped = [];

  try {
    const byTitle = await loadActiveByTitle(client);
    console.log(apply ? 'APPLY mode' : 'DRY-RUN mode (no writes)');
    console.log(`Active releases before: ${[...byTitle.values()].reduce((n, a) => n + a.length, 0)}`);

    for (const release of RELEASES) {
      const existing = byTitle.get(release.title) || [];
      if (existing.length > 0) {
        skipped.push({
          title: release.title,
          reason: 'title already exists',
          matches: existing
        });
        console.log(`SKIP  ${release.title} (existing id ${existing.map((e) => e.id).join(', ')})`);
        continue;
      }

      if (!apply) {
        inserted.push({ title: release.title, releaseDate: release.releaseDate, wouldInsert: true });
        console.log(`WOULD INSERT  ${release.releaseDate}  ${release.title}`);
        continue;
      }

      const status = deriveStatus(release.releaseDate);
      const result = await client.query(
        `INSERT INTO releases (title, brand, sport, release_date, year, description,
                              retail_price, hobby_price, source, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, title, release_date`,
        [
          release.title,
          release.brand,
          release.sport,
          release.releaseDate,
          release.year,
          release.description,
          normalizePrice(release.retailPrice),
          normalizePrice(release.hobbyPrice),
          release.source,
          status,
          release.createdBy
        ]
      );
      const row = result.rows[0];
      inserted.push({
        id: row.id,
        title: row.title,
        releaseDate: toDateOnly(row.release_date)
      });
      console.log(`INSERTED  id=${row.id}  ${release.releaseDate}  ${release.title}`);
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM releases WHERE is_active = TRUE`
    );
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      inserted,
      skipped,
      activeCount: countRows[0].count
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
