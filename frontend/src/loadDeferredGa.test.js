import { GA_ID, CONSENT_KEY, readChoice, analyticsAllowed, syncTracking, saveChoice } from './loadDeferredGa';

const scripts = () => document.querySelectorAll('script[data-scorecard-ga]');
const commands = () => (window.dataLayer || []).map(args => Array.from(args));
const stored = (analytics, extras = {}) => localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, analytics, updatedAt: Date.now(), ...extras }));
let originalLocation;

beforeAll(() => {
  originalLocation = window.location;
  delete window.location;
  window.location = { origin: 'https://cards.example', pathname: '/auth/callback', hostname: 'cards.example', search: '?code=secret&email=person@example.com', hash: '#token=secret', reload: jest.fn() };
});
afterAll(() => { window.location = originalLocation; });
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  window.location.reload.mockClear();
  syncTracking();
});
afterEach(() => jest.restoreAllMocks());

test('actual OAuth success route never loads analytics even with a saved acceptance', () => {
  const originalPath = window.location.pathname;
  try {
    window.location.pathname = '/auth-success';
    stored(true);
    syncTracking();
    expect(analyticsAllowed()).toBe(false);
    expect(scripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window[`ga-disable-${GA_ID}`]).toBe(true);
  } finally {
    window.location.pathname = originalPath;
  }
});

test('before a choice and after rejection no Google script or queued events exist', () => {
  expect(readChoice()).toBeNull();
  expect(scripts()).toHaveLength(0);
  expect(window.gtag).toBeUndefined();
  expect(window[`ga-disable-${GA_ID}`]).toBe(true);
  expect(saveChoice(false)).toBe(true);
  expect(analyticsAllowed()).toBe(false);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
});

test('acceptance loads one tag with analytics consent and advertising denied, stripping callback secrets', () => {
  saveChoice(true);
  syncTracking();
  expect(scripts()).toHaveLength(1);
  expect(scripts()[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  expect(commands()).toContainEqual(['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  expect(commands()).toContainEqual(['config', GA_ID, expect.objectContaining({ page_location: 'https://cards.example/auth/callback', page_referrer: '', allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false })]);
  expect(JSON.stringify(commands())).not.toMatch(/secret|person@example/);
});

test('withdrawal disables the loaded runtime, removes GA cookies, preserves essential cookies, and permits fresh acceptance', () => {
  saveChoice(true);
  const previousGtag = window.gtag;
  document.cookie = '_ga=analytics; path=/';
  document.cookie = '_ga_TEST=analytics; path=/';
  document.cookie = 'essential=keep; path=/';
  saveChoice(false);
  expect(window[`ga-disable-${GA_ID}`]).toBe(true);
  expect(scripts()).toHaveLength(0);
  expect(window.location.reload).toHaveBeenCalledTimes(1);
  previousGtag('event', 'late_event');
  expect(commands()).toEqual([]);
  expect(document.cookie).not.toMatch(/_ga/);
  expect(document.cookie).toContain('essential=keep');
  saveChoice(true);
  expect(scripts()).toHaveLength(1);
  expect(window[`ga-disable-${GA_ID}`]).toBe(false);
});

test.each([
  ['malformed', '{invalid'],
  ['wrong version', JSON.stringify({ version: 2, analytics: true, updatedAt: Date.now() })],
  ['nonboolean', JSON.stringify({ version: 1, analytics: 'true', updatedAt: Date.now() })],
  ['expired', JSON.stringify({ version: 1, analytics: true, updatedAt: Date.now() - 181 * 86400000 })],
  ['future', JSON.stringify({ version: 1, analytics: true, updatedAt: Date.now() + 86400000 })],
])('%s stored choices fail closed', (_, value) => {
  localStorage.setItem(CONSENT_KEY, value);
  syncTracking();
  expect(readChoice()).toBeNull();
  expect(analyticsAllowed()).toBe(false);
  expect(scripts()).toHaveLength(0);
});

test('GPC overrides stored and newly accepted analytics choices', () => {
  stored(true);
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  syncTracking();
  saveChoice(true);
  expect(analyticsAllowed()).toBe(false);
  expect(scripts()).toHaveLength(0);
});

test('unavailable browser storage fails closed and does not claim successful acceptance', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(saveChoice(true)).toBe(false);
  syncTracking();
  expect(scripts()).toHaveLength(0);
  expect(analyticsAllowed()).toBe(false);
});

test('another tab withdrawing consent immediately disables tracking and reloads this tab', () => {
  saveChoice(true);
  const notification = jest.fn();
  window.addEventListener('scorecard-privacy-change', notification);
  stored(false);
  window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }));
  expect(scripts()).toHaveLength(0);
  expect(window[`ga-disable-${GA_ID}`]).toBe(true);
  expect(notification).toHaveBeenCalledTimes(1);
  expect(window.location.reload).toHaveBeenCalledTimes(1);
  window.removeEventListener('scorecard-privacy-change', notification);
});
