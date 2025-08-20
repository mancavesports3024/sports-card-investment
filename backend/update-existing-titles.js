const NewPricingDatabase = require('./create-new-pricing-database.js');
const { CardBaseService } = require('./services/cardbaseService.js');

class ExistingTitleUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
        this.cardbaseService = new CardBaseService();
        this.processedCount = 0;
        this.updatedCount = 0;
        this.failedCount = 0;
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async updateExistingTitles(limit = 10, offset = 0) {
        try {
            console.log(`🔄 Starting to update existing titles (limit: ${limit}, offset: ${offset})`);
            
            // Get cards with title issues first, then fall back to general improvement
            let cards = await this.db.getCardsWithTitleIssues(limit, offset);
            if (cards.length === 0) {
                cards = await this.db.getCardsForTitleImprovement(limit, offset);
            }
            
            if (cards.length === 0) {
                console.log('ℹ️ No cards found that need title improvement');
                return;
            }

            console.log(`📋 Found ${cards.length} cards to process`);

            for (const card of cards) {
                this.processedCount++;
                console.log(`\n🔍 Processing card ${this.processedCount}/${cards.length}: ${card.title}`);
                
                try {
                    // Use the current summary_title to search CardBase (it's cleaner than the original title)
                    const searchQuery = card.summary_title || card.title;
                    const improvement = await this.db.improveCardTitleWithCardBase(searchQuery);
                    
                    if (improvement.success && improvement.improvedTitle !== card.summary_title) {
                        // Update the card with improved title
                        await this.db.updateCardTitle(card.id, improvement.improvedTitle);
                        this.updatedCount++;
                        
                        console.log(`✅ Updated card ${card.id}:`);
                        console.log(`   Current Summary: ${card.summary_title}`);
                        console.log(`   Improved: ${improvement.improvedTitle}`);
                    } else {
                        this.failedCount++;
                        console.log(`❌ No improvement found for card ${card.id}`);
                        if (improvement.error) {
                            console.log(`   Error: ${improvement.error}`);
                        }
                    }
                    
                    // Add delay to be respectful to the API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    this.failedCount++;
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                }
            }

            console.log(`\n📊 Update Summary:`);
            console.log(`   Processed: ${this.processedCount}`);
            console.log(`   Updated: ${this.updatedCount}`);
            console.log(`   Failed: ${this.failedCount}`);

        } catch (error) {
            console.error('❌ Error updating existing titles:', error);
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Main execution
async function main() {
    const updater = new ExistingTitleUpdater();
    
    try {
        await updater.connect();
        
        // Update titles in batches
        const batchSize = 5;
        const totalBatches = 3; // Process 15 cards total
        
        for (let i = 0; i < totalBatches; i++) {
            const offset = i * batchSize;
            console.log(`\n🔄 Processing batch ${i + 1}/${totalBatches} (offset: ${offset})`);
            await updater.updateExistingTitles(batchSize, offset);
            
            // Wait between batches
            if (i < totalBatches - 1) {
                console.log('⏳ Waiting 5 seconds before next batch...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { ExistingTitleUpdater };
