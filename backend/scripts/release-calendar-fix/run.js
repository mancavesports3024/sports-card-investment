#!/usr/bin/env node
// Release calendar data fix. Dry run is the default and never writes to a database.
//
//   Dry run from an /api/releases snapshot (no database access):
//     node scripts/release-calendar-fix/run.js --snapshot <file.json> [--today YYYY-MM-DD] [--include-pending] [--accept-secondary-dates]
//   Dry run from the database (read-only transaction):
//     node scripts/release-calendar-fix/run.js --from-db [--include-pending] [--accept-secondary-dates]
//   Apply (requires the fingerprint printed by an approved dry run, with the same flags):
//     node scripts/release-calendar-fix/run.js --apply --confirm <fingerprint> [--include-pending] [--accept-secondary-dates]
//   Roll back an applied run:
//     node scripts/release-calendar-fix/run.js --rollback <rollback.json> --confirm <fingerprint>
const fs = require('fs');
const path = require('path');
const plan = require('./plan');
const { buildChangeSet, FIELDS } = require('./changeSet');
const { todayInCalendarZone } = require('../../utils/releaseCalendar');

const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'release-calendar-fix');

function parseArgs(argv) {
    const args = { flags: new Set() };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (['--snapshot', '--today', '--confirm', '--rollback'].includes(a)) args[a.slice(2)] = argv[++i];
        else args.flags.add(a.slice(2));
    }
    return args;
}

function createPool() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    const { Pool } = require('pg');
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 1
    });
}

async function readDbRows(client) {
    const { rows } = await client.query(
        `SELECT id, title, brand, sport, release_date, year, description, retail_price, hobby_price,
                source, status, is_active
         FROM releases ORDER BY id`
    );
    return rows;
}

function formatChange(field, change) {
    const show = (v) => (v === null || v === undefined ? 'null' : JSON.stringify(v));
    return `${field}: ${show(change.from)} -> ${show(change.to)}`;
}

function renderReport(result, origin) {
    const lines = [];
    lines.push(`# Release calendar fix - dry run`);
    lines.push('');
    lines.push(`- Origin: ${origin}`);
    lines.push(`- Calendar date (America/Chicago): ${result.today}`);
    lines.push(`- Pending Topps additions included: ${result.includePending ? 'yes' : 'no'}`);
    lines.push(`- Secondary-only dates accepted: ${result.acceptSecondaryDates ? 'yes' : 'no (rows held/archived)'}`);
    lines.push(`- Fingerprint: \`${result.fingerprint}\``);
    lines.push('');
    const flagged = result.operations.filter(o => o.flag);
    lines.push(`## Decisions needed (${flagged.length + (result.includePending ? 0 : plan.PENDING_ADDITIONS.length)})`);
    for (const o of flagged) {
        const label = o.id ? `id ${o.id}` : 'new';
        lines.push(`- **${label}** ${o.after.title} _[${o.flag}]_ -> ${o.op === 'archive' ? 'held (archived)' : o.op}`);
        (o.sources || []).forEach(s => lines.push(`  - ${s.url} (checked ${s.checked})${s.evidence ? `: ${s.evidence}` : ''}`));
    }
    if (!result.includePending) {
        plan.PENDING_ADDITIONS.forEach(a => lines.push(`- **pending** ${a.releaseDate} ${a.title}: ${a.note || 'not applied'}`));
    }
    lines.push('');
    lines.push('## Counts');
    for (const [k, v] of Object.entries(result.counts)) lines.push(`- ${k}: ${v}`);
    lines.push('');
    lines.push(`## Errors (${result.errors.length})`);
    result.errors.forEach(e => lines.push(`- ${e}`));
    lines.push('');
    lines.push(`## Warnings (${result.warnings.length})`);
    result.warnings.forEach(w => lines.push(`- ${w}`));

    const section = (title, ops) => {
        lines.push('');
        lines.push(`## ${title} (${ops.length})`);
        for (const o of ops) {
            const label = o.id ? `id ${o.id}` : 'new';
            lines.push(`- **${label}** ${o.after.title}${o.flag ? ` _[flag: ${o.flag}]_` : ''}`);
            if (o.changes) Object.entries(o.changes).forEach(([f, c]) => lines.push(`  - ${formatChange(f, c)}`));
            if (o.op === 'insert') {
                const a = o.after;
                lines.push(`  - ${a.release_date} | ${a.brand} | ${a.sport} | ${a.status} | hobby ${a.hobby_price ?? 'null'} | retail ${a.retail_price ?? 'null'}`);
                lines.push(`  - ${a.description}`);
            }
            if (o.note) lines.push(`  - Note: ${o.note}`);
            (o.sources || []).forEach(s => lines.push(`  - Source (checked ${s.checked}): ${s.url}${s.evidence ? ` - ${s.evidence}` : ''}`));
        }
    };
    section('Corrected rows', result.operations.filter(o => o.kind === 'corrected'));
    section('Archived rows', result.operations.filter(o => o.kind === 'archive'));
    section('Added releases', result.operations.filter(o => o.kind === 'added'));
    section('Normalization-only rows (brand label, TBD -> null, status)', result.operations.filter(o => o.kind === 'normalized'));

    if (!result.includePending) {
        lines.push('');
        lines.push(`## Pending approval, not applied (${plan.PENDING_ADDITIONS.length})`);
        plan.PENDING_ADDITIONS.forEach(a => lines.push(`- ${a.releaseDate} ${a.title} | hobby ${a.hobbyPrice ?? 'null'} | retail ${a.retailPrice ?? 'null'} | ${a.sources[0].url}${a.note ? ` | ${a.note}` : ''}`));
    }
    lines.push('');
    lines.push(`## Checked but not added (${plan.NOT_ADDED.length})`);
    plan.NOT_ADDED.forEach(n => lines.push(`- ${n.title}: ${n.reason}`));
    return lines.join('\n') + '\n';
}

