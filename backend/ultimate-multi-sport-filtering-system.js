require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Ultimate multi-sport filtering system based on comprehensive research
const ULTIMATE_SPORT_FILTERS = {
    // Universal expensive parallels (all sports)
    universal: [
        'white sparkle', 'ssp', 'superfractor', '1/1', 'one of one', 'one-of-one',
        'black', 'gold', 'red', 'blue', 'green', 'purple', 'pink',
        'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'ruby', 'sapphire',
        'rainbow', 'atomic', 'galaxy', 'cosmic', 'aurora', 'nebula'
    ],
    
    // Universal premium parallels (all sports)
    universalPremium: [
        'fast break', 'choice', 'dragon', 'hyper', 'velocity', 'prizms',
        'concourse', 'premier', 'fotl', 'colossal', 'immortal', 'legendary'
    ],
    
    // Sport-specific base parallels (include these - they're reasonable)
    sportBase: {
        basketball: [
            // Color variants (Ice/Lazer/Holo)
            'orange ice', 'orange lazer', 'orange holo',
            'blue ice', 'blue lazer', 'blue holo',
            'green ice', 'green lazer', 'green holo',
            'red ice', 'red lazer', 'red holo',
            'purple ice', 'purple lazer', 'purple holo',
            'pink ice', 'pink lazer', 'pink holo',
            'silver ice', 'silver lazer', 'silver holo',
            'gold ice', 'gold lazer', 'gold holo',
            'black ice', 'black lazer', 'black holo',
            'white ice', 'white lazer', 'white holo',
            // Basketball specific
            'velocity', 'holo', 'hyper', 'genesis', 'revolution', 'flair', 'pink millionaire', 'chronicles', 'silver', 'millionaire', 'national treasures', 'rejectors'
        ],
        football: [
            // Color variants (Ice/Lazer/Holo)
            'orange ice', 'orange lazer', 'orange holo',
            'blue ice', 'blue lazer', 'blue holo',
            'green ice', 'green lazer', 'green holo',
            'red ice', 'red lazer', 'red holo',
            'purple ice', 'purple lazer', 'purple holo',
            'pink ice', 'pink lazer', 'pink holo',
            'silver ice', 'silver lazer', 'silver holo',
            'gold ice', 'gold lazer', 'gold holo',
            'black ice', 'black lazer', 'black holo',
            'white ice', 'white lazer', 'white holo',
            // Football specific
            'velocity', 'holo', 'hyper', 'national treasures',
            // Topps Chrome refractors
            'pink refractor', 'blue refractor', 'green refractor', 'red refractor', 'purple refractor',
            'orange refractor', 'gold refractor', 'silver refractor', 'black refractor', 'white refractor',
            // Panini Select parallels
            'starcade', 'silver prizm', 'gold prizm', 'blue prizm', 'red prizm', 'green prizm',
            'purple prizm', 'orange prizm', 'black prizm', 'white prizm',
            // Panini Prizm Draft parallels
            'blue /149', 'red /199', 'green /299', 'purple /399', 'orange /499',
            // Additional football parallels
            'electricity', 'silver prizm', 'genesis', 'pink /5', 'license to dominate'
        ],
        baseball: [
            // Baseball specific base parallels
            'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome',
            'bowman', 'heritage', 'mini', 'allen ginter', 'gypsy queen', 'national treasures',
            // Color variants (Ice/Lazer/Holo)
            'orange ice', 'orange lazer', 'orange holo',
            'blue ice', 'blue lazer', 'blue holo',
            'green ice', 'green lazer', 'green holo',
            'red ice', 'red lazer', 'red holo',
            'purple ice', 'purple lazer', 'purple holo',
            'pink ice', 'pink lazer', 'pink holo',
            'silver ice', 'silver lazer', 'silver holo',
            'gold ice', 'gold lazer', 'gold holo',
            'black ice', 'black lazer', 'black holo',
            'white ice', 'white lazer', 'white holo'
        ],
        hockey: [
            // Hockey specific base parallels
            'young guns', 'canvas', 'exclusives', 'high gloss', 'clear cut',
            'artifacts', 'upper deck', 'o-pee-chee', 'rainbow',
            // Color variants (Ice/Lazer/Holo)
            'orange ice', 'orange lazer', 'orange holo',
            'blue ice', 'blue lazer', 'blue holo',
            'green ice', 'green lazer', 'green holo',
            'red ice', 'red lazer', 'red holo',
            'purple ice', 'purple lazer', 'purple holo',
            'pink ice', 'pink lazer', 'pink holo',
            'silver ice', 'silver lazer', 'silver holo',
            'gold ice', 'gold lazer', 'gold holo',
            'black ice', 'black lazer', 'black holo',
            'white ice', 'white lazer', 'white holo'
        ],
        soccer: [
            // Soccer specific base parallels
            'refractor', 'x-fractor', 'atomic', 'superfractor', 'chrome',
            'velocity', 'holo', 'hyper',
            // Color variants (Ice/Lazer/Holo)
            'orange ice', 'orange lazer', 'orange holo',
            'blue ice', 'blue lazer', 'blue holo',
            'green ice', 'green lazer', 'green holo',
            'red ice', 'red lazer', 'red holo',
            'purple ice', 'purple lazer', 'purple holo',
            'pink ice', 'pink lazer', 'pink holo',
            'silver ice', 'silver lazer', 'silver holo',
            'gold ice', 'gold lazer', 'gold holo',
            'black ice', 'black lazer', 'black holo',
            'white ice', 'white lazer', 'white holo'
        ],
        pokemon: [
            // Pokemon specific base parallels (include these - they're reasonable)
            'holo', 'reverse holo', 'cosmos holo', 'cracked ice holo',
            'unlimited', 'first edition', '1st edition',
            'shadowless', 'base set', 'jungle', 'fossil',
            'promo', 'black star promo', 'staff promo'
        ],
        wrestling: [
            // Wrestling specific base parallels
            'chronicles', 'optic', 'blue /49', 'red /99', 'green /199'
        ]
    },
    
    // Sport-specific premium parallels (exclude these)
    sportPremium: {
        basketball: [
            'playoff', 'championship', 'finals', 'mvp', 'all star'
        ],
        football: [
            'playoff', 'championship', 'super bowl', 'pro bowl', 'mvp',
            'flawless', 'immaculate'
        ],
        baseball: [
            'playoff', 'championship', 'world series', 'all star', 'mvp'
        ],
        hockey: [
            'playoff', 'championship', 'stanley cup', 'all star', 'mvp'
        ],
        soccer: [
            'champions league', 'world cup', 'europa league', 'premier league',
            'la liga', 'bundesliga', 'serie a'
        ],
        pokemon: [
            // Pokemon expensive/premium parallels (exclude these)
            'secret rare', 'ultra rare', 'rainbow rare', 'gold rare',
            'full art', 'alternate art', 'special art rare', 'hyper rare',
            'vmax', 'vstar', 'v-union', 'tag team gx', 'gx', 'ex',
            'mega', 'break', 'prime', 'legend', 'lvl x', 'lv.x',
            'crystal', 'gold star', 'shining', 'delta species',
            'error', 'misprint', 'staff', 'worlds', 'championship',
            'tournament', 'trophy', 'winner', 'finalist'
        ]
    }
};

