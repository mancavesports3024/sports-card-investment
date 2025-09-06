const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService');

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
            const hasPsa10Column = columns.some(col => col.name === 'psa10_average_price');
            
            if (!hasPsa10Column) {
                console.log('🔧 Adding missing psa10_average_price column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN psa10_average_price DECIMAL(10,2)");
                console.log('✅ Added psa10_average_price column');
            }

            // Check if new component fields exist
            const hasCardSet = columns.some(col => col.name === 'card_set');
            const hasCardNumber = columns.some(col => col.name === 'card_number');
            const hasPrintRun = columns.some(col => col.name === 'print_run');

            if (!hasCardSet) {
                console.log('🔧 Adding missing card_set column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN card_set TEXT");
                console.log('✅ Added card_set column');
            }

            if (!hasCardNumber) {
                console.log('🔧 Adding missing card_number column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN card_number TEXT");
                console.log('✅ Added card_number column');
            }

            if (!hasPrintRun) {
                console.log('🔧 Adding missing print_run column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN print_run TEXT");
                console.log('✅ Added print_run column');
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

    // Normalize title for duplicate checking
    normalizeTitle(title) {
        return title.toLowerCase()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[^\w\s#-]/g, '') // Remove special characters except # and -
            .trim();
    }

    // Check if card already exists (improved duplicate detection)
    async cardExists(title, price, ebayItemId) {
        const normalizedTitle = this.normalizeTitle(title);
        
        // First check exact title match
        let query = `
            SELECT id, title FROM cards 
            WHERE title = ?
        `;
        
        let params = [title];
        
        // Also check for duplicate eBay item ID if available
        if (ebayItemId) {
            query += ` OR ebay_item_id = ?`;
            params.push(ebayItemId);
        }
        
        query += ` LIMIT 1`;
        
        const exactMatch = await this.db.getQuery(query, params);
        if (exactMatch) {
            return true;
        }
        
        // If no exact match, check for normalized title matches
        const allCards = await this.db.allQuery(`SELECT id, title FROM cards`);
        
        for (const card of allCards) {
            const cardNormalized = this.normalizeTitle(card.title);
            if (cardNormalized === normalizedTitle) {
                console.log(`⚠️ Found duplicate with normalized title match:`);
                console.log(`   Existing: "${card.title}"`);
                console.log(`   New: "${title}"`);
                console.log(`   Normalized: "${normalizedTitle}"`);
                return true;
            }
        }
        
        return false;
    }

    // Add new card to database
    async addCard(cardData) {
        try {
            // Double-check for duplicates before adding
            const exists = await this.cardExists(cardData.title, cardData.price?.value || cardData.price, cardData.ebayItemId);
            if (exists) {
                console.log(`⚠️ Card already exists in database, skipping: "${cardData.title}"`);
                return null;
            }
            
            const cardId = await this.db.addCard(cardData);
            return cardId;
        } catch (error) {
            // Handle specific constraint errors
            if (error.code === 'SQLITE_CONSTRAINT') {
                console.log(`⚠️ Database constraint error for card: "${cardData.title}"`);
                console.log(`   Error details: ${error.message}`);
                console.log(`   eBay Item ID: ${cardData.ebayItemId || 'N/A'}`);
                console.log(`   Price: ${cardData.price?.value || cardData.price || 'N/A'}`);
                
                // Final check for duplicates
                const exists = await this.cardExists(cardData.title, cardData.price?.value || cardData.price, cardData.ebayItemId);
                if (exists) {
                    console.log(`   ⚠️ Card already exists in database, skipping`);
                } else {
                    console.log(`   ❌ Unexpected constraint error - card should not exist`);
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
            
            const exists = await this.cardExists(item.title, item.price?.value || item.price, item.ebayItemId);
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
                        const ebayService = new EbayScraperService();
                        const results = await ebayService.searchSoldCards(searchTerm, null, 15, 'PSA 10');
                        
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