function writeOutputs(result, origin) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const base = path.join(OUT_DIR, `dry-run-${result.today}-${result.fingerprint}`);
    fs.writeFileSync(`${base}.json`, JSON.stringify({ origin, ...result }, null, 2));
    fs.writeFileSync(`${base}.md`, renderReport(result, origin));
    return base;
}

function printSummary(result, base) {
    console.log(JSON.stringify({ fingerprint: result.fingerprint, today: result.today, counts: result.counts, errors: result.errors, warnings: result.warnings }, null, 2));
    console.log(`Report: ${base}.md`);
}

async function dryRun(args) {
    const today = args.today || todayInCalendarZone();
    const includePending = args.flags.has('include-pending');
    const acceptSecondaryDates = args.flags.has('accept-secondary-dates');
    let rows;
    let origin;
    if (args.snapshot) {
        const snap = JSON.parse(fs.readFileSync(args.snapshot, 'utf8'));
        rows = snap.releases || snap;
        origin = `snapshot ${path.basename(args.snapshot)} (active rows only; inactive rows not visible)`;
    } else if (args.flags.has('from-db')) {
        const pool = createPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN READ ONLY');
            rows = await readDbRows(client);
            await client.query('ROLLBACK');
        } finally {
            client.release();
            await pool.end();
        }
        origin = 'database (read-only)';
    } else {
        throw new Error('Use --snapshot <file> or --from-db for a dry run');
    }
    const result = buildChangeSet({ rows, plan, today, includePending, acceptSecondaryDates });
    printSummary(result, writeOutputs(result, origin));
    process.exitCode = result.errors.length ? 1 : 0;
}