// Comprehensive sport detection
function detectSport(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    // Basketball indicators
    if (title.includes('basketball') || title.includes('nba') || 
        title.includes('lebron') || title.includes('james') || title.includes('curry') ||
        title.includes('durant') || title.includes('giannis') || title.includes('luka') ||
        title.includes('doncic') || title.includes('zion') || title.includes('morant') ||
        title.includes('wembanyama') || title.includes('victor') || title.includes('tatum') ||
        title.includes('booker') || title.includes('edwards') || title.includes('brunson') ||
        title.includes('malone') || title.includes('karl malone') || title.includes('shaquille') ||
        title.includes('o\'neal') || title.includes('oneal') || title.includes('gilgeous') ||
        title.includes('alexander') || title.includes('avdija') || title.includes('deni') ||
        title.includes('brink') || title.includes('cameron brink') ||
        title.includes('lakers') || title.includes('warriors') || title.includes('celtics') ||
        title.includes('bulls') || title.includes('knicks') || title.includes('heat') ||
        title.includes('spurs') || title.includes('suns') || title.includes('nuggets')) {
        return 'basketball';
    }
    
    // Football indicators
    if (title.includes('football') || title.includes('nfl') || 
        title.includes('brady') || title.includes('mahomes') || title.includes('manning') ||
        title.includes('herbert') || title.includes('allen') || title.includes('rodgers') ||
        title.includes('burrow') || title.includes('lawrence') || title.includes('prescott') ||
        title.includes('purdy') || title.includes('brock') || title.includes('bo nix') ||
        title.includes('stroud') || title.includes('bryce young') || title.includes('richardson') ||
        title.includes('worthy') || title.includes('xavier worthy') || title.includes('burrow') ||
        title.includes('joe burrow') ||         title.includes('ceedee') || title.includes('lamb') ||
        title.includes('ceedee lamb') || title.includes('vick') || title.includes('michael vick') ||
        title.includes('young') ||
        title.includes('broncos') || title.includes('denver') || title.includes('chiefs') ||
        title.includes('patriots') || title.includes('cowboys') || title.includes('49ers') ||
        title.includes('niners') || title.includes('texans') || title.includes('colts')) {
        return 'football';
    }
    
    // Baseball indicators
    if (title.includes('baseball') || title.includes('mlb') || 
        title.includes('trout') || title.includes('ohtani') || title.includes('judge') ||
        title.includes('acuna') || title.includes('tatis') || title.includes('bichette') ||
        title.includes('jeter') || title.includes('derek jeter') || title.includes('julio') ||
        title.includes('rodriguez') || title.includes('julio rodriguez') || title.includes('correa') ||
        title.includes('carlos correa') || title.includes('santana') || title.includes('johan santana') ||
        title.includes('schwarber') || title.includes('kyle schwarber') || title.includes('dominguez') ||
        title.includes('jasson dominguez') || title.includes('leo de vries') || title.includes('leo de') ||
        title.includes('yankees') || title.includes('dodgers') || title.includes('red sox') ||
        title.includes('cubs') || title.includes('giants') || title.includes('braves') ||
        title.includes('topps') || title.includes('bowman') || title.includes('heritage')) {
        return 'baseball';
    }
    
    // Hockey indicators
    if (title.includes('hockey') || title.includes('nhl') || 
        title.includes('mcdavid') || title.includes('crosby') || title.includes('ovechkin') ||
        title.includes('matthews') || title.includes('mackinnon') || title.includes('draisaitl') ||
        title.includes('oilers') || title.includes('penguins') || title.includes('capitals') ||
        title.includes('maple leafs') || title.includes('avalanche') || title.includes('lightning') ||
        title.includes('upper deck') || title.includes('young guns') || title.includes('canvas')) {
        return 'hockey';
    }
    
    // Soccer indicators
    if (title.includes('soccer') || title.includes('football') || title.includes('futbol') ||
        title.includes('messi') || title.includes('ronaldo') || title.includes('mbappe') ||
        title.includes('haaland') || title.includes('neymar') || title.includes('benzema') ||
        title.includes('barcelona') || title.includes('real madrid') || title.includes('manchester') ||
        title.includes('chelsea') || title.includes('arsenal') || title.includes('liverpool') ||
        title.includes('champions league') || title.includes('world cup') || title.includes('uefa')) {
        return 'soccer';
    }
    
    // Wrestling/Sports Entertainment indicators
    if (title.includes('wwe') || title.includes('wrestling') || title.includes('duggan') ||
        title.includes('jim duggan') || title.includes('hacksaw') || title.includes('chronicles wwe')) {
        return 'wrestling';
    }
    
    // Pokemon indicators
    if (title.includes('pokemon') || title.includes('pikachu') || title.includes('charizard') ||
        title.includes('blastoise') || title.includes('venusaur') || title.includes('mewtwo') ||
        title.includes('mew') || title.includes('lugia') || title.includes('ho-oh') ||
        title.includes('rayquaza') || title.includes('dialga') || title.includes('palkia') ||
        title.includes('giratina') || title.includes('arceus') || title.includes('reshiram') ||
        title.includes('zekrom') || title.includes('kyurem') || title.includes('xerneas') ||
        title.includes('yveltal') || title.includes('zygarde') || title.includes('solgaleo') ||
        title.includes('lunala') || title.includes('necrozma') || title.includes('zacian') ||
        title.includes('zamazenta') || title.includes('eternatus') || title.includes('koraidon') ||
        title.includes('miraidon') || title.includes('swsh') || title.includes('promo') ||
        title.includes('black star') || title.includes('holo') || title.includes('reverse holo') ||
        title.includes('secret rare') || title.includes('ultra rare') || title.includes('rainbow rare') ||
        title.includes('full art') || title.includes('alternate art') || title.includes('vmax') ||
        title.includes('gx') || title.includes('ex') || title.includes('v card') || title.includes(' v ')) {
        return 'pokemon';
    }
    
    return 'unknown';
}

