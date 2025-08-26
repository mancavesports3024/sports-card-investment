const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use Railway volume mount path if available (production), otherwise use local path
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
    : path.join(__dirname, 'data', 'new-scorecard.db');

console.log('🔍 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        return;
    }
    console.log('✅ Connected to database');
});

// Check table structure
db.all("PRAGMA table_info(cards)", [], (err, rows) => {
    if (err) {
        console.error('❌ Error getting table info:', err.message);
        return;
    }
    
    console.log('\n📋 Cards table structure:');
    console.log('Column Name | Type | Not Null | Default | Primary Key');
    console.log('------------|------|----------|---------|-------------');
    
    rows.forEach(column => {
        console.log(`${column.name.padEnd(12)} | ${column.type.padEnd(4)} | ${column.notnull ? 'Yes' : 'No'.padEnd(8)} | ${(column.dflt_value || '').padEnd(7)} | ${column.pk ? 'Yes' : 'No'}`);
    });
    
    // Get sample data
    db.all("SELECT * FROM cards LIMIT 3", [], (err, rows) => {
        if (err) {
            console.error('❌ Error getting sample data:', err.message);
            return;
        }
        
        console.log('\n📊 Sample data from cards table:');
        if (rows.length > 0) {
            console.log('Available columns:', Object.keys(rows[0]));
            console.log('\nSample records:');
            rows.forEach((row, index) => {
                console.log(`\nRecord ${index + 1}:`);
                Object.entries(row).forEach(([key, value]) => {
                    console.log(`  ${key}: ${value}`);
                });
            });
        } else {
            console.log('No data found in cards table');
        }
        
        // Close database
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err.message);
            } else {
                console.log('✅ Database connection closed');
            }
        });
    });
});
