import {
  addDays,
  deriveStatus,
  formatReleaseDate,
  hasPrice,
  isArchived,
  toDateKey,
  todayInCalendarZone,
} from './releaseCalendar';

describe('release calendar dates', () => {
  it('formats a date-only release as that calendar day', () => {
    expect(formatReleaseDate('2026-10-09')).toBe('Friday, October 9, 2026');
    expect(formatReleaseDate(null)).toBe('TBD');
  });

  it('uses the America/Chicago date for today', () => {
    expect(todayInCalendarZone(new Date('2026-11-08T03:30:00Z'))).toBe('2026-11-07');
  });

  it('normalises calendar edge cells into real dates', () => {
    expect(toDateKey(2026, -1, 30)).toBe('2025-12-30');
    expect(toDateKey(2026, 12, 2)).toBe('2027-01-02');
    expect(addDays('2026-11-07', -30)).toBe('2026-10-08');
  });

  it('derives status from the date, with release day counting as released', () => {
    expect(deriveStatus('2026-11-07', '2026-11-07')).toBe('Released');
    expect(deriveStatus('2026-11-08', '2026-11-07')).toBe('Upcoming');
  });

  it('archives releases older than 30 days', () => {
    expect(isArchived('2026-10-07', '2026-11-07')).toBe(true);
    expect(isArchived('2026-10-08', '2026-11-07')).toBe(false);
  });

  it('treats null and TBD prices as absent', () => {
    expect(hasPrice(null)).toBe(false);
    expect(hasPrice('TBD')).toBe(false);
    expect(hasPrice('$72')).toBe(true);
  });
});
