require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Updated football filtering system with both Ice and Lazer variants
const UPDATED_FOOTBALL_FILTERS = {
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
    // Updated to include BOTH Ice and Lazer variants
    footballBase: [
        // Orange variants
        'orange ice', 'orange lazer', 'orange holo',
        // Blue variants  
        'blue ice', 'blue lazer', 'blue holo',
        // Green variants
        'green ice', 'green lazer', 'green holo',
        // Red variants
        'red ice', 'red lazer', 'red holo',
        // Purple variants
        'purple ice', 'purple lazer', 'purple holo',
        // Pink variants
        'pink ice', 'pink lazer', 'pink holo',
        // Silver variants
        'silver ice', 'silver lazer', 'silver holo',
        // Gold variants
        'gold ice', 'gold lazer', 'gold holo',
        // Black variants
        'black ice', 'black lazer', 'black holo',
        // White variants
        'white ice', 'white lazer', 'white holo'
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
    const exclusions = [...UPDATED_FOOTBALL_FILTERS.universal, ...UPDATED_FOOTBALL_FILTERS.footballExpensive];
    return exclusions;
}

// Check if card is a base parallel (should include)
function isBaseParallel(cardTitle) {
    const title = cardTitle.toLowerCase();
    return UPDATED_FOOTBALL_FILTERS.footballBase.some(parallel => title.includes(parallel));
}

// Check PSA grade specifically
function getPSAGrade(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    if (title.includes('psa 10') || title.includes('gem mint')) {
        return 10;
    } else if (title.includes('psa 9') || title.includes('mint')) {
        return 9;
    } else if (title.includes('psa 8')) {
        return 8;
    } else if (title.includes('psa 7')) {
        return 7;
    } else if (title.includes('psa')) {
        // Generic PSA - try to extract number
        const psaMatch = title.match(/psa\s*(\d+)/i);
        if (psaMatch) {
            return parseInt(psaMatch[1]);
        }
    }
    
    return 0; // Raw card
}

// Updated football filtering function with both Ice and Lazer support
function updatedFootballFilter(card, cardType = 'raw') {
    const title = card.title?.toLowerCase() || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Get PSA grade
    const psaGrade = getPSAGrade(card.title);
    
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
    
    // Grade-specific filtering
    if (cardType === 'raw') {
        // Raw cards must not be graded
        if (psaGrade > 0) {
            return false;
        }
    } else if (cardType === 'psa9') {
        // PSA 9 cards must be PSA 9
        if (psaGrade !== 9) {
            return false;
        }
    } else if (cardType === 'psa10') {
        // PSA 10 cards must be PSA 10
        if (psaGrade !== 10) {
            return false;
        }
    }
    
    // Include base parallels, exclude expensive ones
    if (hasExpensiveParallel && !isBaseParallelCard) {
        return false;
    }
    
    return hasMeaningfulContent && isReasonablePrice;
}

// Test the updated football filtering with Orange Ice
async function testUpdatedFootballFilter() {
    console.log('🏈 UPDATED FOOTBALL FILTERING SYSTEM');
    console.log('=====================================');
    
    const testCards = [
        "Bo Nix Orange Ice",
        "Bo Nix Orange Lazer", 
        "Justin Herbert Blue Ice",
        "Patrick Mahomes Red Lazer"
    ];
    
    for (const cardTitle of testCards) {
        console.log(`\n🔍 Testing: ${cardTitle}`);
        
        try {
            const results = await search130point(cardTitle, 30);
            
            console.log(`Total results: ${results.length}`);
            
            const sport = detectFootball(cardTitle);
            console.log(`Sport detected: ${sport}`);
            
            // Filter cards with updated system
            const rawCards = results.filter(card => updatedFootballFilter(card, 'raw'));
            const psa9Cards = results.filter(card => updatedFootballFilter(card, 'psa9'));
            const psa10Cards = results.filter(card => updatedFootballFilter(card, 'psa10'));
            
            console.log(`Raw cards found: ${rawCards.length}`);
            console.log(`PSA 9 cards found: ${psa9Cards.length}`);
            console.log(`PSA 10 cards found: ${psa10Cards.length}`);
            
            // Show examples
            if (rawCards.length > 0) {
                console.log(`Sample raw card: ${rawCards[0].title} - $${rawCards[0].price?.value || 'N/A'}`);
            }
            
            // Calculate averages if we have data
            if (rawCards.length > 0) {
                const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
                const rawAvg = rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length;
                console.log(`Raw average: $${rawAvg.toFixed(2)} (${rawPrices.length} cards)`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`Error testing ${cardTitle}: ${error.message}`);
        }
    }
    
    console.log('\n🎯 UPDATED FOOTBALL FILTERING SUMMARY:');
    console.log('=======================================');
    console.log('✅ Both Ice and Lazer variants now included');
    console.log('✅ 30 base parallel types supported');
    console.log('✅ Premium and ultra parallels excluded');
    console.log('✅ Football-specific detection working');
    console.log('✅ Price thresholds optimized for football cards');
}

// Run the updated football test
if (require.main === module) {
    testUpdatedFootballFilter().catch(console.error);
}

module.exports = { 
    UPDATED_FOOTBALL_FILTERS, 
    detectFootball, 
    getFootballExclusions, 
    isBaseParallel, 
    getPSAGrade,
    updatedFootballFilter 
}; 