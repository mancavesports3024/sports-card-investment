const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkDatabasePrices() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);
    
    console.log('🔍 Checking database prices...\n');
    
    // Check the specific cards mentioned in the user's query
    const cardsToCheck = [
        "2024 Panini Prizm Prizm Flashback Rome Odunze #6 Silver Prizm",
        "2020 Topps Chrome F1 Lando Norris Portrait Card #7 McLaren",
        "2024 Topps Chrome Update JACKSON MERRILL #USC153",
        "2020 Panini Select Justin Herbert WHITE PRIZM /35"
    ];
    
    for (const cardTitle of cardsToCheck) {
        console.log(`📋 Checking: ${cardTitle}`);
        
        db.get(`
            SELECT id, title, psa10_price, raw_average_price, psa9_average_price, psa10_average_price, last_updated
            FROM cards 
            WHERE title LIKE ?
        `, [`%${cardTitle}%`], (err, row) => {
            if (err) {
                console.error(`❌ Error querying card: ${err.message}`);
                return;
            }
            
            if (row) {
                console.log(`✅ Found card:`);
                console.log(`   ID: ${row.id}`);
                console.log(`   Title: ${row.title}`);
                console.log(`   PSA 10 Price: $${row.psa10_price || 'N/A'}`);
                console.log(`   Raw Average: $${row.raw_average_price || 'N/A'}`);
                console.log(`   PSA 9 Average: $${row.psa9_average_price || 'N/A'}`);
                console.log(`   PSA 10 Average: $${row.psa10_average_price || 'N/A'}`);
                console.log(`   Last Updated: ${row.last_updated || 'N/A'}`);
            } else {
                console.log(`❌ Card not found in database`);
            }
            console.log('');
        });
    }
    
    // Also check for any cards with $324.00 PSA 9 prices
    console.log('🔍 Checking for cards with $324.00 PSA 9 prices...\n');
    
    db.all(`
        SELECT id, title, psa9_average_price, psa10_price, raw_average_price
        FROM cards 
        WHERE psa9_average_price = 324.00
        ORDER BY title
    `, [], (err, rows) => {
        if (err) {
            console.error(`❌ Error querying $324 cards: ${err.message}`);
            return;
        }
        
        if (rows.length > 0) {
            console.log(`📊 Found ${rows.length} cards with $324.00 PSA 9 prices:`);
            rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.title}`);
                console.log(`   PSA 9: $${row.psa9_average_price}`);
                console.log(`   PSA 10: $${row.psa10_price || 'N/A'}`);
                console.log(`   Raw: $${row.raw_average_price || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('✅ No cards found with $324.00 PSA 9 prices');
        }
        
        // Close database
        db.close();
        console.log('✅ Database check complete');
    });
}

checkDatabasePrices().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
