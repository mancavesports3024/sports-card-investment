const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function exportPriceResults() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // Query cards with price data
            const query = `
                SELECT 
                    id,
                    title,
                    summaryTitle,
                    sport,
                    rawAveragePrice,
                    psa9AveragePrice,
                    priceComparisons,
                    lastUpdated,
                    updated_at
                FROM cards 
                WHERE rawAveragePrice IS NOT NULL OR psa9AveragePrice IS NOT NULL
                ORDER BY updated_at DESC
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching data:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} cards with price data`);
                
                // Prepare CSV data
                const csvHeaders = [
                    'Card ID',
                    'Summary Title',
                    'Full Title',
                    'Sport',
                    'Raw Average Price',
                    'PSA 9 Average Price',
                    'Raw Card Count',
                    'PSA 9 Card Count',
                    'Price Difference',
                    'Percentage Increase',
                    'Last Updated'
                ];
                
                const csvRows = [csvHeaders.join(',')];
                
                rows.forEach(row => {
                    let rawCount = 0;
                    let psa9Count = 0;
                    let priceDifference = '';
                    let percentageIncrease = '';
                    
                    // Parse price comparisons if available
                    if (row.priceComparisons) {
                        try {
                            const priceData = JSON.parse(row.priceComparisons);
                            rawCount = priceData.raw?.count || 0;
                            psa9Count = priceData.psa9?.count || 0;
                        } catch (e) {
                            console.warn(`⚠️ Could not parse price comparisons for card ${row.id}`);
                        }
                    }
                    
                    // Calculate price difference and percentage
                    if (row.rawAveragePrice && row.psa9AveragePrice) {
                        priceDifference = (row.psa9AveragePrice - row.rawAveragePrice).toFixed(2);
                        percentageIncrease = (((row.psa9AveragePrice - row.rawAveragePrice) / row.rawAveragePrice) * 100).toFixed(1) + '%';
                    }
                    
                    const csvRow = [
                        row.id,
                        `"${(row.summaryTitle || '').replace(/"/g, '""')}"`,
                        `"${(row.title || '').replace(/"/g, '""')}"`,
                        row.sport || '',
                        row.rawAveragePrice ? `$${row.rawAveragePrice.toFixed(2)}` : '',
                        row.psa9AveragePrice ? `$${row.psa9AveragePrice.toFixed(2)}` : '',
                        rawCount,
                        psa9Count,
                        priceDifference ? `$${priceDifference}` : '',
                        percentageIncrease,
                        row.lastUpdated || row.updated_at || ''
                    ];
                    
                    csvRows.push(csvRow.join(','));
                });
                
                // Write CSV file
                const csvContent = csvRows.join('\n');
                const csvPath = path.join(__dirname, 'price-results.csv');
                
                fs.writeFileSync(csvPath, csvContent);
                console.log(`✅ CSV exported to: ${csvPath}`);
                console.log(`📈 Total records: ${rows.length}`);
                
                // Show summary stats
                const cardsWithBothPrices = rows.filter(r => r.rawAveragePrice && r.psa9AveragePrice);
                const cardsWithRawOnly = rows.filter(r => r.rawAveragePrice && !r.psa9AveragePrice);
                const cardsWithPSA9Only = rows.filter(r => !r.rawAveragePrice && r.psa9AveragePrice);
                
                console.log(`\n📊 SUMMARY STATISTICS:`);
                console.log(`Cards with both raw and PSA 9 prices: ${cardsWithBothPrices.length}`);
                console.log(`Cards with raw prices only: ${cardsWithRawOnly.length}`);
                console.log(`Cards with PSA 9 prices only: ${cardsWithPSA9Only.length}`);
                
                if (cardsWithBothPrices.length > 0) {
                    console.log(`\n🏆 TOP 5 BEST PSA 9 UPGRADES (by percentage):`);
                    const topUpgrades = cardsWithBothPrices
                        .map(card => ({
                            title: card.summaryTitle || card.title,
                            raw: card.rawAveragePrice,
                            psa9: card.psa9AveragePrice,
                            increase: ((card.psa9AveragePrice - card.rawAveragePrice) / card.rawAveragePrice) * 100
                        }))
                        .sort((a, b) => b.increase - a.increase)
                        .slice(0, 5);
                    
                    topUpgrades.forEach((card, index) => {
                        console.log(`${index + 1}. ${card.title}`);
                        console.log(`   Raw: $${card.raw.toFixed(2)} → PSA 9: $${card.psa9.toFixed(2)} (+${card.increase.toFixed(1)}%)`);
                    });
                }
                
                db.close();
                resolve(csvPath);
            });
        });
    });
}

// Run the export
if (require.main === module) {
    exportPriceResults()
        .then(csvPath => {
            console.log(`\n🎉 Export complete! Check the file: ${csvPath}`);
        })
        .catch(err => {
            console.error('❌ Export failed:', err);
        });
}

module.exports = { exportPriceResults };
