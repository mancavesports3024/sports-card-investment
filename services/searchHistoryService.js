const fs = require('fs').promises;
const path = require('path');

const SEARCH_HISTORY_FILE = path.join(__dirname, '../data/search_history.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(SEARCH_HISTORY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load search history from file
async function loadSearchHistory() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SEARCH_HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return [];
  }
}

// Save search history to file
async function saveSearchHistory(history) {
  await ensureDataDirectory();
  await fs.writeFile(SEARCH_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Add a new search to history
async function addSearch(searchData) {
  try {
    const history = await loadSearchHistory();
    
    const newSearch = {
      id: Date.now().toString(),
      query: searchData.searchQuery,
      timestamp: new Date().toISOString(),
      results: {
        totalCards: searchData.results?.raw?.length + searchData.results?.psa9?.length + searchData.results?.psa10?.length || 0,
        raw: searchData.results?.raw?.length || 0,
        psa9: searchData.results?.psa9?.length || 0,
        psa10: searchData.results?.psa10?.length || 0
      },
      priceAnalysis: searchData.priceAnalysis || null
    };
    
    // Add to beginning of array (most recent first)
    history.unshift(newSearch);
    
    // Keep only last 50 searches
    if (history.length > 50) {
      history.splice(50);
    }
    
    await saveSearchHistory(history);
    
    console.log(`💾 Saved search: "${searchData.searchQuery}" (${newSearch.results.totalCards} cards found)`);
    
    return newSearch;
  } catch (error) {
    console.error('❌ Error saving search:', error);
    throw error;
  }
}

// Get all saved searches
async function getSearchHistory() {
  try {
    const history = await loadSearchHistory();
    return history;
  } catch (error) {
    console.error('❌ Error loading search history:', error);
    return [];
  }
}

// Get a specific saved search by ID
async function getSearchById(searchId) {
  try {
    const history = await loadSearchHistory();
    return history.find(search => search.id === searchId);
  } catch (error) {
    console.error('❌ Error getting search by ID:', error);
    return null;
  }
}

// Delete a saved search
async function deleteSearch(searchId) {
  try {
    const history = await loadSearchHistory();
    const filteredHistory = history.filter(search => search.id !== searchId);
    await saveSearchHistory(filteredHistory);
    
    console.log(`🗑️ Deleted search: ${searchId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting search:', error);
    return false;
  }
}

// Clear all search history
async function clearSearchHistory() {
  try {
    await saveSearchHistory([]);
    console.log('🗑️ Cleared all search history');
    return true;
  } catch (error) {
    console.error('❌ Error clearing search history:', error);
    return false;
  }
}

module.exports = {
  addSearch,
  getSearchHistory,
  getSearchById,
  deleteSearch,
  clearSearchHistory
}; 