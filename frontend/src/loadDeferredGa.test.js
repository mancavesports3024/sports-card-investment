let tracking;
let originalLocation;
const scripts = () => document.querySelectorAll('script[data-scorecard-ga]');
const commands = () => (window.dataLayer || []).map(args => Array.from(args));
const stored = (analytics, updatedAt = Date.now()) => localStorage.setItem('scorecardPrivacyChoice', JSON.stringify({ version: 1, analytics, updatedAt }));
const optedOut = () => window['ga-disable-G-X6BGH9S5F8'];
const accept = () => { expect(tracking.saveChoice(true)).toBe(true); jest.advanceTimersByTime(0); };

beforeAll(() => {
  originalLocation = window.location;
  delete window.location;
  window.location = {
    get href() { return originalLocation.href; },
    get pathname() { return originalLocation.pathname; },
    get origin() { return originalLocation.origin; },
    get hostname() { return originalLocation.hostname; },
    reload: jest.fn(),
  };
});
afterAll(() => { window.location = originalLocation; });
beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers('modern');
  jest.setSystemTime(new Date('2026-10-12T00:00:00Z'));
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  window.location.reload.mockClear();
  tracking = require('./loadDeferredGa');
});
afterEach(() => {
  jest.restoreAllMocks();
  tracking.disposeTrackingLifecycle();
  jest.useRealTimers();
});

