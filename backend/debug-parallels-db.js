const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'parallels-database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Debugging parallels database...\n');

// Check card_sets table
db.all("SELECT * FROM card_sets", [], (err, rows) => {
    if (err) {
        console.error('Error querying card_sets:', err);
    } else {
        console.log('Card sets table:');
        console.log(rows);
    }
    
    // Check parallels table
    db.all("SELECT * FROM parallels", [], (err, rows) => {
        if (err) {
            console.error('Error querying parallels:', err);
        } else {
            console.log('\nParallels table:');
            console.log(rows);
        }
        
        // Check the count query
        db.all(`
            SELECT cs.set_name, cs.sport, cs.year, cs.brand, COUNT(p.id) as parallel_count
            FROM card_sets cs
            LEFT JOIN parallels p ON cs.id = p.set_id
            GROUP BY cs.id
            ORDER BY cs.set_name
        `, [], (err, rows) => {
            if (err) {
                console.error('Error with count query:', err);
            } else {
                console.log('\nCount query result:');
                console.log(rows);
            }
            db.close();
        });
    });
});
