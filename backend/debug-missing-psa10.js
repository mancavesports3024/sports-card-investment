const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter } = require('./ultimate-multi-sport-filtering-system');

async function debugMissingPSA10() {
    console.log('🔍 Debugging Missing PSA 10 Prices...\n');
    
    const updater = new FastSQLitePriceUpdater();
    
    try {
        await updater.connect();
        
        // Check the specific cards in the database
        const cards = [
            'Ladd McConkey',
            'Jaxson Dart', 
            'Xavier Worthy'
        ];
        
        for (const playerName of cards) {
            console.log(`\n📊 Checking ${playerName} in database...`);
            
            const card = await new Promise((resolve, reject) => {
                updater.db.get(`
                    SELECT id, title, summary_title, psa10_price, raw_average_price, psa9_average_price, multiplier
                    FROM cards 
                    WHERE title LIKE '%${playerName}%' OR summary_title LIKE '%${playerName}%'
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (card) {
                console.log(`  ID: ${card.id}`);
                console.log(`  Title: ${card.title}`);
                console.log(`  Summary: ${card.summary_title}`);
                console.log(`  PSA 10 Price: ${card.psa10_price || 'N/A'}`);
                console.log(`  Raw Price: ${card.raw_average_price || 'N/A'}`);
                console.log(`  PSA 9 Price: ${card.psa9_average_price || 'N/A'}`);
                console.log(`  Multiplier: ${card.multiplier || 'N/A'}`);
                
                // Test PSA 10 search for this specific card
                console.log(`\n🔍 Testing PSA 10 search for: ${card.title}`);
                
                const searchQueries = [
                    `${card.title} PSA 10`,
                    `${card.summary_title} PSA 10`,
                    `${playerName} PSA 10`
                ];
                
                for (const query of searchQueries) {
                    console.log(`\n📝 Testing: "${query}"`);
                    
                    try {
                        const results = await search130point(query, 20);
                        console.log(`  Raw results: ${results.length}`);
                        
                        if (results.length > 0) {
                            console.log('  First 3 results:');
                            results.slice(0, 3).forEach((result, index) => {
                                console.log(`    ${index + 1}. ${result.title}`);
                                console.log(`       Price: $${result.price?.value || 'N/A'}`);
                                console.log(`       Grade: ${result.grade || 'N/A'}`);
                            });
                            
                            // Test PSA 10 filtering
                            const psa10Results = results.filter(card => {
                                const isPSA10 = ultimateMultiSportFilter(card, 'psa10');
                                console.log(`    Checking: "${card.title}" - PSA 10: ${isPSA10}`);
                                return isPSA10;
                            });
                            
                            console.log(`  PSA 10 filtered results: ${psa10Results.length}`);
                            
                            if (psa10Results.length > 0) {
                                console.log('  PSA 10 results:');
                                psa10Results.forEach((result, index) => {
                                    console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
                                });
                                
                                const avgPrice = psa10Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa10Results.length;
                                console.log(`  Average PSA 10 price: $${avgPrice.toFixed(2)}`);
                            } else {
                                console.log('  ❌ No PSA 10 results found after filtering');
                            }
                        } else {
                            console.log('  ❌ No results found');
                        }
                        
                    } catch (error) {
                        console.error(`  ❌ Error searching "${query}":`, error.message);
                    }
                }
            } else {
                console.log(`  ❌ Card not found in database`);
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        if (updater.db) {
            updater.db.close();
        }
    }
}

debugMissingPSA10().catch(console.error);
