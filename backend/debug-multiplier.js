const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function debugMultiplier() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);
    
    try {
        console.log('🔍 Checking multiplier values in database...\n');
        
        // Get sample cards with multiplier values
        const cards = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, title, psa10_price, raw_average_price, multiplier 
                FROM cards 
                WHERE multiplier IS NOT NULL 
                AND psa10_price IS NOT NULL 
                AND raw_average_price IS NOT NULL
                ORDER BY multiplier DESC
                LIMIT 10
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('Top 10 cards by multiplier:');
        console.log('ID | PSA10 Price | Raw Avg Price | Stored Multiplier | Calculated Multiplier');
        console.log('---|-------------|---------------|-------------------|---------------------');
        
        for (const card of cards) {
            const calculated = (card.psa10_price / card.raw_average_price).toFixed(2);
            console.log(`${card.id} | $${card.psa10_price} | $${card.raw_average_price} | ${card.multiplier}x | ${calculated}x`);
        }
        
        console.log('\n🔍 Checking for specific 6.96 multiplier...');
        
        const specificCards = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, title, psa10_price, raw_average_price, multiplier 
                FROM cards 
                WHERE multiplier = 6.96
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (specificCards.length > 0) {
            console.log('\nCards with 6.96x multiplier:');
            for (const card of specificCards) {
                const calculated = (card.psa10_price / card.raw_average_price).toFixed(2);
                console.log(`ID: ${card.id}`);
                console.log(`Title: ${card.title}`);
                console.log(`PSA10: $${card.psa10_price}, Raw: $${card.raw_average_price}`);
                console.log(`Stored: ${card.multiplier}x, Calculated: ${calculated}x`);
                console.log('---');
            }
        } else {
            console.log('No cards found with 6.96x multiplier');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        db.close();
    }
}

debugMultiplier();

