const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkPSA9Pattern() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);
    
    console.log('🔍 Checking PSA 9 price patterns...\n');
    
    // Check for cards with $200.00 PSA 9 prices
    console.log('🔍 Checking for cards with $200.00 PSA 9 prices...\n');
    
    db.all(`
        SELECT id, title, psa9_average_price, psa10_price, raw_average_price
        FROM cards 
        WHERE psa9_average_price = 200.00
        ORDER BY title
        LIMIT 10
    `, [], (err, rows) => {
        if (err) {
            console.error(`❌ Error querying $200 cards: ${err.message}`);
            return;
        }
        
        if (rows.length > 0) {
            console.log(`📊 Found ${rows.length} cards with $200.00 PSA 9 prices:`);
            rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.title}`);
                console.log(`   PSA 9: $${row.psa9_average_price}`);
                console.log(`   PSA 10: $${row.psa10_price || 'N/A'}`);
                console.log(`   Raw: $${row.raw_average_price || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('✅ No cards found with $200.00 PSA 9 prices');
        }
        
        // Check for other common PSA 9 prices
        console.log('🔍 Checking for other common PSA 9 prices...\n');
        
        db.all(`
            SELECT psa9_average_price, COUNT(*) as count
            FROM cards 
            WHERE psa9_average_price IS NOT NULL
            GROUP BY psa9_average_price
            ORDER BY count DESC
            LIMIT 10
        `, [], (err, rows) => {
            if (err) {
                console.error(`❌ Error querying PSA 9 patterns: ${err.message}`);
                return;
            }
            
            if (rows.length > 0) {
                console.log(`📊 PSA 9 price distribution:`);
                rows.forEach((row, index) => {
                    console.log(`${index + 1}. $${row.psa9_average_price}: ${row.count} cards`);
                });
            }
            
            // Close database
            db.close();
            console.log('\n✅ PSA 9 pattern check complete');
        });
    });
}

checkPSA9Pattern().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
