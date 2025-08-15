const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteStatusChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async getStatus() {
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as count FROM cards',
                'SELECT COUNT(*) as count FROM cards WHERE raw_average_price IS NOT NULL AND psa9_average_price IS NOT NULL',
                'SELECT COUNT(*) as count FROM cards WHERE raw_average_price IS NULL OR psa9_average_price IS NULL',
                'SELECT COUNT(*) as count FROM cards WHERE last_updated IS NOT NULL',
                'SELECT last_updated FROM cards WHERE last_updated IS NOT NULL ORDER BY last_updated DESC LIMIT 1'
            ];
            
            let completed = 0;
            const results = [];
            
            queries.forEach((query, index) => {
                this.db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    results[index] = row;
                    completed++;
                    
                    if (completed === queries.length) {
                        const [total, withPrices, missingPrices, updated, lastUpdate] = results;
                        resolve({
                            total: total.count,
                            withPrices: withPrices.count,
                            missingPrices: missingPrices.count,
                            updated: updated.count,
                            lastUpdate: lastUpdate?.last_updated || 'Never'
                        });
                    }
                });
            });
        });
    }

    async showStatus() {
        try {
            await this.connect();
            
            console.log('📊 SQLite Database Status');
            console.log('========================');
            
            const status = await this.getStatus();
            
            console.log(`📈 Total cards: ${status.total.toLocaleString()}`);
            console.log(`✅ Cards with price data: ${status.withPrices.toLocaleString()}`);
            console.log(`🔄 Cards missing price data: ${status.missingPrices.toLocaleString()}`);
            console.log(`📅 Cards updated: ${status.updated.toLocaleString()}`);
            console.log(`🕒 Last update: ${status.lastUpdate}`);
            
            const coverage = Math.round(status.withPrices / status.total * 100);
            console.log(`📊 Coverage: ${coverage}%`);
            
            // Show some recent cards with prices
            console.log('\n📋 Recent cards with price data:');
            const recentCards = await this.getRecentCardsWithPrices(5);
                         recentCards.forEach((card, i) => {
                 console.log(`${i + 1}. ${card.summary_title || card.title}`);
                 console.log(`   💰 Raw: $${card.raw_average_price?.toFixed(2) || 'N/A'} | PSA 9: $${card.psa9_average_price?.toFixed(2) || 'N/A'}`);
             });
            
        } catch (error) {
            console.error('❌ Error getting status:', error);
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async getRecentCardsWithPrices(limit = 5) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT title, summary_title, raw_average_price, psa9_average_price, last_updated
                FROM cards 
                WHERE raw_average_price IS NOT NULL AND psa9_average_price IS NOT NULL
                ORDER BY last_updated DESC
                LIMIT ?
            `;
            
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching recent cards:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

// Export for use in other scripts
module.exports = { SQLiteStatusChecker };

// Run if called directly
if (require.main === module) {
    const checker = new SQLiteStatusChecker();
    checker.showStatus();
} 