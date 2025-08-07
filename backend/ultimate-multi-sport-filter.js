require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Ultimate multi-sport parallel filtering system
const ULTIMATE_PARALLEL_FILTERS = {
    // Universal expensive parallels (all sports)
    universal: [
        'white sparkle', 'ssp', 'superfractor', '1/1', 'one of one', 'one-of-one',
        'black', 'gold', 'red', 'blue', 'green', 'purple', 'orange', 'pink',
        'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby', 'sapphire',
        'rainbow', 'atomic', 'galaxy', 'cosmic', 'aurora', 'nebula'
    ],
    
    // Basketball specific parallels
    basketball: [
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'concourse', 'premier', 'fotl', 'genesis', 'revolution',
        'playoff', 'championship', 'finals', 'mvp', 'all star'
    ],
    
    // Football specific parallels
    football: [
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'concourse', 'premier', 'fotl', 'colossal', 'immortal', 'legendary',
        'playoff', 'championship', 'super bowl', 'pro bowl', 'mvp'
    ],
    
    // Baseball specific parallels
    baseball: [
        'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome',
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'mini', 'heritage', 'bowman', 'allen ginter', 'gypsy queen'
    ],
    
    // Hockey specific parallels
    hockey: [
        'young guns', 'canvas', 'exclusives', 'high gloss', 'clear cut',
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'rainbow', 'artifacts', 'upper deck', 'o-pee-chee'
    ],
    
    // Soccer specific parallels
    soccer: [
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome',
        'velocity', 'holo', 'hyper', 'champions league', 'world cup'
    ]
};

// Improved sport detection with more players and keywords
function detectSport(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    // Basketball indicators
    if (title.includes('basketball') || title.includes('nba') || 
        title.includes('lebron') || title.includes('jordan') || title.includes('kobe') ||
        title.includes('luka') || title.includes('doncic') || title.includes('curry') ||
        title.includes('giannis') || title.includes('durant') || title.includes('james') ||
        title.includes('donruss optic') || title.includes('prizm') || title.includes('mosaic')) {
        return 'basketball';
    }
    
    // Football indicators
    if (title.includes('football') || title.includes('nfl') || 
        title.includes('brady') || title.includes('mahomes') || title.includes('manning') ||
        title.includes('herbert') || title.includes('allen') || title.includes('rodgers') ||
        title.includes('burrow') || title.includes('lawrence') || title.includes('prescott')) {
        return 'football';
    }
    
    // Baseball indicators
    if (title.includes('baseball') || title.includes('mlb') || 
        title.includes('trout') || title.includes('ohtani') || title.includes('judge') ||
        title.includes('acuna') || title.includes('tatis') || title.includes('guerrero') ||
        title.includes('topps chrome') || title.includes('bowman') || title.includes('heritage')) {
        return 'baseball';
    }
    
    // Hockey indicators
    if (title.includes('hockey') || title.includes('nhl') || 
        title.includes('mcdavid') || title.includes('crosby') || title.includes('ovechkin') ||
        title.includes('matthews') || title.includes('mackinnon') || title.includes('draisaitl') ||
        title.includes('upper deck') || title.includes('o-pee-chee') || title.includes('artifacts')) {
        return 'hockey';
    }
    
    // Soccer indicators
    if (title.includes('soccer') || title.includes('mls') || title.includes('fifa') ||
        title.includes('messi') || title.includes('ronaldo') || title.includes('mbappe') ||
        title.includes('haaland') || title.includes('vinicius') || title.includes('bellingham') ||
        title.includes('champions league') || title.includes('world cup')) {
        return 'soccer';
    }
    
    return 'unknown';
}

// Get comprehensive parallel exclusions for any sport
function getComprehensiveExclusions(cardTitle) {
    const sport = detectSport(cardTitle);
    const exclusions = [...ULTIMATE_PARALLEL_FILTERS.universal];
    
    if (sport !== 'unknown' && ULTIMATE_PARALLEL_FILTERS[sport]) {
        exclusions.push(...ULTIMATE_PARALLEL_FILTERS[sport]);
    }
    
    return exclusions;
}

