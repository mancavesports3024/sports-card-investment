const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking Bo Jackson card in database...');

const query = `
    SELECT 
        id,
        title,
        sport,
        raw_average_price,
        psa9_average_price,
        psa10_price,
        created_at
    FROM cards 
    WHERE title LIKE '%Bo Jackson%' AND title LIKE '%Holo Prizm%'
    ORDER BY created_at DESC
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('❌ Error querying database:', err);
        return;
    }
    
    console.log(`\n📊 Found ${rows.length} Bo Jackson cards:`);
    
    rows.forEach((row, index) => {
        console.log(`\nCard ${index + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Title: ${row.title}`);
        console.log(`  Sport: ${row.sport}`);
        console.log(`  PSA 10 Price: $${row.psa10_price || 'N/A'}`);
        console.log(`  Raw Avg Price: $${row.raw_average_price || 'N/A'}`);
        console.log(`  PSA 9 Avg Price: $${row.psa9_average_price || 'N/A'}`);
        console.log(`  Created: ${row.created_at}`);
    });
    
    db.close();
});