async function apply(args) {
    if (!args.confirm) throw new Error('--apply requires --confirm <fingerprint> from the approved dry run');
    const includePending = args.flags.has('include-pending');
    const acceptSecondaryDates = args.flags.has('accept-secondary-dates');
    const today = todayInCalendarZone();
    const pool = createPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE releases IN SHARE ROW EXCLUSIVE MODE');
        const rows = await readDbRows(client);
        const result = buildChangeSet({ rows, plan, today, includePending, acceptSecondaryDates });
        if (result.errors.length) throw new Error(`Plan errors: ${result.errors.join('; ')}`);
        if (result.fingerprint !== args.confirm) {
            throw new Error(`Database no longer matches the approved dry run (expected ${args.confirm}, got ${result.fingerprint}). Re-run the dry run.`);
        }

        const { rows: colRows } = await client.query(
            `SELECT column_name, column_default FROM information_schema.columns
             WHERE table_name IN ('releases', 'release_sources')
               AND column_name IN ('retail_price', 'hobby_price', 'source_checked_at')`
        );
        const columnAdded = !colRows.some(c => c.column_name === 'source_checked_at');
        const defaults = Object.fromEntries(colRows.filter(c => c.column_name !== 'source_checked_at').map(c => [c.column_name, c.column_default]));

        await client.query('ALTER TABLE release_sources ADD COLUMN IF NOT EXISTS source_checked_at DATE');
        await client.query('ALTER TABLE releases ALTER COLUMN retail_price DROP DEFAULT, ALTER COLUMN hobby_price DROP DEFAULT');

        const rollback = { fingerprint: result.fingerprint, appliedOn: today, columnAdded, defaults, rows: [], insertedReleaseIds: [], insertedSourceIds: [] };
        const addSources = async (releaseId, sources) => {
            for (const s of sources || []) {
                const { rows: inserted } = await client.query(
                    `INSERT INTO release_sources (release_id, source_name, source_url, source_checked_at)
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [releaseId, s.name, s.url, s.checked]
                );
                rollback.insertedSourceIds.push(inserted[0].id);
            }
        };

        for (const o of result.operations) {
            if (o.op === 'insert') {
                const a = o.after;
                const { rows: inserted } = await client.query(
                    `INSERT INTO releases (title, brand, sport, release_date, year, description, retail_price, hobby_price, source, status, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'release-calendar-fix') RETURNING id`,
                    [a.title, a.brand, a.sport, a.release_date, a.year, a.description, a.retail_price, a.hobby_price, a.source, a.status]
                );
                rollback.insertedReleaseIds.push(inserted[0].id);
                await addSources(inserted[0].id, o.sources);
                continue;
            }
            rollback.rows.push(o.before);
            const cols = Object.keys(o.changes);
            const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
            const { rowCount } = await client.query(
                `UPDATE releases SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $${cols.length + 1}`,
                [...cols.map(c => o.after[c]), o.id]
            );
            if (rowCount !== 1) throw new Error(`Update of id ${o.id} affected ${rowCount} rows`);
            await addSources(o.id, o.sources);
        }

        fs.mkdirSync(OUT_DIR, { recursive: true });
        const rollbackFile = path.join(OUT_DIR, `rollback-${today}-${result.fingerprint}.json`);
        fs.writeFileSync(rollbackFile, JSON.stringify(rollback, null, 2));
        await client.query('COMMIT');
        console.log(JSON.stringify({ applied: true, fingerprint: result.fingerprint, counts: result.counts, rollbackFile }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

async function rollback(args) {
    const data = JSON.parse(fs.readFileSync(args.rollback, 'utf8'));
    if (args.confirm !== data.fingerprint) throw new Error('--confirm must equal the fingerprint stored in the rollback file');
    const pool = createPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (data.insertedSourceIds.length) {
            await client.query('DELETE FROM release_sources WHERE id = ANY($1::int[])', [data.insertedSourceIds]);
        }
        if (data.insertedReleaseIds.length) {
            await client.query('DELETE FROM releases WHERE id = ANY($1::int[])', [data.insertedReleaseIds]);
        }
        const restoreCols = FIELDS;
        for (const row of data.rows) {
            const sets = restoreCols.map((c, i) => `${c} = $${i + 1}`).join(', ');
            const { rowCount } = await client.query(
                `UPDATE releases SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $${restoreCols.length + 1}`,
                [...restoreCols.map(c => row[c]), row.id]
            );
            if (rowCount !== 1) throw new Error(`Restore of id ${row.id} affected ${rowCount} rows`);
        }
        for (const [col, def] of Object.entries(data.defaults || {})) {
            if (def) await client.query(`ALTER TABLE releases ALTER COLUMN ${col} SET DEFAULT ${def}`);
        }
        if (data.columnAdded) await client.query('ALTER TABLE release_sources DROP COLUMN IF EXISTS source_checked_at');
        await client.query('COMMIT');
        console.log(JSON.stringify({ rolledBack: true, restoredRows: data.rows.length, deletedReleases: data.insertedReleaseIds.length, deletedSources: data.insertedSourceIds.length }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.rollback) return rollback(args);
    if (args.flags.has('apply')) return apply(args);
    return dryRun(args);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { renderReport };
