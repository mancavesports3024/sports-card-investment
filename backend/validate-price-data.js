require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Load database
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');

// Test cards for validation
const TEST_CARDS = [
    {
        title: "2018 Donruss Optic Luka Doncic #177",
        expectedRaw: { min: 50, max: 200 }, // Expected raw price range
        expectedPsa9: { min: 100, max: 300 } // Expected PSA 9 price range
    },
    {
        title: "2020 Panini Prizm Hyper LeBron James #1",
        expectedRaw: { min: 50, max: 150 },
        expectedPsa9: { min: 100, max: 250 }
    },
    {
        title: "1982 Topps Football Archie Manning #408",
        expectedRaw: { min: 1, max: 10 },
        expectedPsa9: { min: 5, max: 50 }
    }
];

// Validate raw card filtering
function validateRawCardFiltering(cards) {
    console.log('\n🔍 VALIDATING RAW CARD FILTERING:');
    console.log('==================================');
    
    const rawCards = cards.filter(card => {
        const title = card.title?.toLowerCase() || '';
        return !title.includes('psa') && !title.includes('graded') && 
               !title.includes('gem mt') && !title.includes('gem mint');
    });
    
    console.log(`Total cards found: ${cards.length}`);
    console.log(`Raw cards filtered: ${rawCards.length}`);
    
    // Show examples of what was filtered
    console.log('\n📋 RAW CARD EXAMPLES:');
    rawCards.slice(0, 5).forEach((card, i) => {
        console.log(`   ${i+1}. ${card.title} - $${card.price?.value || 'N/A'}`);
    });
    
    // Show examples of what was excluded
    const excludedCards = cards.filter(card => {
        const title = card.title?.toLowerCase() || '';
        return title.includes('psa') || title.includes('graded') || 
               title.includes('gem mt') || title.includes('gem mint');
    });
    
    console.log('\n❌ EXCLUDED CARD EXAMPLES:');
    excludedCards.slice(0, 5).forEach((card, i) => {
        console.log(`   ${i+1}. ${card.title} - $${card.price?.value || 'N/A'}`);
    });
    
    return rawCards;
}

// Validate PSA 9 card filtering
function validatePsa9CardFiltering(cards) {
    console.log('\n🔍 VALIDATING PSA 9 CARD FILTERING:');
    console.log('====================================');
    
    const psa9Cards = cards.filter(card => {
        const title = card.title?.toLowerCase() || '';
        return title.includes('psa 9') || title.includes('psa9');
    });
    
    console.log(`Total cards found: ${cards.length}`);
    console.log(`PSA 9 cards filtered: ${psa9Cards.length}`);
    
    // Show examples of PSA 9 cards
    console.log('\n📋 PSA 9 CARD EXAMPLES:');
    psa9Cards.slice(0, 5).forEach((card, i) => {
        console.log(`   ${i+1}. ${card.title} - $${card.price?.value || 'N/A'}`);
    });
    
    // Show examples of non-PSA 9 cards
    const nonPsa9Cards = cards.filter(card => {
        const title = card.title?.toLowerCase() || '';
        return !title.includes('psa 9') && !title.includes('psa9');
    });
    
    console.log('\n❌ NON-PSA 9 CARD EXAMPLES:');
    nonPsa9Cards.slice(0, 5).forEach((card, i) => {
        console.log(`   ${i+1}. ${card.title} - $${card.price?.value || 'N/A'}`);
    });
    
    return psa9Cards;
}

