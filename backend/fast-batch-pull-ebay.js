const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService.js');

class FastBatchItemsPullerEbay {
    constructor() {
        this.db = new NewPricingDatabase();
        this.batchSize = 3; // Reduced to 3 cards per batch
        this.searchDelay = 5000; // Increased to 5 seconds between searches
        this.maxConcurrentSearches = 1; // Sequential only - no parallel searches
        this.ebayService = new EbayScraperService();
        this.totalSearches = 0;
        this.successfulSearches = 0;
        this.blockedSearches = 0;
    }

    async connect() {
        await this.db.connect();
        await this.fixDatabaseSchema();
    }

    // Fix database schema if needed
    async fixDatabaseSchema() {
        try {
            const columns = await this.db.allQuery("PRAGMA table_info(cards)");
            const hasPsa10Column = columns.some(col => col.name === 'psa10_average_price');
            
            if (!hasPsa10Column) {
                console.log('🔧 Adding missing psa10_average_price column...');
                await this.db.runQuery("ALTER TABLE cards ADD COLUMN psa10_average_price DECIMAL(10,2)");
                console.log('✅ Added psa10_average_price column');
            }

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

    // PHASE 1: Start SMALL - Just 10 safe searches to test eBay's tolerance
    getSearchTerms() {
        return [
            // === PHASE 1: TEST RUN - Just 10 searches ===
            // Baseball - Most popular, lowest risk
            "PSA 10 2024 Bowman Chrome Draft",
            "PSA 10 2024 Topps Chrome",
            
            // Football - High demand, moderate risk
            "PSA 10 2024 Prizm football",
            "PSA 10 2024 Select football",
            
            // Basketball - Popular, moderate risk
            "PSA 10 2024 Prizm basketball",
            "PSA 10 2024 Select basketball",
            
            // Hockey - Lower volume, lower risk
            "PSA 10 2024 Upper Deck Series 1 hockey",
            
            // Pokemon - High value, moderate risk
            "PSA 10 2024 Pokemon Scarlet Violet",
            "PSA 10 2024 Pokemon 151",
            
            // Soccer - Lower volume, lowest risk
            "PSA 10 2024 Panini Prizm soccer"
        ];
    }

    // Normalize title for duplicate checking
    normalizeTitle(title) {
        return title.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s#-]/g, '')
            .trim();
    }

    // Check if card already exists
    async cardExists(title, price, ebayItemId) {
        const normalizedTitle = this.normalizeTitle(title);
        
        let query = `
            SELECT id, title FROM cards 
            WHERE title = ?
        `;
        
        let params = [title];
        
        if (ebayItemId) {
            query += ` OR ebay_item_id = ?`;
            params.push(ebayItemId);
        }
        
        query += ` LIMIT 1`;
        
        const exactMatch = await this.db.getQuery(query, params);
        if (exactMatch) {
            return true;
        }
        
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
            const {
                title,
                price,
                soldDate,
                condition,
                cardType,
                grade,
                sport,
                imageUrl,
                itemUrl,
                ebayItemId,
                searchTerm,
                source
            } = cardData;

            if (await this.cardExists(title, price, ebayItemId)) {
                return false;
            }

            const playerName = this.extractPlayerName(title);
            const year = this.extractYear(title);
            const brand = this.extractBrand(title);
            const set = this.extractSet(title);
            const cardNumber = this.extractCardNumber(title);
            const printRun = this.extractPrintRun(title);
            const isRookie = this.isRookie(title);
            const isAutograph = this.isAutograph(title);

            const query = `
                INSERT INTO cards (
                    title, price, sold_date, condition, card_type, grade, sport,
                    image_url, item_url, ebay_item_id, search_term, source,
                    player_name, year, brand, set_name, card_number, print_run,
                    is_rookie, is_autograph, created_at, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            const params = [
                title, price, soldDate, condition, cardType, grade, sport,
                imageUrl, itemUrl, ebayItemId, searchTerm, source,
                playerName, year, brand, set, cardNumber, printRun,
                isRookie, isAutograph
            ];

            await this.db.runQuery(query, params);
            console.log(`✅ Added new card: ${title.substring(0, 50)}...`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding card: ${error.message}`);
            return false;
        }
    }

