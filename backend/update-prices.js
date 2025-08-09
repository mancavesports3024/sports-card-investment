const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater');

class AutomatedPriceUpdater {
    constructor() {
        this.updater = new FastSQLitePriceUpdater();
    }

    async updatePrices() {
        try {
            console.log('🚀 Starting automated price update (Fast Processing)...');
            console.log('=====================================================');
            
            // Use the fast batch processing with 200 cards per run
            const batchSize = 200;
            await this.updater.processBatchFast(batchSize);
            
            return {
                success: true,
                message: 'Fast price update completed',
                method: 'fast_sqlite_parallel',
                batchSize: batchSize,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error during automated price update:', error);
            throw error;
        }
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