// Validate price calculations
function validatePriceCalculations(rawCards, psa9Cards, psa10Price) {
    console.log('\n🔍 VALIDATING PRICE CALCULATIONS:');
    console.log('==================================');
    
    // Calculate averages
    const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    const psa9Prices = psa9Cards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
    
    const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
    const psa9Avg = psa9Prices.length > 0 ? psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
    
    console.log(`Raw cards found: ${rawCards.length}`);
    console.log(`Raw prices (valid): ${rawPrices.length}`);
    console.log(`Raw average: $${rawAvg.toFixed(2)}`);
    console.log(`Raw price range: $${Math.min(...rawPrices).toFixed(2)} - $${Math.max(...rawPrices).toFixed(2)}`);
    
    console.log(`\nPSA 9 cards found: ${psa9Cards.length}`);
    console.log(`PSA 9 prices (valid): ${psa9Prices.length}`);
    console.log(`PSA 9 average: $${psa9Avg.toFixed(2)}`);
    console.log(`PSA 9 price range: $${Math.min(...psa9Prices).toFixed(2)} - $${Math.max(...psa9Prices).toFixed(2)}`);
    
    console.log(`\nPSA 10 price: $${psa10Price.toFixed(2)}`);
    
    // Calculate price differences
    const rawToPsa9Diff = psa9Avg > 0 && rawAvg > 0 ? psa9Avg - rawAvg : 0;
    const rawToPsa9Percent = rawAvg > 0 ? (rawToPsa9Diff / rawAvg) * 100 : 0;
    
    const rawToPsa10Diff = psa10Price > 0 && rawAvg > 0 ? psa10Price - rawAvg : 0;
    const rawToPsa10Percent = rawAvg > 0 ? (rawToPsa10Diff / rawAvg) * 100 : 0;
    
    console.log(`\n💰 PRICE COMPARISONS:`);
    console.log(`Raw → PSA 9: $${rawToPsa9Diff.toFixed(2)} (${rawToPsa9Percent.toFixed(1)}%)`);
    console.log(`Raw → PSA 10: $${rawToPsa10Diff.toFixed(2)} (${rawToPsa10Percent.toFixed(1)}%)`);
    
    return {
        raw: { avg: rawAvg, count: rawPrices.length, min: Math.min(...rawPrices), max: Math.max(...rawPrices) },
        psa9: { avg: psa9Avg, count: psa9Prices.length, min: Math.min(...psa9Prices), max: Math.max(...psa9Prices) },
        comparisons: {
            rawToPsa9: { dollarDiff: rawToPsa9Diff, percentDiff: rawToPsa9Percent },
            rawToPsa10: { dollarDiff: rawToPsa10Diff, percentDiff: rawToPsa10Percent }
        }
    };
}

// Test a single card with detailed validation
async function testCardValidation(cardTitle, expectedRanges) {
    console.log(`\n🎯 TESTING CARD: ${cardTitle}`);
    console.log('='.repeat(50));
    
    try {
        // Search for raw cards
        console.log('\n🔍 Searching for raw cards...');
        const rawResults = await search130point(cardTitle, 20);
        console.log(`Found ${rawResults.length} total results`);
        
        // Validate raw card filtering
        const rawCards = validateRawCardFiltering(rawResults);
        
        // Search for PSA 9 cards
        console.log('\n🔍 Searching for PSA 9 cards...');
        const psa9Results = await search130point(`${cardTitle} PSA 9`, 20);
        console.log(`Found ${psa9Results.length} total results`);
        
        // Validate PSA 9 card filtering
        const psa9Cards = validatePsa9CardFiltering(psa9Results);
        
        // Get PSA 10 price (mock for testing)
        const psa10Price = 100; // This would come from the database
        
        // Validate price calculations
        const priceData = validatePriceCalculations(rawCards, psa9Cards, psa10Price);
        
        // Validate against expected ranges
        console.log('\n✅ VALIDATION AGAINST EXPECTED RANGES:');
        console.log('=======================================');
        
        const rawInRange = priceData.raw.avg >= expectedRanges.expectedRaw.min && 
                          priceData.raw.avg <= expectedRanges.expectedRaw.max;
        const psa9InRange = priceData.psa9.avg >= expectedRanges.expectedPsa9.min && 
                           priceData.psa9.avg <= expectedRanges.expectedPsa9.max;
        
        console.log(`Raw average: $${priceData.raw.avg.toFixed(2)} (expected: $${expectedRanges.expectedRaw.min}-${expectedRanges.expectedRaw.max})`);
        console.log(`Raw validation: ${rawInRange ? '✅ PASS' : '❌ FAIL'}`);
        
        console.log(`PSA 9 average: $${priceData.psa9.avg.toFixed(2)} (expected: $${expectedRanges.expectedPsa9.min}-${expectedRanges.expectedPsa9.max})`);
        console.log(`PSA 9 validation: ${psa9InRange ? '✅ PASS' : '❌ FAIL'}`);
        
        return {
            cardTitle,
            priceData,
            validation: {
                raw: rawInRange,
                psa9: psa9InRange,
                overall: rawInRange && psa9InRange
            }
        };
        
    } catch (error) {
        console.error(`❌ Error testing card ${cardTitle}:`, error.message);
        return { cardTitle, error: error.message };
    }
}