test('before a choice and after rejection there is no Google request or event queue', () => {
  jest.advanceTimersByTime(2000);
  expect(scripts()).toHaveLength(0);
  expect(window.gtag).toBeUndefined();
  expect(optedOut()).toBe(true);
  expect(tracking.saveChoice(false)).toBe(true);
  jest.advanceTimersByTime(2000);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
});
test('acceptance queues sanitized page data with all advertising consent denied', () => {
  window.history.pushState(null, '', '/search?email=person@example.com#secret');
  accept();
  expect(scripts()).toHaveLength(1);
  expect(commands()).toContainEqual(['consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  }]);
  expect(commands()).toContainEqual(['config', tracking.GA_ID, expect.objectContaining({
    page_location: `${originalLocation.origin}/search`, page_referrer: '', send_page_view: false,
    allow_google_signals: false, allow_ad_personalization_signals: false,
  })]);
  expect(JSON.stringify(commands())).not.toMatch(/secret|person@example/);
});
test('successful withdrawal disables stale callbacks and clears GA cookies before reloading', () => {
  accept();
  const previous = window.gtag;
  document.cookie = '_ga=analytics; path=/';
  document.cookie = '_ga_TEST=analytics; path=/';
  document.cookie = 'essential=keep; path=/';
  tracking.saveChoice(false);
  previous('event', 'late_event');
  jest.advanceTimersByTime(2000);
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
  expect(document.cookie).not.toMatch(/_ga/);
  expect(document.cookie).toContain('essential=keep');
  expect(window.location.reload).toHaveBeenCalledTimes(1);
});
test('failed withdrawal after acceptance shuts down even while old stored acceptance is readable', () => {
  accept();
  const previous = window.gtag;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('read only'); });
  expect(tracking.saveChoice(false)).toBe(false);
  expect(JSON.parse(localStorage.getItem(tracking.CONSENT_KEY)).analytics).toBe(true);
  expect(optedOut()).toBe(true);
  expect(tracking.analyticsAllowed()).toBe(false);
  previous('event', 'pending_send');
  window.history.pushState(null, '', '/news');
  window.dispatchEvent(new Event('focus'));
  jest.advanceTimersByTime(3000);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
  expect(window.location.reload).not.toHaveBeenCalled();
});
test('session denial protects a later document when a failed local write cannot remove the old grant', () => {
  accept();
  const prototypeSet = Storage.prototype.setItem;
  const prototypeRemove = Storage.prototype.removeItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (this === localStorage) throw new Error('read only');
    return prototypeSet.call(this, key, value);
  });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
    if (this === localStorage) throw new Error('read only');
    return prototypeRemove.call(this, key);
  });
  expect(tracking.saveChoice(false)).toBe(false);
  expect(sessionStorage.getItem(tracking.DENIAL_KEY)).toBe('1');
  tracking.disposeTrackingLifecycle();
  jest.resetModules();
  tracking = require('./loadDeferredGa');
  jest.advanceTimersByTime(1000);
  expect(scripts()).toHaveLength(0);
  expect(optedOut()).toBe(true);
});
test('a pending loader and captured callback cannot inject after rejection', () => {
  tracking.saveChoice(true);
  expect(scripts()).toHaveLength(0);
  tracking.saveChoice(false);
  jest.advanceTimersByTime(5000);
  expect(scripts()).toHaveLength(0);
  expect(optedOut()).toBe(true);
  expect(commands()).toEqual([]);
});
test('fresh acceptance cannot revive a retired runtime until a new document reloads', () => {
  accept();
  const previous = window.gtag;
  tracking.saveChoice(false);
  tracking.saveChoice(true);
  jest.advanceTimersByTime(1000);
  previous('event', 'from_retired_runtime');
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
  expect(optedOut()).toBe(true);
  expect(window.location.reload).toHaveBeenCalledTimes(2);
});
test('open-page expiry disables the loaded runtime at the deadline and retains only an invalid record', () => {
  stored(true, Date.now() - tracking.CHOICE_MAX_AGE + 20);
  tracking.syncTracking();
  jest.advanceTimersByTime(0);
  expect(scripts()).toHaveLength(1);
  const previous = window.gtag;
  jest.advanceTimersByTime(20);
  previous('event', 'expired_send');
  expect(tracking.readChoice()).toBeNull();
  expect(localStorage.getItem(tracking.CONSENT_KEY)).not.toBeNull();
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
});
test('GPC changing in an open page immediately opts out pending Google work, then cleans the DOM', () => {
  accept();
  const previous = window.gtag;
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  expect(optedOut()).toBe(true); // No event or poll needed for the Google's property read.
  previous('event', 'pending_send');
  const before = commands().length;
  jest.advanceTimersByTime(1000);
  expect(before).toBe(4);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  jest.advanceTimersByTime(1000);
  expect(optedOut()).toBe(true); // Never resurrect the old runtime automatically.
});
test('GPC before a pending injection prevents it, and initial GPC overrides acceptance', () => {
  tracking.saveChoice(true);
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  jest.advanceTimersByTime(0);
  expect(scripts()).toHaveLength(0);
  expect(optedOut()).toBe(true);
});
test.each(['pushState', 'replaceState'])('%s disables a loaded runtime before navigating to an OAuth callback', method => {
  accept();
  window.history[method](null, '', '/auth-success/?token=secret');
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
  expect(commands()).toEqual([]);
  window.history[method](null, '', '/search');
  jest.advanceTimersByTime(1000);
  expect(scripts()).toHaveLength(0);
});
test('a pending loader cannot run on the OAuth route and popstate/focus resynchronize state', () => {
  tracking.saveChoice(true);
  window.history.pushState(null, '', '/auth-success?token=secret');
  jest.advanceTimersByTime(0);
  expect(scripts()).toHaveLength(0);
  window.history.replaceState(null, '', '/search');
  jest.advanceTimersByTime(0);
  expect(scripts()).toHaveLength(1);
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new Event('focus'));
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
});
test('cross-tab withdrawal disables the runtime and does not automatically resume on cross-tab acceptance', () => {
  accept();
  stored(false);
  window.dispatchEvent(new StorageEvent('storage', { key: tracking.CONSENT_KEY }));
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
  stored(true);
  window.dispatchEvent(new StorageEvent('storage', { key: tracking.CONSENT_KEY }));
  jest.advanceTimersByTime(1000);
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
});
test.each([
  '{invalid',
  JSON.stringify({ version: 2, analytics: true, updatedAt: Date.now() }),
  JSON.stringify({ version: 1, analytics: 'true', updatedAt: Date.now() }),
  JSON.stringify({ version: 1, analytics: true, updatedAt: 0 }),
  JSON.stringify({ version: 1, analytics: true, updatedAt: 9999999999999 }),
])('invalid choice %s cannot load Analytics', value => {
  localStorage.setItem(tracking.CONSENT_KEY, value);
  tracking.syncTracking();
  jest.advanceTimersByTime(1000);
  expect(optedOut()).toBe(true);
  expect(scripts()).toHaveLength(0);
});
