require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Research script to discover football parallels
async function researchFootballParallels() {
    console.log('🏈 FOOTBALL PARALLELS RESEARCH');
    console.log('==============================');
    
    const searchTerms = [
        "Orange Ice",
        "Orange Lazer", 
        "Blue Ice",
        "Blue Lazer",
        "Green Ice",
        "Green Lazer",
        "Red Ice",
        "Red Lazer",
        "Purple Ice",
        "Purple Lazer",
        "Pink Ice",
        "Pink Lazer",
        "Silver Ice",
        "Silver Lazer",
        "Gold Ice",
        "Gold Lazer",
        "Black Ice",
        "Black Lazer",
        "White Ice",
        "White Lazer",
        "Fast Break",
        "Choice",
        "Dragon",
        "Hyper",
        "Velocity",
        "Prizms",
        "Concourse",
        "Premier",
        "FOTL",
        "Colossal",
        "Immortal",
        "Legendary"
    ];
    
    console.log(`🔍 Researching ${searchTerms.length} parallel types...`);
    
    const parallelResults = {};
    
    for (const term of searchTerms) {
        try {
            console.log(`\n📋 Searching for: "${term}"`);
            const results = await search130point(term, 20);
            
            if (results.length > 0) {
                parallelResults[term] = {
                    count: results.length,
                    examples: results.slice(0, 5).map(card => ({
                        title: card.title,
                        price: parseFloat(card.price?.value || 0)
                    }))
                };
                
                console.log(`   Found: ${results.length} results`);
                console.log(`   Examples:`);
                results.slice(0, 3).forEach((card, i) => {
                    const price = parseFloat(card.price?.value || 0);
                    console.log(`     ${i+1}. ${card.title} - $${price.toFixed(2)}`);
                });
            } else {
                console.log(`   Found: 0 results`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`   Error searching "${term}": ${error.message}`);
        }
    }
    
    // Analyze results
    console.log('\n📊 PARALLEL ANALYSIS:');
    console.log('=====================');
    
    const foundParallels = Object.keys(parallelResults).filter(term => parallelResults[term].count > 0);
    
    console.log(`Total parallels found: ${foundParallels.length}`);
    console.log(`\nFound parallels:`);
    foundParallels.forEach(term => {
        const data = parallelResults[term];
        console.log(`  ${term}: ${data.count} results`);
    });
    
    // Categorize parallels
    console.log('\n🏷️ PARALLEL CATEGORIES:');
    console.log('========================');
    
    const baseParallels = foundParallels.filter(term => 
        term.includes('Ice') || term.includes('Lazer') || term.includes('Holo')
    );
    
    const premiumParallels = foundParallels.filter(term => 
        term.includes('Fast Break') || term.includes('Choice') || term.includes('Dragon') ||
        term.includes('Hyper') || term.includes('Velocity') || term.includes('Prizms')
    );
    
    const ultraParallels = foundParallels.filter(term => 
        term.includes('Concourse') || term.includes('Premier') || term.includes('FOTL') ||
        term.includes('Colossal') || term.includes('Immortal') || term.includes('Legendary')
    );
    
    console.log(`Base Parallels (Ice/Lazer/Holo): ${baseParallels.join(', ')}`);
    console.log(`Premium Parallels: ${premiumParallels.join(', ')}`);
    console.log(`Ultra Parallels: ${ultraParallels.join(', ')}`);
    
    // Price analysis
    console.log('\n💰 PRICE ANALYSIS:');
    console.log('==================');
    
    foundParallels.forEach(term => {
        const data = parallelResults[term];
        const prices = data.examples.map(ex => ex.price).filter(price => price > 0);
        if (prices.length > 0) {
            const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            console.log(`  ${term}: $${avgPrice.toFixed(2)} avg ($${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)})`);
        }
    });
    
    return parallelResults;
}

// Test specific Orange Ice search
async function testOrangeIce() {
    console.log('\n🔍 SPECIFIC ORANGE ICE TEST');
    console.log('===========================');
    
    try {
        const results = await search130point("Orange Ice", 30);
        
        console.log(`Orange Ice results: ${results.length}`);
        
        if (results.length > 0) {
            console.log('\n📋 ORANGE ICE EXAMPLES:');
            results.slice(0, 10).forEach((card, i) => {
                const price = parseFloat(card.price?.value || 0);
                console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}`);
            });
            
            // Check if any are football cards
            const footballCards = results.filter(card => 
                card.title.toLowerCase().includes('football') || 
                card.title.toLowerCase().includes('nfl') ||
                card.title.toLowerCase().includes('prizm') ||
                card.title.toLowerCase().includes('donruss')
            );
            
            console.log(`\n🏈 Football Orange Ice cards: ${footballCards.length}`);
            footballCards.slice(0, 5).forEach((card, i) => {
                const price = parseFloat(card.price?.value || 0);
                console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}`);
            });
        }
        
    } catch (error) {
        console.error(`Error testing Orange Ice: ${error.message}`);
    }
}

// Run the research
if (require.main === module) {
    researchFootballParallels()
        .then(() => testOrangeIce())
        .catch(console.error);
}

module.exports = { researchFootballParallels, testOrangeIce }; 