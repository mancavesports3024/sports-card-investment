const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
const db = new sqlite3.Database(dbPath);

// Check what tables exist
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Tables in comprehensive database:', rows);
    }
    
    // Check the structure of the main table
    if (rows && rows.length > 0) {
        const mainTable = rows[0].name;
        db.all(`PRAGMA table_info(${mainTable})`, [], (err, columns) => {
            if (err) {
                console.error('Error:', err);
            } else {
                console.log(`\nColumns in ${mainTable}:`, columns);
            }
            
            // Get a sample of data
            db.all(`SELECT * FROM ${mainTable} LIMIT 3`, [], (err, sample) => {
                if (err) {
                    console.error('Error:', err);
                } else {
                    console.log(`\nSample data from ${mainTable}:`, sample);
                }
                db.close();
            });
        });
    } else {
        db.close();
    }
});
