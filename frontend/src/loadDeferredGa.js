export const GA_ID = 'G-X6BGH9S5F8';
export const CONSENT_KEY = 'scorecardPrivacyChoice';
export function readChoice() {
  try {
    const v = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (v?.version === 1 && typeof v.analytics === 'boolean' && Number.isFinite(v.updatedAt) && v.updatedAt <= Date.now() && Date.now() - v.updatedAt < 180 * 86400000) return v;
  } catch (_) {}
  return null;
}
export function analyticsAllowed() {
  return navigator.globalPrivacyControl !== true && window.location.pathname !== '/auth-success' && readChoice()?.analytics === true;
}
export function syncTracking() {
  const allowed = analyticsAllowed();
  window[`ga-disable-${GA_ID}`] = !allowed;
  if (!allowed) {
    window.gtag = undefined;
    window.dataLayer = [];
    document.querySelectorAll('script[data-scorecard-ga]').forEach(s => s.remove());
    document.cookie.split(';').forEach(entry => {
      const name = entry.trim().split('=')[0];
      if (!/^_ga($|_)|^_gid$|^_gat($|_)/.test(name)) return;
      document.cookie = `${name}=; Max-Age=0; path=/`;
      const parts = window.location.hostname.split('.');
      for (let i = 0; i < parts.length - 1; i++) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts.slice(i).join('.')}`;
    });
    return;
  }
  if (document.querySelector('script[data-scorecard-ga]')) return;
  window.dataLayer = [];
  window.gtag = function () { if (analyticsAllowed()) window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { page_location: window.location.origin + window.location.pathname, page_referrer: '', allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false });
  window.gtag('event', 'page_view', { page_location: window.location.origin + window.location.pathname, page_referrer: '' });
  const script = document.createElement('script');
  script.async = true;
  script.dataset.scorecardGa = '1';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}
export function saveChoice(analytics) {
  const wasAllowed = analyticsAllowed();
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, analytics: analytics === true, updatedAt: Date.now() })); }
  catch (_) { return false; }
  syncTracking();
  window.dispatchEvent(new Event('scorecard-privacy-change'));
  // Destroy Google's already executed runtime when withdrawing consent.
  if (wasAllowed && !analyticsAllowed()) window.location.reload();
  return true;
}
window.addEventListener('storage', event => {
  if (event.key === CONSENT_KEY || event.key === null) {
    const loaded = !!document.querySelector('script[data-scorecard-ga]');
    syncTracking();
    window.dispatchEvent(new Event('scorecard-privacy-change'));
    if (loaded && !analyticsAllowed()) window.location.reload();
  }
});
syncTracking();
