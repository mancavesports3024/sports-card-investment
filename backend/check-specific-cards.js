const NewPricingDatabase = require('./create-new-pricing-database.js');

class SpecificCardChecker {
    constructor() {
        this.db = null;
    }

    async connect() {
        this.db = new NewPricingDatabase();
        await this.db.connect();
        console.log('✅ Connected to Railway database');
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }

    async checkSpecificCards() {
        console.log('🔍 Checking specific cards mentioned by user...\n');
        
        try {
            await this.connect();
            
            // Search for cards that might match the examples
            const searchTerms = [
                'Demaryius Thomas',
                'Caitlin Clark',
                'Stephon Castle',
                'Josh Allen',
                'Cassius Clay',
                'Kyle Harrison',
                'Dj Lagway'
            ];
            
            for (const searchTerm of searchTerms) {
                console.log(`\n🔍 Searching for: "${searchTerm}"`);
                
                const cards = await this.db.allQuery(`
                    SELECT id, title, summary_title, player_name, sport, brand, year
                    FROM cards 
                    WHERE title LIKE ? OR summary_title LIKE ? OR player_name LIKE ?
                    ORDER BY id
                `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
                
                if (cards.length > 0) {
                    console.log(`📊 Found ${cards.length} cards:`);
                    cards.forEach((card, index) => {
                        console.log(`\n   Card ${index + 1} (ID: ${card.id}):`);
                        console.log(`   Title: "${card.title}"`);
                        console.log(`   Summary: "${card.summary_title}"`);
                        console.log(`   Player: "${card.player_name}"`);
                        console.log(`   Sport: "${card.sport}"`);
                        console.log(`   Brand: "${card.brand}"`);
                        console.log(`   Year: "${card.year}"`);
                    });
                } else {
                    console.log(`   No cards found for "${searchTerm}"`);
                }
            }
            
            // Also check for cards with obvious issues
            console.log('\n🔍 Checking for cards with obvious summary title issues...');
            
            const problematicCards = await this.db.allQuery(`
                SELECT id, title, summary_title, player_name
                FROM cards 
                WHERE (
                    summary_title LIKE '%PSA 10%' OR
                    summary_title LIKE '%GEM MINT%' OR
                    summary_title LIKE '%RC RC%' OR
                    summary_title LIKE '%ROOKIE ROOKIE%' OR
                    summary_title LIKE '%AUTO AUTO%'
                )
                ORDER BY id
                LIMIT 10
            `);
            
            if (problematicCards.length > 0) {
                console.log(`📊 Found ${problematicCards.length} cards with obvious issues:`);
                problematicCards.forEach((card, index) => {
                    console.log(`\n   Problematic Card ${index + 1} (ID: ${card.id}):`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Summary: "${card.summary_title}"`);
                    console.log(`   Player: "${card.player_name}"`);
                });
            } else {
                console.log('   No cards with obvious summary title issues found');
            }
            
        } catch (error) {
            console.error('❌ Error checking specific cards:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Export for use
module.exports = { SpecificCardChecker };

// For running directly
if (require.main === module) {
    const checker = new SpecificCardChecker();
    checker.checkSpecificCards()
        .then(() => {
            console.log('\n✅ Specific card check completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Specific card check failed:', error);
            process.exit(1);
        });
}
