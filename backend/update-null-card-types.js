const NewPricingDatabase = require('./create-new-pricing-database.js');

class NullCardTypeUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async updateNullCardTypes() {
        console.log('🔄 Updating null card types to "Base"...\n');
        
        try {
            // Get all cards with null or empty card types
            const cards = await this.db.allQuery(`
                SELECT id, title, card_type
                FROM cards 
                WHERE card_type IS NULL OR card_type = ''
                ORDER BY id
            `);

            console.log(`📊 Found ${cards.length} cards with null/empty card types\n`);

            let updatedCount = 0;

            for (const card of cards) {
                try {
                    // Update the card type to "Base"
                    await this.db.runQuery(`
                        UPDATE cards 
                        SET card_type = 'Base'
                        WHERE id = ?
                    `, [card.id]);

                    console.log(`✅ Updated card ${card.id}: "${card.title.substring(0, 50)}..."`);
                    updatedCount++;
                } catch (error) {
                    console.log(`❌ Error updating card ${card.id}: ${error.message}`);
                }
            }

            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Updated: ${updatedCount} cards`);
            console.log(`   📝 Total processed: ${cards.length} cards`);

        } catch (error) {
            console.error('❌ Error updating null card types:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addUpdateNullCardTypesRoute(app) {
    app.post('/api/admin/update-null-card-types', async (req, res) => {
        try {
            console.log('🔄 Update null card types endpoint called');
            
            const updater = new NullCardTypeUpdater();
            await updater.connect();
            await updater.updateNullCardTypes();
            await updater.close();

            res.json({
                success: true,
                message: 'Null card types updated to Base successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in update null card types endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating null card types',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { NullCardTypeUpdater, addUpdateNullCardTypesRoute };
