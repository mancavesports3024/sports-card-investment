const NewPricingDatabase = require('./create-new-pricing-database.js');
const { search130point } = require('./services/130pointService');

class ImprovedPriceUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to new pricing database');
    }

    // Improved raw price search - exact card matching
    async searchRawPrices(title) {
        console.log(`   🔍 Searching for raw prices: ${title}`);
        
        const cleanTitle = this.db.cleanSummaryTitle(title);
        const strategies = [
            // Strategy 1: Clean title (already has grading terms removed)
            cleanTitle
        ];

        let allRawPrices = [];
        
        for (const strategy of strategies) {
            if (!strategy || strategy.length < 5) continue;
            
            try {
                console.log(`   🔍 Strategy: "${strategy}"`);
                const results = await search130point(strategy, 10);
                
                if (results && results.length > 0) {
                    const rawPrices = results
                        .filter(item => {
                            const itemTitle = item.title.toLowerCase();
                            // More permissive filtering - just exclude obvious graded cards
                            return !itemTitle.includes('psa 10') && 
                                   !itemTitle.includes('psa10') &&
                                   !itemTitle.includes('bgs 10') &&
                                   !itemTitle.includes('sgc 10');
                        })
                        .map(item => item.price?.value || item.price)
                        .filter(price => price && price > 0);
                    
                    allRawPrices.push(...rawPrices);
                    console.log(`   📊 Found ${rawPrices.length} raw prices with strategy`);
                }
                
                // Rate limiting between searches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`   ❌ Error with strategy "${strategy}":`, error.message);
            }
        }
        
        return allRawPrices;
    }

    // Improved PSA 9 price search - exact card matching
    async searchPSA9Prices(title) {
        console.log(`   🔍 Searching for PSA 9 prices: ${title}`);
        
        const cleanTitle = this.db.cleanSummaryTitle(title);
        const strategies = [
            // Strategy 1: Clean title + PSA 9 (exact card match)
            `${cleanTitle} PSA 9`
        ];

        let allPSA9Prices = [];
        
        for (const strategy of strategies) {
            if (!strategy || strategy.length < 5) continue;
            
            try {
                console.log(`   🔍 PSA 9 Strategy: "${strategy}"`);
                const results = await search130point(strategy, 10);
                
                if (results && results.length > 0) {
                    const psa9Prices = results
                        .filter(item => {
                            const itemTitle = item.title.toLowerCase();
                            return itemTitle.includes('psa 9') || 
                                   itemTitle.includes('psa9') ||
                                   itemTitle.includes('psa 9.0');
                        })
                        .map(item => item.price?.value || item.price)
                        .filter(price => price && price > 0);
                    
                    allPSA9Prices.push(...psa9Prices);
                    console.log(`   📊 Found ${psa9Prices.length} PSA 9 prices with strategy`);
                }
                
                // Rate limiting between searches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`   ❌ Error with PSA 9 strategy "${strategy}":`, error.message);
            }
        }
        
        return allPSA9Prices;
    }



    // Check if raw prices exist for a card (without updating database)
    async checkRawPrices(title) {
        try {
            console.log(`   🔍 Checking raw prices for: ${title}`);
            
            // Search for raw prices only
            const rawPrices = await this.searchRawPrices(title);
            const rawAverage = rawPrices.length > 0 ? 
                rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
            
            if (rawAverage) {
                console.log(`   ✅ Found raw prices: $${rawAverage.toFixed(2)}`);
            } else {
                console.log(`   ⚠️  No raw prices found`);
            }
            
            return { rawAverage };
            
        } catch (error) {
            console.error(`   ❌ Error checking raw prices: ${error.message}`);
            return { rawAverage: null };
        }
    }

    // Update prices for a specific card
    async updateCardPrices(cardId, title) {
        try {
            console.log(`\n💰 Updating prices for card ${cardId}: ${title}`);
            
            // Search for raw prices
            const rawPrices = await this.searchRawPrices(title);
            const rawAverage = rawPrices.length > 0 ? 
                rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
            
            // Search for PSA 9 prices
            const psa9Prices = await this.searchPSA9Prices(title);
            const psa9Average = psa9Prices.length > 0 ? 
                psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : null;
            
            // Update database
            if (rawAverage || psa9Average) {
                const updateQuery = `
                    UPDATE cards 
                    SET raw_average_price = ?, 
                        psa9_average_price = ?,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                
                await this.db.runQuery(updateQuery, [rawAverage, psa9Average, cardId]);
                
                console.log(`   ✅ Updated prices - Raw: $${rawAverage?.toFixed(2) || 'N/A'}, PSA 9: $${psa9Average?.toFixed(2) || 'N/A'}`);
                return { rawAverage, psa9Average };
            } else {
                console.log(`   ⚠️  No raw/PSA 9 prices found`);
                return { rawAverage: null, psa9Average: null };
            }
            
        } catch (error) {
            console.error(`   ❌ Error updating prices: ${error.message}`);
            return { rawAverage: null, psa9Average: null };
        }
    }

    // Update prices for all cards missing raw/PSA 9 prices
    async updateAllMissingPrices() {
        try {
            console.log('🚀 Starting comprehensive price update for all cards...');
            
            await this.connect();
            
            // Get all cards missing raw or PSA 9 prices
            const query = `
                SELECT id, title, summary_title, psa10_price, raw_average_price, psa9_average_price
                FROM cards 
                WHERE (raw_average_price IS NULL OR psa9_average_price IS NULL)
                AND psa10_price IS NOT NULL
                ORDER BY id DESC
                LIMIT 50
            `;
            
            const cards = await this.db.allQuery(query);
            console.log(`📊 Found ${cards.length} cards needing price updates`);
            
            let updatedCount = 0;
            let totalRawFound = 0;
            let totalPSA9Found = 0;
            
            for (const card of cards) {
                console.log(`\n--- Processing card ${card.id}: ${card.title} ---`);
                
                const result = await this.updateCardPrices(card.id, card.title);
                
                if (result.rawAverage) totalRawFound++;
                if (result.psa9Average) totalPSA9Found++;
                updatedCount++;
                
                // Rate limiting between cards
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            console.log('\n✅ Price update complete!');
            console.log(`📊 Updated ${updatedCount} cards`);
            console.log(`💰 Found raw prices for ${totalRawFound} cards`);
            console.log(`💰 Found PSA 9 prices for ${totalPSA9Found} cards`);
            
            await this.db.close();
            
            return {
                success: true,
                updatedCount,
                totalRawFound,
                totalPSA9Found
            };
            
        } catch (error) {
            console.error('❌ Error in updateAllMissingPrices:', error);
            await this.db.close();
            throw error;
        }
    }
}

// Main execution
async function main() {
    const updater = new ImprovedPriceUpdater();
    
    try {
        await updater.updateAllMissingPrices();
    } catch (error) {
        console.error('❌ Error running price updater:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { ImprovedPriceUpdater };