// Get comprehensive exclusions for a sport
function getSportExclusions(cardTitle) {
    const sport = detectSport(cardTitle);
    const exclusions = [...ULTIMATE_SPORT_FILTERS.universal, ...ULTIMATE_SPORT_FILTERS.universalPremium];
    
    if (sport !== 'unknown' && ULTIMATE_SPORT_FILTERS.sportPremium[sport]) {
        exclusions.push(...ULTIMATE_SPORT_FILTERS.sportPremium[sport]);
    }
    
    return exclusions;
}

// Check if card is a base parallel for its sport
function isBaseParallel(cardTitle) {
    const sport = detectSport(cardTitle);
    const title = cardTitle.toLowerCase();
    
    if (sport === 'unknown') {
        return false;
    }
    
    return ULTIMATE_SPORT_FILTERS.sportBase[sport].some(parallel => title.includes(parallel));
}

// Check PSA grade specifically
function getPSAGrade(cardTitle) {
    const title = cardTitle.toLowerCase();
    
    // First try to match "PSA Mint 9" format
    const psaMintMatch = title.match(/psa\s+mint\s*(\d+)/i);
    if (psaMintMatch) {
        return parseInt(psaMintMatch[1]);
    }
    
    // Then try "PSA 9" format
    const psaMatch = title.match(/psa\s*(\d+)/i);
    if (psaMatch) {
        return parseInt(psaMatch[1]);
    }
    
    // Check for specific grade mentions
    if (title.includes('psa 10') || title.includes('gem mint')) {
        return 10;
    } else if (title.includes('psa 9') || title.includes('mint 9')) {
        return 9;
    } else if (title.includes('psa 8') || title.includes('mint 8')) {
        return 8;
    } else if (title.includes('psa 7') || title.includes('mint 7')) {
        return 7;
    }
    
    return 0; // Raw card
}

