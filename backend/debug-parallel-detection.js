const { ULTIMATE_SPORT_FILTERS, detectSport, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

function debugParallelDetection() {
    console.log('🔍 Debugging Parallel Detection...\n');
    
    const cardTitle = '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10';
    const title = cardTitle.toLowerCase();
    const sport = detectSport(cardTitle);
    
    console.log(`Card: "${cardTitle}"`);
    console.log(`Sport: ${sport}`);
    console.log(`Title (lowercase): "${title}"`);
    console.log('');
    
    // Check universal exclusions
    console.log('🔍 Universal Exclusions Check:');
    const universalMatches = ULTIMATE_SPORT_FILTERS.universal.filter(term => title.includes(term));
    console.log(`  Universal matches: [${universalMatches.join(', ')}]`);
    console.log('');
    
    // Check sport-specific base parallels
    console.log('🎨 Sport Base Parallels Check:');
    if (ULTIMATE_SPORT_FILTERS.sportBase[sport]) {
        const baseMatches = ULTIMATE_SPORT_FILTERS.sportBase[sport].filter(term => title.includes(term));
        console.log(`  Base parallel matches: [${baseMatches.join(', ')}]`);
    } else {
        console.log(`  No base parallels defined for sport: ${sport}`);
    }
    console.log('');
    
    // Check if it's a base parallel
    const isBaseParallelCard = isBaseParallel(cardTitle);
    console.log(`Is Base Parallel: ${isBaseParallelCard}`);
    
    // Check if it has expensive parallel
    const hasExpensiveParallel = ULTIMATE_SPORT_FILTERS.universal.some(term => title.includes(term));
    console.log(`Has Expensive Parallel: ${hasExpensiveParallel}`);
    
    // Check the specific terms
    console.log('\n🔍 Specific Term Analysis:');
    console.log(`  Contains "pink": ${title.includes('pink')}`);
    console.log(`  Contains "refractor": ${title.includes('refractor')}`);
    console.log(`  Contains "pink refractor": ${title.includes('pink refractor')}`);
    
    // Check if "pink refractor" is in football base parallels
    if (ULTIMATE_SPORT_FILTERS.sportBase.football) {
        console.log('\n🏈 Football Base Parallels:');
        ULTIMATE_SPORT_FILTERS.sportBase.football.forEach(parallel => {
            console.log(`  "${parallel}": ${title.includes(parallel)}`);
        });
    }
}

debugParallelDetection();
