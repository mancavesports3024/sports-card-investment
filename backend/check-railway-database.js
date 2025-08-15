const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkRailwayDatabase() {
    console.log('🔍 Checking Railway database structure...');
    
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('❌ Error connecting to Railway database:', err.message);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to Railway database');
            
            // Check table structure
            db.all("PRAGMA table_info(cards)", (err, columns) => {
                if (err) {
                    console.error('❌ Error checking table structure:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('📋 Cards table columns:');
                columns.forEach(col => {
                    console.log(`   - ${col.name} (${col.type})`);
                });
                
                // Check card count
                db.get("SELECT COUNT(*) as count FROM cards", (err, result) => {
                    if (err) {
                        console.error('❌ Error counting cards:', err.message);
                        reject(err);
                        return;
                    }
                    
                    console.log(`📊 Total cards in Railway database: ${result.count}`);
                    
                    // Check for player_name column
                    const hasPlayerName = columns.some(col => col.name === 'player_name');
                    console.log(`🎯 Player name column exists: ${hasPlayerName ? '✅ Yes' : '❌ No'}`);
                    
                    // Check sample cards
                    db.all("SELECT id, title, sport, player_name FROM cards LIMIT 5", (err, cards) => {
                        if (err) {
                            console.error('❌ Error fetching sample cards:', err.message);
                            reject(err);
                            return;
                        }
                        
                        console.log('\n📋 Sample cards:');
                        cards.forEach((card, i) => {
                            console.log(`${i + 1}. ID: ${card.id}`);
                            console.log(`   Title: ${card.title}`);
                            console.log(`   Sport: ${card.sport || 'Unknown'}`);
                            console.log(`   Player: ${card.player_name || 'Not set'}`);
                        });
                        
                        db.close();
                        console.log('\n✅ Railway database check completed!');
                        resolve();
                    });
                });
            });
        });
    });
}

module.exports = { checkRailwayDatabase };

// Run if called directly
if (require.main === module) {
    checkRailwayDatabase().catch(console.error);
}
