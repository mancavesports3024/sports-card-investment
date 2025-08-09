const { SQLitePriceUpdater } = require('./sqlite-price-updater');

class AutomatedPriceUpdater {
    constructor() {
        this.updater = new SQLitePriceUpdater();
    }

    async updatePrices() {
        try {
            console.log('🚀 Starting automated price update...');
            console.log('=====================================');
            
            await this.updater.connect();
            
            // Get cards that need price updates (missing prices or old data)
            const cardsToUpdate = await this.getCardsNeedingUpdates();
            
            if (cardsToUpdate.length === 0) {
                console.log('✅ All cards have recent price data!');
                this.updater.db.close();
                return {
                    success: true,
                    message: 'No cards needed updating',
                    cardsUpdated: 0,
                    timestamp: new Date().toISOString()
                };
            }
            
            console.log(`📊 Found ${cardsToUpdate.length} cards needing price updates`);
            
            // Update prices in larger batches for faster processing
            const batchSize = 200; // Process 200 cards per run
            const cardsToProcess = cardsToUpdate.slice(0, batchSize);
            
            console.log(`🔄 Processing ${cardsToProcess.length} cards in this run...`);
            
            let successful = 0;
            let errors = 0;
            
            for (const card of cardsToProcess) {
                try {
                    const result = await this.updater.processCard(card);
                    if (result) {
                        successful++;
                        console.log(`✅ Updated prices for: ${card.summaryTitle || card.title}`);
                    } else {
                        errors++;
                    }
                    
                    // Optimized rate limiting between cards (1-2 seconds)
                    const delay = 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                } catch (error) {
                    console.error(`❌ Error updating card ${card.id}:`, error.message);
                    errors++;
                }
            }
            
            console.log('\\n✅ Automated Price Update Complete!');
            console.log('=====================================');
            console.log(`📊 Cards processed: ${cardsToProcess.length}`);
            console.log(`✅ Successfully updated: ${successful}`);
            console.log(`❌ Errors: ${errors}`);
            console.log(`⏳ Next update scheduled in 24 hours`);
            
            this.updater.db.close();
            
            return {
                success: true,
                cardsProcessed: cardsToProcess.length,
                cardsUpdated: successful,
                errors: errors,
                remaining: Math.max(0, cardsToUpdate.length - batchSize),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error during automated price update:', error);
            if (this.updater.db) this.updater.db.close();
            throw error;
        }
    }

    // Get cards that need price updates
    async getCardsNeedingUpdates() {
        return new Promise((resolve, reject) => {
            // Priority order:
            // 1. Cards with no prices at all
            // 2. Cards with only raw or only PSA prices (missing the other)
            // 3. Cards with old price data (older than 7 days)
            
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
                    -- Prioritize cards with no prices at all
                    CASE 
                        WHEN rawAveragePrice IS NULL AND psa9AveragePrice IS NULL THEN 1
                        WHEN rawAveragePrice IS NULL OR psa9AveragePrice IS NULL THEN 2
                        ELSE 3
                    END,
                    -- Then by oldest first
                    COALESCE(lastUpdated, '1970-01-01') ASC
                LIMIT 200
            `;
            
            this.updater.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards needing updates:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

// Export for use as module and cron job
module.exports = { AutomatedPriceUpdater };

// Run if called directly
if (require.main === module) {
    const updater = new AutomatedPriceUpdater();
    updater.updatePrices()
        .then(result => {
            console.log('Price update completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Price update failed:', error);
            process.exit(1);
        });
}
