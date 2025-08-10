const { search130point } = require('./services/130pointService');

async function debugSpecificPSA9() {
    console.log('🔍 Debugging specific PSA 9 search...');
    
    // Test with one of the cards that has $324.00 PSA 9 price
    const testTitle = "2023 Panini Donruss Optic - Bo Jackson #95 Holo Prizm";
    const searchTerm = `${testTitle} PSA 9`;
    
    console.log(`📝 Search term: "${searchTerm}"`);
    
    try {
        const results = await search130point(searchTerm, 15);
        
        console.log(`\n📊 Found ${results.length} results from 130point:`);
        
        let psa9Count = 0;
        let totalPrices = [];
        
        results.forEach((item, index) => {
            const itemTitle = item.title.toLowerCase();
            const isPSA9 = itemTitle.includes('psa 9') || 
                          itemTitle.includes('psa9') ||
                          itemTitle.includes('psa 9.0');
            
            if (isPSA9) {
                psa9Count++;
                const priceValue = item.price?.value || item.price;
                const parsedPrice = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                totalPrices.push(parsedPrice);
                
                console.log(`\n--- PSA 9 Result ${psa9Count} ---`);
                console.log(`Title: ${item.title}`);
                console.log(`Price: $${parsedPrice}`);
            }
        });
        
        console.log(`\n🎯 Found ${psa9Count} PSA 9 cards`);
        console.log(`💰 PSA 9 prices:`, totalPrices);
        
        if (totalPrices.length > 0) {
            const average = totalPrices.reduce((sum, price) => sum + price, 0) / totalPrices.length;
            console.log(`📈 PSA 9 Average: $${average.toFixed(2)}`);
            
            if (average === 324) {
                console.log(`⚠️ WARNING: Average is exactly $324.00 - this might be an error!`);
            }
        } else {
            console.log(`❌ No PSA 9 cards found`);
        }
        
        // Also test the raw search for this card
        console.log(`\n🔍 Testing raw search for: "${testTitle}"`);
        const rawResults = await search130point(testTitle, 10);
        
        let rawCount = 0;
        let rawPrices = [];
        
        rawResults.forEach((item, index) => {
            const itemTitle = item.title.toLowerCase();
            const isRaw = !itemTitle.includes('psa 10') && 
                         !itemTitle.includes('psa10') &&
                         !itemTitle.includes('bgs 10') &&
                         !itemTitle.includes('sgc 10');
            
            if (isRaw) {
                rawCount++;
                const priceValue = item.price?.value || item.price;
                const parsedPrice = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                rawPrices.push(parsedPrice);
            }
        });
        
        console.log(`📊 Found ${rawCount} raw cards`);
        console.log(`💰 Raw prices:`, rawPrices);
        
        if (rawPrices.length > 0) {
            const rawAverage = rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length;
            console.log(`📈 Raw Average: $${rawAverage.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the debug
debugSpecificPSA9().then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
});
