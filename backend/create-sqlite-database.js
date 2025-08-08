const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function createDatabase() {
    console.log('🗄️ Creating SQLite database...');
    
    // Debug: Log current directory and paths
    console.log(`📁 Current directory: ${__dirname}`);
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    console.log(`📁 Data directory path: ${dataDir}`);
    
    if (!fs.existsSync(dataDir)) {
        console.log('📁 Creating data directory...');
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const dbPath = path.join(dataDir, 'scorecard.db');
    console.log(`🗄️ Database path: ${dbPath}`);
    
    // Check if path is valid
    if (!dbPath || dbPath === 'null' || dbPath === 'undefined') {
        throw new Error(`Invalid database path: ${dbPath}`);
    }
    
    // Ensure the path is absolute
    const absolutePath = path.resolve(dbPath);
    console.log(`🗄️ Absolute database path: ${absolutePath}`);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(absolutePath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err);
                reject(err);
            } else {
                console.log('✅ Database opened successfully');
                
                // Create cards table
                db.run(`
                    CREATE TABLE IF NOT EXISTS cards (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        summaryTitle TEXT,
                        psa10Price REAL,
                        psa10PriceDate TEXT,
                        rawAveragePrice REAL,
                        psa9AveragePrice REAL,
                        sport TEXT,
                        filterInfo TEXT,
                        priceComparisons TEXT,
                        lastUpdated TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating cards table:', err);
                        reject(err);
                    } else {
                        console.log('✅ Cards table created successfully');
                        
                        // Create indexes for fast queries
                        db.run('CREATE INDEX IF NOT EXISTS idx_missing_prices ON cards(rawAveragePrice, psa9AveragePrice)', (err) => {
                            if (err) {
                                console.error('❌ Error creating missing prices index:', err);
                            } else {
                                console.log('✅ Missing prices index created');
                            }
                        });
                        
                        db.run('CREATE INDEX IF NOT EXISTS idx_sport ON cards(sport)', (err) => {
                            if (err) {
                                console.error('❌ Error creating sport index:', err);
                            } else {
                                console.log('✅ Sport index created');
                            }
                        });
                        
                        db.run('CREATE INDEX IF NOT EXISTS idx_last_updated ON cards(lastUpdated)', (err) => {
                            if (err) {
                                console.error('❌ Error creating last updated index:', err);
                            } else {
                                console.log('✅ Last updated index created');
                            }
                        });
                        
                        console.log('✅ Database schema created successfully');
                        resolve(db);
                    }
                });
            }
        });
    });
}

async function migrateData() {
    console.log('📦 Migrating data from JSON to SQLite...');
    
    try {
        // Load JSON data
        const jsonPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const items = jsonData.items || jsonData;
        
        console.log(`📊 Found ${items.length} cards to migrate`);
        
        // Create database
            const db = await createDatabase();
    
    return new Promise((resolve, reject) => {
        // Begin transaction for faster inserts
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            const stmt = db.prepare(`
                INSERT INTO cards (
                    title, summaryTitle, psa10Price, psa10PriceDate,
                    rawAveragePrice, psa9AveragePrice, sport, filterInfo,
                    priceComparisons, lastUpdated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let inserted = 0;
            
            items.forEach((card) => {
                // Extract price comparison data
                let rawPrice = null;
                let psa9Price = null;
                let priceComparisons = null;
                
                if (card.priceComparisons) {
                    rawPrice = card.priceComparisons.raw?.avgPrice || null;
                    psa9Price = card.priceComparisons.psa9?.avgPrice || null;
                    priceComparisons = JSON.stringify(card.priceComparisons);
                }
                
                stmt.run([
                    card.title || '',
                    card.summaryTitle || '',
                    card.psa10Price || null,
                    card.psa10PriceDate || null,
                    rawPrice,
                    psa9Price,
                    card.sport || null,
                    card.filterInfo ? JSON.stringify(card.filterInfo) : null,
                    priceComparisons,
                    card.lastUpdated || null
                ]);
                
                inserted++;
                
                if (inserted % 1000 === 0) {
                    console.log(`📈 Migrated ${inserted}/${items.length} cards...`);
                }
            });
            
            stmt.finalize(() => {
                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('❌ Error committing transaction:', err);
                        reject(err);
                    } else {
                        console.log(`✅ Successfully migrated ${inserted} cards to SQLite`);
                        
                        // Verify migration
                        db.get('SELECT COUNT(*) as count FROM cards', (err, row) => {
                            if (err) {
                                console.error('❌ Error verifying migration:', err);
                            } else {
                                console.log(`📊 Database now contains ${row.count} cards`);
                                
                                // Check missing prices
                                db.get(`
                                    SELECT COUNT(*) as count 
                                    FROM cards 
                                    WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL
                                `, (err, row) => {
                                    if (err) {
                                        console.error('❌ Error checking missing prices:', err);
                                    } else {
                                        console.log(`🔄 ${row.count} cards still missing price data`);
                                    }
                                    db.close();
                                    resolve();
                                });
                            }
                        });
                    }
                });
            });
        });
    });
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
        throw error;
    }
}

// Export functions for use in other modules
module.exports = { createDatabase, migrateData };

// Run migration if called directly
if (require.main === module) {
    migrateData().then(() => {
        console.log('🎉 Database migration completed successfully!');
    }).catch((error) => {
        console.error('❌ Migration failed:', error);
    });
} 