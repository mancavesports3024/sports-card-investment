// Basic consent mode: never fetch the Google tag until a valid opt-in.
// Google checks ga-disable before setting cookies or sending Analytics data:
// https://developers.google.com/tag-platform/security/guides/privacy
export const GA_ID = 'G-X6BGH9S5F8';
export const CONSENT_KEY = 'scorecardPrivacyChoice';
export const DENIAL_KEY = 'scorecardAnalyticsDeniedForSession';
export const CHOICE_MAX_AGE = 180 * 86400000;
let deniedInMemory = false;
let disabled = true;
let needsReload = false;
let injected = false;
let generation = 0;
let pendingLoader = null;
let expiryTimer = null;
let expiryAt = null;
let lastState;

function sessionDenied() {
  try { return sessionStorage.getItem(DENIAL_KEY) === '1'; }
  catch (_) { return false; } // The in-memory latch still protects this document.
}
function storedChoice() {
  try {
    const v = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (v?.version === 1 && typeof v.analytics === 'boolean' && Number.isFinite(v.updatedAt) &&
        v.updatedAt <= Date.now() && Date.now() - v.updatedAt < CHOICE_MAX_AGE) return v;
  } catch (_) { /* Unreadable storage is never consent. */ }
  return null;
}
export function readChoice() {
  return deniedInMemory || sessionDenied() ? null : storedChoice();
}
function eligible(pathname = window.location.pathname) {
  return navigator.globalPrivacyControl !== true &&
    pathname.replace(/\/+$/, '') !== '/auth-success' && readChoice()?.analytics === true;
}
export function analyticsAllowed() {
  return !needsReload && eligible();
}
// A dynamic getter also protects pending Google work between lifecycle checks.
// The setter preserves Google's documented boolean opt-out interface.
Object.defineProperty(window, `ga-disable-${GA_ID}`, {
  configurable: true,
  get: () => disabled || !analyticsAllowed(),
  set: value => { disabled = Boolean(value); },
});

function clearAnalyticsCookies() {
  document.cookie.split(';').forEach(entry => {
    const name = entry.trim().split('=')[0];
    if (!/^_ga($|_)|^_gid$|^_gat($|_)/.test(name)) return;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    const parts = window.location.hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts.slice(i).join('.')}`;
    }
  });
}
function stopTracking() {
  disabled = true; // Before any persistence, DOM work, event or navigation.
  generation += 1;
  if (pendingLoader !== null) window.clearTimeout(pendingLoader);
  pendingLoader = null;
  if (injected) needsReload = true;
  window.gtag = undefined;
  window.dataLayer = [];
  document.querySelectorAll('script[data-scorecard-ga]').forEach(s => s.remove());
  clearAnalyticsCookies();
}
function notifyState() {
  const state = JSON.stringify([readChoice(), navigator.globalPrivacyControl === true, needsReload]);
  if (state !== lastState) {
    lastState = state;
    window.dispatchEvent(new Event('scorecard-privacy-change'));
  }
}
function scheduleExpiry() {
  const choice = readChoice();
  const nextExpiry = choice ? choice.updatedAt + CHOICE_MAX_AGE : null;
  if (nextExpiry === expiryAt) return;
  if (expiryTimer !== null) window.clearTimeout(expiryTimer);
  expiryTimer = null;
  expiryAt = nextExpiry;
  if (nextExpiry !== null) {
    // Browser timers cannot exceed signed 32-bit milliseconds. Recheck in chunks.
    expiryTimer = window.setTimeout(() => {
      expiryAt = null;
      expiryTimer = null;
      syncTracking();
    }, Math.min(Math.max(nextExpiry - Date.now(), 0), 2147483647));
  }
}
export function syncTracking(pathname = window.location.pathname) {
  scheduleExpiry();
  if (!eligible(pathname) || needsReload) {
    stopTracking();
    notifyState();
    return;
  }
  disabled = false;
  if (!injected && pendingLoader === null) {
    const ticket = generation;
    pendingLoader = window.setTimeout(() => {
      pendingLoader = null;
      if (ticket !== generation || !analyticsAllowed()) return;
      window.dataLayer = [];
      window.gtag = function () {
        if (ticket === generation && analyticsAllowed()) window.dataLayer.push(arguments);
      };
      window.gtag('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, {
        page_location: window.location.origin + window.location.pathname,
        page_referrer: '', allow_google_signals: false,
        allow_ad_personalization_signals: false, send_page_view: false,
      });
      window.gtag('event', 'page_view', {
        page_location: window.location.origin + window.location.pathname, page_referrer: '',
      });
      const script = document.createElement('script');
      script.async = true;
      script.dataset.scorecardGa = '1';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      injected = true;
      document.head.appendChild(script);
    }, 0);
  }
  notifyState();
}
export function saveChoice(analytics) {
  // Fail closed even if the old stored value was an acceptance.
  deniedInMemory = true;
  stopTracking();
  const value = JSON.stringify({ version: 1, analytics: analytics === true, updatedAt: Date.now() });
  try {
    localStorage.setItem(CONSENT_KEY, value);
    if (localStorage.getItem(CONSENT_KEY) !== value) throw new Error('Choice not saved');
    sessionStorage.removeItem(DENIAL_KEY);
  } catch (_) {
    // Best-effort protection on later navigations; never reload into an old grant.
    try { sessionStorage.setItem(DENIAL_KEY, '1'); } catch (_) {}
    try { localStorage.removeItem(CONSENT_KEY); } catch (_) {}
    notifyState();
    return false;
  }
  deniedInMemory = false;
  syncTracking();
  // A new document destroys previously executed Google listeners/timers. Never
  // re-enable a retired runtime in place, and never reload on persistence failure.
  if (needsReload) window.location.reload();
  return true;
}

const onLifecycle = () => syncTracking();
const onStorage = event => {
  if (event.key === CONSENT_KEY || event.key === null) syncTracking();
};
window.addEventListener('storage', onStorage);
window.addEventListener('focus', onLifecycle);
window.addEventListener('pageshow', onLifecycle);
window.addEventListener('popstate', onLifecycle);
window.addEventListener('hashchange', onLifecycle);
document.addEventListener('visibilitychange', onLifecycle);
const originalHistory = {};
const wrappedHistory = {};
['pushState', 'replaceState'].forEach(method => {
  originalHistory[method] = window.history[method];
  wrappedHistory[method] = function (state, title, url) {
    // Disable before history listeners can emit an automatic Google pageview.
    const pathname = url == null ? window.location.pathname : new URL(url, window.location.href).pathname;
    syncTracking(pathname);
    const result = originalHistory[method].apply(this, arguments);
    syncTracking();
    return result;
  };
  window.history[method] = wrappedHistory[method];
});
// GPC has no standard change event. Poll for UI/DOM cleanup; the dynamic opt-out
// getter already denies Google sends immediately when the signal changes.
const lifecycleTimer = window.setInterval(onLifecycle, 1000);
export function disposeTrackingLifecycle() {
  window.clearInterval(lifecycleTimer);
  if (expiryTimer !== null) window.clearTimeout(expiryTimer);
  window.removeEventListener('storage', onStorage);
  ['focus', 'pageshow', 'popstate', 'hashchange'].forEach(type => window.removeEventListener(type, onLifecycle));
  document.removeEventListener('visibilitychange', onLifecycle);
  ['pushState', 'replaceState'].forEach(method => {
    if (window.history[method] === wrappedHistory[method]) window.history[method] = originalHistory[method];
  });
  stopTracking();
}
syncTracking();
