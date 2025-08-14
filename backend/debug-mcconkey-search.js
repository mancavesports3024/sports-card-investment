const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter } = require('./ultimate-multi-sport-filtering-system');

async function testMcConkeySearch() {
    console.log('🔍 Testing 130point search for Ladd McConkey PSA 10...\n');
    
    const searchQueries = [
        '2024 Ladd McConkey Topps Chrome Pink Refractor PSA 10',
        '2024 Topps Chrome Ladd McConkey Pink Refractor PSA 10',
        'Ladd McConkey Topps Chrome Pink Refractor PSA 10',
        'Ladd McConkey Pink Refractor PSA 10',
        '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor PSA 10'
    ];
    
    for (const query of searchQueries) {
        console.log(`\n📝 Testing: "${query}"`);
        
        try {
            const results = await search130point(query, 30);
            console.log(`  Raw results: ${results.length}`);
            
            if (results.length > 0) {
                console.log('  First 5 results:');
                results.slice(0, 5).forEach((result, index) => {
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
                }
            } else {
                console.log('  No results found');
            }
            
        } catch (error) {
            console.error(`  ❌ Error searching "${query}":`, error.message);
        }
    }
}

testMcConkeySearch().catch(console.error);
