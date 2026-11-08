// Run from backend/: node --test tests/releaseCalendarFix.test.js
// Pure logic only; no database or network access.
process.env.TZ = 'America/Chicago';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const {
    todayInCalendarZone,
    toDateOnly,
    addDays,
    deriveStatus,
    normalizePrice,
    normalizeRelease
} = require('../utils/releaseCalendar');
const plan = require('../scripts/release-calendar-fix/plan');
const { buildChangeSet } = require('../scripts/release-calendar-fix/changeSet');

test('today is the America/Chicago calendar date, not UTC', () => {
    // 2026-11-08 03:30 UTC is still Nov 7 in Chicago.
    assert.strictEqual(todayInCalendarZone(new Date('2026-11-08T03:30:00Z')), '2026-11-07');
    assert.strictEqual(todayInCalendarZone(new Date('2026-11-08T06:30:00Z')), '2026-11-08');
});

test('date-only values never shift a day', () => {
    // pg returns DATE columns as local midnight.
    assert.strictEqual(toDateOnly(new Date(2026, 9, 9)), '2026-10-09');
    assert.strictEqual(toDateOnly('2026-10-09'), '2026-10-09');
    assert.strictEqual(toDateOnly('2026-10-09T00:00:00.000Z'), '2026-10-09');
    assert.strictEqual(toDateOnly(null), null);
    assert.strictEqual(addDays('2026-11-07', -30), '2026-10-08');
    assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
});

test('status: on or before today is Released, after today is Upcoming', () => {
    assert.strictEqual(deriveStatus('2026-11-06', '2026-11-07'), 'Released');
    assert.strictEqual(deriveStatus('2026-11-07', '2026-11-07'), 'Released');
    assert.strictEqual(deriveStatus('2026-11-08', '2026-11-07'), 'Upcoming');
});

test('TBD and blank prices become null', () => {
    assert.strictEqual(normalizePrice('TBD'), null);
    assert.strictEqual(normalizePrice(' tbd '), null);
    assert.strictEqual(normalizePrice(''), null);
    assert.strictEqual(normalizePrice(undefined), null);
    assert.strictEqual(normalizePrice('$72'), '$72');
    const r = normalizeRelease({ releaseDate: '2026-12-11', retailPrice: 'TBD', hobbyPrice: '$5', status: 'Released' }, '2026-11-07');
    assert.deepStrictEqual([r.retailPrice, r.hobbyPrice, r.status], [null, '$5', 'Upcoming']);
});

const snapshotPath = path.join(__dirname, '..', 'data', 'release-calendar-fix', 'snapshot-api-releases-2026-11-07.json');

test('change set against the 2026-11-07 snapshot meets the release rules', { skip: !fs.existsSync(snapshotPath) }, () => {
    const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).releases;
    const result = buildChangeSet({ rows, plan, today: '2026-11-07' });
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.counts.liveNullSport, 0);

    const byId = new Map(result.operations.filter(o => o.id).map(o => [o.id, o]));
    assert.strictEqual(byId.get(158).after.title, '2026-27 Upper Deck Series 1 Hockey');
    assert.strictEqual(byId.get(158).after.brand, 'Upper Deck');
    assert.strictEqual(byId.get(158).after.sport, 'Hockey');
    assert.strictEqual(byId.get(105).after.is_active, false);
    for (const id of [151, 152, 153, 154, 155, 156, 157]) assert.strictEqual(byId.get(id).after.is_active, false);
    assert.strictEqual(byId.get(150).after.title, 'Pokémon TCG: 30th Celebration');
    assert.strictEqual(byId.get(148).after.status, 'Upcoming');

    for (const o of result.operations) {
        assert.ok(plan.ALLOWED_BRANDS.includes(o.after.brand), `brand ${o.after.brand}`);
        assert.notStrictEqual(o.after.retail_price, 'TBD');
        assert.notStrictEqual(o.after.hobby_price, 'TBD');
        if (o.kind === 'corrected' || o.kind === 'added') {
            assert.ok(o.sources.length > 0, `${o.after.title} has sources`);
            o.sources.forEach(s => assert.match(s.url, /^https:\/\//));
            o.sources.forEach(s => assert.strictEqual(s.checked, plan.CHECKED));
        }
    }

    const inserts = result.operations.filter(o => o.op === 'insert');
    assert.ok(inserts.every(o => o.after.release_date > '2026-11-07' && o.after.release_date <= addDays('2026-11-07', 90)));
    const toppsDates = Object.fromEntries(inserts.filter(o => o.after.brand === 'Topps').map(o => [o.after.title, o.after.release_date]));
    assert.strictEqual(toppsDates['2026 Topps Museum Collection Baseball'], '2026-11-11');
    assert.strictEqual(toppsDates['2026 Topps Allen & Ginter X Baseball'], '2026-11-11');
    assert.strictEqual(toppsDates['2026 Topps Chrome Football'], '2026-11-18');
    assert.strictEqual(toppsDates['2026 Topps Pro Debut Baseball'], '2026-11-18');
    assert.strictEqual(toppsDates['2026 Topps Gilded Collection Baseball'], '2026-11-25');
    assert.strictEqual(toppsDates['2026 Topps Chrome Update Series Baseball'], '2026-12-09');
    for (const o of inserts.filter(i => i.after.brand === 'Topps')) {
        const cal = o.sources.find(s => s.url === 'https://www.topps.com/release-calendar');
        assert.ok(cal && cal.evidence, `${o.after.title} has Topps calendar evidence`);
    }
    const pendingTitles = new Set(plan.PENDING_ADDITIONS.map(a => a.title));
    assert.ok(!inserts.some(o => pendingTitles.has(o.after.title)), 'pending Topps additions are not applied');
});