// Compare with existing database data
function compareWithDatabase(cardTitle, newPriceData) {
    console.log('\n🔍 COMPARING WITH DATABASE:');
    console.log('============================');
    
    try {
        const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
        const existingCard = data.items.find(item => 
            (item.summaryTitle || item.title).includes(cardTitle.split(' ')[0]) &&
            (item.summaryTitle || item.title).includes(cardTitle.split(' ')[1])
        );
        
        if (existingCard && existingCard.priceComparisons) {
            const existing = existingCard.priceComparisons;
            console.log('📊 EXISTING DATABASE DATA:');
            if (existing.raw && existing.raw.avgPrice > 0) {
                console.log(`   Raw: $${existing.raw.avgPrice.toFixed(2)} (${existing.raw.count} cards)`);
            }
            if (existing.psa9 && existing.psa9.avgPrice > 0) {
                console.log(`   PSA 9: $${existing.psa9.avgPrice.toFixed(2)} (${existing.psa9.count} cards)`);
            }
            
            console.log('\n📊 NEW API DATA:');
            console.log(`   Raw: $${newPriceData.raw.avg.toFixed(2)} (${newPriceData.raw.count} cards)`);
            console.log(`   PSA 9: $${newPriceData.psa9.avg.toFixed(2)} (${newPriceData.psa9.count} cards)`);
            
            // Calculate differences
            if (existing.raw && existing.raw.avgPrice > 0) {
                const rawDiff = Math.abs(newPriceData.raw.avg - existing.raw.avgPrice);
                const rawPercentDiff = (rawDiff / existing.raw.avgPrice) * 100;
                console.log(`\n💰 Raw price difference: $${rawDiff.toFixed(2)} (${rawPercentDiff.toFixed(1)}%)`);
            }
            
            if (existing.psa9 && existing.psa9.avgPrice > 0) {
                const psa9Diff = Math.abs(newPriceData.psa9.avg - existing.psa9.avgPrice);
                const psa9PercentDiff = (psa9Diff / existing.psa9.avgPrice) * 100;
                console.log(`💰 PSA 9 price difference: $${psa9Diff.toFixed(2)} (${psa9PercentDiff.toFixed(1)}%)`);
            }
        } else {
            console.log('❌ No existing price comparison data found in database');
        }
        
    } catch (error) {
        console.error('❌ Error reading database:', error.message);
    }
}

// Main validation function
async function runValidation() {
    console.log('🔍 PRICE DATA VALIDATION SYSTEM');
    console.log('================================');
    console.log('This will test the accuracy of price data being pulled from 130point.com');
    console.log('and validate the filtering and calculation logic.\n');
    
    const results = [];
    
    for (const testCard of TEST_CARDS) {
        const result = await testCardValidation(testCard.title, testCard);
        results.push(result);
        
        if (result.priceData) {
            compareWithDatabase(testCard.title, result.priceData);
        }
        
        // Rate limiting between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n📊 VALIDATION SUMMARY:');
    console.log('=======================');
    results.forEach((result, i) => {
        if (result.error) {
            console.log(`${i+1}. ${result.cardTitle}: ❌ ERROR - ${result.error}`);
        } else if (result.validation) {
            const status = result.validation.overall ? '✅ PASS' : '❌ FAIL';
            console.log(`${i+1}. ${result.cardTitle}: ${status}`);
        }
    });
    
    const passedTests = results.filter(r => r.validation && r.validation.overall).length;
    const totalTests = results.filter(r => r.validation).length;
    
    console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('✅ All validation tests passed! Data quality looks good.');
    } else {
        console.log('⚠️  Some validation tests failed. Review the results above.');
    }
}

// Run validation if called directly
if (require.main === module) {
    runValidation().catch(console.error);
}

module.exports = { runValidation, testCardValidation }; 