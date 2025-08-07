require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Final accurate search with proper filtering
async function finalAccurateSearch() {
    console.log('🎯 FINAL ACCURATE SEARCH');
    console.log('========================');
    console.log('Implementing proper filtering to match manual results');
    console.log('');
    
    try {
        // Search for raw cards
        console.log('📋 SEARCHING FOR RAW CARDS...');
        const rawResults = await search130point("Luka Doncic Donruss Optic #177", 150);
        
        console.log(`Total results: ${rawResults.length}`);
        
        // Advanced filtering to match manual search
        const rawCards = rawResults.filter(card => {
            const title = card.title?.toLowerCase() || '';
            const price = parseFloat(card.price?.value || 0);
            
            // Must NOT contain graded terms
            const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
            const hasGradedTerm = gradedTerms.some(term => title.includes(term));
            
            // Must NOT contain expensive parallel terms
            const expensiveParallels = [
                'white sparkle', 'ssp', 'checkerboard', 'prizms', 'choice',
                'green', 'pink', 'holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast'
            ];
            const hasExpensiveParallel = expensiveParallels.some(term => title.includes(term));
            
            // Must contain base card terms
            const baseCardTerms = ['luka', 'doncic', '177', 'optic'];
            const hasBaseCardTerms = baseCardTerms.some(term => title.includes(term));
            
            // Price sanity check - exclude extremely expensive cards
            const isReasonablePrice = price > 0 && price < 500; // Base cards shouldn't be >$500
            
            return !hasGradedTerm && !hasExpensiveParallel && hasBaseCardTerms && isReasonablePrice;
        });
        
        console.log(`Raw cards found (filtered): ${rawCards.length}`);
        
        // Show raw card details
        console.log('\n💰 RAW CARD DETAILS (FILTERED):');
        rawCards.slice(0, 20).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate raw average
        const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
        
        console.log(`\n📊 RAW SUMMARY (FILTERED):`);
        console.log(`   Average: $${rawAvg.toFixed(2)}`);
        console.log(`   Count: ${rawPrices.length}`);
        if (rawPrices.length > 0) {
            console.log(`   Range: $${Math.min(...rawPrices).toFixed(2)} - $${Math.max(...rawPrices).toFixed(2)}`);
        }
        
        // Search for PSA 9 cards
        console.log('\n📋 SEARCHING FOR PSA 9 CARDS...');
        const psa9Results = await search130point("Luka Doncic Donruss Optic #177 PSA 9", 100);
        
        console.log(`Total PSA 9 results: ${psa9Results.length}`);
        
        // Filter PSA 9 cards
        const psa9Cards = psa9Results.filter(card => {
            const title = card.title?.toLowerCase() || '';
            const price = parseFloat(card.price?.value || 0);
            
            // Must contain PSA 9
            const hasPsa9 = title.includes('psa 9') || title.includes('psa9');
            
            // Must NOT contain expensive parallel terms
            const expensiveParallels = [
                'white sparkle', 'ssp', 'checkerboard', 'prizms', 'choice',
                'green', 'pink', 'holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast'
            ];
            const hasExpensiveParallel = expensiveParallels.some(term => title.includes(term));
            
            // Must contain base card terms
            const baseCardTerms = ['luka', 'doncic', '177', 'optic'];
            const hasBaseCardTerms = baseCardTerms.some(term => title.includes(term));
            
            // Price sanity check for PSA 9
            const isReasonablePrice = price > 0 && price < 1000; // PSA 9 base shouldn't be >$1000
            
            return hasPsa9 && !hasExpensiveParallel && hasBaseCardTerms && isReasonablePrice;
        });
        
        console.log(`PSA 9 cards found (filtered): ${psa9Cards.length}`);
        
        // Show PSA 9 card details
        console.log('\n💰 PSA 9 CARD DETAILS (FILTERED):');
        psa9Cards.slice(0, 15).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate PSA 9 average
        const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
        
        console.log(`\n📊 PSA 9 SUMMARY (FILTERED):`);
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
        console.log('Automated Search (Final Filtered):');
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
            console.log('✅ ACCURACY: Excellent match with manual results!');
        } else if (rawPercentDiff < 50 && psa9PercentDiff < 50) {
            console.log('⚠️  ACCURACY: Good match - minor differences');
        } else {
            console.log('❌ ACCURACY: Still needs improvement');
        }
        
        // Recommendations for improvement
        console.log('\n💡 RECOMMENDATIONS:');
        if (rawPercentDiff > 50) {
            console.log('   - Raw filtering needs refinement');
            console.log('   - Consider adding more exclusion terms');
        }
        if (psa9PercentDiff > 50) {
            console.log('   - PSA 9 filtering needs refinement');
            console.log('   - May need to adjust price thresholds');
        }
        
        return {
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
        console.error(`❌ Error in final accurate search:`, error.message);
        return { error: error.message };
    }
}

// Run the final accurate search
if (require.main === module) {
    finalAccurateSearch().catch(console.error);
}

module.exports = { finalAccurateSearch }; 