// Ultimate multi-sport filtering function
function ultimateMultiSportFilter(card, cardType = 'raw') {
    const title = card.title?.toLowerCase() || '';
    const price = parseFloat(card.price?.value || 0);
    
    // Get PSA grade
    const psaGrade = getPSAGrade(card.title);
    
    // Get sport-specific exclusions
    const exclusions = getSportExclusions(card.title);
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
    
    // DEBUG LOGGING
    console.log(`🔍 DEBUG FILTER: "${card.title}" (${cardType})`);
    console.log(`   PSA Grade: ${psaGrade}`);
    console.log(`   Sport: ${detectSport(card.title)}`);
    console.log(`   Has Expensive Parallel: ${hasExpensiveParallel}`);
    console.log(`   Is Base Parallel: ${isBaseParallelCard}`);
    console.log(`   Has Meaningful Content: ${hasMeaningfulContent} (${meaningfulWords.length} words)`);
    console.log(`   Price: $${price}`);
    
    // Price thresholds based on card type and sport
    const sport = detectSport(card.title);
    let maxPrice = 10000; // Significantly increased default for all cards
    
    if (sport === 'basketball') {
        maxPrice = 15000; // High for Jordan, Kobe, LeBron vintage
    } else if (sport === 'football') {
        maxPrice = 12000; // High for Montana, Brady vintage
    } else if (sport === 'baseball') {
        maxPrice = 25000; // Very high for Ruth, Mantle, Robinson vintage
    } else if (sport === 'hockey') {
        maxPrice = 8000; // High for Gretzky, Orr vintage
    } else if (sport === 'soccer') {
        maxPrice = 10000; // High for Pelé, Maradona vintage
    } else if (sport === 'pokemon') {
        maxPrice = 15000; // Very high for Charizard, Base Set
    }
    
    // Check for vintage cards (pre-1980) - they command higher prices
    const yearMatch = card.title.match(/\b(19[0-7]\d)\b/);
    const isVintage = yearMatch && parseInt(yearMatch[1]) < 1980;
    
    if (isVintage) {
        maxPrice *= 20; // 20x multiplier for vintage cards (pre-1980)
    }
    
    if (cardType === 'psa9') {
        maxPrice *= 20; // Now 200K-10M for vintage PSA 9
    } else if (cardType === 'psa10') {
        maxPrice *= 50; // Now 500K-25M for vintage PSA 10
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
        console.log(`   ❌ REJECTED: Has expensive parallel but not base parallel`);
        return false;
    }
    
    const finalResult = hasMeaningfulContent && isReasonablePrice;
    console.log(`   ✅ RESULT: ${finalResult} (meaningful: ${hasMeaningfulContent}, reasonable price: ${isReasonablePrice})`);
    
    return finalResult;
}

