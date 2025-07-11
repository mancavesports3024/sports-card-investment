const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use Railway's persistent volume if available, otherwise fall back to local data directory
const DB_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH 
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'search_history.db')
  : path.join(__dirname, '../data/search_history.db');

console.log('📁 Database file location:', DB_PATH);

let db;

// Initialize database
function initDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('✅ Connected to SQLite database');
      
      // Create table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS search_history (
          id TEXT PRIMARY KEY,
          userId TEXT,
          query TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          totalCards INTEGER,
          rawCount INTEGER,
          psa9Count INTEGER,
          psa10Count INTEGER,
          priceAnalysis TEXT
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating table:', err);
          reject(err);
          return;
        }
        console.log('✅ Search history table ready');
        resolve();
      });
    });
  });
}

// Add a new search to history
async function addSearchForUser(user, searchData) {
  return new Promise((resolve, reject) => {
    const userId = user.id || user.email;
    const searchId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const totalCards = searchData.results?.raw?.length + searchData.results?.psa9?.length + searchData.results?.psa10?.length || 0;
    const rawCount = searchData.results?.raw?.length || 0;
    const psa9Count = searchData.results?.psa9?.length || 0;
    const psa10Count = searchData.results?.psa10?.length || 0;
    const priceAnalysis = searchData.priceAnalysis ? JSON.stringify(searchData.priceAnalysis) : null;
    
    db.run(`
      INSERT INTO search_history (id, userId, query, timestamp, totalCards, rawCount, psa9Count, psa10Count, priceAnalysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [searchId, userId, searchData.searchQuery, timestamp, totalCards, rawCount, psa9Count, psa10Count, priceAnalysis], function(err) {
      if (err) {
        console.error('❌ Error saving search:', err);
        reject(err);
        return;
      }
      
      console.log(`💾 Saved search for user ${userId}: "${searchData.searchQuery}" (${totalCards} cards found)`);
      
      // Keep only last 50 searches per user
      db.run(`
        DELETE FROM search_history 
        WHERE userId = ? AND id NOT IN (
          SELECT id FROM search_history 
          WHERE userId = ? 
          ORDER BY timestamp DESC 
          LIMIT 50
        )
      `, [userId, userId]);
      
      resolve({
        id: searchId,
        userId,
        query: searchData.searchQuery,
        timestamp,
        results: { totalCards, raw: rawCount, psa9: psa9Count, psa10: psa10Count },
        priceAnalysis: searchData.priceAnalysis
      });
    });
  });
}

// Get search history for a user
async function getSearchHistoryForUser(user) {
  return new Promise((resolve, reject) => {
    const userId = user.id || user.email;
    
    db.all(`
      SELECT * FROM search_history 
      WHERE userId = ? 
      ORDER BY timestamp DESC
    `, [userId], (err, rows) => {
      if (err) {
        console.error('❌ Error loading search history:', err);
        reject(err);
        return;
      }
      
      const history = rows.map(row => ({
        id: row.id,
        userId: row.userId,
        query: row.query,
        timestamp: row.timestamp,
        results: {
          totalCards: row.totalCards,
          raw: row.rawCount,
          psa9: row.psa9Count,
          psa10: row.psa10Count
        },
        priceAnalysis: row.priceAnalysis ? JSON.parse(row.priceAnalysis) : null
      }));
      
      resolve(history);
    });
  });
}

// Delete a search for a user
async function deleteSearchForUser(user, searchId) {
  return new Promise((resolve, reject) => {
    const userId = user.id || user.email;
    
    db.run(`
      DELETE FROM search_history 
      WHERE id = ? AND userId = ?
    `, [searchId, userId], function(err) {
      if (err) {
        console.error('❌ Error deleting search:', err);
        reject(err);
        return;
      }
      
      console.log(`🗑️ Deleted search ${searchId} for user ${userId}`);
      resolve(this.changes > 0);
    });
  });
}

// Clear all search history for a user
async function clearSearchHistoryForUser(user) {
  return new Promise((resolve, reject) => {
    const userId = user.id || user.email;
    
    db.run(`
      DELETE FROM search_history 
      WHERE userId = ?
    `, [userId], function(err) {
      if (err) {
        console.error('❌ Error clearing search history:', err);
        reject(err);
        return;
      }
      
      console.log(`🗑️ Cleared all search history for user ${userId}`);
      resolve(true);
    });
  });
}

// Initialize database on module load
initDB().catch(console.error);

module.exports = {
  addSearchForUser,
  getSearchHistoryForUser,
  deleteSearchForUser,
  clearSearchHistoryForUser
}; 