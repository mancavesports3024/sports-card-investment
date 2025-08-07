require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Ultimate accurate search with comprehensive filtering
async function ultimateAccurateSearch() {
    console.log('🎯 ULTIMATE ACCURATE SEARCH');
    console.log('===========================');
    console.log('Using comprehensive exclusion strategy from manual search');
    console.log('');
    
    try {
        // Search for raw cards with comprehensive exclusions
        console.log('📋 SEARCHING FOR RAW CARDS (COMPREHENSIVE EXCLUSIONS)...');
        const rawResults = await search130point("Luka Doncic Donruss Optic #177", 200);
        
        console.log(`Total results: ${rawResults.length}`);
        
        // Comprehensive filtering based on your improved search
        const rawCards = rawResults.filter(card => {
            const title = card.title?.toLowerCase() || '';
            const price = parseFloat(card.price?.value || 0);
            
            // Must NOT contain graded terms
            const gradedTerms = ['psa', 'graded', 'gem mt', 'gem mint', 'bgs', 'sgc', 'csg'];
            const hasGradedTerm = gradedTerms.some(term => title.includes(term));
            
            // Comprehensive parallel exclusions (from your search)
            const expensiveParallels = [
                'choice', 'rr', 'auto', 'dragon', 'checkerboard', 'purple',
                'green', 'pink', 'holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast',
                'white sparkle', 'ssp', 'prizms', 'velocity', 'hyper', 'silver', 'bronze'
            ];
            const hasExpensiveParallel = expensiveParallels.some(term => title.includes(term));
            
            // Must contain base card terms
            const baseCardTerms = ['luka', 'doncic', '177', 'optic'];
            const hasBaseCardTerms = baseCardTerms.some(term => title.includes(term));
            
            // Price sanity check - exclude extremely expensive cards
            const isReasonablePrice = price > 0 && price < 200; // Base cards shouldn't be >$200
            
            return !hasGradedTerm && !hasExpensiveParallel && hasBaseCardTerms && isReasonablePrice;
        });
        
        console.log(`Raw cards found (comprehensive filtering): ${rawCards.length}`);
        
        // Show raw card details
        console.log('\n💰 RAW CARD DETAILS (COMPREHENSIVE):');
        rawCards.slice(0, 15).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate raw average
        const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
        
        console.log(`\n📊 RAW SUMMARY (COMPREHENSIVE):`);
        console.log(`   Average: $${rawAvg.toFixed(2)}`);
        console.log(`   Count: ${rawPrices.length}`);
        if (rawPrices.length > 0) {
            console.log(`   Range: $${Math.min(...rawPrices).toFixed(2)} - $${Math.max(...rawPrices).toFixed(2)}`);
        }
        
        // Search for PSA 9 cards with different strategy
        console.log('\n📋 SEARCHING FOR PSA 9 CARDS (ENHANCED)...');
        const psa9Results = await search130point("Luka Doncic Donruss Optic #177 PSA 9", 150);
        
        console.log(`Total PSA 9 results: ${psa9Results.length}`);
        
        // Enhanced PSA 9 filtering
        const psa9Cards = psa9Results.filter(card => {
            const title = card.title?.toLowerCase() || '';
            const price = parseFloat(card.price?.value || 0);
            
            // Must contain PSA 9
            const hasPsa9 = title.includes('psa 9') || title.includes('psa9');
            
            // Exclude expensive parallels but be less restrictive for PSA 9
            const expensiveParallels = [
                'white sparkle', 'ssp', 'checkerboard', 'choice', 'dragon',
                'green', 'pink', 'holo', 'blue', 'shock', 'gold', 'red', 'orange', 'black', '249', 'fast'
            ];
            const hasExpensiveParallel = expensiveParallels.some(term => title.includes(term));
            
            // Must contain base card terms
            const baseCardTerms = ['luka', 'doncic', '177', 'optic'];
            const hasBaseCardTerms = baseCardTerms.some(term => title.includes(term));
            
            // More generous price range for PSA 9
            const isReasonablePrice = price > 0 && price < 500; // PSA 9 can be up to $500
            
            return hasPsa9 && !hasExpensiveParallel && hasBaseCardTerms && isReasonablePrice;
        });
        
        console.log(`PSA 9 cards found (enhanced): ${psa9Cards.length}`);
        
        // Show PSA 9 card details
        console.log('\n💰 PSA 9 CARD DETAILS (ENHANCED):');
        psa9Cards.slice(0, 15).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate PSA 9 average
        const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
        
        console.log(`\n📊 PSA 9 SUMMARY (ENHANCED):`);
        console.log(`   Average: $${psa9Avg.toFixed(2)}`);
        console.log(`   Count: ${psa9Prices.length}`);
        if (psa9Prices.length > 0) {
            console.log(`   Range: $${Math.min(...psa9Prices).toFixed(2)} - $${Math.max(...psa9Prices).toFixed(2)}`);
        }
        
        // Compare with interface results
        console.log('\n🔍 COMPARISON WITH INTERFACE RESULTS:');
        console.log('=======================================');
        console.log('Interface Results:');
        console.log(`   Raw: $43.28 (range: $1.00 - $89.95)`);
        console.log(`   PSA 9: $66.83 (range: $15.00 - $161.89)`);
        console.log(`   PSA 10: $263.18 (range: $141.00 - $2,800.00)`);
        console.log('');
        console.log('Automated Search (Ultimate):');
        console.log(`   Raw: $${rawAvg.toFixed(2)} (${rawPrices.length} cards)`);
        console.log(`   PSA 9: $${psa9Avg.toFixed(2)} (${psa9Prices.length} cards)`);
        console.log('');
        
        // Calculate differences
        const rawDiff = Math.abs(rawAvg - 43.28);
        const rawPercentDiff = (rawDiff / 43.28) * 100;
        const psa9Diff = Math.abs(psa9Avg - 66.83);
        const psa9PercentDiff = (psa9Diff / 66.83) * 100;
        
        console.log('📊 ACCURACY ANALYSIS:');
        console.log(`   Raw difference: $${rawDiff.toFixed(2)} (${rawPercentDiff.toFixed(1)}%)`);
        console.log(`   PSA 9 difference: $${psa9Diff.toFixed(2)} (${psa9PercentDiff.toFixed(1)}%)`);
        
        if (rawPercentDiff < 10 && psa9PercentDiff < 20) {
            console.log('✅ ACCURACY: Excellent match with interface results!');
        } else if (rawPercentDiff < 20 && psa9PercentDiff < 30) {
            console.log('⚠️  ACCURACY: Good match - minor differences');
        } else {
            console.log('❌ ACCURACY: Needs improvement');
        }
        
        // Final recommendations
        console.log('\n💡 FINAL RECOMMENDATIONS:');
        if (rawPercentDiff < 10) {
            console.log('   ✅ Raw filtering is working perfectly!');
        }
        if (psa9PercentDiff < 20) {
            console.log('   ✅ PSA 9 filtering is working well!');
        } else {
            console.log('   ⚠️  PSA 9 filtering may need fine-tuning');
        }
        
        return {
            raw: { avg: rawAvg, count: rawPrices.length },
            psa9: { avg: psa9Avg, count: psa9Prices.length },
            interfaceComparison: {
                rawDiff,
                rawPercentDiff,
                psa9Diff,
                psa9PercentDiff
            }
        };
        
    } catch (error) {
        console.error(`❌ Error in ultimate accurate search:`, error.message);
        return { error: error.message };
    }
}

// Run the ultimate accurate search
if (require.main === module) {
    ultimateAccurateSearch().catch(console.error);
}

module.exports = { ultimateAccurateSearch }; 