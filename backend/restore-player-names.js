const NewPricingDatabase = require('./create-new-pricing-database.js');

class PlayerNameRestorer {
    constructor() {
        this.db = new NewPricingDatabase();
        
        // Known corrupted player names that need to be restored
        this.corruptedPlayerNames = [
            // Single names that are likely missing last names
            'Bo', 'Malik', 'Devin', 'Holo', 'Orange', 'Brady', 'Kobe', 'Jalen', 'Jared', 'Marco', 'Stephon',
            'Justin', 'Pete', 'Amon-Ra', 'Brock', 'Wyatt', 'Tom', 'Victor', 'David', 'Jacob', 'Julio',
            'Roman', 'Kris', 'Walter', 'Josh', 'Vladi', 'Brooks', 'Aaron', 'Tyreek', 'Shohei', 'Barry',
            'Cameron', 'Nikola', 'Vladimir', 'Francisco', 'Esteban', 'Spencer', 'Drake', 'Shedeur', 'Ladd',
            'Arda', 'De Von', 'Jayson', 'Tua', 'Randy', 'Keon', 'Deni', 'Tyson', 'Breece', 'J.J.', 'J J'
        ];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    isLikelyCorrupted(playerName) {
        if (!playerName) return false;
        
        // Check if it's a single name that's likely missing a last name
        const words = playerName.trim().split(' ');
        if (words.length === 1) {
            return this.corruptedPlayerNames.some(corrupted => 
                playerName.toLowerCase().includes(corrupted.toLowerCase())
            );
        }
        
        // Check for other obvious corruption patterns
        const lowerName = playerName.toLowerCase();
        return (
            lowerName === 'orange' ||
            lowerName === 'holo' ||
            lowerName === 'brady' ||
            lowerName === 'kobe' ||
            lowerName === 'jalen' ||
            lowerName === 'jared' ||
            lowerName === 'marco' ||
            lowerName === 'stephon' ||
            lowerName === 'justin' ||
            lowerName === 'pete' ||
            lowerName === 'amon-ra' ||
            lowerName === 'brock' ||
            lowerName === 'wyatt' ||
            lowerName === 'tom' ||
            lowerName === 'victor' ||
            lowerName === 'david' ||
            lowerName === 'jacob' ||
            lowerName === 'julio' ||
            lowerName === 'roman' ||
            lowerName === 'kris' ||
            lowerName === 'walter' ||
            lowerName === 'josh' ||
            lowerName === 'vladi' ||
            lowerName === 'brooks' ||
            lowerName === 'aaron' ||
            lowerName === 'tyreek' ||
            lowerName === 'shohei' ||
            lowerName === 'barry' ||
            lowerName === 'cameron' ||
            lowerName === 'nikola' ||
            lowerName === 'vladimir' ||
            lowerName === 'francisco' ||
            lowerName === 'esteban' ||
            lowerName === 'spencer' ||
            lowerName === 'drake' ||
            lowerName === 'shedeur' ||
            lowerName === 'ladd' ||
            lowerName === 'arda' ||
            lowerName === 'de von' ||
            lowerName === 'jayson' ||
            lowerName === 'tua' ||
            lowerName === 'randy' ||
            lowerName === 'keon' ||
            lowerName === 'deni' ||
            lowerName === 'tyson' ||
            lowerName === 'breece'
        );
    }

    async restorePlayerNames() {
        console.log('🔧 Restoring corrupted player names...\n');
        
        try {
            // Get all cards with potentially corrupted player names
            const cards = await this.db.allQuery(`
                SELECT id, title, player_name 
                FROM cards 
                ORDER BY id DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards to check`);
            
            let restoredCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;
            
            for (const card of cards) {
                try {
                    const originalPlayerName = card.player_name;
                    
                    // Check if the player name is likely corrupted
                    if (this.isLikelyCorrupted(originalPlayerName)) {
                        // Re-extract the player name from the original title using the original method
                        const restoredPlayerName = this.db.extractPlayerName(card.title);
                        
                        if (restoredPlayerName && restoredPlayerName !== originalPlayerName) {
                            await this.db.runQuery(`
                                UPDATE cards 
                                SET player_name = ?, last_updated = CURRENT_TIMESTAMP 
                                WHERE id = ?
                            `, [restoredPlayerName, card.id]);
                            
                            console.log(`✅ Restored: "${originalPlayerName}" → "${restoredPlayerName}"`);
                            restoredCount++;
                        } else {
                            unchangedCount++;
                        }
                    } else {
                        unchangedCount++;
                    }
                    
                    // Add a small delay
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log('\n📊 Player Name Restoration Summary');
            console.log('================================');
            console.log(`✅ Player names restored: ${restoredCount}`);
            console.log(`⏭️ Cards unchanged: ${unchangedCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            console.log(`📈 Total processed: ${restoredCount + unchangedCount + errorCount}`);
            
        } catch (error) {
            console.error('❌ Error restoring player names:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addPlayerNameRestorationRoute(app) {
    app.post('/api/admin/restore-player-names', async (req, res) => {
        try {
            console.log('🔧 Restoring corrupted player names...');
            
            const restorer = new PlayerNameRestorer();
            await restorer.connect();
            await restorer.restorePlayerNames();
            await restorer.close();

            res.json({
                success: true,
                message: 'Player name restoration completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error restoring player names:', error);
            res.status(500).json({
                success: false,
                message: 'Error restoring player names',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { PlayerNameRestorer, addPlayerNameRestorationRoute };
