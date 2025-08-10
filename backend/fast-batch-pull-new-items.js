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
        console.log('✅ Connected to new pricing database with fast batch processing');
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
            WHERE title = ? AND (
                (raw_average_price IS NOT NULL AND ABS(raw_average_price - ?) < 0.01) OR
                (psa9_average_price IS NOT NULL AND ABS(psa9_average_price - ?) < 0.01) OR
                (psa10_price IS NOT NULL AND ABS(psa10_price - ?) < 0.01)
            )
            LIMIT 1
        `;
        
        const row = await this.db.getQuery(query, [title, price, price, price]);
        return !!row;
    }

    // Add new card to database
    async addCard(cardData) {
        try {
            const cardId = await this.db.addCard(cardData);
            return cardId;
        } catch (error) {
            console.error(`   ❌ Error adding card: ${error.message}`);
            return null;
        }
    }

    // Batch check raw prices for multiple cards
    async batchCheckRawPrices(titles) {
        const { ImprovedPriceUpdater } = require('./improve-price-updating.js');
        const priceUpdater = new ImprovedPriceUpdater();
        await priceUpdater.connect();
        
        const results = [];
        
        // Process in smaller batches to avoid overwhelming the API
        const checkBatchSize = 3;
        for (let i = 0; i < titles.length; i += checkBatchSize) {
            const batch = titles.slice(i, i + checkBatchSize);
            const batchPromises = batch.map(async (title) => {
                try {
                    const result = await priceUpdater.checkRawPrices(title);
                    return { title, hasRawPrices: result && result.rawAverage !== null };
                } catch (error) {
                    console.error(`   ❌ Error checking raw prices for ${title}: ${error.message}`);
                    return { title, hasRawPrices: false };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Small delay between batches
            if (i + checkBatchSize < titles.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        await priceUpdater.db.close();
        return results;
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
        
        console.log(`   🔍 Checking raw prices for ${validCards.length} cards...`);
        
        // Batch check raw prices
        const priceCheckResults = await this.batchCheckRawPrices(validCards.map(card => card.title));
        
        // Add cards that have raw prices
        let addedCount = 0;
        for (let i = 0; i < validCards.length; i++) {
            const card = validCards[i];
            const hasRawPrices = priceCheckResults[i]?.hasRawPrices;
            
            if (hasRawPrices) {
                const cardId = await this.addCard(card);
                if (cardId) {
                    addedCount++;
                    console.log(`   ✅ Added: ${card.title}`);
                }
            } else {
                console.log(`   ⏭️  Skipped (no raw prices): ${card.title}`);
            }
        }
        
        return addedCount;
    }

    // Main function with batch processing
    async pullNewItems() {
        try {
            console.log('🚀 Starting FAST BATCH items pull with comprehensive sport detection...');
            console.log('================================================================');
            
            await this.connect();
            
            const searchTerms = this.getSearchTerms();
            let totalNewItems = 0;
            let totalSearched = 0;
            
            // Process search terms in batches
            for (let i = 0; i < searchTerms.length; i += this.maxConcurrentSearches) {
                const searchBatch = searchTerms.slice(i, i + this.maxConcurrentSearches);
                
                console.log(`\n🔍 Processing search batch ${Math.floor(i/this.maxConcurrentSearches) + 1}:`);
                searchBatch.forEach(term => console.log(`   - "${term}"`));
                
                // Process searches in parallel
                const searchPromises = searchBatch.map(async (searchTerm) => {
                    try {
                        console.log(`\n🔍 Searching: "${searchTerm}"`);
                        const results = await search130point(searchTerm, 15); // Increased limit
                        
                        if (results && results.length > 0) {
                            console.log(`   📦 Found ${results.length} items from 130point`);
                            
                            // Process cards in batches
                            let batchAdded = 0;
                            for (let j = 0; j < results.length; j += this.batchSize) {
                                const cardBatch = results.slice(j, j + this.batchSize);
                                const added = await this.processCardBatch(cardBatch, searchTerm);
                                batchAdded += added;
                            }
                            
                            totalNewItems += batchAdded;
                            console.log(`   ✅ Added ${batchAdded} cards from "${searchTerm}"`);
                        } else {
                            console.log(`   🔍 No items found for "${searchTerm}"`);
                        }
                        
                        totalSearched++;
                        
                    } catch (searchError) {
                        console.error(`❌ Error searching "${searchTerm}": ${searchError.message}`);
                    }
                });
                
                // Wait for all searches in this batch to complete
                await Promise.all(searchPromises);
                
                // Reduced delay between search batches
                if (i + this.maxConcurrentSearches < searchTerms.length) {
                    console.log(`\n⏳ Waiting ${this.searchDelay}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, this.searchDelay));
                }
            }
            
            // Get final stats
            const stats = await this.db.getDatabaseStats();
            
            console.log('\n✅ FAST BATCH Pull Complete!');
            console.log('=============================');
            console.log(`📊 Searches performed: ${totalSearched}`);
            console.log(`🆕 New items added: ${totalNewItems}`);
            console.log(`📈 Database totals: ${stats.total} cards, ${stats.withPrices} with prices`);
            console.log(`⚡ Processing speed: ~${Math.round(totalNewItems / (totalSearched * 0.1))} cards per minute`);
            
            await this.db.close();
            
            return {
                success: true,
                newItems: totalNewItems,
                searches: totalSearched,
                databaseStats: stats
            };
            
        } catch (error) {
            console.error('❌ Error in fast batch pull:', error);
            await this.db.close();
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
