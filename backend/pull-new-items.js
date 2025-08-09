const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { search130point } = require('./services/130pointService');
const { searchSoldItems } = require('./services/ebayService');

class NewItemsPuller {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database for new items pull');
                    resolve();
                }
            });
        });
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

    // Check if card already exists in database (improved duplicate detection)
    async cardExists(title, price) {
        return new Promise((resolve, reject) => {
            // First check for exact title match (regardless of price)
            const exactTitleQuery = `SELECT id FROM cards WHERE title = ? LIMIT 1`;
            
            this.db.get(exactTitleQuery, [title], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    // Exact title match found - this is a duplicate
                    resolve(true);
                } else {
                    // No exact title match, check for similar title with same price
                    const similarQuery = `
                        SELECT id FROM cards 
                        WHERE (
                            (rawAveragePrice IS NOT NULL AND ABS(rawAveragePrice - ?) < 0.01) OR
                            (psa9AveragePrice IS NOT NULL AND ABS(psa9AveragePrice - ?) < 0.01) OR
                            (psa10Price IS NOT NULL AND ABS(psa10Price - ?) < 0.01)
                        )
                        LIMIT 1
                    `;
                    
                    this.db.get(similarQuery, [price, price, price], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(!!row);
                        }
                    });
                }
            });
        });
    }

    // Add new card to database
    async addCard(card) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO cards (
                    title, summaryTitle, sport, filterInfo, 
                    rawAveragePrice, psa9AveragePrice, psa10Price,
                    source, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            
            // Clean summary title (remove grading terms)
            const summaryTitle = this.cleanSummaryTitle(card.title);
            
            // Detect sport
            const sport = this.detectSport(card.title);
            
            // Focus on PSA 10 cards only - that's what we're pulling
            let rawPrice = null, psa9Price = null, psa10Price = null;
            const title = card.title.toLowerCase();
            
            // Since we're searching specifically for PSA 10, most should be PSA 10
            if (title.includes('psa 10') || title.includes('psa10')) {
                psa10Price = card.price?.value || card.price;
            } else {
                // This should not happen since we filter before calling addCard
                console.log(`   ❌ Unexpected non-PSA 10 card in addCard: ${card.title}`);
                throw new Error('Non-PSA 10 card passed to addCard function');
            }
            
            this.db.run(query, [
                card.title,
                summaryTitle,
                sport,
                JSON.stringify({ source: card.source || '130point', searchTerm: card.searchTerm }),
                rawPrice,
                psa9Price, 
                psa10Price,
                card.source || '130point'
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Clean summary title (reuse logic from api-clean-summary-titles.js)
    cleanSummaryTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove PSA grading information and cert numbers
        cleaned = cleaned.replace(/PSA\s+GEM\s+M[T]?(\s+\d+)?(\s+CERT\s*#?\s*\d+)?/gi, '');
        cleaned = cleaned.replace(/PSA\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
        cleaned = cleaned.replace(/CERT\s*#?\s*\d{8,}/gi, '');
        
        // Remove grading terms
        cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC|BECKETT)\s*(GEM\s*)?(MINT|MT|M)\s*\d*\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC)\s+\d+(\.\d+)?\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(GEM\s+)?(MINT|MT)\s+\d+\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(GEM\s+)?(MINT|MT)\s*$/gi, '');
        cleaned = cleaned.replace(/\s+GEM\s*$/gi, '');
        
        // Remove condition terms
        cleaned = cleaned.replace(/\s+(NM-MT|NMMT|NM|VF|EX|VG|GOOD|FAIR|POOR)\s*\d*\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(GRADED|UNGRADED)\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(NEW\s+HOLDER|OLD\s+HOLDER|HOLDER)\s*$/gi, '');
        
        // Remove serial numbers and pop reports
        cleaned = cleaned.replace(/\s+#?\s*\d{8,}\s*$/gi, '');
        cleaned = cleaned.replace(/\s+POP-\d+/gi, '');
        cleaned = cleaned.replace(/\s+NONE\s+HIGHER/gi, '');
        
        // Clean up spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    // Simple sport detection
    detectSport(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('pokemon') || titleLower.includes('pikachu') || titleLower.includes('charizard')) {
            return 'pokemon';
        } else if (titleLower.includes('topps') || titleLower.includes('panini prizm') || titleLower.includes('bowman')) {
            if (titleLower.includes('football') || titleLower.includes('nfl')) return 'football';
            if (titleLower.includes('basketball') || titleLower.includes('nba')) return 'basketball';
            return 'baseball'; // Default for Topps/Bowman
        } else if (titleLower.includes('yugioh') || titleLower.includes('yu-gi-oh')) {
            return 'yugioh';
        } else if (titleLower.includes('magic') || titleLower.includes('mtg')) {
            return 'magic';
        }
        
        return 'unknown';
    }

    // Main function to pull new items
    async pullNewItems() {
        try {
            console.log('🚀 Starting automated new items pull...');
            console.log('==========================================');
            
            await this.connect();
            
            const searchTerms = this.getSearchTerms();
            let totalNewItems = 0;
            let totalSearched = 0;
            
            for (const searchTerm of searchTerms) {
                try {
                    console.log(`\\n🔍 Searching for: "${searchTerm}"`);
                    
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
                                
                                // Check if card has "lot" in title (reject lot listings)
                                if (title.includes('lot')) {
                                    console.log(`   🚫 Skipping lot listing: ${item.title}`);
                                    continue;
                                }
                                
                                // Check PSA 10 price threshold ($30 minimum)
                                const price = item.price?.value || item.price;
                                if (price && price < 30) {
                                    console.log(`   💸 Skipping low-value PSA 10 ($${price}): ${item.title}`);
                                    continue;
                                }
                                
                                // Check if this card already exists
                                const exists = await this.cardExists(item.title, price);
                                
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
                                            console.log(`   🔄 Updating raw/PSA 9 prices for new item...`);
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
            
            console.log('\\n✅ New Items Pull Complete!');
            console.log('=============================');
            console.log(`📊 Searches performed: ${totalSearched}`);
            console.log(`🆕 New items added: ${totalNewItems}`);
            console.log(`📅 Next pull scheduled in 6 hours`);
            
            this.db.close();
            
            return {
                success: true,
                searchesPerformed: totalSearched,
                newItemsAdded: totalNewItems,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error during new items pull:', error);
            if (this.db) this.db.close();
            throw error;
        }
    }

    // Update raw and PSA 9 prices for a newly added item
    async updateNewItemPrices(cardId, title) {
        const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
        
        // Create a mock card object for the price updater
        const mockCard = {
            id: cardId,
            title: title,
            summaryTitle: title // Use the original title for now to fix the [object Object] issue
        };
        
        // Initialize the price updater
        const priceUpdater = new FastSQLitePriceUpdater();
        
        try {
            // Connect to database
            await priceUpdater.connect();
            
            // Use the searchCardPrices method which handles both raw and PSA 9 searches
            console.log(`     🔍 Searching for raw and PSA 9 prices...`);
            const priceResult = await priceUpdater.searchCardPrices(mockCard);
            
            if (priceResult) {
                // Update the database with the found prices
                const updateData = {};
                if (priceResult.rawAveragePrice) {
                    updateData.rawAveragePrice = priceResult.rawAveragePrice;
                    console.log(`     💰 Found raw price: $${priceResult.rawAveragePrice.toFixed(2)} (${priceResult.rawCount} sales)`);
                }
                if (priceResult.psa9AveragePrice) {
                    updateData.psa9AveragePrice = priceResult.psa9AveragePrice;
                    console.log(`     💎 Found PSA 9 price: $${priceResult.psa9AveragePrice.toFixed(2)} (${priceResult.psa9Count} sales)`);
                }
                
                if (Object.keys(updateData).length > 0) {
                    await priceUpdater.updateCardPrices(cardId, updateData);
                    console.log(`     ✅ Updated prices in database`);
                } else {
                    console.log(`     ⚠️ No prices found to update`);
                }
            } else {
                console.log(`     ⚠️ No price data returned`);
            }
            
            // Close the price updater connection
            if (priceUpdater.db) {
                priceUpdater.db.close();
            }
            
        } catch (error) {
            console.error(`     ❌ Error updating prices: ${error.message}`);
            // Close connection on error
            if (priceUpdater.db) {
                priceUpdater.db.close();
            }
            throw error;
        }
    }
}

// Export for use as module and cron job
module.exports = { NewItemsPuller };

// Run if called directly
if (require.main === module) {
    const puller = new NewItemsPuller();
    puller.pullNewItems()
        .then(result => {
            console.log('Pull completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Pull failed:', error);
            process.exit(1);
        });
}
