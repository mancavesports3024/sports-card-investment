const fs = require('fs');
const path = require('path');

function removeLowPriceItems() {
    console.log('Removing items under $30 from PSA10 database...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        const items = database.items || database;
        console.log(`Original records: ${items.length}`);
        
        // Filter out items under $30
        const filteredItems = [];
        const removedItems = [];
        const zeroPriceItems = [];
        
        items.forEach((item, index) => {
            if (item.price && item.price.value) {
                const price = parseFloat(item.price.value);
                
                if (price === 0) {
                    zeroPriceItems.push({ index, item, price });
                    removedItems.push({ index, item, price, reason: 'zero_price' });
                } else if (price < 30) {
                    removedItems.push({ index, item, price, reason: 'under_30' });
                } else {
                    filteredItems.push(item);
                }
            } else {
                // Items without price data - remove them
                removedItems.push({ index, item, price: null, reason: 'no_price_data' });
            }
        });
        
        // Create filtered database
        const filteredDatabase = {
            ...database,
            items: filteredItems
        };
        
        // Analysis
        const under30Items = removedItems.filter(item => item.reason === 'under_30');
        const zeroPriceCount = zeroPriceItems.length;
        const noPriceDataCount = removedItems.filter(item => item.reason === 'no_price_data').length;
        
        console.log('\n=== FILTERING RESULTS ===');
        console.log(`Original records: ${items.length}`);
        console.log(`Items under $30: ${under30Items.length}`);
        console.log(`Items with $0 price: ${zeroPriceCount}`);
        console.log(`Items with no price data: ${noPriceDataCount}`);
        console.log(`Total items removed: ${removedItems.length}`);
        console.log(`Remaining records: ${filteredItems.length}`);
        console.log(`Removal percentage: ${((removedItems.length / items.length) * 100).toFixed(2)}%`);
        
        // Price statistics of remaining items
        const remainingPrices = filteredItems
            .filter(item => item.price && item.price.value)
            .map(item => parseFloat(item.price.value));
        
        if (remainingPrices.length > 0) {
            const minPrice = Math.min(...remainingPrices);
            const maxPrice = Math.max(...remainingPrices);
            const avgPrice = remainingPrices.reduce((sum, price) => sum + price, 0) / remainingPrices.length;
            const medianPrice = remainingPrices.sort((a, b) => a - b)[Math.floor(remainingPrices.length / 2)];
            
            console.log('\n=== REMAINING ITEMS PRICE STATISTICS ===');
            console.log(`Minimum price: $${minPrice.toFixed(2)}`);
            console.log(`Maximum price: $${maxPrice.toFixed(2)}`);
            console.log(`Average price: $${avgPrice.toFixed(2)}`);
            console.log(`Median price: $${medianPrice.toFixed(2)}`);
        }
        
        // Show some examples of removed items
        console.log('\n=== EXAMPLES OF REMOVED ITEMS ===');
        const sampleRemoved = removedItems.slice(0, 10);
        sampleRemoved.forEach(({ index, item, price, reason }) => {
            const priceStr = price !== null ? `$${price.toFixed(2)}` : 'No price';
            console.log(`\n${priceStr} - "${item.title}" (${reason})`);
            console.log(`  Seller: ${item.seller}`);
            console.log(`  Sale Date: ${item.soldDate}`);
        });
        
        // Save filtered database
        const filteredPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database_filtered.json');
        fs.writeFileSync(filteredPath, JSON.stringify(filteredDatabase, null, 2));
        
        // Save removal details
        const removalDetails = {
            originalRecords: items.length,
            filteredRecords: filteredItems.length,
            removedRecords: removedItems.length,
            removalPercentage: ((removedItems.length / items.length) * 100).toFixed(2),
            removalBreakdown: {
                under30: under30Items.length,
                zeroPrice: zeroPriceCount,
                noPriceData: noPriceDataCount
            },
            remainingPriceStats: remainingPrices.length > 0 ? {
                min: Math.min(...remainingPrices),
                max: Math.max(...remainingPrices),
                average: remainingPrices.reduce((sum, price) => sum + price, 0) / remainingPrices.length,
                median: remainingPrices.sort((a, b) => a - b)[Math.floor(remainingPrices.length / 2)]
            } : null,
            sampleRemovedItems: removedItems.slice(0, 50).map(({ index, item, price, reason }) => ({
                index,
                title: item.title,
                price: price,
                reason: reason,
                seller: item.seller,
                soldDate: item.soldDate
            }))
        };
        
        const removalDetailsPath = path.join(__dirname, 'data', 'low_price_removal_details.json');
        fs.writeFileSync(removalDetailsPath, JSON.stringify(removalDetails, null, 2));
        
        console.log(`\nFiltered database saved to: ${filteredPath}`);
        console.log(`Removal details saved to: ${removalDetailsPath}`);
        
        return {
            originalCount: items.length,
            filteredCount: filteredItems.length,
            removedCount: removedItems.length
        };
        
    } catch (error) {
        console.error('Error removing low price items:', error);
        return null;
    }
}

// Run the filtering
if (require.main === module) {
    removeLowPriceItems();
}

module.exports = { removeLowPriceItems }; 