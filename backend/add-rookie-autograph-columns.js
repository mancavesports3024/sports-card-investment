const NewPricingDatabase = require('./create-new-pricing-database.js');

class DatabaseMigration {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async addRookieAutographColumns() {
        console.log('🔄 Adding is_rookie and is_autograph columns to database...\n');
        
        try {
            // Check if columns already exist
            const tableInfo = await this.db.allQuery("PRAGMA table_info(cards)");
            const existingColumns = tableInfo.map(col => col.name);
            
            console.log('📋 Current columns:', existingColumns);
            
            // Add is_rookie column if it doesn't exist
            if (!existingColumns.includes('is_rookie')) {
                console.log('➕ Adding is_rookie column...');
                await this.db.runQuery('ALTER TABLE cards ADD COLUMN is_rookie BOOLEAN DEFAULT 0');
                console.log('✅ is_rookie column added');
            } else {
                console.log('ℹ️ is_rookie column already exists');
            }
            
            // Add is_autograph column if it doesn't exist
            if (!existingColumns.includes('is_autograph')) {
                console.log('➕ Adding is_autograph column...');
                await this.db.runQuery('ALTER TABLE cards ADD COLUMN is_autograph BOOLEAN DEFAULT 0');
                console.log('✅ is_autograph column added');
            } else {
                console.log('ℹ️ is_autograph column already exists');
            }
            
            // Update existing cards with rookie and autograph flags
            console.log('\n🔄 Updating existing cards with rookie and autograph flags...');
            
            const cards = await this.db.allQuery('SELECT id, title FROM cards');
            console.log(`📊 Found ${cards.length} cards to update`);
            
            let updatedCount = 0;
            
            for (const card of cards) {
                try {
                    const isRookie = this.isRookieCard(card.title);
                    const isAutograph = this.isAutographCard(card.title);
                    
                    await this.db.runQuery(`
                        UPDATE cards 
                        SET is_rookie = ?, is_autograph = ?
                        WHERE id = ?
                    `, [isRookie ? 1 : 0, isAutograph ? 1 : 0, card.id]);
                    
                    if (isRookie || isAutograph) {
                        console.log(`✅ Card ${card.id}: ${isRookie ? 'Rookie' : ''} ${isAutograph ? 'Auto' : ''}`);
                        updatedCount++;
                    }
                } catch (error) {
                    console.log(`❌ Error updating card ${card.id}: ${error.message}`);
                }
            }
            
            console.log(`\n📊 Migration complete!`);
            console.log(`   ✅ Updated ${updatedCount} cards with rookie/autograph flags`);
            console.log(`   📝 Total cards processed: ${cards.length}`);
            
        } catch (error) {
            console.error('❌ Error in migration:', error);
            throw error;
        }
    }

    // Detect if a card is a rookie card
    isRookieCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for rookie indicators
        const rookiePatterns = [
            /\brookie\b/gi,
            /\brc\b/gi,
            /\byg\b/gi,
            /\byoung guns\b/gi,
            /\b1st bowman\b/gi,
            /\bfirst bowman\b/gi,
            /\bdebut\b/gi
        ];
        
        return rookiePatterns.some(pattern => pattern.test(titleLower));
    }

    // Detect if a card is an autograph card
    isAutographCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for autograph indicators
        const autographPatterns = [
            /\bautograph\b/gi,
            /\bauto\b/gi,
            /\bon card autograph\b/gi,
            /\bon card auto\b/gi,
            /\bsticker autograph\b/gi,
            /\bsticker auto\b/gi
        ];
        
        return autographPatterns.some(pattern => pattern.test(titleLower));
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addMigrationRoute(app) {
    app.post('/api/admin/add-rookie-autograph-columns', async (req, res) => {
        try {
            console.log('🔄 Add rookie/autograph columns endpoint called');
            
            const migration = new DatabaseMigration();
            await migration.connect();
            await migration.addRookieAutographColumns();
            await migration.close();

            res.json({
                success: true,
                message: 'Rookie and autograph columns added successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in migration endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding rookie and autograph columns',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { DatabaseMigration, addMigrationRoute };
