const { search130point } = require('./services/130pointService');

async function debugPSA9Prices() {
    console.log('🔍 Debugging PSA 9 price search...');
    
    // Test with one of the cards that showed $324.00
    const testTitle = "2020 Topps Chrome F1 Lando Norris Portrait Card #7 McLaren";
    const searchTerm = `${testTitle} PSA 9`;
    
    console.log(`📝 Search term: "${searchTerm}"`);
    
    try {
        const results = await search130point(searchTerm, 10);
        
        console.log(`\n📊 Found ${results.length} results from 130point:`);
        
        results.forEach((item, index) => {
            console.log(`\n--- Result ${index + 1} ---`);
            console.log(`Title: ${item.title}`);
            console.log(`Price object:`, item.price);
            console.log(`Price value type: ${typeof item.price?.value}`);
            console.log(`Price value: ${item.price?.value}`);
            
            // Test the parsing logic
            const priceValue = item.price?.value || item.price;
            const parsedPrice = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
            console.log(`Parsed price: ${parsedPrice} (type: ${typeof parsedPrice})`);
            
            // Check if it's a PSA 9 card
            const itemTitle = item.title.toLowerCase();
            const isPSA9 = itemTitle.includes('psa 9') || 
                          itemTitle.includes('psa9') ||
                          itemTitle.includes('psa 9.0');
            console.log(`Is PSA 9: ${isPSA9}`);
        });
        
        // Test the filtering logic
        const psa9Prices = results
            .filter(item => {
                const itemTitle = item.title.toLowerCase();
                return itemTitle.includes('psa 9') || 
                       itemTitle.includes('psa9') ||
                       itemTitle.includes('psa 9.0');
            })
            .map(item => {
                const priceValue = item.price?.value || item.price;
                return typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
            })
            .filter(price => price && !isNaN(price) && price > 0);
        
        console.log(`\n🎯 Filtered PSA 9 prices:`, psa9Prices);
        
        if (psa9Prices.length > 0) {
            const average = psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length;
            console.log(`📈 PSA 9 Average: $${average.toFixed(2)}`);
        } else {
            console.log(`❌ No valid PSA 9 prices found`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the debug
debugPSA9Prices().then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
});
