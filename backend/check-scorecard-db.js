const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
const db = new sqlite3.Database(dbPath);

// Check what tables exist
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Tables in new-scorecard database:', rows);
    }
    
    // Check the structure of the cards table if it exists
    if (rows && rows.some(row => row.name === 'cards')) {
        db.all(`PRAGMA table_info(cards)`, [], (err, columns) => {
            if (err) {
                console.error('Error:', err);
            } else {
                console.log(`\nColumns in cards table:`, columns);
            }
            
            // Get a sample of data
            db.all(`SELECT * FROM cards LIMIT 3`, [], (err, sample) => {
                if (err) {
                    console.error('Error:', err);
                } else {
                    console.log(`\nSample data from cards table:`, sample);
                }
                
                // Check for Heritage sets
                db.all("SELECT DISTINCT cardSet, COUNT(*) as count FROM cards WHERE cardSet LIKE '%Heritage%' GROUP BY cardSet", [], (err, heritageRows) => {
                    if (err) {
                        console.error('Error:', err);
                    } else {
                        console.log(`\nHeritage sets in database:`, heritageRows);
                    }
                    db.close();
                });
            });
        });
    } else {
        console.log('No cards table found');
        db.close();
    }
});
