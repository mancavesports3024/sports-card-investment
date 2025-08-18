const NewPricingDatabase = require('./create-new-pricing-database.js');

class SportsUpdaterWithESPNV2 {
    constructor() {
        this.db = new NewPricingDatabase();
        this.updatedCount = 0;
        this.unchangedCount = 0;
        this.errorCount = 0;
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async updateSportsForExistingCards() {
        console.log('🔄 Starting ESPN v2 sport detection update for existing cards...\n');
        
        try {
            // Get all cards from the database
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, sport, player_name 
                FROM cards 
                ORDER BY created_at DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards to process`);
            
            // Process cards in batches to avoid overwhelming the API
            const batchSize = 10;
            const batches = [];
            
            for (let i = 0; i < cards.length; i += batchSize) {
                batches.push(cards.slice(i, i + batchSize));
            }
            
            console.log(`📦 Processing in ${batches.length} batches of ${batchSize} cards each\n`);
            
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)`);
                
                for (const card of batch) {
                    await this.processCard(card);
                    
                    // Add a small delay between cards to be respectful to the API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Add a longer delay between batches
                if (batchIndex < batches.length - 1) {
                    console.log('⏳ Waiting 3 seconds before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Error updating sports:', error);
            throw error;
        }
    }

    async processCard(card) {
        try {
            console.log(`\n🎯 Processing: ${card.title}`);
            console.log(`   Summary title: ${card.summary_title}`);
            console.log(`   Player name: ${card.player_name}`);
            console.log(`   Current sport: ${card.sport}`);
            
            // Use the already extracted player_name for sport detection if available
            let newSport;
            if (card.player_name) {
                // Use ESPN v2 API directly with the player name
                newSport = await this.db.espnDetector.detectSportFromPlayer(card.player_name);
                console.log(`   Using ESPN v2 API with player name: ${card.player_name}`);
            } else {
                // Fallback to comprehensive detection if no player name
                newSport = await this.db.detectSportFromComprehensive(card.summary_title);
                console.log(`   Fallback to comprehensive detection (no player name)`);
            }
            
            console.log(`   New sport: ${newSport}`);
            
            if (newSport && newSport !== card.sport) {
                // Update the card with the new sport
                await this.db.runQuery(`
                    UPDATE cards 
                    SET sport = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [newSport, card.id]);
                
                console.log(`   ✅ Updated: ${card.sport} → ${newSport}`);
                this.updatedCount++;
            } else {
                console.log(`   ⏭️ No change needed`);
                this.unchangedCount++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.errorCount++;
        }
    }

    printSummary() {
        console.log('\n📊 ESPN v2 Sport Detection Update Summary');
        console.log('==========================================');
        console.log(`✅ Cards updated: ${this.updatedCount}`);
        console.log(`⏭️ Cards unchanged: ${this.unchangedCount}`);
        console.log(`❌ Errors: ${this.errorCount}`);
        console.log(`📈 Total processed: ${this.updatedCount + this.unchangedCount + this.errorCount}`);
        
        if (this.updatedCount > 0) {
            console.log('\n🎉 Successfully updated sports using ESPN v2 API!');
        } else {
            console.log('\nℹ️ No sports needed updating - all cards already have correct sports');
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Main execution
async function main() {
    const updater = new SportsUpdaterWithESPNV2();
    
    try {
        await updater.connect();
        await updater.updateSportsForExistingCards();
    } catch (error) {
        console.error('❌ Error in main:', error);
        process.exit(1);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ ESPN v2 sport detection update completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ ESPN v2 sport detection update failed:', error);
            process.exit(1);
        });
}

module.exports = { SportsUpdaterWithESPNV2 };
