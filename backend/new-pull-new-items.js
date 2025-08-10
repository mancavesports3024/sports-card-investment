const NewPricingDatabase = require('./create-new-pricing-database.js');
const { search130point } = require('./services/130pointService');
const { searchSoldItems } = require('./services/ebayService');

class NewItemsPuller {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to new pricing database with comprehensive sport detection');
    }

    // PSA 10 search terms - using your existing proven patterns + high-value product combinations
    getSearchTerms() {
        return [
            // Your existing proven PSA 10 search patterns
            "PSA 10",                    // General PSA 10 search
            "PSA 10 basketball",         // PSA 10 Basketball cards
            "PSA 10 football",           // PSA 10 Football cards
            "PSA 10 rookie",             // PSA 10 Rookie cards
            "PSA 10 auto",               // PSA 10 Autograph cards
            "PSA 10 pokemon",            // PSA 10 Pokemon cards
            "PSA 10 refractor",          // PSA 10 Refractor cards
            
            // High-value product combinations from your database (no years/sports for broader results)
            // Premium Set Names
            "Panini Prizm PSA 10",
            "Panini Select PSA 10", 
            "Donruss Optic PSA 10",
            "Panini Mosaic PSA 10",
            "Topps Chrome PSA 10",
            "Bowman Chrome PSA 10",
            "Panini Obsidian PSA 10",
            "Panini Immaculate PSA 10",
            "Panini National Treasures PSA 10",
            "Topps Finest PSA 10",
            "Panini Flawless PSA 10",
            "Panini Chronicles PSA 10",
            "Topps Heritage PSA 10",
            "Panini Contenders PSA 10",
            "Topps Stadium Club PSA 10",
            
            // High-value vintage/modern combos  
            "Topps Chrome Rookie PSA 10",
            "Panini Prizm Rookie PSA 10",
            "Donruss Optic Rookie PSA 10",
            "Bowman Chrome Rookie PSA 10",
            
            // RC (Rookie Card) variations
            "Topps Chrome RC PSA 10",
            "Panini Prizm RC PSA 10", 
            "Donruss Optic RC PSA 10",
            "Bowman Chrome RC PSA 10"
        ];
    }

    // Check if card already exists in database
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

    // Add new card to database with improved sport detection
    async addCard(cardData) {
        try {
            const cardId = await this.db.addCard(cardData);
            console.log(`   ✅ Added card with ID: ${cardId}`);
            return cardId;
        } catch (error) {
            console.error(`   ❌ Error adding card: ${error.message}`);
            return null;
        }
    }

    // Update raw and PSA 9 prices for newly added cards
    async updateNewItemPrices(cardId, title) {
        try {
            console.log(`   🔄 Updating raw/PSA 9 prices for: ${title}`);
            
            // Use improved price updating logic
            const { ImprovedPriceUpdater } = require('./improve-price-updating.js');
            const priceUpdater = new ImprovedPriceUpdater();
            await priceUpdater.connect();
            
            const result = await priceUpdater.updateCardPrices(cardId, title);
            await priceUpdater.db.close();
            
            return result;
            
        } catch (error) {
            console.error(`   ❌ Error updating prices: ${error.message}`);
            return { rawAverage: null, psa9Average: null };
        }
    }

    // Main function to pull new items
    async pullNewItems() {
        try {
            console.log('🚀 Starting new automated items pull with comprehensive sport detection...');
            console.log('================================================================');
            
            await this.connect();
            
            const searchTerms = this.getSearchTerms();
            let totalNewItems = 0;
            let totalSearched = 0;
            
            for (const searchTerm of searchTerms) {
                try {
                    console.log(`\n🔍 Searching for: "${searchTerm}"`);
                    
                    // Search 130point for new items (limit to 10 per search to avoid overwhelming)
                    const results = await search130point(searchTerm, 10);
                    totalSearched++;
                    
                    if (results && results.length > 0) {
                        console.log(`   📦 Found ${results.length} items from 130point`);
                        
                        for (const item of results) {
                            try {
                                // Check if this is a PSA 10 card
                                const title = item.title.toLowerCase();
                                if (!title.includes('psa 10') && !title.includes('psa10')) {
                                    console.log(`   ⏭️  Skipping non-PSA 10 card: ${item.title}`);
                                    continue;
                                }
                                
                                // Check if this card already exists
                                const exists = await this.cardExists(item.title, item.price?.value || item.price);
                                
                                if (!exists) {
                                    // Add search term for reference
                                    item.searchTerm = searchTerm;
                                    item.source = '130point_auto';
                                    
                                    const cardId = await this.addCard(item);
                                    if (cardId) {
                                        totalNewItems++;
                                        console.log(`   ✅ Added new PSA 10 item: ${item.title}`);
                                        
                                        // Immediately update raw and PSA 9 prices for the new item
                                        try {
                                            await this.updateNewItemPrices(cardId, item.title);
                                        } catch (priceError) {
                                            console.error(`   ❌ Failed to update prices for new item: ${priceError.message}`);
                                        }
                                    }
                                } else {
                                    console.log(`   ⏭️  Skipped duplicate: ${item.title}`);
                                }
                            } catch (addError) {
                                console.error(`   ❌ Error adding item: ${addError.message}`);
                            }
                        }
                    } else {
                        console.log(`   🔍 No items found for "${searchTerm}"`);
                    }
                    
                    // Rate limiting between searches
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                } catch (searchError) {
                    console.error(`❌ Error searching "${searchTerm}": ${searchError.message}`);
                }
            }
            
            // Get final stats
            const stats = await this.db.getDatabaseStats();
            
            console.log('\n✅ New Items Pull Complete!');
            console.log('=============================');
            console.log(`📊 Searches performed: ${totalSearched}`);
            console.log(`🆕 New items added: ${totalNewItems}`);
            console.log(`📈 Database totals: ${stats.total} cards, ${stats.withPrices} with prices`);
            console.log(`📅 Next pull scheduled in 6 hours`);
            
            await this.db.close();
            
            return {
                success: true,
                newItems: totalNewItems,
                searches: totalSearched,
                databaseStats: stats
            };
            
        } catch (error) {
            console.error('❌ Error in pullNewItems:', error);
            await this.db.close();
            throw error;
        }
    }
}

// Main execution
async function main() {
    const puller = new NewItemsPuller();
    
    try {
        await puller.pullNewItems();
    } catch (error) {
        console.error('❌ Error running new items pull:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { NewItemsPuller, pullNewItems: async (db) => {
    const puller = new NewItemsPuller();
    await puller.connect();
    return await puller.pullNewItems();
}};