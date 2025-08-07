require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Improved football filtering system
const FOOTBALL_FILTERS = {
    // Universal expensive parallels (all sports)
    universal: [
        'white sparkle', 'ssp', 'superfractor', '1/1', 'one of one', 'one-of-one',
        'black', 'gold', 'red', 'blue', 'green', 'purple', 'pink',
        'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby', 'sapphire',
        'rainbow', 'atomic', 'galaxy', 'cosmic', 'aurora', 'nebula'
    ],
    
    // Football expensive parallels (exclude these)
    footballExpensive: [
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'concourse', 'premier', 'fotl', 'colossal', 'immortal', 'legendary',
        'playoff', 'championship', 'super bowl', 'pro bowl', 'mvp',
        'national treasures', 'flawless', 'immaculate'
    ],
    
    // Football base parallels (include these - they're reasonable)
    footballBase: [
        'orange lazer', 'orange holo', 'blue lazer', 'blue holo', 
        'green lazer', 'green holo', 'red lazer', 'red holo',
        'purple lazer', 'purple holo', 'pink lazer', 'pink holo',
        'silver lazer', 'silver holo', 'gold lazer', 'gold holo'
    ]
};

// Improved sport detection for football
function detectFootball(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    // Football indicators
    if (title.includes('football') || title.includes('nfl') || 
        title.includes('brady') || title.includes('mahomes') || title.includes('manning') ||
        title.includes('herbert') || title.includes('allen') || title.includes('rodgers') ||
        title.includes('burrow') || title.includes('lawrence') || title.includes('prescott') ||
        title.includes('bo nix') || title.includes('broncos') || title.includes('denver') ||
        title.includes('prizm') || title.includes('donruss') || title.includes('optic')) {
        return 'football';
    }
    
    return 'unknown';
}

// Get football-specific exclusions
function getFootballExclusions(cardTitle) {
    const exclusions = [...FOOTBALL_FILTERS.universal, ...FOOTBALL_FILTERS.footballExpensive];
    return exclusions;
}

// Check if card is a base parallel (should include)
function isBaseParallel(cardTitle) {
    const title = cardTitle.toLowerCase();
    return FOOTBALL_FILTERS.footballBase.some(parallel => title.includes(parallel));
}

