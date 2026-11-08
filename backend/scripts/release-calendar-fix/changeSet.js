const crypto = require('crypto');
const { deriveStatus, normalizePrice, toDateOnly } = require('../../utils/releaseCalendar');

const FIELDS = ['title', 'brand', 'sport', 'release_date', 'year', 'description', 'retail_price', 'hobby_price', 'source', 'status', 'is_active'];
const SET_TO_COLUMN = {
    title: 'title', brand: 'brand', sport: 'sport', releaseDate: 'release_date', year: 'year',
    description: 'description', retailPrice: 'retail_price', hobbyPrice: 'hobby_price', source: 'source'
};

// Accepts DB rows (snake_case) or /api/releases items (camelCase, active only).
function toRow(r) {
    const pick = (snake, camel) => (r[snake] !== undefined ? r[snake] : r[camel]);
    return {
        id: r.id,
        title: r.title,
        brand: r.brand ?? null,
        sport: r.sport ?? null,
        release_date: toDateOnly(pick('release_date', 'releaseDate')),
        year: r.year ?? null,
        description: r.description ?? null,
        retail_price: pick('retail_price', 'retailPrice') ?? null,
        hobby_price: pick('hobby_price', 'hobbyPrice') ?? null,
        source: r.source ?? null,
        status: r.status ?? null,
        is_active: r.is_active === undefined ? true : r.is_active
    };
}

function normalizeBrand(brand, brandMap) {
    return brandMap[brand] || 'Other';
}

const SECONDARY_ONLY = 'date-secondary-only';
const HOLD_REASONS = {
    [SECONDARY_ONLY]: 'release date supported only by secondary sources',
    'topps-calendar-no-date-for-released': 'Topps/Bowman release date lacks official Topps confirmation'
};

