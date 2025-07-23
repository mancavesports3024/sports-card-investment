const fs = require('fs').promises;
const path = require('path');

// Use environment variable for data path, fallback to local directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const SEARCH_HISTORY_FILE = path.join(DATA_DIR, 'search_history.json');

console.log('📁 Search history file location:', SEARCH_HISTORY_FILE);
console.log('📁 Data directory:', DATA_DIR);

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Data directory ensured:', DATA_DIR);
  } catch (error) {
    console.error('❌ Error creating data directory:', error);
    // Fallback to local directory if environment path fails
    const fallbackDir = path.join(__dirname, '../../data');
    if (DATA_DIR !== fallbackDir) {
      console.log('🔄 Falling back to local data directory:', fallbackDir);
      await fs.mkdir(fallbackDir, { recursive: true });
    }
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

// Add a new search to history for a user
async function addSearchForUser(user, searchData) {
  try {
    const history = await loadSearchHistory();
    const userId = user.id || user.email;
    const now = new Date().toISOString();
    const newSearch = {
      id: Date.now().toString(),
      userId,
      query: searchData.searchQuery,
      timestamp: now,
      createdAt: now,
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
    // Keep only last 50 searches per user
    const filtered = history.filter(s => s.userId === userId).slice(0, 50);
    const rest = history.filter(s => s.userId !== userId);
    await saveSearchHistory([...filtered, ...rest]);
    console.log(`💾 Saved search for user ${userId}: "${searchData.searchQuery}" (${newSearch.results.totalCards} cards found)`);
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

// Get all saved searches for a user
async function getSearchHistoryForUser(user) {
  try {
    const history = await loadSearchHistory();
    const userId = user.id || user.email;
    return history.filter(s => s.userId === userId).map(s => ({
      ...s,
      createdAt: s.createdAt || s.timestamp || null
    }));
  } catch (error) {
    console.error('❌ Error loading search history:', error);
    return [];
  }
}

// Get all saved searches (for admin purposes)
async function getAllSearchHistory() {
  try {
    const history = await loadSearchHistory();
    return history;
  } catch (error) {
    console.error('❌ Error loading all search history:', error);
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

// Get a specific saved search by ID for a user
async function getSearchByIdForUser(user, searchId) {
  try {
    const history = await loadSearchHistory();
    const userId = user.id || user.email;
    return history.find(s => s.id === searchId && s.userId === userId);
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

// Delete a saved search for a user
async function deleteSearchForUser(user, searchId) {
  try {
    const history = await loadSearchHistory();
    const userId = user.id || user.email;
    const filteredHistory = history.filter(s => !(s.id === searchId && s.userId === userId));
    await saveSearchHistory(filteredHistory);
    console.log(`🗑️ Deleted search ${searchId} for user ${userId}`);
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

// Clear all search history for a user
async function clearSearchHistoryForUser(user) {
  try {
    const history = await loadSearchHistory();
    const userId = user.id || user.email;
    const filteredHistory = history.filter(s => s.userId !== userId);
    await saveSearchHistory(filteredHistory);
    console.log(`🗑️ Cleared all search history for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing search history:', error);
    return false;
  }
}

module.exports = {
  addSearchForUser,
  getSearchHistoryForUser,
  getSearchByIdForUser,
  deleteSearchForUser,
  clearSearchHistoryForUser,
  // legacy exports (if needed elsewhere)
  addSearch,
  getSearchHistory,
  getSearchById,
  deleteSearch,
  clearSearchHistory,
  getAllSearchHistory
}; 