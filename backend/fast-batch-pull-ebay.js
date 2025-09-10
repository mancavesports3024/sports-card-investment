const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService.js');
const SimplePlayerExtractor = require('./simple-player-extraction.js');
const EbayPriceUpdater = require('./ebay-price-updater.js');

class FastBatchItemsPullerEbay {
    constructor() {
        this.db = new NewPricingDatabase();
        this.batchSize = 3; // Reduced to 3 cards per batch
        this.searchDelay = 5000; // Increased to 5 seconds between searches
        this.maxConcurrentSearches = 1; // Sequential only - no parallel searches
        this.ebayService = new EbayScraperService();
        this.extractor = new SimplePlayerExtractor();
        this.priceUpdater = new EbayPriceUpdater(); // For immediate price updates
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

    // COMPREHENSIVE SPORT SEARCHES - One search per sport using eBay's built-in filters
    getSearchTerms() {
        return [
            // === 5 BRAND SEARCHES - NO GRADE FILTERS ===
            // Search for major card brands, let eBay's year/sport filters narrow results
            // Remove grade filters to get ALL grades (PSA 10, PSA 9, Raw) in one search
            
            // Major Sports Card Brands
            { searchTerm: "Topps", sport: null },        // All Topps cards across all sports/years
            { searchTerm: "Bowman", sport: null },       // All Bowman cards across all sports/years  
            { searchTerm: "Panini", sport: null },       // All Panini cards across all sports/years
            { searchTerm: "Upper Deck", sport: null },   // All Upper Deck cards across all sports/years
            
            // Pokemon TCG - Special case using category filters (not a sport)
            { searchTerm: "Pokemon", sport: null, cardType: "Pokemon TCG" }
        ];
    }

    // Extract card identity for smart deduplication
    extractCardIdentity(title) {
        // Use SimplePlayerExtractor for player name extraction
        const playerName = this.extractor.extractPlayerName(title) || '';
        
        // For now, use simple extraction for other components
        // This is a simplified version - card number normalization is key for deduplication
        let cardNumber = '';
        const cardNumberMatch = title.match(/#?([A-Z0-9\-]+)/i);
        if (cardNumberMatch) {
            cardNumber = cardNumberMatch[1];
        }
        
        // Normalize card number by removing hyphens, spaces, and # symbols
        let normalizedCardNumber = '';
        if (cardNumber) {
            normalizedCardNumber = cardNumber
                .toLowerCase()
                .replace(/[#\-\s]/g, '') // Remove #, hyphens, and spaces
                .trim();
        }
        
        // Extract year
        const yearMatch = title.match(/\b(20\d{2})\b/);
        const year = yearMatch ? yearMatch[1] : '';
        
        return {
            playerName: playerName.toLowerCase().trim(),
            cardNumber: normalizedCardNumber,
            year: year,
            cardSet: '', // Simplified for now
            cardType: '' // Simplified for now
        };
    }

    // Normalize title for duplicate checking
    normalizeTitle(title) {
        return title.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s#-]/g, '')
            .trim();
    }

    // Smart duplicate checking based on card identity
    async cardExists(title, price, ebayItemId) {
        // First check exact title match and eBay item ID
        let query = `SELECT id, title FROM cards WHERE title = ?`;
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
        
        // Smart deduplication based on card identity
        const newCardIdentity = this.extractCardIdentity(title);
        
        // Only proceed with smart dedup if we have key identifiers
        if (newCardIdentity.playerName && newCardIdentity.cardNumber && newCardIdentity.year) {
            const allCards = await this.db.allQuery(`
                SELECT id, title, player_name, card_number, year, card_set, card_type 
                FROM cards 
                WHERE year = ? AND player_name IS NOT NULL AND card_number IS NOT NULL
            `, [newCardIdentity.year]);
            
            for (const card of allCards) {
                const existingIdentity = {
                    playerName: card.player_name?.toLowerCase().trim() || '',
                    cardNumber: card.card_number?.toLowerCase().trim() || '',
                    year: card.year || '',
                    cardSet: card.card_set?.toLowerCase().trim() || '',
                    cardType: card.card_type?.toLowerCase().trim() || ''
                };
                
                // Check if this is the same card (same player, number, year)
                if (existingIdentity.playerName === newCardIdentity.playerName &&
                    existingIdentity.cardNumber === newCardIdentity.cardNumber &&
                    existingIdentity.year === newCardIdentity.year) {
                    
                    console.log(`🔄 Found smart duplicate:`);
                    console.log(`   Existing: "${card.title}"`);
                    console.log(`   New: "${title}"`);
                    console.log(`   Identity: ${newCardIdentity.playerName} | ${newCardIdentity.cardNumber} | ${newCardIdentity.year}`);
                    return true;
                }
            }
        }
        
        // Fallback to normalized title checking for cards without clear identity
        const normalizedTitle = this.normalizeTitle(title);
        const allTitles = await this.db.allQuery(`SELECT id, title FROM cards`);
        
        for (const card of allTitles) {
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
            const extractedCardType = this.extractCardType(title);

            // Generate summary title from extracted components
            const summaryTitle = this.generateSummaryTitle({
                year, brand, set, extractedCardType, playerName, 
                cardNumber, printRun, isRookie, isAutograph
            });

            const query = `
                INSERT INTO cards (
                    title, summary_title, psa10_price, condition, card_type, grade, sport,
                    image_url, ebay_item_id, search_term, source,
                    player_name, year, brand, card_set, card_number, print_run,
                    is_rookie, is_autograph, created_at, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            const params = [
                title, summaryTitle, price, condition, extractedCardType, grade, sport,
                imageUrl, ebayItemId, searchTerm, source,
                playerName, year, brand, set, cardNumber, printRun,
                isRookie, isAutograph
            ];

            // Debug logging
            console.log(`🔍 DEBUG - Adding card: "${title.substring(0, 30)}..."`);
            console.log(`🔍 DEBUG - Price: ${price}`);
            console.log(`🔍 DEBUG - Sport: ${sport}`);
            console.log(`🔍 DEBUG - Player: ${playerName}`);
            console.log(`🔍 DEBUG - Params count: ${params.length}`);
            
            await this.db.runQuery(query, params);
            console.log(`✅ Added new card: ${title.substring(0, 50)}...`);
            
            // Get the card ID of the newly inserted card
            const getCardIdQuery = `SELECT id FROM cards WHERE title = ? AND psa10_price = ? ORDER BY id DESC LIMIT 1`;
            const cardResult = await this.db.getQuery(getCardIdQuery, [title, price]);
            
            if (cardResult && summaryTitle) {
                console.log(`🔄 Starting immediate price update for: ${summaryTitle}`);
                try {
                    // Use the existing 3-search price updater with summary title
                    const priceResult = await this.priceUpdater.updateCardPrices(cardResult.id, summaryTitle);
                    
                    if (priceResult) {
                        console.log(`✅ Price update completed: PSA 10 avg $${priceResult.psa10Average?.toFixed(2) || 'N/A'}, PSA 9 avg $${priceResult.psa9Average?.toFixed(2) || 'N/A'}, Raw avg $${priceResult.rawAverage?.toFixed(2) || 'N/A'}`);
                    } else {
                        console.log(`⚠️ Price update failed for card ${cardResult.id}`);
                    }
                } catch (priceError) {
                    console.log(`⚠️ Error during price update: ${priceError.message}`);
                }
            }
            
            return true;

        } catch (error) {
            console.error(`❌ Error adding card: ${error.message}`);
            return false;
        }
    }

    // Process a batch of cards
    async processCardBatch(cards, searchTerm, sport) {
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
                    sport: sport || 'Unknown',
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
                const searchConfig = searchTerms[i];
                const searchTerm = searchConfig.searchTerm;
                const sport = searchConfig.sport;
                const cardType = searchConfig.cardType;
                
                console.log(`\n🔍 Search ${i + 1}/${searchTerms.length}: "${searchTerm}" (${sport || cardType || 'No filter'})`);
                console.log(`   ⏳ Processing...`);
                
                try {
                    // Remove grade filter to get ALL grades (PSA 10, PSA 9, Raw) in one search
                    const result = await this.ebayService.searchSoldCards(searchTerm, sport, 50, null, cardType);
                    this.totalSearches++;
                    
                    if (result.success && result.results && result.results.length > 0) {
                        // Filter for PSA 10 cards in price range, but keep all other grades for processing
                        const psa10Cards = result.results.filter(item => 
                            item.numericPrice >= 50 && item.numericPrice <= 50000
                        );
                        
                        if (psa10Cards.length > 0) {
                            console.log(`   ✅ Found ${psa10Cards.length} PSA 10 cards (${result.results.length} total cards)`);
                            
                            let batchAdded = 0;
                            for (let j = 0; j < psa10Cards.length; j += this.batchSize) {
                                const cardBatch = psa10Cards.slice(j, j + this.batchSize);
                                const added = await this.processCardBatch(cardBatch, searchTerm, sport);
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

    // Generate summary title from extracted components
    generateSummaryTitle(components) {
        const { year, brand, set, extractedCardType, playerName, cardNumber, printRun, isRookie, isAutograph } = components;
        
        let summaryTitle = '';
        
        // Start with year (matching rebuild tool format)
        if (year && year !== 'Unknown') {
            summaryTitle += year;
        }
        
        // Add card set (use the full set name, matching rebuild tool logic)
        if (set && set !== 'Unknown') {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += set;
        }
        
        // Add card type (colors, parallels, etc.) - but skip "Base"  
        if (extractedCardType && extractedCardType !== 'Unknown' && extractedCardType.toLowerCase() !== 'base') {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += extractedCardType;
        }
        
        // Add player name
        if (playerName && playerName !== 'Unknown') {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += playerName;
        }
        
        // Add "auto" if it's an autograph
        if (isAutograph) {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += 'auto';
        }
        
        // Add card number (normalize format like rebuild tool)
        if (cardNumber && cardNumber !== 'Unknown') {
            if (summaryTitle) summaryTitle += ' ';
            // Remove any leading '#' and normalize
            let cleanCardNumber = String(cardNumber).trim().replace(/^#\s*/, '');
            summaryTitle += cleanCardNumber;
        }
        
        // Add print run if available
        if (printRun && printRun !== 'Unknown') {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += printRun;
        }
        
        // Clean up extra spaces
        summaryTitle = summaryTitle.replace(/\s+/g, ' ');
        
        // Remove any trailing punctuation
        summaryTitle = summaryTitle.replace(/[.,;!?]+$/, '');
        
        return summaryTitle || null;
    }

    // Helper methods for extracting card components using centralized system
    extractPlayerName(title) {
        try {
            return this.extractor.extractPlayerName(title) || 'Unknown';
        } catch (error) {
            console.log(`⚠️ Error extracting player name from "${title}": ${error.message}`);
            return 'Unknown';
        }
    }

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractBrand(title) {
        if (title.toLowerCase().includes('panini')) return 'Panini';
        if (title.toLowerCase().includes('topps')) return 'Topps';
        if (title.toLowerCase().includes('upper deck')) return 'Upper Deck';
        if (title.toLowerCase().includes('bowman')) return 'Bowman';
        if (title.toLowerCase().includes('donruss')) return 'Donruss';
        return 'Unknown';
    }

    extractSet(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardSet(title) || 'Unknown';
        } catch (error) {
            console.log(`⚠️ Error extracting set from "${title}": ${error.message}`);
            return 'Unknown';
        }
    }

    extractCardNumber(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardNumber(title) || null;
        } catch (error) {
            const numberMatch = title.match(/#(\d+)/);
            return numberMatch ? `#${numberMatch[1]}` : null;
        }
    }

    extractPrintRun(title) {
        const printMatch = title.match(/\/(\d+)/);
        return printMatch ? `/${printMatch[1]}` : null;
    }

    isRookie(title) {
        return (title.toLowerCase().includes('rookie') ||
               title.toLowerCase().includes('rc') ||
               title.toLowerCase().includes('1st')) ? 1 : 0;
    }

    isAutograph(title) {
        return (title.toLowerCase().includes('auto') ||
               title.toLowerCase().includes('autograph') ||
               title.toLowerCase().includes('signed')) ? 1 : 0;
    }

    extractCardType(title) {
        try {
            const NewPricingDatabase = require('./create-new-pricing-database.js');
            const db = new NewPricingDatabase();
            return db.extractCardType(title) || 'Base';
        } catch (error) {
            console.log(`⚠️ Error extracting card type from "${title}": ${error.message}`);
            return 'Base';
        }
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
