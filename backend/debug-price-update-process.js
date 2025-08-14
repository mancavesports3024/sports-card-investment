const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter, detectSport, getPSAGrade, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

async function debugPriceUpdateProcess() {
    console.log('🔍 Debugging Price Update Process...\n');

    const testCards = [
        {
            title: '2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18 PSA 10',
            searchQuery: 'Leo DE VRIES Bowman Wave Silver Refractor PSA 10'
        },
        {
            title: '1994-95 Shaquille O\'Neal Flair Rejectors PSA 10',
            searchQuery: 'Shaquille O\'Neal Flair Rejectors PSA 10'
        },
        {
            title: '2022 Joe Burrow Electricity Donruss Optic /65 PSA 10',
            searchQuery: 'Joe Burrow Electricity Donruss Optic PSA 10'
        },
        {
            title: '2023 Bryce Young National Treasures Rookies #TRC-BYG /99 PSA 10',
            searchQuery: 'Bryce Young National Treasures Rookies PSA 10'
        }
    ];

    for (const card of testCards) {
        console.log(`🔍 Testing: ${card.title}`);
        console.log(`  Search Query: ${card.searchQuery}`);

        try {
            // Test the actual search
            const results = await search130point(card.searchQuery, 20);
            console.log(`  Raw results found: ${results.length}`);

            if (results.length > 0) {
                console.log(`  Sample results:`);
                results.slice(0, 3).forEach((result, index) => {
                    console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
                });
            }

            // Test sport detection
            const sport = detectSport(card.title);
            console.log(`  Sport detected: ${sport}`);

            // Test PSA 10 filtering
            const psa10Results = results.filter(result => ultimateMultiSportFilter(result, 'psa10'));
            console.log(`  PSA 10 filtered results: ${psa10Results.length}`);

            if (psa10Results.length > 0) {
                console.log(`  PSA 10 prices found:`);
                psa10Results.slice(0, 3).forEach((result, index) => {
                    const price = parseFloat(result.price?.value || 0);
                    console.log(`    ${index + 1}. $${price.toFixed(2)} - ${result.title}`);
                });
            } else {
                console.log(`  ❌ No PSA 10 prices found after filtering`);
                
                // Debug why filtering failed
                console.log(`  🔍 Debugging filter failures:`);
                const psa10Cards = results.filter(result => {
                    const psaGrade = getPSAGrade(result.title);
                    return psaGrade === 10;
                });
                console.log(`    Cards with PSA 10 grade: ${psa10Cards.length}`);
                
                if (psa10Cards.length > 0) {
                    psa10Cards.slice(0, 2).forEach((result, index) => {
                        console.log(`    PSA 10 card ${index + 1}: ${result.title}`);
                        console.log(`      Price: $${result.price?.value || 'N/A'}`);
                        console.log(`      Is base parallel: ${isBaseParallel(result.title)}`);
                        console.log(`      Passes filter: ${ultimateMultiSportFilter(result, 'psa10')}`);
                    });
                }
            }

            console.log('');

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
            console.log(`  Error: ${error.message}`);
            console.log('');
        }
    }
}

debugPriceUpdateProcess().catch(console.error);
