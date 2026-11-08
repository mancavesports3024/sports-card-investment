// Release dates are date-only 'YYYY-MM-DD' strings. They are compared as strings
// and formatted from local date parts, so no UTC parsing can move them a day.
export const CALENDAR_TIME_ZONE = 'America/Chicago';
export const RECENT_DAYS = 30;

export const todayInCalendarZone = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const toDateKey = (year, month, day) => {
  // Normalises overflow such as month -1 or 12 for the calendar's edge cells.
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const parseDateOnly = (value) => {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
};

export const formatReleaseDate = (value) => {
  const parts = parseDateOnly(value);
  if (!parts) return 'TBD';
  return new Date(parts.year, parts.month, parts.day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const addDays = (dateKey, days) => {
  const parts = parseDateOnly(dateKey);
  return toDateKey(parts.year, parts.month, parts.day + days);
};

// A release is out on its release day.
export const deriveStatus = (releaseDate, today) =>
  releaseDate && releaseDate.slice(0, 10) <= today ? 'Released' : 'Upcoming';

export const hasPrice = (value) =>
  value !== null && value !== undefined && String(value).trim() !== '' && !/^tbd$/i.test(String(value).trim());

export const isArchived = (releaseDate, today) => releaseDate.slice(0, 10) < addDays(today, -RECENT_DAYS);
