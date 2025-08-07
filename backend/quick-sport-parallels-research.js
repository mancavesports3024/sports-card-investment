require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Quick sport parallels research - focused on key parallels
async function quickSportParallelsResearch() {
    console.log('🏈⚾🏀🏒⚽ QUICK SPORT PARALLELS RESEARCH');
    console.log('=========================================');
    
    // Focus on key parallels for each sport
    const keyParallels = {
        basketball: [
            'orange ice', 'orange lazer', 'blue ice', 'blue lazer', 'velocity', 'holo',
            'fast break', 'choice', 'dragon', 'genesis', 'concourse', 'premier'
        ],
        football: [
            'orange ice', 'orange lazer', 'blue ice', 'blue lazer', 'velocity', 'holo',
            'fast break', 'choice', 'dragon', 'concourse', 'premier', 'colossal'
        ],
        baseball: [
            'refractor', 'x-fractor', 'atomic', 'chrome', 'bowman', 'heritage',
            'fast break', 'choice', 'dragon', 'concourse', 'premier', 'world series'
        ],
        hockey: [
            'young guns', 'canvas', 'exclusives', 'high gloss', 'clear cut', 'artifacts',
            'fast break', 'choice', 'dragon', 'concourse', 'premier', 'stanley cup'
        ],
        soccer: [
            'refractor', 'x-fractor', 'atomic', 'chrome', 'velocity', 'holo',
            'fast break', 'choice', 'dragon', 'concourse', 'premier', 'champions league'
        ]
    };
    
    const results = {};
    
    // Research each sport
    for (const [sport, parallels] of Object.entries(keyParallels)) {
        console.log(`\n🏈⚾🏀🏒⚽ RESEARCHING ${sport.toUpperCase()} KEY PARALLELS`);
        console.log('='.repeat(50));
        
        results[sport] = {};
        
        for (const parallel of parallels) {
            try {
                console.log(`  Searching: "${parallel}"`);
                const searchResults = await search130point(parallel, 10);
                
                if (searchResults.length > 0) {
                    results[sport][parallel] = {
                        count: searchResults.length,
                        examples: searchResults.slice(0, 2).map(card => ({
                            title: card.title,
                            price: parseFloat(card.price?.value || 0)
                        }))
                    };
                    
                    console.log(`    Found: ${searchResults.length} results`);
                    console.log(`    Sample: ${searchResults[0].title} - $${parseFloat(searchResults[0].price?.value || 0).toFixed(2)}`);
                } else {
                    console.log(`    Found: 0 results`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`    Error: ${error.message}`);
            }
        }
    }
    
    // Analyze results
    console.log('\n📊 QUICK PARALLEL ANALYSIS');
    console.log('==========================');
    
    for (const [sport, data] of Object.entries(results)) {
        console.log(`\n🏈⚾🏀🏒⚽ ${sport.toUpperCase()} RESULTS:`);
        
        const foundParallels = Object.keys(data).filter(term => data[term].count > 0);
        console.log(`  Found: ${foundParallels.length}/${keyParallels[sport].length} parallels`);
        
        // Show found parallels with price ranges
        foundParallels.forEach(parallel => {
            const parallelData = data[parallel];
            const prices = parallelData.examples.map(ex => ex.price).filter(price => price > 0);
            if (prices.length > 0) {
                const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                console.log(`    ${parallel}: $${avgPrice.toFixed(2)} avg ($${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
            }
        });
    }
    
    // Generate summary
    console.log('\n🎯 QUICK SUMMARY');
    console.log('================');
    
    let totalFound = 0;
    let totalSearched = 0;
    
    for (const [sport, data] of Object.entries(results)) {
        const found = Object.keys(data).filter(term => data[term].count > 0).length;
        const searched = keyParallels[sport].length;
        
        totalFound += found;
        totalSearched += searched;
        
        console.log(`${sport}: ${found}/${searched} parallels found`);
    }
    
    console.log(`\nOVERALL: ${totalFound}/${totalSearched} parallels found (${((totalFound/totalSearched)*100).toFixed(1)}% success rate)`);
    
    return results;
}

// Test sport-specific card examples
async function testSportCardExamples() {
    console.log('\n🔍 TESTING SPORT-SPECIFIC CARD EXAMPLES');
    console.log('=========================================');
    
    const testCards = [
        { sport: 'basketball', card: 'Luka Doncic Orange Ice', expected: 'base' },
        { sport: 'basketball', card: 'LeBron James Fast Break', expected: 'premium' },
        { sport: 'football', card: 'Bo Nix Orange Lazer', expected: 'base' },
        { sport: 'football', card: 'Patrick Mahomes Choice', expected: 'premium' },
        { sport: 'baseball', card: 'Shohei Ohtani Refractor', expected: 'base' },
        { sport: 'baseball', card: 'Mike Trout Atomic', expected: 'base' },
        { sport: 'hockey', card: 'Connor McDavid Young Guns', expected: 'base' },
        { sport: 'hockey', card: 'Sidney Crosby Canvas', expected: 'base' },
        { sport: 'soccer', card: 'Lionel Messi Refractor', expected: 'base' },
        { sport: 'soccer', card: 'Cristiano Ronaldo Chrome', expected: 'base' }
    ];
    
    for (const testCard of testCards) {
        console.log(`\n🔍 Testing ${testCard.sport}: ${testCard.card} (expected: ${testCard.expected})`);
        
        try {
            const results = await search130point(testCard.card, 15);
            console.log(`  Found: ${results.length} results`);
            
            if (results.length > 0) {
                // Show first 3 results
                results.slice(0, 3).forEach((card, i) => {
                    const price = parseFloat(card.price?.value || 0);
                    console.log(`    ${i+1}. ${card.title} - $${price.toFixed(2)}`);
                });
                
                // Calculate average price
                const prices = results.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
                if (prices.length > 0) {
                    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                    console.log(`  Average price: $${avgPrice.toFixed(2)}`);
                }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1500));
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
}

// Run the quick research
if (require.main === module) {
    quickSportParallelsResearch()
        .then(() => testSportCardExamples())
        .catch(console.error);
}

module.exports = { quickSportParallelsResearch, testSportCardExamples }; 