const NewPricingDatabase = require('./create-new-pricing-database.js');
const { search130point } = require('./services/130pointService');

class ImprovedPriceUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    // Improved raw price search - exact card matching
    async searchRawPrices(title) {
        const cleanTitle = this.db.cleanSummaryTitle(title);
        const strategies = [
            // Strategy 1: Clean title (already has grading terms removed)
            cleanTitle
        ];

        let allRawPrices = [];
        
        for (const strategy of strategies) {
            if (!strategy || strategy.length < 5) continue;
            
            try {
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
                        .map(item => {
                            const priceValue = item.price?.value || item.price;
                            return typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                        })
                        .filter(price => price && !isNaN(price) && price > 0);
                    
                    allRawPrices.push(...rawPrices);
                }
                
                // Rate limiting between searches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                // Silent error handling
            }
        }
        
        return allRawPrices;
    }

    // Improved PSA 9 price search - exact card matching
    async searchPSA9Prices(title) {
        const cleanTitle = this.db.cleanSummaryTitle(title);
        const strategies = [
            // Strategy 1: Clean title + PSA 9 (exact card match)
            `${cleanTitle} PSA 9`
        ];

        let allPSA9Prices = [];
        
        for (const strategy of strategies) {
            if (!strategy || strategy.length < 5) continue;
            
            try {
                const results = await search130point(strategy, 10);
                
                if (results && results.length > 0) {
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
                    
                    allPSA9Prices.push(...psa9Prices);
                }
                
                // Rate limiting between searches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                // Silent error handling
            }
        }
        
        return allPSA9Prices;
    }

    // PSA 10 price search - to calculate average from multiple sales
    async searchPSA10Prices(title) {
        const cleanTitle = this.db.cleanSummaryTitle(title);
        const strategies = [
            // Strategy 1: Clean title + PSA 10 (exact card match)
            `${cleanTitle} PSA 10`
        ];

        let allPSA10Prices = [];
        
        for (const strategy of strategies) {
            if (!strategy || strategy.length < 5) continue;
            
            try {
                const results = await search130point(strategy, 10);
                
                if (results && results.length > 0) {
                    const psa10Prices = results
                        .filter(item => {
                            const itemTitle = item.title.toLowerCase();
                            return itemTitle.includes('psa 10') || 
                                   itemTitle.includes('psa10') ||
                                   itemTitle.includes('psa 10.0');
                        })
                        .map(item => {
                            const priceValue = item.price?.value || item.price;
                            return typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                        })
                        .filter(price => price && !isNaN(price) && price > 0);
                    
                    allPSA10Prices.push(...psa10Prices);
                }
                
                // Rate limiting between searches
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                // Silent error handling
            }
        }
        
        return allPSA10Prices;
    }

    // Check if raw prices exist for a card (without updating database)
    async checkRawPrices(title) {
        try {
            // Search for raw prices only
            const rawPrices = await this.searchRawPrices(title);
            const rawAverage = rawPrices.length > 0 ? 
                rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
            
            return { rawAverage };
            
        } catch (error) {
            return { rawAverage: null };
        }
    }

    // Update card prices in database
    async updateCardPrices(cardId, title) {
        try {
            // Search for raw prices
            const rawPrices = await this.searchRawPrices(title);
            const rawAverage = rawPrices.length > 0 ? 
                rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
            
            // Search for PSA 9 prices
            const psa9Prices = await this.searchPSA9Prices(title);
            const psa9Average = psa9Prices.length > 0 ? 
                psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : null;
            
            // Search for PSA 10 prices to calculate average
            const psa10Prices = await this.searchPSA10Prices(title);
            const psa10Average = psa10Prices.length > 0 ? 
                psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : null;
            
            // Update database
            const updateQuery = `
                UPDATE cards 
                SET raw_average_price = ?, 
                    psa9_average_price = ?,
                    psa10_average_price = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            await this.db.runQuery(updateQuery, [rawAverage, psa9Average, psa10Average, cardId]);
            
            return {
                rawAverage,
                psa9Average,
                psa10Average,
                rawCount: rawPrices.length,
                psa9Count: psa9Prices.length,
                psa10Count: psa10Prices.length
            };
            
        } catch (error) {
            console.error(`Error updating prices for card ${cardId}:`, error.message);
            return null;
        }
    }

    // Update all cards with missing prices
    async updateAllMissingPrices() {
        try {
            const query = `
                SELECT id, title 
                FROM cards 
                WHERE (raw_average_price IS NULL OR psa9_average_price IS NULL)
                AND title IS NOT NULL
                ORDER BY id DESC
                LIMIT 50
            `;
            
            const cards = await this.db.allQuery(query);
            
            if (cards.length === 0) {
                return { updated: 0, total: 0 };
            }
            
            let updatedCount = 0;
            
            for (const card of cards) {
                try {
                    const result = await this.updateCardPrices(card.id, card.title);
                    
                    if (result) {
                        updatedCount++;
                    }
                    
                    // Rate limiting between updates
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                } catch (error) {
                    // Silent error handling
                }
            }
            
            return { updated: updatedCount, total: cards.length };
            
        } catch (error) {
            throw error;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Main execution
async function main() {
    const updater = new ImprovedPriceUpdater();
    
    try {
        await updater.connect();
        await updater.updateAllMissingPrices();
    } catch (error) {
        console.error('❌ Error running price updater:', error);
        process.exit(1);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { ImprovedPriceUpdater };
