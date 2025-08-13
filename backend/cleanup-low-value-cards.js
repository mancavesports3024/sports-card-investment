const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class LowValueCardCleanup {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async runUpdate(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    async cleanupLowValueCards() {
        console.log('🧹 Starting Low-Value Card Cleanup...\n');

        try {
            await this.connect();

            // 1. First, let's see what we're dealing with
            const lowValueCards = await this.runQuery(`
                SELECT id, title, summary_title, sport, psa10_price, raw_average_price
                FROM cards 
                WHERE (psa10_price < 30 AND psa10_price IS NOT NULL)
                   OR sport = 'Unknown' 
                   OR sport = 'UNKNOWN'
                ORDER BY psa10_price ASC
            `);

            console.log(`📊 Found ${lowValueCards.length} low-value/unknown cards to review`);

            if (lowValueCards.length > 0) {
                console.log('\n📋 Examples of low-value cards:');
                lowValueCards.slice(0, 10).forEach(card => {
                    console.log(`   ID ${card.id}: $${card.psa10_price || 'N/A'} - "${card.title}"`);
                    console.log(`   Sport: ${card.sport}, Summary: "${card.summary_title}"`);
                    console.log('');
                });
            }

            // 2. Get total count before cleanup
            const totalBefore = await this.runQuery('SELECT COUNT(*) as count FROM cards');
            console.log(`📊 Total cards before cleanup: ${totalBefore[0].count}`);

            // 3. Remove low-value PSA 10 cards (under $30)
            const lowPriceResult = await this.runUpdate(`
                DELETE FROM cards 
                WHERE psa10_price < 30 AND psa10_price IS NOT NULL
            `);
            console.log(`🗑️ Removed ${lowPriceResult.changes} cards with PSA 10 price under $30`);

            // 4. Remove cards with UNKNOWN sport
            const unknownSportResult = await this.runUpdate(`
                DELETE FROM cards 
                WHERE sport = 'Unknown' OR sport = 'UNKNOWN'
            `);
            console.log(`🗑️ Removed ${unknownSportResult.changes} cards with UNKNOWN sport`);

            // 5. Get total count after cleanup
            const totalAfter = await this.runQuery('SELECT COUNT(*) as count FROM cards');
            console.log(`📊 Total cards after cleanup: ${totalAfter[0].count}`);

            const totalRemoved = totalBefore[0].count - totalAfter[0].count;
            console.log(`🗑️ Total cards removed: ${totalRemoved}`);

            // 6. Show remaining cards by price range
            const priceDistribution = await this.runQuery(`
                SELECT 
                    CASE 
                        WHEN psa10_price < 50 THEN 'Under $50'
                        WHEN psa10_price < 100 THEN '$50-$100'
                        WHEN psa10_price < 200 THEN '$100-$200'
                        WHEN psa10_price < 500 THEN '$200-$500'
                        ELSE 'Over $500'
                    END as price_range,
                    COUNT(*) as count
                FROM cards 
                WHERE psa10_price IS NOT NULL
                GROUP BY price_range
                ORDER BY 
                    CASE price_range
                        WHEN 'Under $50' THEN 1
                        WHEN '$50-$100' THEN 2
                        WHEN '$100-$200' THEN 3
                        WHEN '$200-$500' THEN 4
                        ELSE 5
                    END
            `);

            console.log('\n💰 Remaining cards by price range:');
            priceDistribution.forEach(price => {
                console.log(`   ${price.price_range}: ${price.count} cards`);
            });

            // 7. Show sport distribution after cleanup
            const sportDistribution = await this.runQuery(`
                SELECT sport, COUNT(*) as count 
                FROM cards 
                GROUP BY sport 
                ORDER BY count DESC
            `);

            console.log('\n📊 Sport distribution after cleanup:');
            sportDistribution.forEach(sport => {
                console.log(`   ${sport.sport || 'NULL'}: ${sport.count} cards`);
            });

            return {
                success: true,
                totalBefore: totalBefore[0].count,
                totalAfter: totalAfter[0].count,
                totalRemoved: totalRemoved,
                lowPriceRemoved: lowPriceResult.changes,
                unknownSportRemoved: unknownSportResult.changes
            };

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }
}

// Run the cleanup
if (require.main === module) {
    const cleanup = new LowValueCardCleanup();
    cleanup.cleanupLowValueCards()
        .then((result) => {
            console.log('\n🎉 Low-Value Card Cleanup Complete!');
            console.log('====================================');
            console.log(`📊 Total cards before: ${result.totalBefore}`);
            console.log(`📊 Total cards after: ${result.totalAfter}`);
            console.log(`🗑️ Total removed: ${result.totalRemoved}`);
            console.log(`💰 Low price removed: ${result.lowPriceRemoved}`);
            console.log(`❓ Unknown sport removed: ${result.unknownSportRemoved}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Cleanup failed:', error);
            process.exit(1);
        });
}

module.exports = { LowValueCardCleanup };
