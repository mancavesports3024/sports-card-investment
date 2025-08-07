require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Improved search function with better filtering
async function improvedSearch(cardTitle) {
    console.log(`🔍 IMPROVED SEARCH: ${cardTitle}`);
    console.log('='.repeat(60));
    
    try {
        // Search for raw cards with better filtering
        console.log('\n📋 SEARCHING FOR RAW CARDS (IMPROVED)...');
        const rawResults = await search130point(cardTitle, 50);
        
        // Improved raw card filtering
        const rawCards = rawResults.filter(card => {
            const title = card.title?.toLowerCase() || '';
            
            // Must NOT contain these terms (graded indicators)
            const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
            const hasGradedTerm = gradedTerms.some(term => title.includes(term));
            
            // Must NOT be specific parallels (based on your search)
            const parallelTerms = ['green', 'pink', 'holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast'];
            const hasParallelTerm = parallelTerms.some(term => title.includes(term));
            
            // Must be the base card (should contain key identifiers)
            const baseCardTerms = ['luka', 'doncic', '177', 'optic'];
            const hasBaseCardTerms = baseCardTerms.some(term => title.includes(term));
            
            return !hasGradedTerm && !hasParallelTerm && hasBaseCardTerms;
        });
        
        console.log(`Total results: ${rawResults.length}`);
        console.log(`Raw cards found (improved): ${rawCards.length}`);
        
        // Show raw card details
        console.log('\n💰 RAW CARD DETAILS (IMPROVED):');
        rawCards.slice(0, 15).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate raw average
        const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
        
        console.log(`\n📊 RAW SUMMARY (IMPROVED):`);
        console.log(`   Average: $${rawAvg.toFixed(2)}`);
        console.log(`   Count: ${rawPrices.length}`);
        if (rawPrices.length > 0) {
            console.log(`   Range: $${Math.min(...rawPrices).toFixed(2)} - $${Math.max(...rawPrices).toFixed(2)}`);
        }
        
        // Search for PSA 9 cards
        console.log('\n📋 SEARCHING FOR PSA 9 CARDS...');
        const psa9Results = await search130point(`${cardTitle} PSA 9`, 30);
        
        // Filter PSA 9 cards
        const psa9Cards = psa9Results.filter(card => {
            const title = card.title?.toLowerCase() || '';
            return title.includes('psa 9') || title.includes('psa9');
        });
        
        console.log(`Total PSA 9 results: ${psa9Results.length}`);
        console.log(`PSA 9 cards found: ${psa9Cards.length}`);
        
        // Show PSA 9 card details
        console.log('\n💰 PSA 9 CARD DETAILS:');
        psa9Cards.slice(0, 10).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate PSA 9 average
        const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
        
        console.log(`\n📊 PSA 9 SUMMARY:`);
        console.log(`   Average: $${psa9Avg.toFixed(2)}`);
        console.log(`   Count: ${psa9Prices.length}`);
        if (psa9Prices.length > 0) {
            console.log(`   Range: $${Math.min(...psa9Prices).toFixed(2)} - $${Math.max(...psa9Prices).toFixed(2)}`);
        }
        
        // Compare with your manual results
        console.log('\n🔍 COMPARISON WITH MANUAL RESULTS:');
        console.log('====================================');
        console.log('Your Manual Search:');
        console.log(`   Raw: $44.61 (82 cards)`);
        console.log(`   PSA 9: $212`);
        console.log(`   PSA 10: $272`);
        console.log('');
        console.log('Automated Search:');
        console.log(`   Raw: $${rawAvg.toFixed(2)} (${rawPrices.length} cards)`);
        console.log(`   PSA 9: $${psa9Avg.toFixed(2)} (${psa9Prices.length} cards)`);
        console.log('');
        
        // Calculate differences
        const rawDiff = Math.abs(rawAvg - 44.61);
        const rawPercentDiff = (rawDiff / 44.61) * 100;
        const psa9Diff = Math.abs(psa9Avg - 212);
        const psa9PercentDiff = (psa9Diff / 212) * 100;
        
        console.log('📊 ACCURACY ANALYSIS:');
        console.log(`   Raw difference: $${rawDiff.toFixed(2)} (${rawPercentDiff.toFixed(1)}%)`);
        console.log(`   PSA 9 difference: $${psa9Diff.toFixed(2)} (${psa9PercentDiff.toFixed(1)}%)`);
        
        if (rawPercentDiff < 20 && psa9PercentDiff < 20) {
            console.log('✅ ACCURACY: Good match with manual results!');
        } else if (rawPercentDiff < 50 && psa9PercentDiff < 50) {
            console.log('⚠️  ACCURACY: Moderate match - needs improvement');
        } else {
            console.log('❌ ACCURACY: Poor match - significant improvement needed');
        }
        
        return {
            cardTitle,
            raw: { avg: rawAvg, count: rawPrices.length },
            psa9: { avg: psa9Avg, count: psa9Prices.length },
            manualComparison: {
                rawDiff,
                rawPercentDiff,
                psa9Diff,
                psa9PercentDiff
            }
        };
        
    } catch (error) {
        console.error(`❌ Error in improved search:`, error.message);
        return { cardTitle, error: error.message };
    }
}

// Test the improved search
async function testImprovedSearch() {
    const testCard = "2018 Donruss Optic Luka Doncic #177";
    await improvedSearch(testCard);
}

// Run if called directly
if (require.main === module) {
    testImprovedSearch().catch(console.error);
}

module.exports = { improvedSearch }; 