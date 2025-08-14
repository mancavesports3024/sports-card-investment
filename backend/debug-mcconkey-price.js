const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter } = require('./ultimate-multi-sport-filtering-system');

async function debugMcConkeyPrice() {
    console.log('🔍 Debugging Ladd McConkey PSA 10 Price Search...\n');
    
    const updater = new FastSQLitePriceUpdater();
    
    try {
        await updater.connect();
        
        // Find the specific card in the database
        console.log('📊 Looking for Ladd McConkey card in database...');
        const card = await new Promise((resolve, reject) => {
            updater.db.get(`
                SELECT id, title, summary_title, psa10_price, raw_average_price, psa9_average_price
                FROM cards 
                WHERE title LIKE '%Ladd McConkey%' OR summary_title LIKE '%Ladd McConkey%'
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (card) {
            console.log('✅ Found card in database:');
            console.log(`  ID: ${card.id}`);
            console.log(`  Title: ${card.title}`);
            console.log(`  Summary: ${card.summary_title}`);
            console.log(`  PSA 10 Price: ${card.psa10_price || 'N/A'}`);
            console.log(`  Raw Price: ${card.raw_average_price || 'N/A'}`);
            console.log(`  PSA 9 Price: ${card.psa9_average_price || 'N/A'}`);
        } else {
            console.log('❌ Card not found in database');
            return;
        }
        
        // Test different search strategies
        console.log('\n🔍 Testing search strategies...');
        
        const searchQueries = [
            '2024 Ladd McConkey Topps Chrome Pink Refractor',
            '2024 Ladd McConkey Topps Chrome Pink Refractor PSA 10',
            'Ladd McConkey Topps Chrome Pink Refractor PSA 10',
            'Ladd McConkey Topps Chrome Pink PSA 10'
        ];
        
        for (const query of searchQueries) {
            console.log(`\n📝 Testing: "${query}"`);
            
            try {
                const results = await search130point(query, 20);
                const filteredResults = results.filter(card => ultimateMultiSportFilter(card, 'psa10'));
                
                console.log(`  Raw results: ${results.length}`);
                console.log(`  Filtered results: ${filteredResults.length}`);
                
                if (filteredResults.length > 0) {
                    console.log('  PSA 10 results found:');
                    filteredResults.slice(0, 3).forEach((result, index) => {
                        console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
                    });
                    
                    const avgPrice = filteredResults.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / filteredResults.length;
                    console.log(`  Average PSA 10 price: $${avgPrice.toFixed(2)}`);
                } else {
                    console.log('  No PSA 10 results found');
                }
                
            } catch (error) {
                console.error(`  ❌ Error searching "${query}":`, error.message);
            }
        }
        
        // Test the card identifier extraction
        console.log('\n🔧 Testing card identifier extraction...');
        const testCard = {
            title: card.title,
            summaryTitle: card.summary_title
        };
        
        const { identifier, strategies } = updater.extractCardIdentifier(testCard);
        console.log(`  Identifier: "${identifier}"`);
        console.log(`  Strategies:`, strategies);
        
        // Test the full search process
        console.log('\n🚀 Testing full search process...');
        const priceData = await updater.searchCardPrices(testCard);
        
        if (priceData) {
            console.log('  Price data found:');
            console.log(`    Raw: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count} results)`);
            console.log(`    PSA 9: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count} results)`);
            console.log(`    PSA 10: $${priceData.psa10.avgPrice.toFixed(2)} (${priceData.psa10.count} results)`);
            
            if (priceData.psa10.avgPrice > 0) {
                console.log(`  ✅ PSA 10 price found: $${priceData.psa10.avgPrice.toFixed(2)}`);
            } else {
                console.log(`  ❌ No PSA 10 price found`);
            }
        } else {
            console.log('  ❌ No price data found');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        if (updater.db) {
            updater.db.close();
        }
    }
}

debugMcConkeyPrice().catch(console.error);

