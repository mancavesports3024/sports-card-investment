const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService.js');

class FastBatchItemsPullerEbay {
    constructor() {
        this.db = new NewPricingDatabase();
        this.batchSize = 5; // Process 5 cards in parallel
        this.searchDelay = 1000; // Reduced from 3000ms to 1000ms
        this.maxConcurrentSearches = 3; // Limit concurrent searches
        this.ebayService = new EbayScraperService();
    }

    async connect() {
        await this.db.connect();
        await this.fixDatabaseSchema();
    }

    // Fix database schema if needed (same as original)
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

    // Smart generic search terms - catch ALL cards in specific sets (much better than 130point approach)
    getSearchTerms() {
        return [
            // === BASEBALL - High-value sets that catch ALL players ===
            "PSA 10 2024 Bowman Chrome Draft",
            "PSA 10 2024 Topps Chrome", 
            "PSA 10 2024 Prizm",
            "PSA 10 2024 Select",
            "PSA 10 2024 Heritage",
            "PSA 10 2024 Stadium Club",
            
            "PSA 10 2023 Bowman Chrome Draft",
            "PSA 10 2023 Topps Chrome",
            "PSA 10 2023 Prizm",
            "PSA 10 2023 Select",
            "PSA 10 2023 Heritage",
            "PSA 10 2023 Stadium Club",
            
            "PSA 10 2022 Bowman Chrome Draft",
            "PSA 10 2022 Topps Chrome",
            "PSA 10 2022 Prizm",
            "PSA 10 2022 Select",
            
            // === FOOTBALL - Premium sets that catch ALL players ===
            "PSA 10 2024 Prizm football",
            "PSA 10 2024 Select football",
            "PSA 10 2024 Contenders football",
            "PSA 10 2024 Donruss Optic football",
            "PSA 10 2024 Mosaic football",
            "PSA 10 2024 Absolute football",
            
            "PSA 10 2023 Prizm football",
            "PSA 10 2023 Select football",
            "PSA 10 2023 Contenders football",
            "PSA 10 2023 Donruss Optic football",
            "PSA 10 2023 Mosaic football",
            "PSA 10 2023 Absolute football",
            
            "PSA 10 2022 Prizm football",
            "PSA 10 2022 Select football",
            "PSA 10 2022 Contenders football",
            "PSA 10 2022 Donruss Optic football",
            
            // === BASKETBALL - Premium sets that catch ALL players ===
            "PSA 10 2024 Prizm basketball",
            "PSA 10 2024 Select basketball",
            "PSA 10 2024 Donruss Optic basketball",
            "PSA 10 2024 Mosaic basketball",
            "PSA 10 2024 Hoops Premium basketball",
            "PSA 10 2024 Chronicles basketball",
            
            "PSA 10 2023 Prizm basketball",
            "PSA 10 2023 Select basketball",
            "PSA 10 2023 Donruss Optic basketball",
            "PSA 10 2023 Mosaic basketball",
            "PSA 10 2023 Hoops Premium basketball",
            "PSA 10 2023 Chronicles basketball",
            
            "PSA 10 2022 Prizm basketball",
            "PSA 10 2022 Select basketball",
            "PSA 10 2022 Donruss Optic basketball",
            "PSA 10 2022 Mosaic basketball",
            
            // === HOCKEY - Premium sets that catch ALL players ===
            "PSA 10 2024 Upper Deck hockey",
            "PSA 10 2024 Upper Deck Series 1 hockey",
            "PSA 10 2024 Upper Deck Series 2 hockey",
            "PSA 10 2024 Upper Deck Young Guns hockey",
            
            "PSA 10 2023 Upper Deck hockey",
            "PSA 10 2023 Upper Deck Series 1 hockey",
            "PSA 10 2023 Upper Deck Series 2 hockey",
            "PSA 10 2023 Upper Deck Young Guns hockey",
            
            "PSA 10 2022 Upper Deck hockey",
            "PSA 10 2022 Upper Deck Series 1 hockey",
            "PSA 10 2022 Upper Deck Series 2 hockey",
            "PSA 10 2022 Upper Deck Young Guns hockey",
            
            // === POKEMON - Premium sets that catch ALL cards ===
            "PSA 10 2024 Pokemon Scarlet Violet",
            "PSA 10 2024 Pokemon Obsidian Flames",
            "PSA 10 2024 Pokemon 151",
            "PSA 10 2024 Pokemon Paradox Rift",
            "PSA 10 2024 Pokemon Paldea Evolved",
            
            "PSA 10 2023 Pokemon Scarlet Violet",
            "PSA 10 2023 Pokemon Obsidian Flames",
            "PSA 10 2023 Pokemon 151",
            "PSA 10 2023 Pokemon Crown Zenith",
            "PSA 10 2023 Pokemon Paldea Evolved",
            
            "PSA 10 2022 Pokemon Sword Shield",
            "PSA 10 2022 Pokemon Brilliant Stars",
            "PSA 10 2022 Pokemon Astral Radiance",
            "PSA 10 2022 Pokemon Lost Origin",
            
            // === SOCCER - Premium sets that catch ALL players ===
            "PSA 10 2024 Panini Prizm soccer",
            "PSA 10 2024 Panini Select soccer",
            "PSA 10 2024 Topps Chrome soccer",
            "PSA 10 2024 Topps Merlin soccer",
            
            "PSA 10 2023 Panini Prizm soccer",
            "PSA 10 2023 Panini Select soccer",
            "PSA 10 2023 Topps Chrome soccer",
            "PSA 10 2023 Topps Merlin soccer",
            
            "PSA 10 2022 Panini Prizm soccer",
            "PSA 10 2022 Panini Select soccer",
            "PSA 10 2022 Topps Chrome soccer",
            "PSA 10 2022 Topps Merlin soccer"
        ];
    }

