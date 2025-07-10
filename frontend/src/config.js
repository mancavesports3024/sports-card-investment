// Configuration for API endpoints
const config = {
  // Use environment variable for API URL, fallback to Railway backend for development
  API_BASE_URL: process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app',
  
  // API endpoints
  SEARCH_CARDS: '/api/search-cards',
  SEARCH_HISTORY: '/api/search-history',
  DELETE_SEARCH: (id) => `/api/search-history/${id}`,
  CLEAR_HISTORY: '/api/search-history',
  ANALYZE_IMAGE: '/api/analyze-base64',
  
  // Build full URLs
  getSearchCardsUrl: () => `${config.API_BASE_URL}${config.SEARCH_CARDS}`,
  getSearchHistoryUrl: () => `${config.API_BASE_URL}${config.SEARCH_HISTORY}`,
  getDeleteSearchUrl: (id) => `${config.API_BASE_URL}${config.DELETE_SEARCH(id)}`,
  getClearHistoryUrl: () => `${config.API_BASE_URL}${config.CLEAR_HISTORY}`,
  getAnalyzeImageUrl: () => `${config.API_BASE_URL}${config.ANALYZE_IMAGE}`,
};

export default config; 