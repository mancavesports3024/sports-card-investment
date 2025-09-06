require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const EbayScraperService = require('./services/ebayScraperService');
// Use the sport detection from the main database class
const NewPricingDatabase = require('./create-new-pricing-database.js');

class FastSQLitePriceUpdater {
    constructor() {
        // Use Railway volume mount path if available (production), otherwise use local path
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
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
                    (raw_average_price IS NULL AND psa9_average_price IS NULL) OR
                    -- Missing any combination of prices
                    (raw_average_price IS NULL AND psa9_average_price IS NOT NULL) OR
                    (raw_average_price IS NOT NULL AND psa9_average_price IS NULL) OR
                    -- Old data (older than 7 days)
                    (last_updated IS NULL OR datetime(last_updated) < datetime('now', '-7 days'))
                ORDER BY
                    -- Priority: no prices first, then missing prices, then old data
                    CASE 
                        WHEN raw_average_price IS NULL AND psa9_average_price IS NULL THEN 1
                        WHEN raw_average_price IS NULL OR psa9_average_price IS NULL THEN 2
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

        // Create specific search strategies for raw vs graded cards
        const strategies = [
            // Strategy 1: Base strategy (exclude grading terms, no negative keywords yet)
            summaryTitle.replace(/\b(PSA|BGS|SGC|CGC)\s*\d+/gi, '').replace(/\b(GEM|MINT|MT|NM|VG|G)\b/gi, '').trim(),
            // Strategy 2: Original summary title (fallback)
            summaryTitle
        ];

        return {
            identifier: summaryTitle,
            strategies: strategies
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
                
                console.log(`\n🔍 DEBUG: Testing strategy "${strategy}"`);
                
                // Search for raw cards (add negative keywords to exclude graded cards)
                const rawQuery = strategy + ' -(psa, bgs, sgc, cgc, graded, slab)';
                console.log(`🔍 DEBUG: Raw search query: "${rawQuery}"`);
                console.log(`🔍 DEBUG: Raw query length: ${rawQuery.length}`);
                console.log(`🔍 DEBUG: Raw query contains negative keywords: ${rawQuery.includes('-(psa, bgs, sgc, cgc, graded, slab)')}`);
                console.log(`🔍 DEBUG: Raw query contains parentheses: ${rawQuery.includes('(') && rawQuery.includes(')')}`);
                console.log(`🔍 DEBUG: Raw query contains commas: ${rawQuery.includes(',')}`);
                console.log(`🔍 DEBUG: Raw query contains minus: ${rawQuery.includes('-')}`);
                const ebayService = new EbayScraperService();
                const tempRawResults = await ebayService.searchSoldCards(rawQuery, null, 20, 'Raw');
                console.log(`🔍 DEBUG: Raw search found ${tempRawResults.length} results before filtering`);
                console.log(`🔍 DEBUG: Raw search returned ${tempRawResults.length} results from eBay`);
                
                // Debug filtering for raw results
                if (tempRawResults.length > 0) {
                    console.log(`🔍 DEBUG: Raw query "${rawQuery}" → First result "${tempRawResults[0].title}"`);
                    console.log(`🔍 DEBUG: First result contains PSA: ${tempRawResults[0].title.toLowerCase().includes('psa')}`);
                    console.log(`🔍 DEBUG: First result contains BGS: ${tempRawResults[0].title.toLowerCase().includes('bgs')}`);
                    console.log(`🔍 DEBUG: First result contains SGC: ${tempRawResults[0].title.toLowerCase().includes('sgc')}`);
                }
                
                // Filter out graded cards from raw results (since negative keywords don't work via API)
                const filteredRaw = tempRawResults.filter(result => {
                    const title = result.title.toLowerCase();
                    return !title.includes('psa') && 
                           !title.includes('bgs') && 
                           !title.includes('sgc') && 
                           !title.includes('cgc') && 
                           !title.includes('graded') && 
                           !title.includes('slab');
                });
                
                console.log(`🔍 DEBUG: Raw results filtered from ${tempRawResults.length} to ${filteredRaw.length} (excluded graded cards)`);
                
                // Search for PSA 9 cards
                const psa9Query = `${strategy} PSA 9`;
                const tempPsa9Results = await ebayService.searchSoldCards(strategy, null, 20, 'PSA 9');
                
                // Debug filtering for PSA 9 results
                if (tempPsa9Results.length > 0) {
                    console.log(`🔍 DEBUG: PSA 9 query "${psa9Query}" → First result "${tempPsa9Results[0].title}"`);
                }
                
                // For now, accept all PSA 9 results (we can add filtering later if needed)
                const filteredPsa9 = tempPsa9Results;
                
                // Skip PSA 10 searches for now - focus on raw and PSA 9 only
                const psa10Query = `${strategy} PSA 10`;
                console.log(`🔍 DEBUG: Skipping PSA 10 search for now - "${psa10Query}"`);
                
                const tempPsa10Results = [];
                const filteredPsa10 = [];
                
                console.log(`🔍 "${strategy}" → Found ${filteredRaw.length} raw, ${filteredPsa9.length} PSA 9, ${filteredPsa10.length} PSA 10`);
                
                if (filteredRaw.length > 0 || filteredPsa9.length > 0) {
                    rawResults = filteredRaw;
                    psa9Results = filteredPsa9;
                    psa10Results = filteredPsa10;
                    break; // Use first strategy that gets results
                }
            }
            
            // Calculate averages (skip PSA 10 for now)
            const rawAvg = rawResults.length > 0 ? 
                rawResults.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / rawResults.length : 0;
            const psa9Avg = psa9Results.length > 0 ? 
                psa9Results.reduce((sum, sale) => sum + parseFloat(sale.price?.value || 0), 0) / psa9Results.length : 0;
            const psa10Avg = 0; // Skip PSA 10 for now

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
            const psa10Price = null; // Skip PSA 10 for now
            
            // Skip multiplier calculation for now (since no PSA 10)
            let multiplier = null;
            
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
            
            // First, clean up existing cards with N/A PSA 10 prices
            console.log('🧹 Cleaning up cards with N/A PSA 10 prices...');
            await this.cleanupNAPSA10Cards();
            
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
                                                     // Remove cards with N/A PSA 10 price (existing cards)
                        if (card.psa10Price === null || card.psa10Price === 'N/A') {
                            console.log(`🗑️ ${card.summaryTitle || card.title} → PSA 10: N/A - REMOVING`);
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
                             
                                                           // Skip multiplier info for now (since no PSA 10)
                             
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

    async cleanupNAPSA10Cards() {
        console.log('🧹 Cleaning up ALL cards with N/A PSA 10 prices...');
        
        try {
            const cards = await this.getNAPSA10Cards();
            console.log(`📊 Found ${cards.length} cards with N/A PSA 10 prices`);
            
            if (cards.length === 0) {
                console.log('✅ No cards with N/A PSA 10 prices found!');
                return;
            }
            
            let removedCount = 0;
            
            for (const card of cards) {
                console.log(`🗑️ Removing: ${card.title} (PSA 10: N/A)`);
                await this.removeCard(card.id);
                removedCount++;
                
                if (removedCount % 10 === 0) {
                    console.log(`✅ Removed ${removedCount} cards with N/A PSA 10 prices...`);
                }
            }
            
            console.log(`✅ N/A PSA 10 cleanup complete!`);
            console.log(`📊 Total cards removed: ${removedCount}`);
            
        } catch (error) {
            console.error('❌ Error cleaning up N/A PSA 10 cards:', error);
            throw error;
        }
    }

    async getNAPSA10Cards() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, title, psa10_price, raw_average_price, psa9_average_price
                FROM cards 
                WHERE psa10_price IS NULL OR psa10_price = 'N/A'
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
