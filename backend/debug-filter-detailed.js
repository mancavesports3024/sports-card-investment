const { ultimateMultiSportFilter, detectSport, getPSAGrade, getSportExclusions, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

function debugFilterDetailed() {
    console.log('🔍 Detailed Filter Debug for Ladd McConkey...\n');
    
    const cardTitle = '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10';
    const card = {
        title: cardTitle,
        price: { value: '49.00' }
    };
    
    console.log(`Card: "${cardTitle}"`);
    console.log(`Price: $${card.price.value}`);
    console.log('');
    
    // Test each component
    const title = card.title.toLowerCase();
    const price = parseFloat(card.price.value);
    const psaGrade = getPSAGrade(card.title);
    const sport = detectSport(card.title);
    const exclusions = getSportExclusions(card.title);
    const hasExpensiveParallel = exclusions.some(term => title.includes(term));
    const isBaseParallelCard = isBaseParallel(card.title);
    
    console.log('🔧 Component Analysis:');
    console.log(`  Title (lowercase): "${title}"`);
    console.log(`  Price: $${price}`);
    console.log(`  PSA Grade: ${psaGrade}`);
    console.log(`  Sport: ${sport}`);
    console.log(`  Has Expensive Parallel: ${hasExpensiveParallel}`);
    console.log(`  Is Base Parallel: ${isBaseParallelCard}`);
    console.log('');
    
    // Check meaningful content
    const words = card.title.split(' ');
    const meaningfulWords = words.filter(word => 
        word.length > 2 && !word.includes('#') && !word.includes('$') && 
        !word.includes('psa') && !word.includes('graded')
    );
    const hasMeaningfulContent = meaningfulWords.length >= 3;
    
    console.log('📝 Content Analysis:');
    console.log(`  All words: [${words.join(', ')}]`);
    console.log(`  Meaningful words: [${meaningfulWords.join(', ')}]`);
    console.log(`  Meaningful word count: ${meaningfulWords.length}`);
    console.log(`  Has meaningful content: ${hasMeaningfulContent}`);
    console.log('');
    
    // Check price thresholds
    let maxPrice = 10000;
    if (sport === 'football') {
        maxPrice = 12000;
    }
    if (psaGrade === 10) {
        maxPrice *= 50; // 600,000 for football PSA 10
    }
    
    const isReasonablePrice = price > 0 && price < maxPrice;
    
    console.log('💰 Price Analysis:');
    console.log(`  Max price for ${sport} PSA ${psaGrade}: $${maxPrice.toLocaleString()}`);
    console.log(`  Actual price: $${price}`);
    console.log(`  Is reasonable price: ${isReasonablePrice}`);
    console.log('');
    
    // Grade-specific check
    const gradeCheck = psaGrade === 10;
    console.log('🏆 Grade Check:');
    console.log(`  Required grade: 10`);
    console.log(`  Actual grade: ${psaGrade}`);
    console.log(`  Grade check passed: ${gradeCheck}`);
    console.log('');
    
    // Expensive parallel check
    const parallelCheck = !(hasExpensiveParallel && !isBaseParallelCard);
    console.log('🎨 Parallel Check:');
    console.log(`  Has expensive parallel: ${hasExpensiveParallel}`);
    console.log(`  Is base parallel: ${isBaseParallelCard}`);
    console.log(`  Parallel check passed: ${parallelCheck}`);
    console.log('');
    
    // Final result
    const finalResult = hasMeaningfulContent && isReasonablePrice && gradeCheck && parallelCheck;
    console.log('🎯 Final Result:');
    console.log(`  Meaningful content: ${hasMeaningfulContent}`);
    console.log(`  Reasonable price: ${isReasonablePrice}`);
    console.log(`  Grade check: ${gradeCheck}`);
    console.log(`  Parallel check: ${parallelCheck}`);
    console.log(`  FINAL RESULT: ${finalResult ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test the actual function
    const actualResult = ultimateMultiSportFilter(card, 'psa10');
    console.log(`\n🔍 Actual function result: ${actualResult ? '✅ PASS' : '❌ FAIL'}`);
}

debugFilterDetailed();
