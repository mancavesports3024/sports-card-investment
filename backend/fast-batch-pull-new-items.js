const NewPricingDatabase = require('./create-new-pricing-database.js');
const { search130point } = require('./services/130pointService');

class FastBatchItemsPuller {
    constructor() {
        this.db = new NewPricingDatabase();
        this.batchSize = 5; // Process 5 cards in parallel
        this.searchDelay = 1000; // Reduced from 3000ms to 1000ms
        this.maxConcurrentSearches = 3; // Limit concurrent searches
    }

    async connect() {
        await this.db.connect();
        await this.fixDatabaseSchema();
    }

    // Fix database schema if needed
    async fixDatabaseSchema() {
        try {
            // Check if psa10_average_price column exists
            const columns = await this.db.allQuery("PRAGMA table_info(cards)");
            const hasColumn = columns.some(col => col.name === 'psa10_average_price');
            
            if (!hasColumn) {
                console.log('🔧 Adding missing psa10_average_price column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN psa10_average_price DECIMAL(10,2)");
                console.log('✅ Added psa10_average_price column');
            }
        } catch (error) {
            console.log('⚠️ Schema fix not needed or already applied');
        }
    }

    // Optimized search terms - focus on high-value, high-volume searches
    getSearchTerms() {
        return [
            // High-volume general searches
            "PSA 10",
            "PSA 10 basketball",
            "PSA 10 football",
            "PSA 10 rookie",
            
            // High-value premium sets
            "Panini Prizm PSA 10",
            "Topps Chrome PSA 10",
            "Bowman Chrome PSA 10",
            "Donruss Optic PSA 10",
            "Panini Mosaic PSA 10",
            "Panini Select PSA 10",
            
            // High-value combinations
            "Topps Chrome Rookie PSA 10",
            "Panini Prizm Rookie PSA 10",
            "Bowman Chrome Rookie PSA 10"
        ];
    }

    // Check if card already exists (optimized)
    async cardExists(title, price) {
        const query = `
            SELECT id FROM cards 
            WHERE title = ?
            LIMIT 1
        `;
        
        const row = await this.db.getQuery(query, [title]);
        return !!row;
    }

    // Add new card to database
    async addCard(cardData) {
        try {
            const cardId = await this.db.addCard(cardData);
            return cardId;
        } catch (error) {
            // Handle specific constraint errors
            if (error.code === 'SQLITE_CONSTRAINT') {
                if (error.message.includes('Card with this title already exists')) {
                    console.log(`⚠️ Skipping duplicate card: "${cardData.title}"`);
                } else if (error.message.includes('Valid year')) {
                    console.log(`⚠️ Skipping card with invalid year: "${cardData.title}"`);
                } else {
                    console.log(`⚠️ Database constraint error for card: "${cardData.title}" - ${error.message}`);
                }
            } else {
                console.log(`❌ Error adding card: "${cardData.title}" - ${error.message}`);
            }
            return null;
        }
    }

    // Process a batch of cards
    async processCardBatch(cards, searchTerm) {
        const validCards = [];
        
        // Filter PSA 10 cards and check for duplicates
        for (const item of cards) {
            const title = item.title.toLowerCase();
            if (!title.includes('psa 10') && !title.includes('psa10')) {
                continue;
            }
            
            // Check PSA 10 price - only add if $40 or higher
            let psa10Price;
            try {
                psa10Price = parseFloat(item.price?.value || item.price);
                if (isNaN(psa10Price) || psa10Price < 40) {
                    continue;
                }
            } catch (priceError) {
                console.log(`⚠️ Invalid price format for card: "${item.title}" - ${item.price?.value || item.price}`);
                continue;
            }
            
            const exists = await this.cardExists(item.title, item.price?.value || item.price);
            if (!exists) {
                item.searchTerm = searchTerm;
                item.source = '130point_auto';
                validCards.push(item);
            }
        }
        
        if (validCards.length === 0) {
            return 0;
        }
        
        // Batch check raw prices and get the actual price data
        const { ImprovedPriceUpdater } = require('./improve-price-updating.js');
        const priceUpdater = new ImprovedPriceUpdater();
        
        try {
            await priceUpdater.connect();
        } catch (connectionError) {
            console.error('❌ Failed to connect to price updater:', connectionError.message);
            return 0;
        }
        
        const results = [];
        
        // Process in smaller batches to avoid overwhelming the API
        const checkBatchSize = 3;
        for (let i = 0; i < validCards.length; i += checkBatchSize) {
            const batch = validCards.slice(i, i + checkBatchSize);
            const batchPromises = batch.map(async (card) => {
                try {
                    // Get raw, PSA 9, and PSA 10 prices
                    const rawPrices = await priceUpdater.searchRawPrices(card.title);
                    const psa9Prices = await priceUpdater.searchPSA9Prices(card.title);
                    const psa10Prices = await priceUpdater.searchPSA10Prices(card.title);
                    
                    const rawAverage = rawPrices.length > 0 ? 
                        rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
                    const psa9Average = psa9Prices.length > 0 ? 
                        psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : null;
                    const psa10Average = psa10Prices.length > 0 ? 
                        psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : null;
                    
                    return { 
                        card, 
                        hasRawPrices: rawAverage !== null,
                        rawAverage,
                        psa9Average,
                        psa10Average
                    };
                } catch (error) {
                    return { card, hasRawPrices: false, rawAverage: null, psa9Average: null, psa10Average: null };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Small delay between batches
            if (i + checkBatchSize < validCards.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        try {
            await priceUpdater.db.close();
        } catch (closeError) {
            console.log(`⚠️ Error closing price updater connection: ${closeError.message}`);
        }
        
        // Add cards that have raw prices and update them with the prices
        let addedCount = 0;
        for (const result of results) {
            if (result.hasRawPrices) {
                const cardId = await this.addCard(result.card);
                if (cardId) {
                    // Update the card with the found prices
                    const updateQuery = `
                        UPDATE cards 
                        SET raw_average_price = ?, 
                            psa9_average_price = ?,
                            psa10_average_price = ?,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `;
                    
                    await this.db.runQuery(updateQuery, [result.rawAverage, result.psa9Average, result.psa10Average, cardId]);
                    
                    addedCount++;
                }
            }
        }
        
        return addedCount;
    }

    // Main function with batch processing
    async pullNewItems() {
        try {
            // Ensure database connection
            if (!this.db) {
                await this.connect();
            }
            
            // Validate database connection
            if (!this.db.pricingDb) {
                throw new Error('Database connection failed');
            }
            
            const searchTerms = this.getSearchTerms();
            let totalNewItems = 0;
            let totalSearched = 0;
            
            // Process search terms in batches
            for (let i = 0; i < searchTerms.length; i += this.maxConcurrentSearches) {
                const searchBatch = searchTerms.slice(i, i + this.maxConcurrentSearches);
                
                // Process searches in parallel
                const searchPromises = searchBatch.map(async (searchTerm) => {
                    try {
                        const results = await search130point(searchTerm, 15);
                        
                        if (results && results.length > 0) {
                            // Process cards in batches
                            let batchAdded = 0;
                            for (let j = 0; j < results.length; j += this.batchSize) {
                                const cardBatch = results.slice(j, j + this.batchSize);
                                const added = await this.processCardBatch(cardBatch, searchTerm);
                                batchAdded += added;
                            }
                            
                            totalNewItems += batchAdded;
                        }
                        
                        totalSearched++;
                        
                    } catch (searchError) {
                        // Silent error handling
                    }
                });
                
                // Wait for all searches in this batch to complete
                await Promise.all(searchPromises);
                
                // Reduced delay between search batches
                if (i + this.maxConcurrentSearches < searchTerms.length) {
                    await new Promise(resolve => setTimeout(resolve, this.searchDelay));
                }
            }
            
            // Calculate multipliers for new cards
            if (totalNewItems > 0) {
                console.log('🧮 Calculating multipliers for new cards...');
                try {
                    const { MultiplierFieldAdder } = require('./add-multiplier-field.js');
                    const adder = new MultiplierFieldAdder();
                    await adder.connect();
                    await adder.calculateMultipliers();
                    await adder.close();
                    console.log('✅ Multiplier calculation completed');
                } catch (multiplierError) {
                    console.log(`⚠️ Error calculating multipliers: ${multiplierError.message}`);
                }
            }
            
            // Get final stats
            const stats = await this.db.getDatabaseStats();
            
            try {
                await this.db.close();
            } catch (closeError) {
                console.log(`⚠️ Error closing database connection: ${closeError.message}`);
            }
            
            return {
                success: true,
                newItems: totalNewItems,
                searches: totalSearched,
                databaseStats: stats
            };
            
        } catch (error) {
            try {
                await this.db.close();
            } catch (closeError) {
                console.log(`⚠️ Error closing database connection: ${closeError.message}`);
            }
            throw error;
        }
    }
}

// Main execution
async function main() {
    const puller = new FastBatchItemsPuller();
    
    try {
        await puller.pullNewItems();
    } catch (error) {
        console.error('❌ Error running fast batch pull:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { FastBatchItemsPuller, pullNewItems: async (db) => {
    const puller = new FastBatchItemsPuller();
    await puller.connect();
    return await puller.pullNewItems();
}};