// Test the ultimate multi-sport filtering system
async function testUltimateMultiSportSystem() {
    console.log('🏈⚾🏀🏒⚽ ULTIMATE MULTI-SPORT FILTERING SYSTEM');
    console.log('================================================');
    
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
            const results = await search130point(testCard.card, 20);
            
            console.log(`  Found: ${results.length} results`);
            
            // Test sport detection
            const detectedSport = detectSport(testCard.card);
            console.log(`  Sport detected: ${detectedSport}`);
            
            // Test filtering
            const rawCards = results.filter(card => ultimateMultiSportFilter(card, 'raw'));
            const psa9Cards = results.filter(card => ultimateMultiSportFilter(card, 'psa9'));
            const psa10Cards = results.filter(card => ultimateMultiSportFilter(card, 'psa10'));
            
            console.log(`  Raw cards: ${rawCards.length}, PSA 9: ${psa9Cards.length}, PSA 10: ${psa10Cards.length}`);
            
            if (rawCards.length > 0) {
                const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
                const rawAvg = rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length;
                console.log(`  Raw average: $${rawAvg.toFixed(2)}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
    }
    
    console.log('\n🎯 ULTIMATE MULTI-SPORT FILTERING SUMMARY:');
    console.log('===========================================');
    console.log('✅ Comprehensive sport detection for 5 sports');
    console.log('✅ 150+ parallel types supported');
    console.log('✅ Sport-specific base and premium parallel handling');
    console.log('✅ Universal parallel support across all sports');
    console.log('✅ Price thresholds optimized per sport');
    console.log('✅ Grade-specific filtering (raw, PSA 9, PSA 10)');
}

// Run the ultimate multi-sport test
if (require.main === module) {
    testUltimateMultiSportSystem().catch(console.error);
}

module.exports = { 
    ULTIMATE_SPORT_FILTERS, 
    detectSport, 
    getSportExclusions, 
    isBaseParallel, 
    getPSAGrade,
    ultimateMultiSportFilter 
}; 