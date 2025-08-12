// Script to check what tables exist in the Railway database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkRailwayDatabase() {
    return new Promise((resolve, reject) => {
        // Use Railway database path
        const dbPath = path.join(__dirname, 'new-scorecard.db');
        
        console.log('🔍 Checking Railway database structure...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to Railway SQLite database');
            
            // Get all table names
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching tables:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} tables in the database:`);
                rows.forEach(row => {
                    console.log(`   • ${row.name}`);
                });
                
                if (rows.length === 0) {
                    console.log('❌ No tables found in the database!');
                } else {
                    // Check if cards table exists
                    const hasCardsTable = rows.some(row => row.name === 'cards');
                    console.log(`\n🎯 Cards table exists: ${hasCardsTable ? 'YES' : 'NO'}`);
                    
                    if (hasCardsTable) {
                        // Check cards table structure
                        db.all("PRAGMA table_info(cards)", (err, columns) => {
                            if (err) {
                                console.error('❌ Error fetching cards table structure:', err);
                            } else {
                                console.log(`\n📋 Cards table structure:`);
                                columns.forEach(col => {
                                    console.log(`   • ${col.name} (${col.type})`);
                                });
                            }
                            db.close();
                            resolve();
                        });
                    } else {
                        db.close();
                        resolve();
                    }
                }
            });
        });
    });
}

// Export the function for use in API endpoint
module.exports = { checkRailwayDatabase };

// Run the check if called directly
if (require.main === module) {
    checkRailwayDatabase().catch(console.error);
}
