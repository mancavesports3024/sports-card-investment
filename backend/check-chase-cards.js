const NewPricingDatabase = require('./create-new-pricing-database.js');

class ChaseCardsChecker {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }

    async checkChaseCards() {
        try {
            console.log('🔍 Checking all cards with "Chase" in the title...\n');

            // Get all cards with "Chase" in the title
            const query = `SELECT id, player_name, title, summary_title FROM cards WHERE title LIKE '%Chase%' ORDER BY id LIMIT 20`;
            const results = await this.db.allQuery(query);
            
            if (results.length === 0) {
                console.log('❌ No cards with "Chase" in title found');
            } else {
                console.log(`✅ Found ${results.length} cards with "Chase" in title:`);
                results.forEach((card, index) => {
                    console.log(`\n${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Player Name: "${card.player_name || 'NULL'}"`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Summary Title: "${card.summary_title || 'NULL'}"`);
                });
            }

            // Also check for cards with "Chase" in player_name
            console.log('\n🔍 Checking all cards with "Chase" in player_name...\n');
            const playerQuery = `SELECT id, player_name, title, summary_title FROM cards WHERE player_name LIKE '%Chase%' ORDER BY id LIMIT 10`;
            const playerResults = await this.db.allQuery(playerQuery);
            
            if (playerResults.length === 0) {
                console.log('❌ No cards with "Chase" in player_name found');
            } else {
                console.log(`✅ Found ${playerResults.length} cards with "Chase" in player_name:`);
                playerResults.forEach((card, index) => {
                    console.log(`\n${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Player Name: "${card.player_name}"`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Summary Title: "${card.summary_title || 'NULL'}"`);
                });
            }

        } catch (error) {
            console.error('❌ Error checking Chase cards:', error);
        }
    }
}

// Main execution
async function main() {
    const checker = new ChaseCardsChecker();
    
    try {
        await checker.connect();
        await checker.checkChaseCards();
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await checker.close();
    }
}

// Export for use as module
module.exports = { ChaseCardsChecker };

// Run if called directly
if (require.main === module) {
    main();
}
