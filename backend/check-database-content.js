const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkDatabaseContent() {
    console.log('🔍 Checking Database Content and Structure\n');
    console.log('==========================================\n');

    try {
        const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        console.log(`📁 Database path: ${dbPath}\n`);

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('❌ Database connection failed:', err.message);
                return;
            }
            console.log('✅ Connected to database\n');
        });

        // Get all tables
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log('📋 Tables found:');
        tables.forEach(table => {
            console.log(`   - ${table.name}`);
        });
        console.log('');

        // Check each table for data
        for (const table of tables) {
            const tableName = table.name;
            
            // Get row count
            const countResult = await new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            console.log(`📊 Table: ${tableName} - ${countResult.count} rows`);

            // Get sample data if table has rows
            if (countResult.count > 0) {
                const sampleData = await new Promise((resolve, reject) => {
                    db.all(`SELECT * FROM ${tableName} LIMIT 3`, [], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                console.log(`   Sample data:`);
                sampleData.forEach((row, index) => {
                    console.log(`   Row ${index + 1}:`, JSON.stringify(row, null, 2));
                });
            }
            console.log('');
        }

        db.close();
        console.log('✅ Database check completed!');

    } catch (error) {
        console.error('❌ Error checking database:', error);
    }
}

// Run the check
checkDatabaseContent();



