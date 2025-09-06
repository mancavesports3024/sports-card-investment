const NewPricingDatabase = require('./create-new-pricing-database.js');
const EbayScraperService = require('./services/ebayScraperService.js');

class PSA9RawPriceUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
        this.ebayService = new EbayScraperService();
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }

    // Get cards that need PSA 10, PSA 9 and Raw prices
    async getCardsNeedingPrices(limit = 50) {
        const query = `
            SELECT id, title, summary_title, player_name, sport, psa10_price, 
                   psa9_average_price, raw_average_price, created_at
            FROM cards 
            WHERE (psa10_price IS NULL OR psa10_price = 0 OR 
                   psa9_average_price IS NULL OR psa9_average_price = 0 OR 
                   raw_average_price IS NULL OR raw_average_price = 0)
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        
        return await this.db.allQuery(query, [limit]);
    }

    // Generate search term from card data
    generateSearchTerm(card) {
        // Use summary title if available, otherwise use cleaned title
        let searchTerm = card.summary_title || card.title;
        
        if (!searchTerm) return null;
        
        // Clean up the search term for eBay searching
        searchTerm = searchTerm
            .replace(/\bPSA\s*10\b/gi, '') // Remove PSA 10
            .replace(/\bGEM\s*MINT?\b/gi, '') // Remove GEM MINT
            .replace(/\bMT\b/gi, '') // Remove MT
            .replace(/\bGRADED?\b/gi, '') // Remove GRADED
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
            
        return searchTerm;
    }

    // Search for PSA 10, PSA 9 and Raw prices for a single card
    async searchCardPrices(card) {
        const searchTerm = this.generateSearchTerm(card);
        if (!searchTerm) {
            console.log(`⚠️ No search term for card ${card.id}`);
            return null;
        }

        console.log(`🔍 Searching prices for: "${searchTerm}"`);
        
        try {
            // Search for PSA 10 cards (for average)
            const psa10Results = await this.ebayService.searchSoldCards(
                searchTerm, 
                card.sport, 
                20, 
                'PSA 10'
            );
            
            // Search for PSA 9 cards
            const psa9Results = await this.ebayService.searchSoldCards(
                searchTerm, 
                card.sport, 
                20, 
                'PSA 9'
            );
            
            // Search for Raw cards
            const rawResults = await this.ebayService.searchSoldCards(
                searchTerm, 
                card.sport, 
                20, 
                'Raw'
            );
            
            // Process PSA 10 results
            let psa10Prices = [];
            if (psa10Results.success && psa10Results.results) {
                psa10Prices = psa10Results.results
                    .filter(result => {
                        const title = result.title.toLowerCase();
                        return title.includes('psa 10') && 
                               result.numericPrice >= 50 && 
                               result.numericPrice <= 5000;
                    })
                    .map(result => result.numericPrice);
            }
            
            // Process PSA 9 results
            let psa9Prices = [];
            if (psa9Results.success && psa9Results.results) {
                psa9Prices = psa9Results.results
                    .filter(result => {
                        const title = result.title.toLowerCase();
                        return title.includes('psa 9') && 
                               result.numericPrice >= 10 && 
                               result.numericPrice <= 2500;
                    })
                    .map(result => result.numericPrice);
            }
            
            // Process Raw results  
            let rawPrices = [];
            if (rawResults.success && rawResults.results) {
                rawPrices = rawResults.results
                    .filter(result => {
                        const title = result.title.toLowerCase();
                        return !title.includes('psa') && 
                               !title.includes('bgs') && 
                               !title.includes('sgc') && 
                               !title.includes('cgc') &&
                               !title.includes('graded') &&
                               result.numericPrice >= 5 && 
                               result.numericPrice <= 1000;
                    })
                    .map(result => result.numericPrice);
            }
            
            // Calculate averages
            const psa10Average = psa10Prices.length > 0 ? 
                psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : 0;
            const psa9Average = psa9Prices.length > 0 ? 
                psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : 0;
            const rawAverage = rawPrices.length > 0 ? 
                rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : 0;
            
            console.log(`   💰 PSA 10: $${psa10Average.toFixed(2)} (${psa10Prices.length} cards)`);
            console.log(`   💰 PSA 9: $${psa9Average.toFixed(2)} (${psa9Prices.length} cards)`);
            console.log(`   💰 Raw: $${rawAverage.toFixed(2)} (${rawPrices.length} cards)`);
            
            return {
                psa10Average: Math.round(psa10Average * 100) / 100,
                psa9Average: Math.round(psa9Average * 100) / 100,
                rawAverage: Math.round(rawAverage * 100) / 100,
                psa10Count: psa10Prices.length,
                psa9Count: psa9Prices.length,
                rawCount: rawPrices.length
            };
            
        } catch (error) {
            console.error(`❌ Error searching prices for "${searchTerm}": ${error.message}`);
            return null;
        }
    }

    // Update card with new prices
    async updateCardPrices(cardId, prices) {
        const query = `
            UPDATE cards 
            SET psa10_price = ?,
                psa9_average_price = ?, 
                raw_average_price = ?,
                last_updated = datetime('now')
            WHERE id = ?
        `;
        
        await this.db.runQuery(query, [
            prices.psa10Average,
            prices.psa9Average, 
            prices.rawAverage, 
            cardId
        ]);
    }

    // Calculate multiplier after prices are updated
    async updateMultiplier(cardId) {
        const query = `
            UPDATE cards 
            SET multiplier = CASE 
                WHEN raw_average_price > 0 AND psa10_price > 0 
                THEN ROUND(psa10_price / raw_average_price, 2)
                ELSE NULL 
            END
            WHERE id = ?
        `;
        
        await this.db.runQuery(query, [cardId]);
    }

    // Main function to update PSA 10, PSA 9 and Raw prices
    async updatePrices(options = {}) {
        const { limit = 50, delayMs = 2000 } = options;
        
        console.log('🚀 Starting PSA 10, PSA 9 and Raw price update...\n');
        
        try {
            await this.connect();
            
            const cards = await this.getCardsNeedingPrices(limit);
            console.log(`📊 Found ${cards.length} cards needing price updates\n`);
            
            if (cards.length === 0) {
                console.log('✅ All cards already have complete pricing data');
                return { success: true, updated: 0, errors: 0 };
            }
            
            let updated = 0;
            let errors = 0;
            
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                console.log(`\n📈 Card ${i + 1}/${cards.length}: ${card.summary_title || card.title}`);
                console.log(`   PSA 10: $${card.psa10_price}`);
                
                try {
                    const prices = await this.searchCardPrices(card);
                    
                    if (prices) {
                        await this.updateCardPrices(card.id, prices);
                        await this.updateMultiplier(card.id);
                        updated++;
                        
                        // Calculate and show multiplier if we have data
                        if (prices.rawAverage > 0 && prices.psa10Average > 0) {
                            const multiplier = (prices.psa10Average / prices.rawAverage).toFixed(2);
                            console.log(`   📊 Multiplier: ${multiplier}x`);
                        }
                        
                        console.log(`   ✅ Updated successfully`);
                    } else {
                        console.log(`   ⚠️ No price data found`);
                        errors++;
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error updating card: ${error.message}`);
                    errors++;
                }
                
                // Delay between requests to be respectful to eBay
                if (i < cards.length - 1) {
                    console.log(`   ⏳ Waiting ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            console.log(`\n🎉 Price update completed!`);
            console.log(`✅ Updated: ${updated} cards`);
            console.log(`❌ Errors: ${errors} cards`);
            
            return { success: true, updated, errors };
            
        } catch (error) {
            console.error(`❌ Fatal error in price updater: ${error.message}`);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// CLI interface for standalone execution
if (require.main === module) {
    const updater = new PSA9RawPriceUpdater();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const limit = args.includes('--limit') ? 
        parseInt(args[args.indexOf('--limit') + 1]) || 50 : 50;
    const delayMs = args.includes('--delay') ? 
        parseInt(args[args.indexOf('--delay') + 1]) || 2000 : 2000;
    
    console.log(`⚙️ Configuration:`);
    console.log(`   Limit: ${limit} cards`);
    console.log(`   Delay: ${delayMs}ms between requests\n`);
    
    updater.updatePrices({ limit, delayMs })
        .then(result => {
            console.log(`\n✅ Process completed successfully`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`\n❌ Process failed: ${error.message}`);
            process.exit(1);
        });
}

module.exports = PSA9RawPriceUpdater;
