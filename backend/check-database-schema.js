const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking database schema...');

// Get table info
db.all("PRAGMA table_info(cards)", [], (err, columns) => {
    if (err) {
        console.error('❌ Error getting table info:', err);
        return;
    }
    
    console.log('\n📋 CARDS TABLE COLUMNS:');
    columns.forEach(col => {
        console.log(`  ${col.name} (${col.type})`);
    });
    
    // Get sample data
    db.all("SELECT * FROM cards LIMIT 3", [], (err, rows) => {
        if (err) {
            console.error('❌ Error getting sample data:', err);
            return;
        }
        
        console.log('\n📊 SAMPLE DATA:');
        rows.forEach((row, index) => {
            console.log(`\nRow ${index + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        });
        
        // Get total count
        db.get("SELECT COUNT(*) as count FROM cards", [], (err, result) => {
            if (err) {
                console.error('❌ Error getting count:', err);
            } else {
                console.log(`\n📈 TOTAL CARDS: ${result.count}`);
            }
            db.close();
        });
    });
});