test('secondary-only dates are held unless explicitly accepted', { skip: !fs.existsSync(snapshotPath) }, () => {
    const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).releases;
    const held = buildChangeSet({ rows, plan, today: '2026-11-07' });
    const accepted = buildChangeSet({ rows, plan, today: '2026-11-07', acceptSecondaryDates: true });
    assert.deepStrictEqual(accepted.errors, []);
    for (const id of [132, 135]) {
        const h = held.operations.find(o => o.id === id);
        assert.strictEqual(h.op, 'archive');
        assert.strictEqual(h.after.is_active, false);
        assert.strictEqual(h.after.sport, null, 'held row is not enriched');
        assert.match(h.note, /^Held: /);
        assert.ok(h.sources.every(s => s.evidence && s.checked === plan.CHECKED));
        const a = accepted.operations.find(o => o.id === id);
        assert.strictEqual(a.op, 'update');
        assert.strictEqual(a.after.is_active, true);
        assert.strictEqual(a.after.release_date, '2026-08-07');
    }
    for (const result of [held, accepted]) {
        for (const id of [131, 140]) {
            const o = result.operations.find(op => op.id === id);
            assert.strictEqual(o.op, 'archive', `id ${id} held without official Topps date`);
            assert.match(o.note, /official Topps confirmation/);
        }
    }
    const bowman = held.operations.find(o => o.after.title === '2026 Bowman U Signature Football');
    assert.strictEqual(bowman.after.release_date, '2026-12-04');
    assert.doesNotMatch(bowman.after.description, /\d+\s*(on-card\s*)?autograph/i);
    assert.notStrictEqual(held.fingerprint, accepted.fingerprint);
    assert.strictEqual(accepted.counts.activeAfter, held.counts.activeAfter + 2);
});

test('the dry run is deterministic and refuses unknown or inactive ids', () => {
    const rows = [{ id: 1, title: 'A', brand: 'Bowman', sport: 'Baseball', releaseDate: '2026-01-01', retailPrice: 'TBD', hobbyPrice: 'TBD', status: 'Released' }];
    const empty = { ...plan, UPDATES: [], ARCHIVES: [], ADDITIONS: [], PENDING_ADDITIONS: [] };
    const a = buildChangeSet({ rows, plan: empty, today: '2026-11-07' });
    const b = buildChangeSet({ rows, plan: empty, today: '2026-11-07' });
    assert.strictEqual(a.fingerprint, b.fingerprint);
    assert.strictEqual(a.operations[0].after.brand, 'Topps');

    const bad = buildChangeSet({ rows, plan: { ...empty, ARCHIVES: [{ id: 99, reason: 'x' }] }, today: '2026-11-07' });
    assert.match(bad.errors.join(), /id 99 not found/);
    const inactive = buildChangeSet({ rows: [{ ...rows[0], is_active: false }], plan: { ...empty, ARCHIVES: [{ id: 1, reason: 'x' }] }, today: '2026-11-07' });
    assert.match(inactive.errors.join(), /already inactive/);
});