    // Process a batch of cards
    async processCardBatch(cards, searchTerm) {
        let addedCount = 0;
        
        for (const card of cards) {
            try {
                const cardData = {
                    title: card.title,
                    price: card.price,
                    soldDate: card.soldDate || 'Recently sold',
                    condition: card.condition || 'Unknown',
                    cardType: card.cardType || 'Unknown',
                    grade: card.grade || 'Unknown',
                    sport: card.sport || 'Unknown',
                    imageUrl: card.imageUrl || '',
                    itemUrl: card.itemUrl || '',
                    ebayItemId: card.rawData?.itemId || null,
                    searchTerm: searchTerm,
                    source: 'ebay_scraper'
                };

                const added = await this.addCard(cardData);
                if (added) {
                    addedCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing card: ${error.message}`);
            }
        }
        
        return addedCount;
    }

    // Main function with SAFE, SEQUENTIAL processing
    async pullNewItems() {
        try {
            if (!this.db) {
                await this.connect();
            }
            
            if (!this.db.pricingDb) {
                throw new Error('Database connection failed');
            }
            
            const searchTerms = this.getSearchTerms();
            let totalNewItems = 0;
            
            console.log(`🚀 Starting SAFE eBay test run with ${searchTerms.length} searches`);
            console.log(`⚠️  Using SEQUENTIAL processing (no parallel searches)`);
            console.log(`⏱️  5 second delay between searches to avoid blocking`);
            console.log(`📊 This is a TEST RUN to check eBay's tolerance`);
            
            // Process searches ONE AT A TIME (much safer)
            for (let i = 0; i < searchTerms.length; i++) {
                const searchTerm = searchTerms[i];
                
                console.log(`\n🔍 Search ${i + 1}/${searchTerms.length}: "${searchTerm}"`);
                console.log(`   ⏳ Processing...`);
                
                try {
                    const result = await this.ebayService.searchSoldCards(searchTerm, null, 15);
                    this.totalSearches++;
                    
                    if (result.success && result.results && result.results.length > 0) {
                        const psa10Cards = result.results.filter(item => 
                            item.numericPrice >= 50 && item.numericPrice <= 50000
                        );
                        
                        if (psa10Cards.length > 0) {
                            console.log(`   ✅ Found ${psa10Cards.length} PSA 10 cards`);
                            
                            let batchAdded = 0;
                            for (let j = 0; j < psa10Cards.length; j += this.batchSize) {
                                const cardBatch = psa10Cards.slice(j, j + this.batchSize);
                                const added = await this.processCardBatch(cardBatch, searchTerm);
                                batchAdded += added;
                            }
                            
                            totalNewItems += batchAdded;
                            this.successfulSearches++;
                            console.log(`   💾 Added ${batchAdded} new cards to database`);
                        } else {
                            console.log(`   ⚠️ No PSA 10 cards meet price criteria`);
                        }
                    } else {
                        console.log(`   ❌ No results found`);
                    }
                    
                } catch (searchError) {
                    console.log(`   ❌ Search failed: ${searchError.message}`);
                    this.blockedSearches++;
                    
                    // If we get blocked, stop immediately
                    if (searchError.message.includes('blocked') || 
                        searchError.message.includes('rate limit') ||
                        searchError.message.includes('too many requests')) {
                        console.log(`🚨 DETECTED BLOCKING - Stopping test run immediately`);
                        break;
                    }
                }
                
                // Wait 5 seconds between searches (much safer)
                if (i < searchTerms.length - 1) {
                    console.log(`   ⏳ Waiting 5 seconds before next search...`);
                    await new Promise(resolve => setTimeout(resolve, this.searchDelay));
                }
            }
            
            // Calculate multipliers for new cards
            if (totalNewItems > 0) {
                console.log('\n🧮 Calculating multipliers for new cards...');
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
            
            const stats = await this.db.getDatabaseStats();
            
            try {
                await this.db.close();
            } catch (closeError) {
                console.log(`⚠️ Error closing database connection: ${closeError.message}`);
            }
            
            console.log(`\n🎉 SAFE eBay test run completed!`);
            console.log(`📊 Results: ${totalNewItems} new cards`);
            console.log(`🔍 Searches: ${this.totalSearches} attempted, ${this.successfulSearches} successful`);
            if (this.blockedSearches > 0) {
                console.log(`🚨 BLOCKED: ${this.blockedSearches} searches (eBay detected us)`);
            }
            console.log(`\n💡 Next steps:`);
            if (this.blockedSearches === 0) {
                console.log(`   ✅ eBay tolerated us - can try more searches next time`);
            } else {
                console.log(`   ⚠️ eBay blocked us - wait 24+ hours before trying again`);
            }
            
            return {
                success: true,
                newItems: totalNewItems,
                searches: this.totalSearches,
                successful: this.successfulSearches,
                blocked: this.blockedSearches,
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

    // Helper methods for extracting card components
    extractPlayerName(title) {
        return 'Unknown';
    }

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractBrand(title) {
        if (title.toLowerCase().includes('panini')) return 'Panini';
        if (title.toLowerCase().includes('topps')) return 'Topps';
        if (title.toLowerCase().includes('upper deck')) return 'Upper Deck';
        return 'Unknown';
    }

    extractSet(title) {
        return 'Unknown';
    }

    extractCardNumber(title) {
        const numberMatch = title.match(/#(\d+)/);
        return numberMatch ? `#${numberMatch[1]}` : null;
    }

    extractPrintRun(title) {
        return null;
    }

    isRookie(title) {
        return title.toLowerCase().includes('rookie') || title.toLowerCase().includes('rc') ? 1 : 0;
    }

    isAutograph(title) {
        return title.toLowerCase().includes('auto') || title.toLowerCase().includes('autograph') ? 1 : 0;
    }
}

// Main execution
async function main() {
    const puller = new FastBatchItemsPullerEbay();
    
    try {
        await puller.pullNewItems();
    } catch (error) {
        console.error('❌ Error running safe eBay test run:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { FastBatchItemsPullerEbay, pullNewItems: async (db) => {
    const puller = new FastBatchItemsPullerEbay();
    await puller.connect();
    return await puller.pullNewItems();
}};