// Ultimate filtering function for all sports
function ultimateFilterCard(card, cardType = 'raw') {
    const title = card.title?.toLowerCase() || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Must NOT contain graded terms
    const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
    const hasGradedTerm = gradedTerms.some(term => title.includes(term));
    
    // Get comprehensive parallel exclusions
    const parallelExclusions = getComprehensiveExclusions(card.title);
    const hasExpensiveParallel = parallelExclusions.some(term => title.includes(term));
    
    // Must contain meaningful card terms
    const words = card.title?.split(' ') || [];
    const meaningfulWords = words.filter(word => 
        word.length > 2 && !word.includes('#') && !word.includes('$') && 
        !word.includes('psa') && !word.includes('graded')
    );
    const hasMeaningfulContent = meaningfulWords.length >= 3;
    
    // Price thresholds based on card type
    let maxPrice = 200; // Default for raw cards
    if (cardType === 'psa9') {
        maxPrice = 500;
    } else if (cardType === 'psa10') {
        maxPrice = 1000;
    }
    
    const isReasonablePrice = price > 0 && price < maxPrice;
    
    return !hasGradedTerm && !hasExpensiveParallel && hasMeaningfulContent && isReasonablePrice;
}

// Test the ultimate multi-sport system
async function testUltimateMultiSport() {
    console.log('🏈⚾🏀🏒⚽ ULTIMATE MULTI-SPORT FILTERING SYSTEM');
    console.log('================================================');
    
    const testCards = [
        "2018 Donruss Optic Luka Doncic #177", // Basketball
        "2020 Panini Prizm Justin Herbert #280", // Football
        "2018 Topps Chrome Shohei Ohtani #150", // Baseball
        "2016 Upper Deck Connor McDavid #201", // Hockey
        "2022 Panini Prizm Kylian Mbappe #50" // Soccer
    ];
    
    for (const cardTitle of testCards) {
        console.log(`\n🔍 Testing: ${cardTitle}`);
        const sport = detectSport(cardTitle);
        console.log(`Sport detected: ${sport}`);
        
        const exclusions = getComprehensiveExclusions(cardTitle);
        console.log(`Total exclusions: ${exclusions.length}`);
        console.log(`Sample exclusions: ${exclusions.slice(0, 8).join(', ')}...`);
        
        // Test search
        try {
            const results = await search130point(cardTitle, 30);
            const rawCards = results.filter(card => ultimateFilterCard(card, 'raw'));
            const psa9Cards = results.filter(card => ultimateFilterCard(card, 'psa9'));
            
            console.log(`Total results: ${results.length}`);
            console.log(`Raw cards found: ${rawCards.length}`);
            console.log(`PSA 9 cards found: ${psa9Cards.length}`);
            
            // Show examples
            if (rawCards.length > 0) {
                console.log(`Sample raw card: ${rawCards[0].title} - $${rawCards[0].price?.value || 'N/A'}`);
            }
            if (psa9Cards.length > 0) {
                console.log(`Sample PSA 9 card: ${psa9Cards[0].title} - $${psa9Cards[0].price?.value || 'N/A'}`);
            }
            
            // Calculate averages if we have data
            if (rawCards.length > 0) {
                const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
                const rawAvg = rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length;
                console.log(`Raw average: $${rawAvg.toFixed(2)} (${rawPrices.length} cards)`);
            }
            
            if (psa9Cards.length > 0) {
                const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
                const psa9Avg = psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length;
                console.log(`PSA 9 average: $${psa9Avg.toFixed(2)} (${psa9Prices.length} cards)`);
            }
            
        } catch (error) {
            console.log(`Error testing ${cardTitle}: ${error.message}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n🎯 SYSTEM SUMMARY:');
    console.log('==================');
    console.log('✅ Universal parallel exclusions: 25+ terms');
    console.log('✅ Sport-specific exclusions: 15+ terms per sport');
    console.log('✅ Improved sport detection with player names');
    console.log('✅ Dynamic price thresholds based on card type');
    console.log('✅ Comprehensive filtering for all major sports');
}

// Run the ultimate multi-sport test
if (require.main === module) {
    testUltimateMultiSport().catch(console.error);
}

module.exports = { 
    ULTIMATE_PARALLEL_FILTERS, 
    detectSport, 
    getComprehensiveExclusions, 
    ultimateFilterCard 
}; 