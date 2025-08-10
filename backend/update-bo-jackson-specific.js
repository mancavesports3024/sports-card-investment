const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ImprovedPriceUpdater } = require('./improve-price-updating.js');

class BoJacksonUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.priceUpdater = new ImprovedPriceUpdater();
    }

    async connect() {
        await this.priceUpdater.connect();
    }

    async getBoJacksonCard() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, raw_average_price, psa9_average_price
                FROM cards 
                WHERE title LIKE '%Bo Jackson%' AND title LIKE '%Holo Prizm%'
                LIMIT 1
            `;
            
            this.db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateCardPrices(cardId, rawAverage, psa9Average) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cards 
                SET raw_average_price = ?, 
                    psa9_average_price = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            this.db.run(query, [rawAverage, psa9Average, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async updateBoJackson() {
        console.log('🔍 Finding Bo Jackson card...');
        
        const card = await this.getBoJacksonCard();
        if (!card) {
            console.log('❌ Bo Jackson card not found');
            return;
        }
        
        console.log(`📊 Found card: ${card.title}`);
        console.log(`Current raw price: $${card.raw_average_price || 'N/A'}`);
        console.log(`Current PSA 9 price: $${card.psa9_average_price || 'N/A'}`);
        
        console.log('\n🔍 Searching for raw prices...');
        const rawPrices = await this.priceUpdater.searchRawPrices(card.title);
        console.log(`Found ${rawPrices.length} raw prices: ${rawPrices.map(p => `$${p}`).join(', ')}`);
        
        const rawAverage = rawPrices.length > 0 ? 
            rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
        
        console.log('\n🔍 Searching for PSA 9 prices...');
        const psa9Prices = await this.priceUpdater.searchPSA9Prices(card.title);
        console.log(`Found ${psa9Prices.length} PSA 9 prices: ${psa9Prices.map(p => `$${p}`).join(', ')}`);
        
        const psa9Average = psa9Prices.length > 0 ? 
            psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : null;
        
        console.log(`\n💰 Calculated averages:`);
        console.log(`  Raw average: $${rawAverage?.toFixed(2) || 'N/A'}`);
        console.log(`  PSA 9 average: $${psa9Average?.toFixed(2) || 'N/A'}`);
        
        if (rawAverage !== null || psa9Average !== null) {
            const success = await this.updateCardPrices(card.id, rawAverage, psa9Average);
            if (success) {
                console.log('✅ Successfully updated Bo Jackson card!');
            } else {
                console.log('❌ Failed to update card');
            }
        } else {
            console.log('❌ No prices found to update');
        }
    }

    async close() {
        this.db.close();
        await this.priceUpdater.close();
    }
}

async function main() {
    const updater = new BoJacksonUpdater();
    
    try {
        await updater.connect();
        await updater.updateBoJackson();
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await updater.close();
    }
}

main();
