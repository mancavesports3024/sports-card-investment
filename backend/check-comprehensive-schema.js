const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkComprehensiveSchema() {
    const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    
    console.log('🔍 Checking comprehensive database schema...');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error connecting to comprehensive database:', err.message);
            return;
        }
        console.log('✅ Connected to comprehensive database');
    });
    
    // Get table names
    db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
        if (err) {
            console.error('❌ Error getting tables:', err.message);
            return;
        }
        
        console.log('\n📋 Tables in comprehensive database:');
        tables.forEach(table => {
            console.log(`   • ${table.name}`);
        });
        
        // Check schema of first table
        if (tables.length > 0) {
            const firstTable = tables[0].name;
            console.log(`\n🔍 Schema of table: ${firstTable}`);
            
            db.all(`PRAGMA table_info(${firstTable});`, (err, columns) => {
                if (err) {
                    console.error('❌ Error getting schema:', err.message);
                    return;
                }
                
                console.log('\n📋 Columns:');
                columns.forEach(col => {
                    console.log(`   • ${col.name} (${col.type})`);
                });
                
                // Show a few sample rows
                console.log(`\n📋 Sample data from ${firstTable}:`);
                db.all(`SELECT * FROM ${firstTable} LIMIT 3;`, (err, rows) => {
                    if (err) {
                        console.error('❌ Error getting sample data:', err.message);
                        return;
                    }
                    
                    rows.forEach((row, index) => {
                        console.log(`\n   Row ${index + 1}:`);
                        Object.keys(row).forEach(key => {
                            console.log(`     ${key}: ${row[key]}`);
                        });
                    });
                    
                    db.close();
                });
            });
        }
    });
}

checkComprehensiveSchema();
