const { createClient } = require('redis');

// Redis client for search history
let redisClient = null;

// Initialize Redis client
async function getRedisClient() {
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  try {
    if (process.env.REDIS_URL) {
      redisClient = createClient({ url: process.env.REDIS_URL });
      
      redisClient.on('error', (err) => {
        console.error('❌ Search History Redis error:', err);
      });
      
      redisClient.on('connect', () => {
        console.log('✅ Search History Redis connected');
      });
      
      redisClient.on('ready', () => {
        console.log('✅ Search History Redis ready');
      });

      await redisClient.connect();
      return redisClient;
    } else {
      console.log('⚠️ No REDIS_URL, using in-memory fallback for search history');
      // Fallback to in-memory storage (not recommended for production)
      return null;
    }
  } catch (error) {
    console.error('❌ Search History Redis connection failed:', error.message);
    return null;
  }
}

// Generate Redis key for user's search history
function getUserSearchHistoryKey(userId) {
  return `search_history:${userId}`;
}

// Generate Redis key for a specific search
function getSearchKey(userId, searchId) {
  return `search:${userId}:${searchId}`;
}

// Add a new search to history for a user
async function addSearchForUser(user, searchData) {
  try {
    const client = await getRedisClient();
    const userId = user.id || user.email;
    const now = new Date().toISOString();
    const searchId = Date.now().toString();
    
    const newSearch = {
      id: searchId,
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

    if (client) {
      // Use Redis
      const userKey = getUserSearchHistoryKey(userId);
      const searchKey = getSearchKey(userId, searchId);
      
      // Store the search details
      await client.setEx(searchKey, 30 * 24 * 60 * 60, JSON.stringify(newSearch)); // 30 days TTL
      
      // Add to user's search history list (sorted set by timestamp)
      await client.zAdd(userKey, {
        score: Date.now(),
        value: searchId
      });
      
      // Set TTL for user's search history
      await client.expire(userKey, 30 * 24 * 60 * 60); // 30 days TTL
      
      // Keep only last 50 searches per user
      await client.zRemRangeByRank(userKey, 0, -51); // Remove oldest searches beyond 50
      
      console.log(`💾 Saved search for user ${userId}: "${searchData.searchQuery}" (${newSearch.results.totalCards} cards found)`);
    } else {
      // Fallback to in-memory storage (not recommended for production)
      console.log(`⚠️ Using in-memory fallback for search history - data will be lost on restart`);
      // In a real implementation, you'd want to store this in a database
    }
    
    return newSearch;
  } catch (error) {
    console.error('❌ Error saving search:', error);
    throw error;
  }
}

// Get all saved searches for a user
async function getSearchHistoryForUser(user) {
  try {
    const client = await getRedisClient();
    const userId = user.id || user.email;
    
    if (client) {
      // Use Redis
      const userKey = getUserSearchHistoryKey(userId);
      
      // Get search IDs in reverse chronological order (newest first)
      const searchIds = await client.zRange(userKey, 0, -1, { REV: true });
      
      if (searchIds.length === 0) {
        return [];
      }
      
      // Get all search details
      const searches = [];
      for (const searchId of searchIds) {
        const searchKey = getSearchKey(userId, searchId);
        const searchData = await client.get(searchKey);
        if (searchData) {
          const search = JSON.parse(searchData);
          searches.push({
            ...search,
            createdAt: search.createdAt || search.timestamp || null
          });
        }
      }
      
      return searches;
    } else {
      // Fallback to empty array for in-memory fallback
      console.log(`⚠️ No Redis available, returning empty search history for user ${userId}`);
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading search history:', error);
    return [];
  }
}

// Get all saved searches (for admin purposes)
async function getAllSearchHistory() {
  try {
    const client = await getRedisClient();
    
    if (client) {
      // Use Redis - get all user search history keys
      const userKeys = await client.keys('search_history:*');
      const allSearches = [];
      
      for (const userKey of userKeys) {
        const userId = userKey.replace('search_history:', '');
        const searchIds = await client.zRange(userKey, 0, -1);
        
        for (const searchId of searchIds) {
          const searchKey = getSearchKey(userId, searchId);
          const searchData = await client.get(searchKey);
          if (searchData) {
            allSearches.push(JSON.parse(searchData));
          }
        }
      }
      
      return allSearches;
    } else {
      // Fallback to empty array
      return [];
    }
  } catch (error) {
    console.error('❌ Error loading all search history:', error);
    return [];
  }
}

// Get a specific saved search by ID for a user
async function getSearchByIdForUser(user, searchId) {
  try {
    const client = await getRedisClient();
    const userId = user.id || user.email;
    
    if (client) {
      // Use Redis
      const searchKey = getSearchKey(userId, searchId);
      const searchData = await client.get(searchKey);
      
      if (searchData) {
        return JSON.parse(searchData);
      }
      
      return null;
    } else {
      // Fallback to null
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting search by ID:', error);
    return null;
  }
}

// Delete a saved search for a user
async function deleteSearchForUser(user, searchId) {
  try {
    const client = await getRedisClient();
    const userId = user.id || user.email;
    
    if (client) {
      // Use Redis
      const userKey = getUserSearchHistoryKey(userId);
      const searchKey = getSearchKey(userId, searchId);
      
      // Remove from user's search history list
      await client.zRem(userKey, searchId);
      
      // Delete the search details
      await client.del(searchKey);
      
      console.log(`🗑️ Deleted search ${searchId} for user ${userId}`);
      return true;
    } else {
      // Fallback to false
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting search:', error);
    return false;
  }
}

// Clear all search history for a user
async function clearSearchHistoryForUser(user) {
  try {
    const client = await getRedisClient();
    const userId = user.id || user.email;
    
    if (client) {
      // Use Redis
      const userKey = getUserSearchHistoryKey(userId);
      
      // Get all search IDs for this user
      const searchIds = await client.zRange(userKey, 0, -1);
      
      // Delete all search details
      for (const searchId of searchIds) {
        const searchKey = getSearchKey(userId, searchId);
        await client.del(searchKey);
      }
      
      // Delete the user's search history list
      await client.del(userKey);
      
      console.log(`🗑️ Cleared all search history for user ${userId}`);
      return true;
    } else {
      // Fallback to false
      return false;
    }
  } catch (error) {
    console.error('❌ Error clearing search history:', error);
    return false;
  }
}

// Get search history statistics
async function getSearchHistoryStats() {
  try {
    const client = await getRedisClient();
    
    if (client) {
      // Use Redis
      const userKeys = await client.keys('search_history:*');
      const stats = {
        totalUsers: userKeys.length,
        totalSearches: 0,
        users: []
      };
      
      for (const userKey of userKeys) {
        const userId = userKey.replace('search_history:', '');
        const searchCount = await client.zCard(userKey);
        stats.totalSearches += searchCount;
        stats.users.push({ userId, searchCount });
      }
      
      return stats;
    } else {
      // Fallback to empty stats
      return {
        totalUsers: 0,
        totalSearches: 0,
        users: []
      };
    }
  } catch (error) {
    console.error('❌ Error getting search history stats:', error);
    return {
      totalUsers: 0,
      totalSearches: 0,
      users: []
    };
  }
}

// Legacy functions for backward compatibility
async function addSearch(searchData) {
  // This is a legacy function - in production, you should always use addSearchForUser
  console.log('⚠️ Using legacy addSearch function - please use addSearchForUser instead');
  return addSearchForUser({ id: 'legacy', email: 'legacy@example.com' }, searchData);
}

async function getSearchHistory() {
  // This is a legacy function - in production, you should always use getSearchHistoryForUser
  console.log('⚠️ Using legacy getSearchHistory function - please use getSearchHistoryForUser instead');
  return [];
}

async function getSearchById(searchId) {
  // This is a legacy function - in production, you should always use getSearchByIdForUser
  console.log('⚠️ Using legacy getSearchById function - please use getSearchByIdForUser instead');
  return null;
}

async function deleteSearch(searchId) {
  // This is a legacy function - in production, you should always use deleteSearchForUser
  console.log('⚠️ Using legacy deleteSearch function - please use deleteSearchForUser instead');
  return false;
}

async function clearSearchHistory() {
  // This is a legacy function - in production, you should always use clearSearchHistoryForUser
  console.log('⚠️ Using legacy clearSearchHistory function - please use clearSearchHistoryForUser instead');
  return false;
}

module.exports = {
  addSearchForUser,
  getSearchHistoryForUser,
  getSearchByIdForUser,
  deleteSearchForUser,
  clearSearchHistoryForUser,
  getAllSearchHistory,
  getSearchHistoryStats,
  // Legacy exports (if needed elsewhere)
  addSearch,
  getSearchHistory,
  getSearchById,
  deleteSearch,
  clearSearchHistory
}; 