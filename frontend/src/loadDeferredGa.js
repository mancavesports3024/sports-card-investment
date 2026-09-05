/**
 * Deferred GA4 loader — keeps analytics off the critical rendering path.
 * Guarantees ~2s after window "load" before inject; then optional idle callback.
 */
const GA_MEASUREMENT_ID = 'G-X6BGH9S5F8';
const POST_LOAD_DELAY_MS = 2000;

function injectAndInitGa() {
  try {
    if (typeof window === 'undefined') return;
    if (window.__SCORECARD_GA_LOADED__) return;
    window.__SCORECARD_GA_LOADED__ = true;

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }

    // Already present (e.g. hot reload / unexpected duplicate) — only config once
    if (document.querySelector('script[data-scorecard-ga="1"]')) {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
      return;
    }

    const existing = document.querySelector(
      'script[src*="googletagmanager.com/gtag/js"]'
    );
    if (existing) {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute('data-scorecard-ga', '1');
    script.onerror = () => {
      // Analytics must never break the app
    };
    script.onload = () => {
      try {
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID);
      } catch (_) {
        // ignore
      }
    };
    document.head.appendChild(script);
  } catch (_) {
    // ignore — never block rendering
  }
}

function scheduleDeferredGa() {
  try {
    if (typeof window === 'undefined') return;
    if (window.__SCORECARD_GA_SCHEDULED__) return;
    window.__SCORECARD_GA_SCHEDULED__ = true;

    const afterLoad = () => {
      // Fixed delay first so GA cannot start during the early critical window.
      window.setTimeout(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(() => injectAndInitGa(), { timeout: 1000 });
        } else {
          injectAndInitGa();
        }
      }, POST_LOAD_DELAY_MS);
    };

    if (document.readyState === 'complete') {
      afterLoad();
    } else {
      window.addEventListener('load', afterLoad, { once: true });
    }
  } catch (_) {
    // ignore
  }
}

scheduleDeferredGa();

export {};
