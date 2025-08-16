const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkComprehensiveDatabase() {
    console.log('🔍 Checking Comprehensive Database...\n');
    
    const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    console.log('Database path:', dbPath);
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Database connection failed:', err.message);
            return;
        }
        console.log('✅ Connected to comprehensive database');
        
        // Check what tables exist
        db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
            if (err) {
                console.error('❌ Error getting tables:', err);
            } else {
                console.log('\n📋 Tables found:');
                tables.forEach(table => {
                    console.log(`   - ${table.name}`);
                });
                
                // If cards table exists, check its structure
                const cardsTable = tables.find(t => t.name === 'cards');
                if (cardsTable) {
                    console.log('\n🔍 Checking cards table structure...');
                    db.all('PRAGMA table_info(cards)', (err, columns) => {
                        if (err) {
                            console.error('❌ Error getting table info:', err);
                        } else {
                            console.log('\n📊 Cards table columns:');
                            columns.forEach(col => {
                                console.log(`   - ${col.name} (${col.type})`);
                            });
                            
                            // Check how many cards are in the table
                            db.get('SELECT COUNT(*) as count FROM cards', (err, result) => {
                                if (err) {
                                    console.error('❌ Error counting cards:', err);
                                } else {
                                    console.log(`\n📈 Total cards in comprehensive database: ${result.count}`);
                                    
                                    // Show a few sample cards
                                    if (result.count > 0) {
                                        console.log('\n📋 Sample cards:');
                                        db.all('SELECT id, title, player_name, summary_title FROM cards LIMIT 5', (err, cards) => {
                                            if (err) {
                                                console.error('❌ Error getting sample cards:', err);
                                            } else {
                                                cards.forEach((card, index) => {
                                                    console.log(`\n   Card ${index + 1}:`);
                                                    console.log(`     ID: ${card.id}`);
                                                    console.log(`     Title: ${card.title}`);
                                                    console.log(`     Player Name: ${card.player_name}`);
                                                    console.log(`     Summary Title: ${card.summary_title}`);
                                                });
                                            }
                                            db.close();
                                        });
                                    } else {
                                        console.log('\n⚠️  No cards found in comprehensive database');
                                        db.close();
                                    }
                                }
                            });
                        }
                    });
                } else {
                    console.log('\n⚠️  No cards table found in comprehensive database');
                    db.close();
                }
            }
        });
    });
}

checkComprehensiveDatabase().catch(error => {
    console.error('❌ Script failed:', error);
});