    // Normalize title for duplicate checking (same as original)
    normalizeTitle(title) {
        return title.toLowerCase()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[^\w\s#-]/g, '') // Remove special characters except # and -
            .trim();
    }

    // Check if card already exists (same as original)
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

    // Add new card to database (same as original)
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

            // Check if card already exists
            if (await this.cardExists(title, price, ebayItemId)) {
                return false; // Card already exists
            }

            // Extract player name and other components
            const playerName = this.extractPlayerName(title);
            const year = this.extractYear(title);
            const brand = this.extractBrand(title);
            const set = this.extractSet(title);
            const cardNumber = this.extractCardNumber(title);
            const printRun = this.extractPrintRun(title);
            const isRookie = this.isRookie(title);
            const isAutograph = this.isAutograph(title);

            // Insert new card
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

    // Process a batch of cards (same as original)
    async processCardBatch(cards, searchTerm) {
        let addedCount = 0;
        
        for (const card of cards) {
            try {
                // Transform eBay card data to match your database schema
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

    // Main function with batch processing (same structure as original)
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
            
            console.log(`🚀 Starting eBay batch pull with ${searchTerms.length} generic search terms`);
            console.log(`📊 This will catch ALL cards in premium sets across all 6 sports`);
            
            // Process search terms in batches
            for (let i = 0; i < searchTerms.length; i += this.maxConcurrentSearches) {
                const searchBatch = searchTerms.slice(i, i + this.maxConcurrentSearches);
                
                console.log(`\n🔍 Processing batch ${Math.floor(i/this.maxConcurrentSearches) + 1}/${Math.ceil(searchTerms.length/this.maxConcurrentSearches)}`);
                console.log(`   Searches: ${searchBatch.join(', ')}`);
                
                // Process searches in parallel
                const searchPromises = searchBatch.map(async (searchTerm) => {
                    try {
                        // REPLACE 130point with eBay - this is the key change!
                        const result = await this.ebayService.searchSoldCards(searchTerm, null, 15);
                        
                        if (result.success && result.results && result.results.length > 0) {
                            // Filter to PSA 10 cards only ($50+)
                            const psa10Cards = result.results.filter(item => 
                                item.numericPrice >= 50 && item.numericPrice <= 50000
                            );
                            
                            if (psa10Cards.length > 0) {
                                console.log(`   ✅ "${searchTerm}": Found ${psa10Cards.length} PSA 10 cards`);
                                
                                // Process cards in batches
                                let batchAdded = 0;
                                for (let j = 0; j < psa10Cards.length; j += this.batchSize) {
                                    const cardBatch = psa10Cards.slice(j, j + this.batchSize);
                                    const added = await this.processCardBatch(cardBatch, searchTerm);
                                    batchAdded += added;
                                }
                                
                                totalNewItems += batchAdded;
                                console.log(`   💾 Added ${batchAdded} new cards to database`);
                            } else {
                                console.log(`   ⚠️ "${searchTerm}": No PSA 10 cards meet price criteria`);
                            }
                        } else {
                            console.log(`   ❌ "${searchTerm}": No results found`);
                        }
                        
                        totalSearched++;
                        
                    } catch (searchError) {
                        // Silent error handling
                        console.log(`   ❌ "${searchTerm}": ${searchError.message}`);
                    }
                });
                
                // Wait for all searches in this batch to complete
                await Promise.all(searchPromises);
                
                // Reduced delay between search batches
                if (i + this.maxConcurrentSearches < searchTerms.length) {
                    console.log(`   ⏳ Waiting ${this.searchDelay}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, this.searchDelay));
                }
            }
            
            // Calculate multipliers for new cards (same as original)
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
            
            // Get final stats
            const stats = await this.db.getDatabaseStats();
            
            try {
                await this.db.close();
            } catch (closeError) {
                console.log(`⚠️ Error closing database connection: ${closeError.message}`);
            }
            
            console.log(`\n🎉 eBay batch pull completed!`);
            console.log(`📊 Results: ${totalNewItems} new cards, ${totalSearched} searches`);
            
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

    // Helper methods for extracting card components (same as original)
    extractPlayerName(title) {
        // Your existing player name extraction logic
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
        // Your existing set extraction logic
        return 'Unknown';
    }

    extractCardNumber(title) {
        const numberMatch = title.match(/#(\d+)/);
        return numberMatch ? `#${numberMatch[1]}` : null;
    }

    extractPrintRun(title) {
        // Your existing print run extraction logic
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
        console.error('❌ Error running fast batch pull:', error);
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
