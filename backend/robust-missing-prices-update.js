const fs = require('fs');
const path = require('path');
const { hybridBatchPriceComparisons } = require('./hybrid-price-comparisons.js');

async function robustUpdateMissingPrices() {
    console.log('🛡️ ROBUST TARGETED UPDATE - CARDS MISSING PRICE DATA');
    console.log('====================================================');

    try {
        const databasePath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        console.log('📊 Loading database...');

        const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const items = database.items || database;

        // Find cards missing price data
        const cardsMissingPrices = items.filter(card => 
            !card.rawAveragePrice || !card.psa9AveragePrice
        );

        console.log(`📈 DATABASE ANALYSIS:`);
        console.log(`Total cards: ${items.length}`);
        console.log(`Cards with price data: ${items.length - cardsMissingPrices.length}`);
        console.log(`Cards missing price data: ${cardsMissingPrices.length}`);
        console.log(`Coverage: ${Math.round((items.length - cardsMissingPrices.length)/items.length*100)}%`);

        if (cardsMissingPrices.length === 0) {
            console.log('✅ All cards already have price data!');
            return;
        }

        // Create backup
        const backupPath = path.join(__dirname, 'data', 'backups', `psa10_database_backup_before_robust_update_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        console.log('💾 Creating backup...');
        fs.writeFileSync(backupPath, JSON.stringify(database, null, 2));
        console.log(`✅ Backup created: ${backupPath}`);

        const BATCH_SIZE = 50; // Smaller batches for better reliability
        const totalBatches = Math.ceil(cardsMissingPrices.length / BATCH_SIZE);

        console.log(`\n🚀 Starting robust targeted update...`);
        console.log(`📦 Processing ${cardsMissingPrices.length} cards in ${totalBatches} batches of ${BATCH_SIZE}`);
        console.log(`⏱️ Estimated time: ${Math.ceil(cardsMissingPrices.length / 3 / 60)} hours (with delays)`);

        let processedCount = 0;
        let enhancedCount = 0;
        let errorCount = 0;
        let retryCount = 0;

        for (let i = 0; i < totalBatches; i++) {
            const startIndex = i * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, cardsMissingPrices.length);
            const batch = cardsMissingPrices.slice(startIndex, endIndex);

            console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (cards ${startIndex + 1}-${endIndex})`);
            console.log(`⏰ ${new Date().toLocaleTimeString()}`);

            let batchSuccess = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!batchSuccess && attempts < maxAttempts) {
                attempts++;
                
                if (attempts > 1) {
                    console.log(`🔄 Retry attempt ${attempts}/${maxAttempts} for batch ${i + 1}`);
                    retryCount++;
                }

                try {
                    // Use a smaller batch size for the hybrid function
                    const results = await hybridBatchPriceComparisons(batch.length, startIndex);
                    processedCount += batch.length;
                    enhancedCount += results.enhanced || 0;

                    console.log(`✅ Batch ${i + 1} complete: ${results.enhanced || 0} cards enhanced`);
                    console.log(`📊 Progress: ${processedCount}/${cardsMissingPrices.length} (${Math.round(processedCount/cardsMissingPrices.length*100)}%)`);

                    // Save progress after each batch
                    const currentDatabase = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
                    fs.writeFileSync(databasePath, JSON.stringify(currentDatabase, null, 2));
                    console.log(`💾 Progress saved`);

                    batchSuccess = true;

                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error in batch ${i + 1} (attempt ${attempts}):`, error.message);
                    
                    if (attempts < maxAttempts) {
                        const delay = attempts * 60 * 1000; // 1, 2, 3 minutes
                        console.log(`⏳ Waiting ${delay/1000} seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        console.log('❌ Max retries reached for this batch, continuing...');
                    }
                }
            }

            // Longer delay between batches to prevent timeouts
            if (i < totalBatches - 1) {
                const delay = 90 * 1000; // 90 seconds
                console.log(`⏳ Waiting ${delay/1000} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log('\n🎉 ROBUST TARGETED UPDATE COMPLETE!');
        console.log('===================================');
        console.log(`📊 Total cards processed: ${processedCount}`);
        console.log(`✅ Cards enhanced: ${enhancedCount}`);
        console.log(`❌ Errors encountered: ${errorCount}`);
        console.log(`🔄 Retries performed: ${retryCount}`);
        console.log(`⏰ Completed at: ${new Date().toLocaleString()}`);

        // Final status check
        const finalDatabase = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const finalItems = finalDatabase.items || finalDatabase;
        const finalEnhancedCards = finalItems.filter(card =>
            card.rawAveragePrice && card.psa9AveragePrice
        );

        console.log(`\n📈 FINAL DATABASE STATS:`);
        console.log(`Total cards: ${finalItems.length}`);
        console.log(`Cards with price comparisons: ${finalEnhancedCards.length}`);
        console.log(`Coverage: ${Math.round(finalEnhancedCards.length/finalItems.length*100)}%`);

        // Show top investment opportunities
        const opportunities = finalEnhancedCards
            .filter(card => card.rawAveragePrice && card.psa10Price)
            .map(card => {
                const percentage = ((card.psa10Price - card.rawAveragePrice) / card.rawAveragePrice * 100);
                return { card, percentage };
            })
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        console.log(`\n🏆 TOP 5 INVESTMENT OPPORTUNITIES:`);
        opportunities.forEach((opp, index) => {
            console.log(`${index + 1}. ${opp.card.title}`);
            console.log(`   Raw: $${opp.card.rawAveragePrice.toFixed(2)} → PSA 10: $${opp.card.psa10Price.toFixed(2)} (+${opp.percentage.toFixed(1)}%)`);
        });

        console.log(`\n✅ Robust update complete! Database is now more resilient! 🛡️`);

    } catch (error) {
        console.error('❌ Error during robust update:', error.message);
        console.log('🔄 Check the backup file and try again later.');
    }
}

robustUpdateMissingPrices(); 