const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = './data/new-scorecard.db';

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.log('❌ Database not found at:', dbPath);
    process.exit(1);
}

console.log('✅ Database found at:', dbPath);

const db = new sqlite3.Database(dbPath);

// First, let's see what cards we have
db.all(`
    SELECT title, psa10_price, raw_average_price, multiplier 
    FROM cards 
    WHERE title LIKE '%SHAQUILLE%' 
    OR title LIKE '%SHAQ%'
    LIMIT 5
`, (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('\nFound Shaq cards:');
        rows.forEach((row, index) => {
            console.log(`\n${index + 1}. ${row.title}`);
            console.log(`   PSA 10: $${row.psa10_price}`);
            console.log(`   Raw: $${row.raw_average_price}`);
            console.log(`   Multiplier: ${row.multiplier}`);
            
            if (row.psa10_price && row.raw_average_price && row.raw_average_price > 0) {
                const calculatedMultiplier = (row.psa10_price / row.raw_average_price).toFixed(2);
                console.log(`   Calculated: ${calculatedMultiplier}x`);
            }
        });
    }
    db.close();
});
