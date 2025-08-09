const fs = require('fs');
const path = require('path');

// Import the hybrid price comparison system
const { hybridBatchPriceComparisons } = require('./hybrid-price-comparisons.js');

async function updateMissingPrices() {
    console.log('🎯 TARGETED UPDATE - CARDS MISSING PRICE DATA');
    console.log('============================================');
    
    try {
        // Load the database
        const databasePath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        console.log('📊 Loading database...');
        
        const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const items = database.items || database;
        
        console.log(`📈 Total cards in database: ${items.length}`);
        
        // Find cards that are missing price comparisons data
        const cardsMissingPrices = items.filter(card => 
            !card.priceComparisons || !card.priceComparisons.raw || !card.priceComparisons.psa9
        );
        
        const cardsWithPrices = items.filter(card => 
            card.priceComparisons && card.priceComparisons.raw && card.priceComparisons.psa9
        );
        
        console.log(`✅ Cards with price data: ${cardsWithPrices.length}`);
        console.log(`🔄 Cards missing price data: ${cardsMissingPrices.length}`);
        console.log(`📊 Current coverage: ${Math.round(cardsWithPrices.length/items.length*100)}%`);
        
        if (cardsMissingPrices.length === 0) {
            console.log('🎉 All cards already have price data!');
            return;
        }
        
        // Create backup before starting
        const backupPath = path.join(__dirname, 'data', 'backups', `psa10_database_backup_before_missing_prices_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        console.log('💾 Creating backup...');
        fs.writeFileSync(backupPath, JSON.stringify(database, null, 2));
        console.log(`✅ Backup created: ${backupPath}`);
        
        // Process missing cards in batches
        const BATCH_SIZE = 100;
        const totalBatches = Math.ceil(cardsMissingPrices.length / BATCH_SIZE);
        
        console.log(`\n🚀 Starting targeted update...`);
        console.log(`📦 Processing ${cardsMissingPrices.length} cards in ${totalBatches} batches of ${BATCH_SIZE}`);
        console.log(`⏱️ Estimated time: ${Math.ceil(cardsMissingPrices.length / 5 / 60)} hours`);
        
        let processedCount = 0;
        let enhancedCount = 0;
        
        for (let i = 0; i < totalBatches; i++) {
            const startIndex = i * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, cardsMissingPrices.length);
            const batch = cardsMissingPrices.slice(startIndex, endIndex);
            
            console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (cards ${startIndex + 1}-${endIndex})`);
            console.log(`⏰ ${new Date().toLocaleTimeString()}`);
            
            try {
                // Process this batch
                const results = await hybridBatchPriceComparisons(batch.length, startIndex);
                
                processedCount += batch.length;
                enhancedCount += results.enhanced || 0;
                
                console.log(`✅ Batch ${i + 1} complete: ${results.enhanced || 0} cards enhanced`);
                console.log(`📊 Progress: ${processedCount}/${cardsMissingPrices.length} (${Math.round(processedCount/cardsMissingPrices.length*100)}%)`);
                
                // Save progress after each batch
                const currentDatabase = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
                fs.writeFileSync(databasePath, JSON.stringify(currentDatabase, null, 2));
                console.log(`💾 Progress saved`);
                
                // Add a small delay between batches to be respectful to APIs
                if (i < totalBatches - 1) {
                    console.log('⏳ Waiting 30 seconds before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
                
            } catch (error) {
                console.error(`❌ Error in batch ${i + 1}:`, error.message);
                console.log('🔄 Continuing with next batch...');
            }
        }
        
        // Final summary
        console.log('\n🎉 TARGETED UPDATE COMPLETE!');
        console.log('============================');
        console.log(`📊 Total cards processed: ${processedCount}`);
        console.log(`✅ Cards enhanced: ${enhancedCount}`);
        console.log(`⏰ Completed at: ${new Date().toLocaleString()}`);
        
        // Load final database to show results
        const finalDatabase = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const finalItems = finalDatabase.items || finalDatabase;
        const finalEnhancedCards = finalItems.filter(card => 
            card.priceComparisons && card.priceComparisons.raw && card.priceComparisons.psa9
        );
        
        console.log(`\n📈 FINAL DATABASE STATS:`);
        console.log(`Total cards: ${finalItems.length}`);
        console.log(`Cards with price comparisons: ${finalEnhancedCards.length}`);
        console.log(`Coverage: ${Math.round(finalEnhancedCards.length/finalItems.length*100)}%`);
        
        // Show top opportunities
        const opportunities = finalEnhancedCards
            .filter(card => card.priceComparisons.raw.avgPrice > 0 && card.price?.value)
            .map(card => {
                const rawPrice = card.priceComparisons.raw.avgPrice;
                const psa10Price = parseFloat(card.price.value);
                const percentage = ((psa10Price - rawPrice) / rawPrice * 100);
                return { card, percentage, rawPrice, psa10Price };
            })
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);
        
        console.log(`\n🏆 TOP 5 INVESTMENT OPPORTUNITIES:`);
        opportunities.forEach((opp, index) => {
            console.log(`${index + 1}. ${opp.card.summaryTitle || opp.card.title}`);
            console.log(`   Raw: $${opp.rawPrice.toFixed(2)} → PSA 10: $${opp.psa10Price.toFixed(2)} (+${opp.percentage.toFixed(1)}%)`);
        });
        
        console.log(`\n✅ Targeted update complete! Sweet dreams! 🌙`);
        
    } catch (error) {
        console.error('❌ Error during targeted update:', error.message);
        console.log('🔄 Check the backup file and try again later.');
    }
}

// Run the update
updateMissingPrices(); 