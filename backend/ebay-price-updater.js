const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService.js');

class EbayPriceUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
        this.ebayService = new EbayScraperService();
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        await this.db.close();
    }

    // Get cards that need price updates (missing PSA 9 or raw prices)
    async getCardsNeedingUpdates(limit = 50) {
        const query = `
            SELECT id, title, summary_title, sport
            FROM cards 
            WHERE 
                (raw_average_price IS NULL OR psa9_average_price IS NULL)
                AND summary_title IS NOT NULL 
                AND summary_title != ''
            ORDER BY id DESC
            LIMIT ?
        `;
        return await this.db.allQuery(query, [limit]);
    }

    // Search for prices using eBay scraper with summary title
    async searchCardPrices(summaryTitle) {
        console.log(`🔍 Searching prices for: ${summaryTitle}`);
        
        const results = {
            psa10: [],
            psa9: [],
            raw: []
        };

        try {
            // Search for PSA 10 cards
            console.log(`   📊 Searching PSA 10...`);
            const psa10Result = await this.ebayService.searchSoldCards(summaryTitle, null, 20, 'PSA 10');
            console.log(`   🔍 PSA 10 Result structure:`, JSON.stringify(psa10Result, null, 2));
            
            if (psa10Result.success && Array.isArray(psa10Result.results)) {
                results.psa10 = psa10Result.results.slice(0, 10); // Take first 10
                console.log(`   ✅ Found ${results.psa10.length} PSA 10 results`);
            } else if (Array.isArray(psa10Result)) {
                // Handle case where result is directly an array
                results.psa10 = psa10Result.slice(0, 10);
                console.log(`   ✅ Found ${results.psa10.length} PSA 10 results (direct array)`);
            } else {
                console.log(`   ⚠️ PSA 10 search failed. Result type: ${typeof psa10Result}, isArray: ${Array.isArray(psa10Result)}`);
                console.log(`   🔍 Full result:`, psa10Result);
                results.psa10 = []; // Set empty array for calculation
            }

            // Search for PSA 9 cards
            console.log(`   📊 Searching PSA 9...`);
            const psa9Result = await this.ebayService.searchSoldCards(summaryTitle, null, 20, 'PSA 9');
            console.log(`   🔍 PSA 9 Result structure:`, JSON.stringify(psa9Result, null, 2));
            
            if (psa9Result.success && Array.isArray(psa9Result.results)) {
                results.psa9 = psa9Result.results.slice(0, 10); // Take first 10
                console.log(`   ✅ Found ${results.psa9.length} PSA 9 results`);
            } else if (Array.isArray(psa9Result)) {
                // Handle case where result is directly an array
                results.psa9 = psa9Result.slice(0, 10);
                console.log(`   ✅ Found ${results.psa9.length} PSA 9 results (direct array)`);
            } else {
                console.log(`   ⚠️ PSA 9 search failed. Result type: ${typeof psa9Result}, isArray: ${Array.isArray(psa9Result)}`);
                console.log(`   🔍 Full result:`, psa9Result);
                // Note: eBay scraper found cards but filtered them out - this is expected for some searches
                results.psa9 = []; // Set empty array for calculation
            }

            // Search for raw (ungraded) cards - specify 'Raw' as grade to get Graded=No
            console.log(`   📊 Searching Raw (ungraded)...`);
            const rawResult = await this.ebayService.searchSoldCards(summaryTitle, null, 20, 'Raw', false); // Raw grade, not autograph
            if (rawResult.success && Array.isArray(rawResult.results)) {
                // Filter out any graded cards from raw results
                const filteredRaw = rawResult.results.filter(card => {
                    const title = card.title.toLowerCase();
                    return !title.includes('psa') && 
                           !title.includes('bgs') && 
                           !title.includes('sgc') && 
                           !title.includes('cgc') && 
                           !title.includes('graded') && 
                           !title.includes('slab');
                });
                results.raw = filteredRaw.slice(0, 10); // Take first 10
                console.log(`   ✅ Found ${results.raw.length} raw results (filtered from ${rawResult.results.length})`);
            } else {
                console.log(`   ⚠️ Raw search failed or returned no results`);
            }

        } catch (error) {
            console.log(`   ❌ Error searching for prices: ${error.message}`);
        }

        return results;
    }

    // Calculate average price from results
    calculateAverage(results) {
        if (!Array.isArray(results) || results.length === 0) {
            console.log(`     🔍 No results array provided`);
            return null;
        }

        console.log(`     🔍 Processing ${results.length} results for average calculation`);
        
        // Debug first few items to see price structure
        results.slice(0, 3).forEach((item, index) => {
            console.log(`     🔍 Result ${index}: price="${item.price}", numericPrice="${item.numericPrice}", title="${item.title?.substring(0, 50)}..."`);
        });

        const validPrices = results
            .map(item => {
                // Handle both string prices like "$12.00" and numeric prices like "12"
                let priceValue = item.numericPrice || item.price || 0;
                
                // If it's a string, remove $ and other currency symbols
                if (typeof priceValue === 'string') {
                    priceValue = priceValue.replace(/[$,]/g, '');
                }
                
                const price = parseFloat(priceValue);
                console.log(`       💰 Processing: "${item.price}" / "${item.numericPrice}" → ${price}`);
                return price;
            })
            .filter(price => !isNaN(price) && price > 0);

        console.log(`     🔍 Valid prices found: ${validPrices.length} out of ${results.length}`);
        console.log(`     🔍 Price values: [${validPrices.slice(0, 5).join(', ')}...]`);

        if (validPrices.length === 0) {
            console.log(`     ⚠️ No valid prices found`);
            return null;
        }

        const sum = validPrices.reduce((sum, price) => sum + price, 0);
        const average = sum / validPrices.length;
        const roundedAverage = Math.round(average * 100) / 100;
        
        console.log(`     🧮 Calculation: sum=${sum}, count=${validPrices.length}, average=${average}, rounded=${roundedAverage}`);
        console.log(`     ✅ Calculated average: $${roundedAverage} from ${validPrices.length} prices`);
        
        if (isNaN(roundedAverage)) {
            console.log(`     ❌ NaN detected! Sum: ${sum}, Count: ${validPrices.length}, Raw average: ${average}`);
            return null;
        }
        
        return roundedAverage;
    }

    // Update a single card's prices
    async updateCardPrices(cardId, summaryTitle) {
        console.log(`🔄 Updating prices for card ${cardId}: ${summaryTitle}`);

        try {
            // Search for all price types
            const searchResults = await this.searchCardPrices(summaryTitle);

            // Calculate averages
            const psa10Average = this.calculateAverage(searchResults.psa10);
            const psa9Average = this.calculateAverage(searchResults.psa9);
            const rawAverage = this.calculateAverage(searchResults.raw);

            // Calculate multiplier (PSA 10 / raw)
            let multiplier = null;
            if (rawAverage && psa10Average && rawAverage > 0) {
                multiplier = Math.round((psa10Average / rawAverage) * 100) / 100;
            }

            // Update database
            const updateQuery = `
                UPDATE cards 
                SET 
                    raw_average_price = ?, 
                    psa9_average_price = ?,
                    psa10_average_price = ?,
                    multiplier = ?,
                    last_updated = datetime('now')
                WHERE id = ?
            `;

            await this.db.runQuery(updateQuery, [rawAverage, psa9Average, psa10Average, multiplier, cardId]);

            console.log(`   ✅ Updated: PSA 10 $${psa10Average || 'N/A'}, PSA 9 $${psa9Average || 'N/A'}, Raw $${rawAverage || 'N/A'}, Multiplier ${multiplier || 'N/A'}x`);

            return {
                psa10Average,
                psa9Average,
                rawAverage,
                multiplier,
                psa10Count: searchResults.psa10.length,
                psa9Count: searchResults.psa9.length,
                rawCount: searchResults.raw.length
            };

        } catch (error) {
            console.log(`   ❌ Error updating card ${cardId}: ${error.message}`);
            return null;
        }
    }

    // Test with a single card using simplified search terms
    async testSingleCard(cardId) {
        console.log(`🧪 Testing single card ${cardId}...`);
        
        try {
            await this.connect();
            
            // Get the specific card
            const query = `SELECT id, title, summary_title, sport FROM cards WHERE id = ?`;
            const card = await this.db.getQuery(query, [cardId]);
            
            if (!card) {
                console.log(`❌ Card ${cardId} not found`);
                await this.close();
                return null;
            }
            
            console.log(`🎯 Testing card: ${card.title}`);
            console.log(`📋 Summary title: ${card.summary_title}`);
            
            // Try both full summary title and simplified version
            const fullSummary = card.summary_title;
            const simplified = this.simplifySearchTerm(fullSummary);
            
            console.log(`🔍 Testing full summary: "${fullSummary}"`);
            console.log(`🔍 Testing simplified: "${simplified}"`);
            
            // Test full summary
            const fullResults = await this.searchCardPrices(fullSummary);
            
            // Test simplified
            const simplifiedResults = await this.searchCardPrices(simplified);
            
            await this.close();
            
            return {
                card: {
                    id: card.id,
                    title: card.title,
                    summaryTitle: card.summary_title,
                    sport: card.sport
                },
                fullSummaryResults: {
                    psa10Count: fullResults.psa10.length,
                    psa9Count: fullResults.psa9.length,
                    rawCount: fullResults.raw.length
                },
                simplifiedResults: {
                    psa10Count: simplifiedResults.psa10.length,
                    psa9Count: simplifiedResults.psa9.length,
                    rawCount: simplifiedResults.raw.length
                }
            };
            
        } catch (error) {
            console.log(`❌ Error testing card ${cardId}: ${error.message}`);
            await this.close();
            throw error;
        }
    }
    
    // Simplify search terms for better eBay matching
    simplifySearchTerm(summaryTitle) {
        // Remove specific card codes and simplify
        return summaryTitle
            .replace(/\b[A-Z]{1,3}-?\d+\b/g, '') // Remove codes like UV-4, C79
            .replace(/\b\d{4}\s+/g, '2024 ')      // Ensure year is present
            .replace(/\s+/g, ' ')                 // Clean up spaces
            .trim();
    }

    // Update multiple cards (batch processing)
    async updateBatch(limit = 50) {
        console.log(`🚀 Starting eBay price update batch (limit: ${limit})`);
        
        try {
            await this.connect();

            const cardsToUpdate = await this.getCardsNeedingUpdates(limit);
            
            if (cardsToUpdate.length === 0) {
                console.log(`✅ No cards need price updates`);
                await this.close();
                return { updated: 0, total: 0 };
            }

            console.log(`📊 Found ${cardsToUpdate.length} cards needing price updates`);

            let updatedCount = 0;

            for (const card of cardsToUpdate) {
                const result = await this.updateCardPrices(card.id, card.summary_title);
                
                if (result) {
                    updatedCount++;
                }

                // Rate limiting - wait 3 seconds between cards
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            await this.close();

            console.log(`🎉 Price update batch completed: ${updatedCount}/${cardsToUpdate.length} cards updated`);

            return {
                updated: updatedCount,
                total: cardsToUpdate.length
            };

        } catch (error) {
            console.log(`❌ Error in batch update: ${error.message}`);
            await this.close();
            throw error;
        }
    }
}

module.exports = EbayPriceUpdater;

// If run directly, execute batch update
if (require.main === module) {
    (async () => {
        const updater = new EbayPriceUpdater();
        try {
            await updater.updateBatch(1); // Update 1 card for testing
        } catch (error) {
            console.error('Error running price updater:', error);
        }
    })();
}
