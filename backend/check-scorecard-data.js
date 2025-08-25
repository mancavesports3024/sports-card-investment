const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking new-scorecard database data...');

// Check total count
db.get("SELECT COUNT(*) as total FROM cards", [], (err, row) => {
    if (err) {
        console.error('Error getting count:', err);
    } else {
        console.log(`📊 Total cards in database: ${row.total}`);
    }
    
    // Check for cards with set_name
    db.get("SELECT COUNT(*) as count FROM cards WHERE set_name IS NOT NULL AND set_name != ''", [], (err, row) => {
        if (err) {
            console.error('Error getting set_name count:', err);
        } else {
            console.log(`📋 Cards with set_name: ${row.count}`);
        }
        
        // Get sample data
        db.all("SELECT id, title, set_name, year, brand, sport FROM cards LIMIT 5", [], (err, rows) => {
            if (err) {
                console.error('Error getting sample data:', err);
            } else {
                console.log('\n📝 Sample data:');
                rows.forEach((row, index) => {
                    console.log(`${index + 1}. ID: ${row.id}`);
                    console.log(`   Title: ${row.title}`);
                    console.log(`   Set: ${row.set_name || 'NULL'}`);
                    console.log(`   Year: ${row.year || 'NULL'}`);
                    console.log(`   Brand: ${row.brand || 'NULL'}`);
                    console.log(`   Sport: ${row.sport || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Check unique set names
            db.all("SELECT DISTINCT set_name, COUNT(*) as count FROM cards WHERE set_name IS NOT NULL AND set_name != '' GROUP BY set_name ORDER BY count DESC LIMIT 10", [], (err, rows) => {
                if (err) {
                    console.error('Error getting unique sets:', err);
                } else {
                    console.log('🏷️  Top 10 unique set names:');
                    rows.forEach((row, index) => {
                        console.log(`${index + 1}. ${row.set_name} (${row.count} cards)`);
                    });
                }
                
                db.close();
            });
        });
    });
});
