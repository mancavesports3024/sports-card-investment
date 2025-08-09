require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { search130point } = require('./services/130pointService');
const { 
    ultimateMultiSportFilter, 
    detectSport, 
    getSportExclusions, 
    isBaseParallel, 
    getPSAGrade 
} = require('./ultimate-multi-sport-filtering-system');

class FastSQLitePriceUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async getCardsNeedingUpdates(limit = 50) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summaryTitle, sport, filterInfo, 
                       rawAveragePrice, psa9AveragePrice, lastUpdated
                FROM cards 
                WHERE 
                    -- Missing both prices
                    (rawAveragePrice IS NULL AND psa9AveragePrice IS NULL) OR
                    -- Missing raw price but has PSA 9
                    (rawAveragePrice IS NULL AND psa9AveragePrice IS NOT NULL) OR
                    -- Missing PSA 9 price but has raw
                    (rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NULL) OR
                    -- Old data (older than 7 days)
                    (lastUpdated IS NULL OR datetime(lastUpdated) < datetime('now', '-7 days'))
                ORDER BY
                    -- Priority: no prices first, then missing prices, then old data
                    CASE 
                        WHEN rawAveragePrice IS NULL AND psa9AveragePrice IS NULL THEN 1
                        WHEN rawAveragePrice IS NULL OR psa9AveragePrice IS NULL THEN 2
                        ELSE 3
                    END,
                    CASE WHEN lastUpdated IS NULL THEN 1 ELSE 0 END,
                    lastUpdated ASC
                LIMIT ?
            `;
            
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    extractCardIdentifier(card) {
        let summaryTitle = card.summaryTitle || card.title || '';
        if (typeof summaryTitle === 'object') {
            if (summaryTitle.title) {
                summaryTitle = summaryTitle.title;
            } else if (summaryTitle.summaryTitle) {
                summaryTitle = summaryTitle.summaryTitle;
            } else {
                summaryTitle = card.title || '';
            }
        }
        summaryTitle = String(summaryTitle || '').trim();

        // Create smart search strategies (similar to sqlite-price-updater.js)
        let genericTitle = summaryTitle;
        genericTitle = genericTitle
            .replace(/\s+\d+\/\d+\s*$/g, '')
            .replace(/\s+\d+\/\d+\s+/g, ' ')
            .replace(/\s+Cert\s*$/gi, '')
            .replace(/\s+#\w+\s*$/g, '')
            .replace(/\s+Engine\s+\d+\/\d+/gi, '')
            .replace(/\s+Gold\s+Engine/gi, ' Gold')
            .replace(/\s+\d+\/\d+\s*$/g, '')
            .replace(/\s+-\s*$/g, '')
            .replace(/\s+\d+\s*$/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const strategies = [];
        if (genericTitle && genericTitle !== summaryTitle) {
            strategies.push(genericTitle);
        }
        
        // Try to extract player name + year
        const playerYearMatch = summaryTitle.match(/(\d{4})\s+.*?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        if (playerYearMatch) {
            const year = playerYearMatch[1];
            const possiblePlayer = playerYearMatch[2];
            if (possiblePlayer.length > 3) {
                strategies.push(`${year} ${possiblePlayer}`);
            }
        }
        
        if (strategies.length === 0) {
            strategies.push(summaryTitle);
        }

        return {
            identifier: summaryTitle,
            strategies: strategies.slice(0, 2)
        };
    }

    async searchCardPrices(card) {
        const { identifier, strategies } = this.extractCardIdentifier(card);
        
        try {
            let rawResults = [];
            let psa9Results = [];
            
            // Try each strategy until we get good results
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                console.log(`🔍 Strategy ${i + 1}: "${strategy}"`);
                
                // Search for raw cards
                const rawQuery = strategy;
                const tempRawResults = await search130point(rawQuery, 20);
                const filteredRaw = tempRawResults.filter(card => ultimateMultiSportFilter(card, 'raw'));
                
                // Search for PSA 9 cards
                const psa9Query = `${strategy} PSA 9`;
                const tempPsa9Results = await search130point(psa9Query, 20);
                const filteredPsa9 = tempPsa9Results.filter(card => ultimateMultiSportFilter(card, 'psa9'));
                
                console.log(`   ✅ Found ${filteredRaw.length} raw, ${filteredPsa9.length} PSA 9`);
                
                if (filteredRaw.length > 0 || filteredPsa9.length > 0) {
                    rawResults = filteredRaw;
                    psa9Results = filteredPsa9;
                    break; // Use first strategy that gets results
                }
            }
            
            // Calculate averages
            const rawAvg = rawResults.length > 0 ? 
                rawResults.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / rawResults.length : 0;
            const psa9Avg = psa9Results.length > 0 ? 
                psa9Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa9Results.length : 0;

            return {
                raw: { avgPrice: rawAvg, count: rawResults.length, sales: rawResults },
                psa9: { avgPrice: psa9Avg, count: psa9Results.length, sales: psa9Results },
                source: '130point_fast'
            };
            
        } catch (error) {
            console.error(`❌ Error searching for ${identifier}:`, error.message);
            return null;
        }
    }

    async updateCardPrices(cardId, priceData) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cards 
                SET rawAveragePrice = ?, 
                    psa9AveragePrice = ?, 
                    lastUpdated = datetime('now')
                WHERE id = ?
            `;
            
            const rawPrice = priceData.raw.avgPrice > 0 ? priceData.raw.avgPrice : null;
            const psa9Price = priceData.psa9.avgPrice > 0 ? priceData.psa9.avgPrice : null;
            
            this.db.run(query, [rawPrice, psa9Price, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async processBatchFast(batchSize = 50) {
        console.log('🚀 Fast SQLite Price Updater - Parallel Processing');
        console.log('=================================================\n');
        
        try {
            await this.connect();
            
            const cards = await this.getCardsNeedingUpdates(batchSize);
            console.log(`📊 Found ${cards.length} cards needing price updates`);
            
            if (cards.length === 0) {
                console.log('🎉 All cards have recent price data!');
                return;
            }
            
            let processed = 0;
            let updated = 0;
            let errors = 0;
            
            // Process cards in smaller parallel batches for speed
            const PARALLEL_BATCH_SIZE = 10; // Process 10 cards simultaneously
            
            for (let i = 0; i < cards.length; i += PARALLEL_BATCH_SIZE) {
                const batch = cards.slice(i, i + PARALLEL_BATCH_SIZE);
                console.log(`\n📦 Processing batch ${Math.floor(i/PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(cards.length/PARALLEL_BATCH_SIZE)} (${batch.length} cards)...`);
                
                // Process batch in parallel
                const batchPromises = batch.map(async (card, batchIndex) => {
                    try {
                        console.log(`🔄 [${i + batchIndex + 1}/${cards.length}] ${card.summaryTitle || card.title}`);
                        
                        const priceData = await this.searchCardPrices(card);
                        
                        if (priceData && (priceData.raw.avgPrice > 0 || priceData.psa9.avgPrice > 0)) {
                            await this.updateCardPrices(card.id, priceData);
                            
                            console.log(`   📈 Results:`);
                            if (priceData.raw.avgPrice > 0) {
                                console.log(`      💰 Raw: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count} cards)`);
                            }
                            if (priceData.psa9.avgPrice > 0) {
                                console.log(`      💰 PSA 9: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count} cards)`);
                            }
                            console.log(`      ✅ Updated database for card ${card.id}`);
                            
                            return { success: true };
                        } else {
                            console.log(`      ⚠️ No valid prices found - skipping database update`);
                            return { success: false };
                        }
                        
                    } catch (error) {
                        console.error(`❌ Error processing card ${card.id}:`, error.message);
                        return { error: true };
                    }
                });
                
                // Wait for batch to complete
                const batchResults = await Promise.all(batchPromises);
                
                // Count results
                batchResults.forEach(result => {
                    processed++;
                    if (result.success) {
                        updated++;
                    } else if (result.error) {
                        errors++;
                    }
                });
                
                console.log(`📈 Batch complete: ${updated}/${processed} updated, ${errors} errors`);
                
                // Rate limiting between batches
                if (i + PARALLEL_BATCH_SIZE < cards.length) {
                    const delay = 2000 + Math.random() * 1000; // 2-3 seconds between batches
                    console.log(`⏳ Rate limiting: waiting ${Math.round(delay)}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            console.log('\n🎉 FAST SQLITE PRICE UPDATE COMPLETE!');
            console.log('=====================================');
            console.log(`📊 Cards processed: ${processed}`);
            console.log(`✅ Successfully updated: ${updated}`);
            console.log(`❌ Errors: ${errors}`);
            console.log(`📈 Success rate: ${((updated/processed)*100).toFixed(1)}%`);
            
        } catch (error) {
            console.error('❌ Error during fast batch processing:', error);
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async getDatabaseStats() {
        try {
            const queries = [
                'SELECT COUNT(*) as count FROM cards',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NOT NULL',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL'
            ];
            
            return new Promise((resolve, reject) => {
                Promise.all(queries.map(query => {
                    return new Promise((resolve, reject) => {
                        this.db.get(query, (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                })).then(([total, withPrices, missingPrices]) => {
                    resolve({ total, withPrices, missingPrices });
                }).catch(reject);
            });
        } catch (err) {
            console.error('❌ Error getting database stats:', err);
            throw err;
        }
    }
}

// Command line execution
if (require.main === module) {
    const batchSize = process.argv[2] ? parseInt(process.argv[2]) : 50;
    console.log(`🚀 Starting Fast SQLite Price Updater with ${batchSize} cards...`);
    
    const updater = new FastSQLitePriceUpdater();
    updater.processBatchFast(batchSize).catch(console.error);
}

module.exports = FastSQLitePriceUpdater;
