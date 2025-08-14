const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter, detectSport, getPSAGrade, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

async function debugRailwayCards() {
    console.log('🔍 Debugging Railway Cards PSA 10 Issues...\n');
    
    const testCards = [
        {
            title: '2024 Ladd Mcconkey Topps Chrome Pink Refractor',
            summary: '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10'
        },
        {
            title: '2024 Picks Football Panini Prizm Draft Blue /149 Auto',
            summary: '2024 Panini Prizm Draft Picks Football - Auto - Jaxson Dart Blue /149 PSA 10'
        },
        {
            title: '2024 Xavier Worthy Panini Select Silver Prizm #17',
            summary: '2024 Panini Select Xavier Worthy 17 STARCADE Silver Prizm, Case Hit SSP PSA 10'
        },
        {
            title: '2024 Leo DE Bowman Wave Silver Refractor #TP-18',
            summary: 'LEO DE VRIES 2024 Bowman\'s Best Prospect #TP-18 Silver Wave Refractor PSA 10 GEM'
        },
        {
            title: '1991-92 Karl Malone Dream USA Basketball Skybox #535',
            summary: '1991-92 Skybox #535 Karl Malone PSA 10 Gem Mint USA Basketball Dream Team!'
        }
    ];
    
    for (const card of testCards) {
        console.log(`\n🔍 Testing: ${card.title}`);
        console.log(`Summary: ${card.summary}`);
        
        // Test sport detection
        const sport = detectSport(card.title);
        console.log(`Sport detected: ${sport}`);
        
        // Test PSA grade detection
        const psaGrade = getPSAGrade(card.title);
        console.log(`PSA Grade detected: ${psaGrade}`);
        
        // Test base parallel detection
        const isBase = isBaseParallel(card.title);
        console.log(`Is base parallel: ${isBase}`);
        
        // Test different search strategies
        const searchQueries = [
            `${card.title} PSA 10`,
            `${card.summary} PSA 10`,
            `${card.title.replace('2024 ', '')} PSA 10`,
            `${card.title.replace('2024 ', '').replace('1991-92 ', '')} PSA 10`
        ];
        
        for (const query of searchQueries) {
            console.log(`\n📝 Testing search: "${query}"`);
            
            try {
                const results = await search130point(query, 15);
                console.log(`  Raw results: ${results.length}`);
                
                if (results.length > 0) {
                    console.log('  First 5 results:');
                    results.slice(0, 5).forEach((result, index) => {
                        console.log(`    ${index + 1}. ${result.title}`);
                        console.log(`       Price: $${result.price?.value || 'N/A'}`);
                        console.log(`       Grade: ${result.grade || 'N/A'}`);
                        
                        // Test filtering for this specific result
                        const isPSA10 = ultimateMultiSportFilter(result, 'psa10');
                        console.log(`       PSA 10 Filter: ${isPSA10 ? '✅ PASS' : '❌ FAIL'}`);
                    });
                    
                    // Test PSA 10 filtering
                    const psa10Results = results.filter(result => ultimateMultiSportFilter(result, 'psa10'));
                    console.log(`  PSA 10 filtered results: ${psa10Results.length}`);
                    
                    if (psa10Results.length > 0) {
                        console.log('  ✅ PSA 10 results found:');
                        psa10Results.forEach((result, index) => {
                            console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
                        });
                        
                        const avgPrice = psa10Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa10Results.length;
                        console.log(`  Average PSA 10 price: $${avgPrice.toFixed(2)}`);
                    } else {
                        console.log('  ❌ No PSA 10 results after filtering');
                        
                        // Debug why filtering failed
                        console.log('  🔍 Debugging filter failures:');
                        results.slice(0, 3).forEach((result, index) => {
                            console.log(`    Result ${index + 1}: "${result.title}"`);
                            
                            const title = result.title.toLowerCase();
                            const price = parseFloat(result.price?.value || 0);
                            const psaGrade = getPSAGrade(result.title);
                            const sport = detectSport(result.title);
                            const isBaseParallelCard = isBaseParallel(result.title);
                            
                            console.log(`      Price: $${price}, PSA Grade: ${psaGrade}, Sport: ${sport}, Base Parallel: ${isBaseParallelCard}`);
                            
                            // Check each filter condition
                            const words = result.title.split(' ');
                            const meaningfulWords = words.filter(word => 
                                word.length > 2 && !word.includes('#') && !word.includes('$') && 
                                !word.includes('psa') && !word.includes('graded')
                            );
                            const hasMeaningfulContent = meaningfulWords.length >= 3;
                            
                            let maxPrice = 10000;
                            if (sport === 'football') maxPrice = 12000;
                            if (psaGrade === 10) maxPrice *= 50;
                            
                            const isReasonablePrice = price > 0 && price < maxPrice;
                            const gradeCheck = psaGrade === 10;
                            
                            console.log(`      Meaningful content: ${hasMeaningfulContent}, Reasonable price: ${isReasonablePrice}, Grade check: ${gradeCheck}`);
                        });
                    }
                } else {
                    console.log('  ❌ No results found');
                }
                
            } catch (error) {
                console.error(`  ❌ Error searching "${query}":`, error.message);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n' + '='.repeat(80));
    }
}

debugRailwayCards().catch(console.error);
