const NewPricingDatabase = require('./create-new-pricing-database.js');

class JaMarrChaseChecker {
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

    async checkJaMarrChase() {
        try {
            console.log('🔍 Checking for "Ja Marr Chase" entries...\n');

            // Check for various spellings of Ja'Marr Chase
            const queries = [
                {
                    name: 'Ja Marr Chase (missing apostrophe)',
                    query: `SELECT id, player_name, title FROM cards WHERE player_name LIKE '%Ja Marr Chase%'`
                },
                {
                    name: 'Ja\'Marr Chase (correct spelling)',
                    query: `SELECT id, player_name, title FROM cards WHERE player_name LIKE '%Ja''Marr Chase%'`
                },
                {
                    name: 'Ja\'marr Chase (lowercase m)',
                    query: `SELECT id, player_name, title FROM cards WHERE player_name LIKE '%Ja''marr Chase%'`
                },
                {
                    name: 'JaMarr Chase (no space)',
                    query: `SELECT id, player_name, title FROM cards WHERE player_name LIKE '%JaMarr Chase%'`
                }
            ];

            for (const { name, query } of queries) {
                console.log(`📋 ${name}:`);
                const results = await this.db.allQuery(query);
                
                if (results.length === 0) {
                    console.log(`   ❌ No entries found`);
                } else {
                    console.log(`   ✅ Found ${results.length} entries:`);
                    results.forEach((card, index) => {
                        console.log(`      ${index + 1}. ID: ${card.id} | Player: "${card.player_name}" | Title: "${card.title}"`);
                    });
                }
                console.log('');
            }

            // Also check for any cards with "Chase" in the title that might be Ja'Marr
            console.log('🔍 Checking for cards with "Chase" in title that might be Ja\'Marr:');
            const chaseQuery = `SELECT id, player_name, title FROM cards WHERE title LIKE '%Chase%' AND (player_name IS NULL OR player_name = '') LIMIT 10`;
            const chaseResults = await this.db.allQuery(chaseQuery);
            
            if (chaseResults.length === 0) {
                console.log('   ❌ No cards with "Chase" in title and NULL player_name found');
            } else {
                console.log(`   ✅ Found ${chaseResults.length} potential Ja'Marr Chase cards:`);
                chaseResults.forEach((card, index) => {
                    console.log(`      ${index + 1}. ID: ${card.id} | Player: "${card.player_name || 'NULL'}" | Title: "${card.title}"`);
                });
            }

        } catch (error) {
            console.error('❌ Error checking Ja\'Marr Chase entries:', error);
        }
    }
}

// Main execution
async function main() {
    const checker = new JaMarrChaseChecker();
    
    try {
        await checker.connect();
        await checker.checkJaMarrChase();
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await checker.close();
    }
}

// Export for use as module
module.exports = { JaMarrChaseChecker };

// Run if called directly
if (require.main === module) {
    main();
}
