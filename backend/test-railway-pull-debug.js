// Test just one search term with detailed logging to see what Railway finds
const { search130point } = require('./services/130pointService');
const { NewItemsPuller } = require('./pull-new-items.js');

async function testRailwayPull() {
    console.log('🚀 Testing Railway pull-new-items with detailed logging...\n');
    
    const puller = new NewItemsPuller();
    await puller.connect();
    
    const searchTerm = "PSA 10 basketball";
    let addedCount = 0;
    let rejectedCount = 0;
    
    console.log(`🔍 Searching for: "${searchTerm}"`);
    
    try {
        const results = await search130point(searchTerm, 5); // Just 5 for testing
        
        if (results && results.length > 0) {
            console.log(`📦 Found ${results.length} items from 130point`);
            
            for (const item of results) {
                console.log(`\n📋 Processing: ${item.title.substring(0, 50)}...`);
                console.log(`💰 Price: $${item.price?.value || item.price}`);
                
                try {
                    // Apply same filtering as in pull-new-items.js
                    const title = item.title.toLowerCase();
                    const price = item.price?.value || item.price;
                    
                    // Check if this is a PSA 10 card
                    if (!title.includes('psa 10') && !title.includes('psa10')) {
                        console.log(`   ⏭️  Skipping non-PSA 10 card`);
                        rejectedCount++;
                        continue;
                    }
                    
                    // Check if card has "lot" in title
                    if (title.includes('lot')) {
                        console.log(`   🚫 Skipping lot listing`);
                        rejectedCount++;
                        continue;
                    }
                    
                    // Check PSA 10 price threshold
                    if (price && price < 30) {
                        console.log(`   💸 Skipping low-value PSA 10 ($${price})`);
                        rejectedCount++;
                        continue;
                    }
                    
                    // Check if this card already exists
                    const exists = await puller.cardExists(item.title, price);
                    if (exists) {
                        console.log(`   ⏭️  Skipping duplicate`);
                        rejectedCount++;
                        continue;
                    }
                    
                    console.log(`   ✅ ADDING: Passes all filters!`);
                    
                    // Add search term for reference
                    item.searchTerm = searchTerm;
                    item.source = '130point_test';
                    
                    const cardId = await puller.addCard(item);
                    if (cardId) {
                        addedCount++;
                        console.log(`   🎉 Successfully added with ID: ${cardId}`);
                    }
                    
                } catch (addError) {
                    console.error(`   ❌ Error processing item: ${addError.message}`);
                    rejectedCount++;
                }
            }
        } else {
            console.log(`🔍 No items found for "${searchTerm}"`);
        }
        
    } catch (searchError) {
        console.error(`❌ Error searching "${searchTerm}": ${searchError.message}`);
    }
    
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`   Items added: ${addedCount}`);
    console.log(`   Items rejected: ${rejectedCount}`);
    console.log(`   Total processed: ${addedCount + rejectedCount}`);
    
    puller.db.close();
}

// Export for API use
module.exports = { testRailwayPull };

// Run directly if called
if (require.main === module) {
    testRailwayPull().catch(console.error);
}
