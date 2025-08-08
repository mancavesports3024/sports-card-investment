const Database = require('sqlite');
const path = require('path');

class SQLiteStatusChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'scorecard.db');
        this.db = null;
    }

    async connect() {
        try {
            this.db = await Database.open(this.dbPath);
            console.log('✅ Connected to SQLite database');
        } catch (err) {
            console.error('❌ Error connecting to database:', err);
            throw err;
        }
    }

    async getStatus() {
        try {
            const queries = [
                'SELECT COUNT(*) as count FROM cards',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NOT NULL',
                'SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL',
                'SELECT COUNT(*) as count FROM cards WHERE lastUpdated IS NOT NULL',
                'SELECT lastUpdated FROM cards WHERE lastUpdated IS NOT NULL ORDER BY lastUpdated DESC LIMIT 1'
            ];
            
            const results = await Promise.all(queries.map(async query => {
                return await this.db.get(query);
            }));
            
            const [total, withPrices, missingPrices, updated, lastUpdate] = results;
            
            return {
                total: total.count,
                withPrices: withPrices.count,
                missingPrices: missingPrices.count,
                updated: updated.count,
                lastUpdate: lastUpdate?.lastUpdated || 'Never'
            };
        } catch (err) {
            console.error('❌ Error getting status:', err);
            throw err;
        }
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
                console.log(`${i + 1}. ${card.summaryTitle || card.title}`);
                console.log(`   💰 Raw: $${card.rawAveragePrice?.toFixed(2) || 'N/A'} | PSA 9: $${card.psa9AveragePrice?.toFixed(2) || 'N/A'}`);
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
        try {
            const query = `
                SELECT title, summaryTitle, rawAveragePrice, psa9AveragePrice, lastUpdated
                FROM cards 
                WHERE rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NOT NULL
                ORDER BY lastUpdated DESC
                LIMIT ?
            `;
            
            const rows = await this.db.all(query, limit);
            return rows;
        } catch (err) {
            console.error('❌ Error fetching recent cards:', err);
            throw err;
        }
    }
}

// Export for use in other scripts
module.exports = { SQLiteStatusChecker };

// Run if called directly
if (require.main === module) {
    const checker = new SQLiteStatusChecker();
    checker.showStatus();
} 