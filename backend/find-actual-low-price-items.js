const fs = require('fs');
const path = require('path');

function findActualLowPriceItems() {
    console.log('Analyzing PSA10 database for actual low-price items (excluding $0)...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        const items = database.items || database;
        console.log(`Total records: ${items.length}`);
        
        // Find items with actual prices under $30 (excluding $0)
        const actualLowPriceItems = [];
        const zeroPriceItems = [];
        
        items.forEach((item, index) => {
            if (item.price && item.price.value) {
                const price = parseFloat(item.price.value);
                
                if (price === 0) {
                    zeroPriceItems.push({ index, item, price });
                } else if (price > 0 && price < 30) {
                    actualLowPriceItems.push({ index, item, price });
                }
            }
        });
        
        // Sort by price
        actualLowPriceItems.sort((a, b) => a.price - b.price);
        
        console.log('\n=== ACTUAL LOW PRICE ANALYSIS ===');
        console.log(`Items with $0 price: ${zeroPriceItems.length}`);
        console.log(`Items with actual price under $30: ${actualLowPriceItems.length}`);
        
        // Price breakdown for actual low price items
        const priceBreakdown = {
            under5: actualLowPriceItems.filter(item => item.price < 5).length,
            under10: actualLowPriceItems.filter(item => item.price < 10).length,
            under15: actualLowPriceItems.filter(item => item.price < 15).length,
            under20: actualLowPriceItems.filter(item => item.price < 20).length,
            under25: actualLowPriceItems.filter(item => item.price < 25).length,
            under30: actualLowPriceItems.length
        };
        
        console.log('\n=== PRICE BREAKDOWN (Actual Prices) ===');
        console.log(`Under $5: ${priceBreakdown.under5}`);
        console.log(`Under $10: ${priceBreakdown.under10}`);
        console.log(`Under $15: ${priceBreakdown.under15}`);
        console.log(`Under $20: ${priceBreakdown.under20}`);
        console.log(`Under $25: ${priceBreakdown.under25}`);
        console.log(`Under $30: ${priceBreakdown.under30}`);
        
        // Show actual low price items
        console.log('\n=== ACTUAL ITEMS UNDER $30 (Excluding $0) ===');
        if (actualLowPriceItems.length > 0) {
            console.log(`Found ${actualLowPriceItems.length} items with actual prices under $30:`);
            
            actualLowPriceItems.slice(0, 30).forEach(({ index, item, price }) => {
                console.log(`\n$${price.toFixed(2)} - "${item.title}"`);
                console.log(`  Seller: ${item.seller}`);
                console.log(`  Sale Date: ${item.soldDate}`);
                console.log(`  Sale Type: ${item.saleType}`);
                if (item.itemWebUrl) {
                    console.log(`  URL: ${item.itemWebUrl}`);
                }
            });
            
            if (actualLowPriceItems.length > 30) {
                console.log(`\n... and ${actualLowPriceItems.length - 30} more items under $30`);
            }
        } else {
            console.log('No items found with actual prices under $30');
        }
        
        // Show some $0 items for reference
        console.log('\n=== SAMPLE $0 PRICE ITEMS (Possible Data Errors) ===');
        if (zeroPriceItems.length > 0) {
            console.log(`Found ${zeroPriceItems.length} items with $0 price (showing first 5):`);
            
            zeroPriceItems.slice(0, 5).forEach(({ index, item, price }) => {
                console.log(`\n$${price.toFixed(2)} - "${item.title}"`);
                console.log(`  Seller: ${item.seller}`);
                console.log(`  Sale Date: ${item.soldDate}`);
                console.log(`  Sale Type: ${item.saleType}`);
            });
        }
        
        // Save detailed report
        const report = {
            totalRecords: items.length,
            zeroPriceItems: zeroPriceItems.length,
            actualLowPriceItems: actualLowPriceItems.length,
            priceBreakdown: priceBreakdown,
            actualLowPriceItemsList: actualLowPriceItems.slice(0, 100).map(({ index, item, price }) => ({
                index,
                title: item.title,
                price: price,
                seller: item.seller,
                soldDate: item.soldDate,
                saleType: item.saleType,
                url: item.itemWebUrl
            })),
            zeroPriceItemsSample: zeroPriceItems.slice(0, 10).map(({ index, item, price }) => ({
                index,
                title: item.title,
                price: price,
                seller: item.seller,
                soldDate: item.soldDate,
                saleType: item.saleType
            }))
        };
        
        const reportPath = path.join(__dirname, 'data', 'actual_low_price_analysis.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return report;
        
    } catch (error) {
        console.error('Error analyzing actual low price items:', error);
        return null;
    }
}

// Run the analysis
if (require.main === module) {
    findActualLowPriceItems();
}

module.exports = { findActualLowPriceItems }; 