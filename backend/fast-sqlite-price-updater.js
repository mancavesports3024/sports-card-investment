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
        // Use the Railway database path (same as other scripts)
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
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
                SELECT id, title, summary_title as summaryTitle, sport, notes as filterInfo, 
                       raw_average_price as rawAveragePrice, psa9_average_price as psa9AveragePrice, psa10_price as psa10Price, last_updated as lastUpdated
                FROM cards 
                WHERE 
                    -- Missing all prices
                    (raw_average_price IS NULL AND psa9_average_price IS NULL AND psa10_price IS NULL) OR
                    -- Missing any combination of prices
                    (raw_average_price IS NULL AND psa9_average_price IS NOT NULL AND psa10_price IS NOT NULL) OR
                    (raw_average_price IS NOT NULL AND psa9_average_price IS NULL AND psa10_price IS NOT NULL) OR
                    (raw_average_price IS NOT NULL AND psa9_average_price IS NOT NULL AND psa10_price IS NULL) OR
                    (raw_average_price IS NULL AND psa9_average_price IS NULL AND psa10_price IS NOT NULL) OR
                    (raw_average_price IS NULL AND psa9_average_price IS NOT NULL AND psa10_price IS NULL) OR
                    (raw_average_price IS NOT NULL AND psa9_average_price IS NULL AND psa10_price IS NULL) OR
                    -- Old data (older than 7 days)
                    (last_updated IS NULL OR datetime(last_updated) < datetime('now', '-7 days'))
                ORDER BY
                    -- Priority: no prices first, then missing prices, then old data
                    CASE 
                        WHEN raw_average_price IS NULL AND psa9_average_price IS NULL AND psa10_price IS NULL THEN 1
                        WHEN raw_average_price IS NULL OR psa9_average_price IS NULL OR psa10_price IS NULL THEN 2
                        ELSE 3
                    END,
                    CASE WHEN last_updated IS NULL THEN 1 ELSE 0 END,
                    last_updated ASC
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

        // Create smart search strategies that work with 130point.com
        const strategies = [];
        
        // Strategy 1: Use the full summary title (most specific) - this is what works!
        strategies.push(summaryTitle);
        
        // Strategy 2: Remove only card numbers and print runs, but keep player names
        let playerPreservedTitle = summaryTitle
            .replace(/\s+#[A-Z0-9-]+\s*$/g, '')  // Remove card numbers like #TP-18
            .replace(/\s+\d+\/\d+\s*$/g, '')     // Remove print runs like /99
            .replace(/\s+Cert\s*$/gi, '')        // Remove Cert
            .replace(/\s+Engine\s+\d+\/\d+/gi, '') // Remove Engine
            .replace(/\s+Gold\s+Engine/gi, ' Gold') // Fix Gold Engine
            .replace(/\s+-\s*$/g, '')            // Remove trailing dash
            .replace(/\s+/g, ' ')                // Normalize spaces
            .trim();
            
        if (playerPreservedTitle && playerPreservedTitle !== summaryTitle) {
            strategies.push(playerPreservedTitle);
        }
        
        // Strategy 3: Create a simple search with just year + player name
        // For "2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18"
        // Create "2024 Leo DE VRIES" (just the basic info that works)
        const yearPlayerMatch = summaryTitle.match(/^(\d{4})\s+([A-Z][a-z]+(?:\s+[A-Z]+)*?)(?=\s+[A-Z][a-z]|$)/);
        if (yearPlayerMatch) {
            const year = yearPlayerMatch[1];
            const player = yearPlayerMatch[2];
            const simpleSearch = `${year} ${player}`;
            
            if (simpleSearch !== summaryTitle && simpleSearch.length > 5) {
                strategies.push(simpleSearch);
            }
        }

        return {
            identifier: summaryTitle,
            strategies: strategies.slice(0, 3)
        };
    }

    async searchCardPrices(card) {
        const { identifier, strategies } = this.extractCardIdentifier(card);
        
        try {
            let rawResults = [];
            let psa9Results = [];
            let psa10Results = [];
            
            // Try each strategy until we get good results
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                
                // Search for raw cards
                const rawQuery = strategy;
                const tempRawResults = await search130point(rawQuery, 20);
                const filteredRaw = tempRawResults.filter(card => ultimateMultiSportFilter(card, 'raw'));
                
                // Search for PSA 9 cards
                const psa9Query = `${strategy} PSA 9`;
                const tempPsa9Results = await search130point(psa9Query, 20);
                const filteredPsa9 = tempPsa9Results.filter(card => ultimateMultiSportFilter(card, 'psa9'));
                
                // Search for PSA 10 cards
                const psa10Query = `${strategy} PSA 10`;
                const tempPsa10Results = await search130point(psa10Query, 20);
                const filteredPsa10 = tempPsa10Results.filter(card => ultimateMultiSportFilter(card, 'psa10'));
                
                console.log(`🔍 "${strategy}" → Found ${filteredRaw.length} raw, ${filteredPsa9.length} PSA 9, ${filteredPsa10.length} PSA 10`);
                
                if (filteredRaw.length > 0 || filteredPsa9.length > 0 || filteredPsa10.length > 0) {
                    rawResults = filteredRaw;
                    psa9Results = filteredPsa9;
                    psa10Results = filteredPsa10;
                    break; // Use first strategy that gets results
                }
            }
            
            // Calculate averages
            const rawAvg = rawResults.length > 0 ? 
                rawResults.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / rawResults.length : 0;
            const psa9Avg = psa9Results.length > 0 ? 
                psa9Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa9Results.length : 0;
            const psa10Avg = psa10Results.length > 0 ? 
                psa10Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa10Results.length : 0;

            return {
                raw: { avgPrice: rawAvg, count: rawResults.length, sales: rawResults },
                psa9: { avgPrice: psa9Avg, count: psa9Results.length, sales: psa9Results },
                psa10: { avgPrice: psa10Avg, count: psa10Results.length, sales: psa10Results },
                source: '130point_fast'
            };
            
        } catch (error) {
            console.error(`❌ Error searching for ${identifier}:`, error.message);
            return null;
        }
    }

    async updateCardPrices(cardId, priceData) {
        return new Promise((resolve, reject) => {
            const rawPrice = priceData.raw.avgPrice > 0 ? priceData.raw.avgPrice : null;
            const psa9Price = priceData.psa9.avgPrice > 0 ? priceData.psa9.avgPrice : null;
            const psa10Price = priceData.psa10.avgPrice > 0 ? priceData.psa10.avgPrice : null;
            
            // Calculate multiplier if we have both raw and PSA 10 prices
            let multiplier = null;
            if (rawPrice && psa10Price && rawPrice > 0) {
                multiplier = (psa10Price / rawPrice).toFixed(2);
            }
            
            const query = `
                UPDATE cards 
                SET raw_average_price = ?, 
                    psa9_average_price = ?, 
                    psa10_price = ?, 
                    multiplier = ?,
                    last_updated = datetime('now')
                WHERE id = ?
            `;
            
            this.db.run(query, [rawPrice, psa9Price, psa10Price, multiplier, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Backward compatibility method
    async processBatch(batchSize = 50) {
        console.log('🔄 Using processBatch (calling processBatchFast for backward compatibility)');
        return this.processBatchFast(batchSize);
    }

    async processBatchFast(batchSize = 50) {
        console.log('🚀 Fast SQLite Price Updater');
        
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
             let removed = 0;
             let errors = 0;
            
            // Process cards in smaller parallel batches for speed
            const PARALLEL_BATCH_SIZE = 10; // Process 10 cards simultaneously
            
            for (let i = 0; i < cards.length; i += PARALLEL_BATCH_SIZE) {
                const batch = cards.slice(i, i + PARALLEL_BATCH_SIZE);
                console.log(`\n📦 Batch ${Math.floor(i/PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(cards.length/PARALLEL_BATCH_SIZE)} (${batch.length} cards)`);
                
                // Process batch in parallel
                const batchPromises = batch.map(async (card, batchIndex) => {
                    try {
                        const priceData = await this.searchCardPrices(card);
                        
                                                 if (priceData && (priceData.raw.avgPrice > 0 || priceData.psa9.avgPrice > 0 || priceData.psa10.avgPrice > 0)) {
                             // Check if PSA 10 price is below $40 - if so, remove the card
                             if (priceData.psa10.avgPrice > 0 && priceData.psa10.avgPrice < 40) {
                                 console.log(`🗑️ ${card.summaryTitle || card.title} → PSA 10: $${priceData.psa10.avgPrice.toFixed(2)} (below $40) - REMOVING`);
                                 await this.removeCard(card.id);
                                 return { removed: true };
                             }
                             
                             await this.updateCardPrices(card.id, priceData);
                             
                             // Show search results and price updates
                             let priceInfo = '';
                             if (priceData.raw.avgPrice > 0) {
                                 priceInfo += `Raw: $${priceData.raw.avgPrice.toFixed(2)} (${priceData.raw.count})`;
                             }
                             if (priceData.psa9.avgPrice > 0) {
                                 if (priceInfo) priceInfo += ', ';
                                 priceInfo += `PSA 9: $${priceData.psa9.avgPrice.toFixed(2)} (${priceData.psa9.count})`;
                             }
                             if (priceData.psa10.avgPrice > 0) {
                                 if (priceInfo) priceInfo += ', ';
                                 priceInfo += `PSA 10: $${priceData.psa10.avgPrice.toFixed(2)} (${priceData.psa10.count})`;
                             }
                             
                             // Add multiplier info if calculated
                             if (priceData.raw.avgPrice > 0 && priceData.psa10.avgPrice > 0) {
                                 const multiplier = (priceData.psa10.avgPrice / priceData.raw.avgPrice).toFixed(2);
                                 priceInfo += `, Multiplier: ${multiplier}x`;
                             }
                             
                             console.log(`✅ ${card.summaryTitle || card.title} → ${priceInfo}`);
                             
                             return { success: true };
                         } else {
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
                     } else if (result.removed) {
                         removed++;
                     } else if (result.error) {
                         errors++;
                     }
                 });
                 
                 console.log(`📈 Batch complete: ${updated}/${processed} updated, ${removed} removed, ${errors} errors`);
                
                // Rate limiting between batches
                if (i + PARALLEL_BATCH_SIZE < cards.length) {
                    const delay = 2000 + Math.random() * 1000; // 2-3 seconds between batches
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
                         console.log('\n🎉 FAST SQLITE PRICE UPDATE COMPLETE!');
             console.log('=====================================');
             console.log(`📊 Cards processed: ${processed}`);
             console.log(`✅ Successfully updated: ${updated}`);
             console.log(`🗑️ Cards removed (PSA 10 < $40): ${removed}`);
             console.log(`❌ Errors: ${errors}`);
             console.log(`📈 Success rate: ${((updated/processed)*100).toFixed(1)}%`);
            
                         // Clean up low-value cards
             console.log('\n🧹 Cleaning up low-value cards...');
             await this.cleanupLowValueCards();
             
             // Recalculate multipliers for all cards that need it
             console.log('\n🧮 Recalculating multipliers...');
             await this.recalculateAllMultipliers();
            
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
                'SELECT COUNT(*) as count FROM cards WHERE raw_average_price IS NOT NULL AND psa9_average_price IS NOT NULL AND psa10_price IS NOT NULL',
                'SELECT COUNT(*) as count FROM cards WHERE raw_average_price IS NULL OR psa9_average_price IS NULL OR psa10_price IS NULL',
                'SELECT COUNT(*) as count FROM cards WHERE raw_average_price IS NOT NULL AND psa10_price IS NOT NULL AND multiplier IS NULL'
            ];
            
            return new Promise((resolve, reject) => {
                Promise.all(queries.map(query => {
                    return new Promise((resolve, reject) => {
                        this.db.get(query, (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                })).then(([total, withPrices, missingPrices, missingMultipliers]) => {
                    resolve({ total, withPrices, missingPrices, missingMultipliers });
                }).catch(reject);
            });
        } catch (err) {
            console.error('❌ Error getting database stats:', err);
            throw err;
        }
    }

         async recalculateAllMultipliers() {
         console.log('🧮 Recalculating multipliers for all cards with raw and PSA 10 prices...');
         
         try {
             const cards = await this.getCardsNeedingMultiplierUpdate();
             console.log(`📊 Found ${cards.length} cards needing multiplier updates`);
             
             if (cards.length === 0) {
                 console.log('✅ All cards have up-to-date multipliers!');
                 return;
             }
             
             let updatedCount = 0;
             
             for (const card of cards) {
                 if (card.raw_average_price && card.psa10_price && card.raw_average_price > 0) {
                     const multiplier = (card.psa10_price / card.raw_average_price).toFixed(2);
                     
                     await this.runQuery(`
                         UPDATE cards 
                         SET multiplier = ? 
                         WHERE id = ?
                     `, [multiplier, card.id]);
                     
                     updatedCount++;
                     
                     if (updatedCount % 10 === 0) {
                         console.log(`✅ Updated ${updatedCount} multipliers...`);
                     }
                 }
             }
             
             console.log(`✅ Multiplier recalculation complete!`);
             console.log(`📊 Total multipliers updated: ${updatedCount}`);
             
         } catch (error) {
             console.error('❌ Error recalculating multipliers:', error);
             throw error;
         }
     }

     async cleanupLowValueCards() {
         console.log('🧹 Cleaning up cards with PSA 10 prices below $40...');
         
         try {
             const cards = await this.getLowValueCards();
             console.log(`📊 Found ${cards.length} cards with PSA 10 prices below $40`);
             
             if (cards.length === 0) {
                 console.log('✅ No low-value cards found!');
                 return;
             }
             
             let removedCount = 0;
             
             for (const card of cards) {
                 console.log(`🗑️ Removing: ${card.title} (PSA 10: $${card.psa10_price})`);
                 await this.removeCard(card.id);
                 removedCount++;
                 
                 if (removedCount % 10 === 0) {
                     console.log(`✅ Removed ${removedCount} low-value cards...`);
                 }
             }
             
             console.log(`✅ Low-value card cleanup complete!`);
             console.log(`📊 Total cards removed: ${removedCount}`);
             
         } catch (error) {
             console.error('❌ Error cleaning up low-value cards:', error);
             throw error;
         }
     }

     async getLowValueCards() {
         return new Promise((resolve, reject) => {
             this.db.all(`
                 SELECT id, title, psa10_price
                 FROM cards 
                 WHERE psa10_price IS NOT NULL 
                 AND psa10_price < 40
             `, (err, rows) => {
                 if (err) reject(err);
                 else resolve(rows);
             });
         });
     }

    async getCardsNeedingMultiplierUpdate() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, raw_average_price, psa10_price, multiplier
                FROM cards 
                WHERE raw_average_price IS NOT NULL 
                AND psa10_price IS NOT NULL
                AND (multiplier IS NULL OR multiplier = '')
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

         async removeCard(cardId) {
         return new Promise((resolve, reject) => {
             this.db.run('DELETE FROM cards WHERE id = ?', [cardId], function(err) {
                 if (err) {
                     reject(err);
                 } else {
                     resolve(this.changes);
                 }
             });
         });
     }

     async runQuery(sql, params = []) {
         return new Promise((resolve, reject) => {
             this.db.run(sql, params, function(err) {
                 if (err) reject(err);
                 else resolve(this);
             });
         });
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
