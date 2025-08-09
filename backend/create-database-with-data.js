const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function createDatabaseWithData() {
    console.log('🗄️ Creating SQLite database with real card data...');
    console.log('================================================');
    
    try {
        // Load JSON data
        const jsonPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        console.log(`📊 Loading data from: ${jsonPath}`);
        
        if (!fs.existsSync(jsonPath)) {
            console.error(`❌ JSON file not found: ${jsonPath}`);
            return;
        }
        
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const items = jsonData.items || jsonData;
        
        console.log(`📈 Found ${items.length} cards to add to database`);
        
        // Create new database file
        const dbPath = path.join(__dirname, 'data', 'scorecard_with_data.db');
        console.log(`🗄️ Creating database at: ${dbPath}`);
        
        // Remove existing file if it exists
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('🗑️ Removed existing database file');
        }
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Error creating database:', err);
                    reject(err);
                } else {
                    console.log('✅ Database created successfully');
                    
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
                            
                            // Create indexes
                            db.run('CREATE INDEX IF NOT EXISTS idx_missing_prices ON cards(rawAveragePrice, psa9AveragePrice)', (err) => {
                                if (err) console.error('❌ Error creating missing prices index:', err);
                                else console.log('✅ Missing prices index created');
                            });
                            
                            db.run('CREATE INDEX IF NOT EXISTS idx_sport ON cards(sport)', (err) => {
                                if (err) console.error('❌ Error creating sport index:', err);
                                else console.log('✅ Sport index created');
                            });
                            
                            db.run('CREATE INDEX IF NOT EXISTS idx_last_updated ON cards(lastUpdated)', (err) => {
                                if (err) console.error('❌ Error creating last updated index:', err);
                                else console.log('✅ Last updated index created');
                            });
                            
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
                                        console.log(`📈 Inserted ${inserted}/${items.length} cards...`);
                                    }
                                });
                                
                                stmt.finalize(() => {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('❌ Error committing transaction:', err);
                                            reject(err);
                                        } else {
                                            console.log(`✅ Successfully inserted ${inserted} cards`);
                                            
                                            // Verify insertion
                                            db.get('SELECT COUNT(*) as count FROM cards', (err, row) => {
                                                if (err) {
                                                    console.error('❌ Error verifying insertion:', err);
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
                                                            console.log(`🔄 ${row.count} cards missing price data`);
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
                        }
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error during database creation:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    createDatabaseWithData().then(() => {
        console.log('\n🎉 Database creation completed successfully!');
        console.log('📁 Database file: data/scorecard_with_data.db');
        console.log('💡 You can now copy this file to Railway or use it locally');
    }).catch((error) => {
        console.error('\n❌ Database creation failed:', error.message);
        process.exit(1);
    });
}

module.exports = { createDatabaseWithData };
