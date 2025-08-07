const fs = require('fs');
const path = require('path');

function findLowPriceItems() {
    console.log('Analyzing PSA10 database for low-price items...');
    
    try {
        const dataPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const database = JSON.parse(rawData);
        
        const items = database.items || database;
        console.log(`Total records: ${items.length}`);
        
        // Price analysis
        const priceRanges = {
            under10: [],
            under20: [],
            under30: [],
            under50: [],
            under100: [],
            over100: []
        };
        
        const allPrices = [];
        const lowPriceItems = [];
        
        items.forEach((item, index) => {
            if (item.price && item.price.value) {
                const price = parseFloat(item.price.value);
                allPrices.push(price);
                
                if (price < 10) {
                    priceRanges.under10.push({ index, item, price });
                }
                if (price < 20) {
                    priceRanges.under20.push({ index, item, price });
                }
                if (price < 30) {
                    priceRanges.under30.push({ index, item, price });
                    lowPriceItems.push({ index, item, price });
                }
                if (price < 50) {
                    priceRanges.under50.push({ index, item, price });
                }
                if (price < 100) {
                    priceRanges.under100.push({ index, item, price });
                } else {
                    priceRanges.over100.push({ index, item, price });
                }
            }
        });
        
        // Sort low price items by price
        lowPriceItems.sort((a, b) => a.price - b.price);
        
        console.log('\n=== PRICE ANALYSIS ===');
        console.log(`Items under $10: ${priceRanges.under10.length}`);
        console.log(`Items under $20: ${priceRanges.under20.length}`);
        console.log(`Items under $30: ${priceRanges.under30.length}`);
        console.log(`Items under $50: ${priceRanges.under50.length}`);
        console.log(`Items under $100: ${priceRanges.under100.length}`);
        console.log(`Items over $100: ${priceRanges.over100.length}`);
        
        // Price statistics
        if (allPrices.length > 0) {
            const minPrice = Math.min(...allPrices);
            const maxPrice = Math.max(...allPrices);
            const avgPrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
            const medianPrice = allPrices.sort((a, b) => a - b)[Math.floor(allPrices.length / 2)];
            
            console.log('\n=== PRICE STATISTICS ===');
            console.log(`Minimum price: $${minPrice.toFixed(2)}`);
            console.log(`Maximum price: $${maxPrice.toFixed(2)}`);
            console.log(`Average price: $${avgPrice.toFixed(2)}`);
            console.log(`Median price: $${medianPrice.toFixed(2)}`);
        }
        
        // Show items under $30
        console.log('\n=== ITEMS UNDER $30 ===');
        if (lowPriceItems.length > 0) {
            console.log(`Found ${lowPriceItems.length} items under $30:`);
            
            lowPriceItems.slice(0, 20).forEach(({ index, item, price }) => {
                console.log(`\n$${price.toFixed(2)} - "${item.title}"`);
                console.log(`  Seller: ${item.seller}`);
                console.log(`  Sale Date: ${item.soldDate}`);
                console.log(`  Sale Type: ${item.saleType}`);
                if (item.itemWebUrl) {
                    console.log(`  URL: ${item.itemWebUrl}`);
                }
            });
            
            if (lowPriceItems.length > 20) {
                console.log(`\n... and ${lowPriceItems.length - 20} more items under $30`);
            }
        } else {
            console.log('No items found under $30');
        }
        
        // Save detailed report
        const report = {
            totalRecords: items.length,
            priceAnalysis: {
                under10: priceRanges.under10.length,
                under20: priceRanges.under20.length,
                under30: priceRanges.under30.length,
                under50: priceRanges.under50.length,
                under100: priceRanges.under100.length,
                over100: priceRanges.over100.length
            },
            lowPriceItems: lowPriceItems.slice(0, 50).map(({ index, item, price }) => ({
                index,
                title: item.title,
                price: price,
                seller: item.seller,
                soldDate: item.soldDate,
                saleType: item.saleType,
                url: item.itemWebUrl
            })),
            priceStatistics: allPrices.length > 0 ? {
                min: Math.min(...allPrices),
                max: Math.max(...allPrices),
                average: allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length,
                median: allPrices.sort((a, b) => a - b)[Math.floor(allPrices.length / 2)]
            } : null
        };
        
        const reportPath = path.join(__dirname, 'data', 'low_price_analysis.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return report;
        
    } catch (error) {
        console.error('Error analyzing low price items:', error);
        return null;
    }
}

// Run the analysis
if (require.main === module) {
    findLowPriceItems();
}

module.exports = { findLowPriceItems }; 