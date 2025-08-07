require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Comprehensive parallel filtering for all sports
const PARALLEL_FILTERS = {
    // Universal expensive parallels (all sports)
    universal: [
        'white sparkle', 'ssp', 'superfractor', '1/1', 'one of one', 'one-of-one',
        'black', 'gold', 'red', 'blue', 'green', 'purple', 'orange', 'pink',
        'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby', 'sapphire'
    ],
    
    // Basketball specific parallels
    basketball: {
        paniniPrizm: ['fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms'],
        donrussOptic: ['velocity', 'choice', 'dragon', 'holo', 'hyper'],
        select: ['concourse', 'premier', 'fotl', 'black', 'gold', 'red', 'blue', 'green'],
        mosaic: ['genesis', 'silver', 'gold', 'red', 'blue', 'green', 'purple', 'orange', 'black'],
        revolution: ['galaxy', 'cosmic', 'aurora', 'nebula'],
        contenders: ['playoff', 'championship', 'super bowl']
    },
    
    // Football specific parallels
    football: {
        paniniPrizm: ['fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms'],
        donrussOptic: ['velocity', 'choice', 'dragon', 'holo', 'hyper'],
        select: ['concourse', 'premier', 'fotl', 'black', 'gold', 'red', 'blue', 'green'],
        contenders: ['playoff', 'championship', 'super bowl'],
        nationalTreasures: ['colossal', 'immortal', 'legendary'],
        flawless: ['diamond', 'emerald', 'ruby', 'sapphire']
    },
    
    // Baseball specific parallels
    baseball: {
        toppsChrome: ['refractor', 'x-fractor', 'atomic', 'superfractor'],
        bowmanChrome: ['refractor', 'x-fractor', 'superfractor'],
        paniniPrizm: ['fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms'],
        toppsHeritage: ['chrome', 'refractor'],
        bowman: ['chrome', 'refractor', 'x-fractor'],
        allenGinter: ['mini', 'chrome', 'refractor']
    },
    
    // Hockey specific parallels
    hockey: {
        upperDeck: ['young guns', 'canvas', 'exclusives', 'high gloss', 'clear cut'],
        paniniPrizm: ['fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms'],
        oPeeChee: ['rainbow', 'black', 'gold', 'red', 'blue'],
        artifacts: ['emerald', 'ruby', 'sapphire', 'gold', 'red']
    },
    
    // Soccer specific parallels
    soccer: {
        paniniPrizm: ['fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms'],
        toppsChrome: ['refractor', 'x-fractor', 'atomic', 'superfractor'],
        donrussOptic: ['velocity', 'choice', 'dragon', 'holo', 'hyper']
    }
};

// Function to detect sport from card title
function detectSport(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    // Basketball indicators
    if (title.includes('basketball') || title.includes('nba') || 
        title.includes('lebron') || title.includes('jordan') || title.includes('kobe') ||
        title.includes('luka') || title.includes('doncic') || title.includes('curry')) {
        return 'basketball';
    }
    
    // Football indicators
    if (title.includes('football') || title.includes('nfl') || 
        title.includes('brady') || title.includes('mahomes') || title.includes('manning')) {
        return 'football';
    }
    
    // Baseball indicators
    if (title.includes('baseball') || title.includes('mlb') || 
        title.includes('trout') || title.includes('ohtani') || title.includes('judge')) {
        return 'baseball';
    }
    
    // Hockey indicators
    if (title.includes('hockey') || title.includes('nhl') || 
        title.includes('mcdavid') || title.includes('crosby') || title.includes('ovechkin')) {
        return 'hockey';
    }
    
    // Soccer indicators
    if (title.includes('soccer') || title.includes('mls') || 
        title.includes('messi') || title.includes('ronaldo') || title.includes('mbappe')) {
        return 'soccer';
    }
    
    return 'unknown';
}

// Function to get sport-specific parallel exclusions
function getParallelExclusions(cardTitle) {
    const sport = detectSport(cardTitle);
    const exclusions = [...PARALLEL_FILTERS.universal];
    
    if (sport !== 'unknown' && PARALLEL_FILTERS[sport]) {
        // Add all sport-specific parallels
        Object.values(PARALLEL_FILTERS[sport]).forEach(parallelList => {
            exclusions.push(...parallelList);
        });
    }
    
    return exclusions;
}

// Enhanced filtering function for all sports
function filterCardBySport(card, cardType = 'raw') {
    const title = card.title?.toLowerCase() || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Must NOT contain graded terms
    const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
    const hasGradedTerm = gradedTerms.some(term => title.includes(term));
    
    // Get sport-specific parallel exclusions
    const parallelExclusions = getParallelExclusions(card.title);
    const hasExpensiveParallel = parallelExclusions.some(term => title.includes(term));
    
    // Must contain base card terms (extract from title)
    const words = card.title?.split(' ') || [];
    const baseCardTerms = words.filter(word => 
        word.length > 2 && !word.includes('#') && !word.includes('$')
    ).slice(0, 3); // Take first 3 meaningful words
    
    const hasBaseCardTerms = baseCardTerms.length > 0;
    
    // Price thresholds based on card type and sport
    let maxPrice = 200; // Default for raw cards
    if (cardType === 'psa9') {
        maxPrice = 500;
    } else if (cardType === 'psa10') {
        maxPrice = 1000;
    }
    
    const isReasonablePrice = price > 0 && price < maxPrice;
    
    return !hasGradedTerm && !hasExpensiveParallel && hasBaseCardTerms && isReasonablePrice;
}

// Test function for different sports
async function testMultiSportFiltering() {
    console.log('🏈⚾🏀🏒⚽ MULTI-SPORT PARALLEL FILTERING TEST');
    console.log('=============================================');
    
    const testCards = [
        "2018 Donruss Optic Luka Doncic #177", // Basketball
        "2020 Panini Prizm Justin Herbert #280", // Football
        "2018 Topps Chrome Shohei Ohtani #150", // Baseball
        "2016 Upper Deck Connor McDavid #201", // Hockey
        "2022 Panini Prizm Kylian Mbappe #50" // Soccer
    ];
    
    for (const cardTitle of testCards) {
        console.log(`\n🔍 Testing: ${cardTitle}`);
        console.log(`Sport detected: ${detectSport(cardTitle)}`);
        
        const exclusions = getParallelExclusions(cardTitle);
        console.log(`Parallel exclusions: ${exclusions.slice(0, 10).join(', ')}...`);
        
        // Test search
        try {
            const results = await search130point(cardTitle, 20);
            const rawCards = results.filter(card => filterCardBySport(card, 'raw'));
            const psa9Cards = results.filter(card => filterCardBySport(card, 'psa9'));
            
            console.log(`Raw cards found: ${rawCards.length}`);
            console.log(`PSA 9 cards found: ${psa9Cards.length}`);
            
            // Show examples
            if (rawCards.length > 0) {
                console.log(`Sample raw card: ${rawCards[0].title} - $${rawCards[0].price?.value || 'N/A'}`);
            }
            
        } catch (error) {
            console.log(`Error testing ${cardTitle}: ${error.message}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Run the multi-sport test
if (require.main === module) {
    testMultiSportFiltering().catch(console.error);
}

module.exports = { 
    PARALLEL_FILTERS, 
    detectSport, 
    getParallelExclusions, 
    filterCardBySport 
}; 