require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Comprehensive sport parallels research
async function researchAllSportParallels() {
    console.log('🏈⚾🏀🏒⚽ COMPREHENSIVE SPORT PARALLELS RESEARCH');
    console.log('================================================');
    
    // Define parallel search terms for each sport
    const sportParallels = {
        basketball: {
            base: [
                'orange ice', 'orange lazer', 'blue ice', 'blue lazer', 'green ice', 'green lazer',
                'red ice', 'red lazer', 'purple ice', 'purple lazer', 'pink ice', 'pink lazer',
                'silver ice', 'silver lazer', 'gold ice', 'gold lazer', 'black ice', 'black lazer',
                'white ice', 'white lazer', 'velocity', 'holo', 'hyper', 'prizms'
            ],
            premium: [
                'fast break', 'choice', 'dragon', 'genesis', 'revolution', 'galaxy', 'cosmic',
                'aurora', 'nebula', 'concourse', 'premier', 'fotl', 'playoff', 'championship',
                'finals', 'mvp', 'all star'
            ]
        },
        football: {
            base: [
                'orange ice', 'orange lazer', 'blue ice', 'blue lazer', 'green ice', 'green lazer',
                'red ice', 'red lazer', 'purple ice', 'purple lazer', 'pink ice', 'pink lazer',
                'silver ice', 'silver lazer', 'gold ice', 'gold lazer', 'black ice', 'black lazer',
                'white ice', 'white lazer', 'velocity', 'holo', 'hyper', 'prizms'
            ],
            premium: [
                'fast break', 'choice', 'dragon', 'concourse', 'premier', 'fotl', 'colossal',
                'immortal', 'legendary', 'playoff', 'championship', 'super bowl', 'pro bowl', 'mvp',
                'national treasures', 'flawless', 'immaculate'
            ]
        },
        baseball: {
            base: [
                'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome', 'mini', 'heritage',
                'bowman', 'allen ginter', 'gypsy queen', 'orange ice', 'orange lazer', 'blue ice',
                'blue lazer', 'green ice', 'green lazer', 'red ice', 'red lazer', 'purple ice',
                'purple lazer', 'pink ice', 'pink lazer', 'silver ice', 'silver lazer', 'gold ice',
                'gold lazer', 'black ice', 'black lazer', 'white ice', 'white lazer'
            ],
            premium: [
                'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms', 'concourse',
                'premier', 'fotl', 'colossal', 'immortal', 'legendary', 'playoff', 'championship',
                'world series', 'all star', 'mvp'
            ]
        },
        hockey: {
            base: [
                'young guns', 'canvas', 'exclusives', 'high gloss', 'clear cut', 'rainbow',
                'artifacts', 'upper deck', 'o-pee-chee', 'orange ice', 'orange lazer', 'blue ice',
                'blue lazer', 'green ice', 'green lazer', 'red ice', 'red lazer', 'purple ice',
                'purple lazer', 'pink ice', 'pink lazer', 'silver ice', 'silver lazer', 'gold ice',
                'gold lazer', 'black ice', 'black lazer', 'white ice', 'white lazer'
            ],
            premium: [
                'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms', 'concourse',
                'premier', 'fotl', 'colossal', 'immortal', 'legendary', 'playoff', 'championship',
                'stanley cup', 'all star', 'mvp'
            ]
        },
        soccer: {
            base: [
                'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome', 'velocity', 'holo',
                'hyper', 'orange ice', 'orange lazer', 'blue ice', 'blue lazer', 'green ice',
                'green lazer', 'red ice', 'red lazer', 'purple ice', 'purple lazer', 'pink ice',
                'pink lazer', 'silver ice', 'silver lazer', 'gold ice', 'gold lazer', 'black ice',
                'black lazer', 'white ice', 'white lazer'
            ],
            premium: [
                'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms', 'concourse',
                'premier', 'fotl', 'colossal', 'immortal', 'legendary', 'champions league',
                'world cup', 'europa league', 'premier league', 'la liga', 'bundesliga', 'serie a'
            ]
        }
    };
    
    const allResults = {};
    
    // Research each sport
    for (const [sport, parallels] of Object.entries(sportParallels)) {
        console.log(`\n🏈⚾🏀🏒⚽ RESEARCHING ${sport.toUpperCase()} PARALLELS`);
        console.log('='.repeat(50));
        
        allResults[sport] = {
            base: {},
            premium: {}
        };
        
        // Research base parallels
        console.log(`\n📋 Researching ${parallels.base.length} base parallels...`);
        for (const parallel of parallels.base) {
            try {
                console.log(`  Searching: "${parallel}"`);
                const results = await search130point(parallel, 15);
                
                if (results.length > 0) {
                    allResults[sport].base[parallel] = {
                        count: results.length,
                        examples: results.slice(0, 3).map(card => ({
                            title: card.title,
                            price: parseFloat(card.price?.value || 0)
                        }))
                    };
                    
                    console.log(`    Found: ${results.length} results`);
                    console.log(`    Sample: ${results[0].title} - $${parseFloat(results[0].price?.value || 0).toFixed(2)}`);
                } else {
                    console.log(`    Found: 0 results`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.log(`    Error: ${error.message}`);
            }
        }
        
        // Research premium parallels
        console.log(`\n📋 Researching ${parallels.premium.length} premium parallels...`);
        for (const parallel of parallels.premium) {
            try {
                console.log(`  Searching: "${parallel}"`);
                const results = await search130point(parallel, 15);
                
                if (results.length > 0) {
                    allResults[sport].premium[parallel] = {
                        count: results.length,
                        examples: results.slice(0, 3).map(card => ({
                            title: card.title,
                            price: parseFloat(card.price?.value || 0)
                        }))
                    };
                    
                    console.log(`    Found: ${results.length} results`);
                    console.log(`    Sample: ${results[0].title} - $${parseFloat(results[0].price?.value || 0).toFixed(2)}`);
                } else {
                    console.log(`    Found: 0 results`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.log(`    Error: ${error.message}`);
            }
        }
    }
    
    // Analyze results
    console.log('\n📊 COMPREHENSIVE PARALLEL ANALYSIS');
    console.log('===================================');
    
    for (const [sport, data] of Object.entries(allResults)) {
        console.log(`\n🏈⚾🏀🏒⚽ ${sport.toUpperCase()} RESULTS:`);
        
        const baseParallels = Object.keys(data.base).filter(term => data.base[term].count > 0);
        const premiumParallels = Object.keys(data.premium).filter(term => data.premium[term].count > 0);
        
        console.log(`  Base parallels found: ${baseParallels.length}`);
        console.log(`  Premium parallels found: ${premiumParallels.length}`);
        
        // Show base parallels with price ranges
        if (baseParallels.length > 0) {
            console.log(`  Base parallels:`);
            baseParallels.forEach(parallel => {
                const parallelData = data.base[parallel];
                const prices = parallelData.examples.map(ex => ex.price).filter(price => price > 0);
                if (prices.length > 0) {
                    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    console.log(`    ${parallel}: $${avgPrice.toFixed(2)} avg ($${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
                }
            });
        }
        
        // Show premium parallels with price ranges
        if (premiumParallels.length > 0) {
            console.log(`  Premium parallels:`);
            premiumParallels.forEach(parallel => {
                const parallelData = data.premium[parallel];
                const prices = parallelData.examples.map(ex => ex.price).filter(price => price > 0);
                if (prices.length > 0) {
                    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    console.log(`    ${parallel}: $${avgPrice.toFixed(2)} avg ($${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
                }
            });
        }
    }
    
    // Generate comprehensive summary
    console.log('\n🎯 COMPREHENSIVE SUMMARY');
    console.log('========================');
    
    let totalBaseParallels = 0;
    let totalPremiumParallels = 0;
    
    for (const [sport, data] of Object.entries(allResults)) {
        const baseCount = Object.keys(data.base).filter(term => data.base[term].count > 0).length;
        const premiumCount = Object.keys(data.premium).filter(term => data.premium[term].count > 0).length;
        
        totalBaseParallels += baseCount;
        totalPremiumParallels += premiumCount;
        
        console.log(`${sport}: ${baseCount} base + ${premiumCount} premium = ${baseCount + premiumCount} total`);
    }
    
    console.log(`\nTOTAL DISCOVERED:`);
    console.log(`Base parallels: ${totalBaseParallels}`);
    console.log(`Premium parallels: ${totalPremiumParallels}`);
    console.log(`Grand total: ${totalBaseParallels + totalPremiumParallels} parallel types`);
    
    return allResults;
}

// Test specific sport examples
async function testSportExamples() {
    console.log('\n🔍 TESTING SPORT-SPECIFIC EXAMPLES');
    console.log('===================================');
    
    const testExamples = [
        { sport: 'basketball', card: 'Luka Doncic Orange Ice' },
        { sport: 'football', card: 'Bo Nix Orange Lazer' },
        { sport: 'baseball', card: 'Shohei Ohtani Refractor' },
        { sport: 'hockey', card: 'Connor McDavid Young Guns' },
        { sport: 'soccer', card: 'Lionel Messi Refractor' }
    ];
    
    for (const example of testExamples) {
        console.log(`\n🔍 Testing ${example.sport}: ${example.card}`);
        
        try {
            const results = await search130point(example.card, 20);
            console.log(`  Found: ${results.length} results`);
            
            if (results.length > 0) {
                console.log(`  Sample: ${results[0].title} - $${parseFloat(results[0].price?.value || 0).toFixed(2)}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
}

// Run the comprehensive research
if (require.main === module) {
    researchAllSportParallels()
        .then(() => testSportExamples())
        .catch(console.error);
}

module.exports = { researchAllSportParallels, testSportExamples }; 