function buildChangeSet({ rows, plan, today, includePending = false, acceptSecondaryDates = false }) {
    const errors = [];
    const warnings = [];
    const byId = new Map(rows.map(r => [r.id, toRow(r)]));
    const updatesById = new Map(plan.UPDATES.map(u => [u.id, u]));
    const archivesById = new Map(plan.ARCHIVES.map(a => [a.id, a]));

    for (const id of [...updatesById.keys(), ...archivesById.keys()]) {
        const row = byId.get(id);
        if (!row) errors.push(`Planned id ${id} not found`);
        else if (!row.is_active) errors.push(`Planned id ${id} is already inactive`);
    }
    for (const id of updatesById.keys()) {
        if (archivesById.has(id)) errors.push(`Id ${id} is both updated and archived`);
    }

    const operations = [];
    for (const before of [...byId.values()].sort((a, b) => a.id - b.id)) {
        if (!before.is_active) continue;
        const after = { ...before };
        const planned = updatesById.get(before.id);
        const held = planned && HOLD_REASONS[planned.flag] && !(planned.flag === SECONDARY_ONLY && acceptSecondaryDates);
        const update = held ? null : planned;
        const archive = archivesById.get(before.id) || (held ? {
            reason: `Held: ${HOLD_REASONS[planned.flag]}. ${planned.note || ''} Archived until an official date is found.`
        } : null);

        after.brand = normalizeBrand(before.brand, plan.BRAND_MAP);
        after.retail_price = normalizePrice(before.retail_price);
        after.hobby_price = normalizePrice(before.hobby_price);
        if (update) {
            for (const [key, value] of Object.entries(update.set)) {
                const column = SET_TO_COLUMN[key];
                if (!column) throw new Error(`Unknown field ${key} for id ${before.id}`);
                after[column] = key === 'retailPrice' || key === 'hobbyPrice' ? normalizePrice(value) : value;
            }
            after.brand = normalizeBrand(after.brand, plan.BRAND_MAP);
        }
        after.status = deriveStatus(after.release_date, today);
        if (archive) after.is_active = false;

        const changes = {};
        for (const field of FIELDS) {
            if (before[field] !== after[field]) changes[field] = { from: before[field], to: after[field] };
        }
        if (Object.keys(changes).length === 0) continue;

        operations.push({
            op: archive ? 'archive' : 'update',
            id: before.id,
            kind: archive ? 'archive' : update ? 'corrected' : 'normalized',
            before,
            after,
            changes,
            sources: planned ? planned.sources : [],
            note: archive ? archive.reason : update?.note,
            flag: planned?.flag
        });
    }

    const additions = [...plan.ADDITIONS, ...(includePending ? plan.PENDING_ADDITIONS : [])];
    const takenKeys = new Set([...byId.values()].map(r => `${r.title}|${r.release_date}`));
    for (const op of operations) takenKeys.add(`${op.after.title}|${op.after.release_date}`);
    for (const a of additions) {
        const key = `${a.title}|${a.release_date || a.releaseDate}`;
        if (takenKeys.has(key)) {
            errors.push(`Addition collides with existing (title, release_date): ${key}`);
            continue;
        }
        takenKeys.add(key);
        const row = {
            title: a.title,
            brand: normalizeBrand(a.brand, plan.BRAND_MAP),
            sport: a.sport,
            release_date: a.releaseDate,
            year: a.year,
            description: a.description,
            retail_price: normalizePrice(a.retailPrice),
            hobby_price: normalizePrice(a.hobbyPrice),
            source: a.source,
            status: deriveStatus(a.releaseDate, today),
            is_active: true
        };
        operations.push({ op: 'insert', id: null, kind: 'added', after: row, sources: a.sources, flag: a.flag });
    }

    // Post-conditions on the resulting live calendar.
    const live = new Map();
    for (const r of byId.values()) if (r.is_active) live.set(`id:${r.id}`, r);
    for (const op of operations) {
        if (op.op === 'insert') live.set(`new:${op.after.title}`, op.after);
        else if (op.after.is_active) live.set(`id:${op.id}`, op.after);
        else live.delete(`id:${op.id}`);
    }
    const liveRows = [...live.values()];
    for (const r of liveRows) {
        const label = r.id ? `id ${r.id}` : `"${r.title}"`;
        if (!r.sport) errors.push(`Live ${label} has null sport`);
        if (!plan.ALLOWED_BRANDS.includes(r.brand)) errors.push(`Live ${label} has brand ${r.brand}`);
        if (/^tbd$/i.test(r.retail_price || '') || /^tbd$/i.test(r.hobby_price || '')) errors.push(`Live ${label} still has TBD price`);
        if (r.status !== deriveStatus(r.release_date, today)) errors.push(`Live ${label} status ${r.status} != derived`);
    }
    for (const op of operations) {
        if (op.kind !== 'normalized' && (!op.sources || op.sources.length === 0) && op.op !== 'archive') {
            errors.push(`${op.op} ${op.id || op.after.title} has no source`);
        }
    }

    const titles = new Map();
    for (const r of liveRows) {
        const k = r.title.toLowerCase();
        titles.set(k, (titles.get(k) || 0) + 1);
    }
    for (const [title, n] of titles) if (n > 1) warnings.push(`${n} live rows share title "${title}"`);

    const count = (pred) => operations.filter(pred).length;
    const counts = {
        rowsRead: byId.size,
        activeBefore: [...byId.values()].filter(r => r.is_active).length,
        activeAfter: liveRows.length,
        updates: count(o => o.op === 'update'),
        correctedRows: count(o => o.kind === 'corrected'),
        normalizedOnlyRows: count(o => o.kind === 'normalized'),
        archived: count(o => o.op === 'archive'),
        inserted: count(o => o.op === 'insert'),
        brandChanges: count(o => o.changes && o.changes.brand),
        tbdPricesNulled: operations.reduce((n, o) => n +
            ['retail_price', 'hobby_price'].filter(f => o.changes && o.changes[f] && /^tbd$/i.test(o.changes[f].from || '')).length, 0),
        statusChanges: count(o => o.changes && o.changes.status),
        dateChanges: count(o => o.changes && o.changes.release_date),
        sourceRows: operations.reduce((n, o) => n + (o.sources ? o.sources.length : 0), 0),
        liveNullSport: liveRows.filter(r => !r.sport).length,
        liveUpcoming: liveRows.filter(r => r.status === 'Upcoming').length,
        liveReleased: liveRows.filter(r => r.status === 'Released').length
    };

    return { today, includePending, acceptSecondaryDates, counts, operations, errors, warnings, fingerprint: fingerprint(operations, today) };
}

function fingerprint(operations, today) {
    const stable = operations.map(o => ({
        op: o.op, id: o.id, before: o.before || null, after: o.after,
        sources: (o.sources || []).map(s => [s.url, s.checked])
    }));
    return crypto.createHash('sha256').update(JSON.stringify({ today, stable })).digest('hex').slice(0, 16);
}

module.exports = { buildChangeSet, toRow, FIELDS };
