require('dotenv').config();
const { search130point } = require('./services/130pointService');

// Manual verification for a single card
async function verifyCard(cardTitle) {
    console.log(`🔍 MANUAL VERIFICATION: ${cardTitle}`);
    console.log('='.repeat(60));
    
    try {
        // Search for raw cards
        console.log('\n📋 SEARCHING FOR RAW CARDS...');
        const rawResults = await search130point(cardTitle, 20);
        
        // Filter raw cards
        const rawCards = rawResults.filter(card => {
            const title = card.title?.toLowerCase() || '';
            return !title.includes('psa') && !title.includes('graded') && 
                   !title.includes('gem mt') && !title.includes('gem mint');
        });
        
        console.log(`Total results: ${rawResults.length}`);
        console.log(`Raw cards found: ${rawCards.length}`);
        
        // Show raw card details
        console.log('\n💰 RAW CARD DETAILS:');
        rawCards.slice(0, 10).forEach((card, i) => {
            const price = parseFloat(card.price?.value || 0);
            const date = card.dateSold || 'Unknown';
            console.log(`   ${i+1}. ${card.title}`);
            console.log(`      Price: $${price.toFixed(2)} | Date: ${date}`);
        });
        
        // Calculate raw average
        const rawPrices = rawCards.map(card => parseFloat(card.price?.value || 0)).filter(price => price > 0);
        const rawAvg = rawPrices.length > 0 ? rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
        
        console.log(`\n📊 RAW SUMMARY:`);
        console.log(`   Average: $${rawAvg.toFixed(2)}`);
        console.log(`   Count: ${rawPrices.length}`);
        console.log(`   Range: $${Math.min(...rawPrices).toFixed(2)} - $${Math.max(...rawPrices).toFixed(2)}`);
        
        // Search for PSA 9 cards
        console.log('\n📋 SEARCHING FOR PSA 9 CARDS...');
        const psa9Results = await search130point(`${cardTitle} PSA 9`, 20);
        
        // Filter PSA 9 cards
        const psa9Cards = psa9Results.filter(card => {
            const title = card.title?.toLowerCase() || '';
            return title.includes('psa 9') || title.includes('psa9');
        });
        
        console.log(`Total results: ${psa9Results.length}`);
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
        console.log(`   Range: $${Math.min(...psa9Prices).toFixed(2)} - $${Math.max(...psa9Prices).toFixed(2)}`);
        
        // Manual verification instructions
        console.log('\n🔍 MANUAL VERIFICATION STEPS:');
        console.log('==============================');
        console.log('1. Go to 130point.com');
        console.log(`2. Search for: "${cardTitle}"`);
        console.log('3. Look for raw cards (no PSA mentioned)');
        console.log('4. Note the prices and compare with results above');
        console.log(`5. Search for: "${cardTitle} PSA 9"`);
        console.log('6. Look for PSA 9 cards and compare prices');
        console.log('');
        console.log('📊 EXPECTED RESULTS:');
        console.log(`   Raw average should be around: $${rawAvg.toFixed(2)}`);
        console.log(`   PSA 9 average should be around: $${psa9Avg.toFixed(2)}`);
        
        return {
            cardTitle,
            raw: { avg: rawAvg, count: rawPrices.length, min: Math.min(...rawPrices), max: Math.max(...rawPrices) },
            psa9: { avg: psa9Avg, count: psa9Prices.length, min: Math.min(...psa9Prices), max: Math.max(...psa9Prices) }
        };
        
    } catch (error) {
        console.error(`❌ Error verifying card ${cardTitle}:`, error.message);
        return { cardTitle, error: error.message };
    }
}

// Test multiple cards
async function testMultipleCards() {
    const testCards = [
        "2018 Donruss Optic Luka Doncic #177",
        "2020 Panini Prizm Hyper LeBron James #1",
        "1982 Topps Football Archie Manning #408"
    ];
    
    console.log('🔍 MANUAL VERIFICATION SYSTEM');
    console.log('==============================');
    console.log('This will help you manually verify the accuracy of price data.\n');
    
    for (const cardTitle of testCards) {
        await verifyCard(cardTitle);
        
        // Rate limiting between cards
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n' + '='.repeat(80) + '\n');
    }
}

// Run if called directly
if (require.main === module) {
    const cardTitle = process.argv[2];
    
    if (cardTitle) {
        // Test specific card
        verifyCard(cardTitle).catch(console.error);
    } else {
        // Test multiple cards
        testMultipleCards().catch(console.error);
    }
}

module.exports = { verifyCard, testMultipleCards }; 