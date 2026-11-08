// Release dates are calendar dates (no time of day). Everything here works on
// 'YYYY-MM-DD' strings so no UTC conversion can move a release to another day.
const CALENDAR_TIME_ZONE = 'America/Chicago';

function todayInCalendarZone(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CALENDAR_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const get = (type) => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

// pg returns DATE columns as a Date at local midnight, so read the local parts.
function toDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function addDays(dateOnly, days) {
    const [y, m, d] = dateOnly.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + days));
    return shifted.toISOString().slice(0, 10);
}

// A release is out on its release day.
function deriveStatus(releaseDate, today = todayInCalendarZone()) {
    const date = toDateOnly(releaseDate);
    if (!date) return 'Upcoming';
    return date <= today ? 'Released' : 'Upcoming';
}

function normalizePrice(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text || /^(tbd|tba|n\/a|unknown)$/i.test(text)) return null;
    return text;
}

function normalizeRelease(release, today = todayInCalendarZone()) {
    const releaseDate = toDateOnly(release.releaseDate);
    return {
        ...release,
        releaseDate,
        retailPrice: normalizePrice(release.retailPrice),
        hobbyPrice: normalizePrice(release.hobbyPrice),
        status: deriveStatus(releaseDate, today)
    };
}

module.exports = {
    CALENDAR_TIME_ZONE,
    todayInCalendarZone,
    toDateOnly,
    addDays,
    deriveStatus,
    normalizePrice,
    normalizeRelease
};
