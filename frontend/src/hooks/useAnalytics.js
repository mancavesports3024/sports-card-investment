import { useCallback } from 'react';

// Custom hook for Google Analytics tracking
export const useAnalytics = () => {
  const trackEvent = useCallback((eventName, parameters = {}) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  }, []);

  const trackSearch = useCallback((searchTerm, filters = {}) => {
    trackEvent('search', {
      search_term: searchTerm,
      ...filters
    });
  }, [trackEvent]);

  const trackCardView = useCallback((cardTitle, cardId, price) => {
    trackEvent('view_item', {
      item_name: cardTitle,
      item_id: cardId,
      value: price,
      currency: 'USD'
    });
  }, [trackEvent]);

  const trackPageView = useCallback((pageTitle, pagePath) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'G-X6BGH9S5F8', {
        page_title: pageTitle,
        page_path: pagePath
      });
    }
  }, []);

  const trackError = useCallback((errorMessage, errorCode) => {
    trackEvent('exception', {
      description: errorMessage,
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