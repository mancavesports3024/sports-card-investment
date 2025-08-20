const NewPricingDatabase = require('./create-new-pricing-database.js');

class CardChecker {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async checkCardsForImprovement() {
        try {
            console.log('🔍 Checking cards that need title improvement...');
            
            // Get total count of cards
            const totalCards = await this.getTotalCardCount();
            console.log(`📊 Total cards in database: ${totalCards}`);
            
            // Get cards that need improvement
            const cardsNeedingImprovement = await this.db.getCardsForTitleImprovement(10, 0);
            console.log(`📋 Cards needing improvement: ${cardsNeedingImprovement.length}`);
            
            if (cardsNeedingImprovement.length > 0) {
                console.log('\n📝 Sample cards that need improvement:');
                cardsNeedingImprovement.slice(0, 5).forEach((card, index) => {
                    console.log(`${index + 1}. ID: ${card.id}`);
                    console.log(`   Title: ${card.title}`);
                    console.log(`   Summary Title: ${card.summary_title || 'NULL'}`);
                    console.log('');
                });
            } else {
                console.log('✅ All cards already have good summary titles!');
            }
            
            // Get some sample cards to see what we're working with
            const sampleCards = await this.getSampleCards(5);
            console.log('\n📝 Sample cards from database:');
            sampleCards.forEach((card, index) => {
                console.log(`${index + 1}. ID: ${card.id}`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Summary Title: ${card.summary_title || 'NULL'}`);
                console.log('');
            });
            
        } catch (error) {
            console.error('❌ Error checking cards:', error);
        }
    }

    async getTotalCardCount() {
        return new Promise((resolve, reject) => {
            this.db.pricingDb.get('SELECT COUNT(*) as count FROM cards', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    async getSampleCards(limit = 5) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT id, title, summary_title FROM cards ORDER BY created_at DESC LIMIT ?';
            this.db.pricingDb.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Main execution
async function main() {
    const checker = new CardChecker();
    
    try {
        await checker.connect();
        await checker.checkCardsForImprovement();
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await checker.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { CardChecker };
