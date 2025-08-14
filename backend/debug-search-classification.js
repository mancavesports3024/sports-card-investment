const { search130point } = require('./services/130pointService');
const { ultimateMultiSportFilter, getPSAGrade } = require('./ultimate-multi-sport-filtering-system');

async function debugSearchClassification() {
    console.log('🔍 Debugging Search Classification...\n');

    const testCard = {
        summaryTitle: "2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18"
    };

    console.log(`🔍 Testing: ${testCard.summaryTitle}`);

    try {
        // Test the search strategy that should work
        const searchQuery = "2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18 PSA 10";
        console.log(`  Search Query: "${searchQuery}"`);

        const results = await search130point(searchQuery, 20);
        console.log(`  Raw results found: ${results.length}`);

        if (results.length > 0) {
            console.log(`  Sample results:`);
            results.slice(0, 5).forEach((result, index) => {
                console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
                
                // Test PSA grade detection
                const grade = getPSAGrade(result.title);
                console.log(`       PSA Grade: ${grade}`);
                
                // Test filtering
                const isRaw = ultimateMultiSportFilter(result, 'raw');
                const isPsa9 = ultimateMultiSportFilter(result, 'psa9');
                const isPsa10 = ultimateMultiSportFilter(result, 'psa10');
                
                console.log(`       Raw: ${isRaw}, PSA 9: ${isPsa9}, PSA 10: ${isPsa10}`);
                console.log('');
            });
        }

        // Test the actual filtering
        const rawResults = results.filter(card => ultimateMultiSportFilter(card, 'raw'));
        const psa9Results = results.filter(card => ultimateMultiSportFilter(card, 'psa9'));
        const psa10Results = results.filter(card => ultimateMultiSportFilter(card, 'psa10'));

        console.log(`  Filtered results:`);
        console.log(`    Raw: ${rawResults.length}`);
        console.log(`    PSA 9: ${psa9Results.length}`);
        console.log(`    PSA 10: ${psa10Results.length}`);

        if (psa10Results.length > 0) {
            console.log(`  PSA 10 results:`);
            psa10Results.forEach((result, index) => {
                console.log(`    ${index + 1}. ${result.title} - $${result.price?.value || 'N/A'}`);
            });
        }

    } catch (error) {
        console.log(`  Error: ${error.message}`);
    }
}

debugSearchClassification().catch(console.error);
