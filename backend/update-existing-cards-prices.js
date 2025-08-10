const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ImprovedPriceUpdater } = require('./improve-price-updating.js');

class ExistingCardsPriceUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.priceUpdater = new ImprovedPriceUpdater();
    }

    async connect() {
        await this.priceUpdater.connect();
    }

    async getCardsWithoutRawPrices() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, raw_average_price, psa9_average_price
                FROM cards 
                WHERE (raw_average_price IS NULL OR psa9_average_price IS NULL)
                ORDER BY created_at DESC
                LIMIT 50
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async updateCardPrices(cardId, rawAverage, psa9Average, psa10Average) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cards 
                SET raw_average_price = ?, 
                    psa9_average_price = ?,
                    psa10_average_price = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            this.db.run(query, [rawAverage, psa9Average, psa10Average, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async updateExistingCards() {
        const cards = await this.getCardsWithoutRawPrices();
        
        let updatedCount = 0;
        let totalProcessed = 0;
        
        for (const card of cards) {
            try {
                // Get raw prices
                const rawPrices = await this.priceUpdater.searchRawPrices(card.title);
                const rawAverage = rawPrices.length > 0 ? 
                    rawPrices.reduce((sum, price) => sum + price, 0) / rawPrices.length : null;
                
                // Get PSA 9 prices
                const psa9Prices = await this.priceUpdater.searchPSA9Prices(card.title);
                const psa9Average = psa9Prices.length > 0 ? 
                    psa9Prices.reduce((sum, price) => sum + price, 0) / psa9Prices.length : null;
                
                // Get PSA 10 prices to calculate average
                const psa10Prices = await this.priceUpdater.searchPSA10Prices(card.title);
                const psa10Average = psa10Prices.length > 0 ? 
                    psa10Prices.reduce((sum, price) => sum + price, 0) / psa10Prices.length : null;
                
                // Update the card if we found any prices
                if (rawAverage !== null || psa9Average !== null || psa10Average !== null) {
                    const success = await this.updateCardPrices(card.id, rawAverage, psa9Average, psa10Average);
                    if (success) {
                        updatedCount++;
                    }
                }
                
                totalProcessed++;
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                // Silent error handling
            }
        }
        
        return { totalProcessed, updatedCount };
    }

    async close() {
        this.db.close();
        await this.priceUpdater.close();
    }
}

async function main() {
    const updater = new ExistingCardsPriceUpdater();
    
    try {
        await updater.connect();
        await updater.updateExistingCards();
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await updater.close();
    }
}

main();
