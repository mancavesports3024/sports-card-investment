import { useCallback } from 'react';
import { analyticsAllowed } from '../loadDeferredGa';

// Custom hook for Google Analytics tracking
export const useAnalytics = () => {
  const trackEvent = useCallback((eventName, parameters = {}) => {
    if (typeof window !== 'undefined' && analyticsAllowed() && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  }, []);

  const trackSearch = useCallback((searchTerm, filters = {}) => {
    trackEvent('search', {
      search_performed: true,
      // Free-text queries and filters are not sent to Google.
    });
  }, [trackEvent]);

  const trackCardView = useCallback((cardTitle, cardId, price) => {
    trackEvent('view_item', {
      // Card titles may contain user-provided text; omit them.
      item_id: cardId,
      value: price,
      currency: 'USD'
    });
  }, [trackEvent]);

  const trackPageView = useCallback((pageTitle, pagePath) => {
    if (typeof window !== 'undefined' && analyticsAllowed() && window.gtag) {
      window.gtag('event', 'page_view', {
        // Avoid arbitrary page titles.
        page_path: window.location.pathname,
        page_location: window.location.origin + window.location.pathname,
        page_referrer: ''
      });
    }
  }, []);

  const trackError = useCallback((errorMessage, errorCode) => {
    trackEvent('exception', {
      description: 'Application error',
      fatal: false,
      error_code: errorCode
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackSearch,
    trackCardView,
    trackPageView,
    trackError
  };
}; 