// Improved football filtering function
function improvedFootballFilter(card, cardType = 'raw') {
    const title = card.title?.toLowerCase() || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Must NOT contain graded terms (unless we're looking for graded)
    const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
    const hasGradedTerm = gradedTerms.some(term => title.includes(term));
    
    // Get football-specific exclusions
    const exclusions = getFootballExclusions(card.title);
    const hasExpensiveParallel = exclusions.some(term => title.includes(term));
    
    // Check if it's a base parallel (should include)
    const isBaseParallelCard = isBaseParallel(card.title);
    
    // Must contain meaningful card terms
    const words = card.title?.split(' ') || [];
    const meaningfulWords = words.filter(word => 
        word.length > 2 && !word.includes('#') && !word.includes('$') && 
        !word.includes('psa') && !word.includes('graded')
    );
    const hasMeaningfulContent = meaningfulWords.length >= 3;
    
    // Price thresholds based on card type
    let maxPrice = 500; // Higher for football cards
    if (cardType === 'psa9') {
        maxPrice = 1000;
    } else if (cardType === 'psa10') {
        maxPrice = 2000;
    }
    
    const isReasonablePrice = price > 0 && price < maxPrice;
    
    // For raw cards, exclude graded
    if (cardType === 'raw' && hasGradedTerm) {
        return false;
    }
    
    // For PSA 9/10 cards, must be graded
    if ((cardType === 'psa9' || cardType === 'psa10') && !hasGradedTerm) {
        return false;
    }
    
    // Include base parallels, exclude expensive ones
    if (hasExpensiveParallel && !isBaseParallelCard) {
        return false;
    }
    
    return hasMeaningfulContent && isReasonablePrice;
}

// Test the improved football filtering
async function testImprovedFootballFilter() {
    console.log('🏈 IMPROVED FOOTBALL FILTERING SYSTEM');
    console.log('=====================================');
    
    const cardTitle = "Bo Nix Orange Lazer";
    console.log(`🔍 Testing: ${cardTitle}`);
    
    try {
        // Search for Bo Nix cards
        console.log('\n📋 SEARCHING FOR BO NIX CARDS...');
        const results = await search130point(cardTitle, 50);
        
        console.log(`Total results: ${results.length}`);
        
        // Show all results first
        console.log('\n📋 ALL RESULTS:');
        results.slice(0, 10).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}`);
        });
        
        // Test improved filtering
        console.log('\n🔍 TESTING IMPROVED FOOTBALL FILTERING...');
        
        const sport = detectFootball(cardTitle);
        console.log(`Sport detected: ${sport}`);
        
        const exclusions = getFootballExclusions(cardTitle);
        console.log(`Total exclusions: ${exclusions.length}`);
        console.log(`Sample exclusions: ${exclusions.slice(0, 8).join(', ')}...`);
        
        // Filter cards with improved system
        const rawCards = results.filter(card => improvedFootballFilter(card, 'raw'));
        const psa9Cards = results.filter(card => improvedFootballFilter(card, 'psa9'));
        const psa10Cards = results.filter(card => improvedFootballFilter(card, 'psa10'));
        
        console.log(`\n📊 IMPROVED FILTERING RESULTS:`);
        console.log(`Raw cards found: ${rawCards.length}`);
        console.log(`PSA 9 cards found: ${psa9Cards.length}`);
        console.log(`PSA 10 cards found: ${psa10Cards.length}`);
        
        // Show filtered raw cards
        if (rawCards.length > 0) {
            console.log('\n💰 FILTERED RAW CARDS:');
            rawCards.slice(0, 10).forEach((card, i) => {
                const price = parseFloat(card.price?.value || 0);
                const isBase = isBaseParallel(card.title) ? ' (Base Parallel)' : '';
                console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}${isBase}`);
            });
            
            // Calculate raw average
            const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
            const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
            console.log(`\n📊 RAW SUMMARY: Average: $${rawAvg.toFixed(2)} (${rawPrices.length} cards)`);
        }
        
        // Show filtered PSA 9 cards
        if (psa9Cards.length > 0) {
            console.log('\n💰 FILTERED PSA 9 CARDS:');
            psa9Cards.slice(0, 10).forEach((card, i) => {
                const price = parseFloat(card.price?.value || 0);
                const isBase = isBaseParallel(card.title) ? ' (Base Parallel)' : '';
                console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}${isBase}`);
            });
            
            // Calculate PSA 9 average
            const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
            const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
            console.log(`\n📊 PSA 9 SUMMARY: Average: $${psa9Avg.toFixed(2)} (${psa9Prices.length} cards)`);
        }
        
        // Show filtered PSA 10 cards
        if (psa10Cards.length > 0) {
            console.log('\n💰 FILTERED PSA 10 CARDS:');
            psa10Cards.slice(0, 10).forEach((card, i) => {
                const price = parseFloat(card.price?.value || 0);
                const isBase = isBaseParallel(card.title) ? ' (Base Parallel)' : '';
                console.log(`   ${i+1}. ${card.title} - $${price.toFixed(2)}${isBase}`);
            });
            
            // Calculate PSA 10 average
            const psa10Prices = psa10Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
            const psa10Avg = psa10Prices.length > 0 ? psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : 0;
            console.log(`\n📊 PSA 10 SUMMARY: Average: $${psa10Avg.toFixed(2)} (${psa10Prices.length} cards)`);
        }
        
        console.log('\n🎯 IMPROVED FOOTBALL FILTERING SUMMARY:');
        console.log('========================================');
        console.log('✅ Base parallels (Orange Lazer) now included');
        console.log('✅ Expensive parallels still excluded');
        console.log('✅ Football-specific detection improved');
        console.log('✅ Price thresholds adjusted for football cards');
        
    } catch (error) {
        console.error(`❌ Error testing improved football filter:`, error.message);
    }
}

// Run the improved football test
if (require.main === module) {
    testImprovedFootballFilter().catch(console.error);
}

module.exports = { 
    FOOTBALL_FILTERS, 
    detectFootball, 
    getFootballExclusions, 
    isBaseParallel, 
    improvedFootballFilter 
}; 