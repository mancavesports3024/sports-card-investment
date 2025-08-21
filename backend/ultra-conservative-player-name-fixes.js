const NewPricingDatabase = require('./create-new-pricing-database.js');

class UltraConservativePlayerNameFixes {
    constructor() {
        this.db = new NewPricingDatabase();
        
        // Only fix the most obvious problematic patterns that are clearly NOT player names
        // These must be standalone terms, not part of actual player names
        this.ultraConservativeFixes = [
            // Sport prefixes that should be removed from the beginning ONLY
            { pattern: /^wwe\s+/gi, replacement: '' },
            { pattern: /^wwf\s+/gi, replacement: '' },
            { pattern: /^formula\s+/gi, replacement: '' },
            { pattern: /^f1\s+/gi, replacement: '' },
            { pattern: /^pokemon\s+/gi, replacement: '' },
            { pattern: /^pokémon\s+/gi, replacement: '' },
            
            // Card descriptions that should be removed from the end ONLY
            { pattern: /\s+supernatural$/gi, replacement: '' },
            { pattern: /\s+pitching$/gi, replacement: '' },
            { pattern: /\s+catching$/gi, replacement: '' },
            { pattern: /\s+storm chasers$/gi, replacement: '' },
            { pattern: /\s+storm-chasers$/gi, replacement: '' },
            { pattern: /\s+case hit$/gi, replacement: '' },
            { pattern: /\s+case-hit$/gi, replacement: '' },
            { pattern: /\s+case hits$/gi, replacement: '' },
            { pattern: /\s+case-hits$/gi, replacement: '' },
            { pattern: /\s+winning ticket$/gi, replacement: '' },
            { pattern: /\s+focus$/gi, replacement: '' },
            { pattern: /\s+stormfront$/gi, replacement: '' },
            { pattern: /\s+sword shield$/gi, replacement: '' },
            { pattern: /\s+aquapolis$/gi, replacement: '' },
            { pattern: /\s+helmet heroes$/gi, replacement: '' },
            { pattern: /\s+color blast$/gi, replacement: '' },
            { pattern: /\s+premium box set$/gi, replacement: '' },
            { pattern: /\s+montana rice$/gi, replacement: '' },
            { pattern: /\s+ohtani judge$/gi, replacement: '' },
            { pattern: /\s+ja marr chase$/gi, replacement: '' },
            { pattern: /\s+kobe bryant michael$/gi, replacement: '' },
            { pattern: /\s+aaron judge catching$/gi, replacement: '' },
            
            // Specific alphanumeric codes that are clearly not player names
            { pattern: /\s+x2001$/gi, replacement: '' },
            { pattern: /\s+q0902$/gi, replacement: '' },
            { pattern: /\s+lewis$/gi, replacement: '' },
            { pattern: /\s+liv$/gi, replacement: '' },
            { pattern: /\s+euro$/gi, replacement: '' },
            { pattern: /\s+warming$/gi, replacement: '' },
            { pattern: /\s+usa$/gi, replacement: '' },
            { pattern: /\s+big$/gi, replacement: '' },
            { pattern: /\s+club$/gi, replacement: '' },
            { pattern: /\s+bernabel$/gi, replacement: '' },
            { pattern: /\s+charizard$/gi, replacement: '' },
            { pattern: /\s+tyranitar$/gi, replacement: '' },
            { pattern: /\s+buffaloes$/gi, replacement: '' },
            { pattern: /\s+explosive$/gi, replacement: '' },
            { pattern: /\s+vision$/gi, replacement: '' },
            { pattern: /\s+design$/gi, replacement: '' },
            { pattern: /\s+color$/gi, replacement: '' },
            { pattern: /\s+new$/gi, replacement: '' },
            { pattern: /\s+japanese$/gi, replacement: '' },
            { pattern: /\s+composite$/gi, replacement: '' },
            { pattern: /\s+heritage$/gi, replacement: '' },
            { pattern: /\s+collection$/gi, replacement: '' },
            { pattern: /\s+overdrive$/gi, replacement: '' },
            { pattern: /\s+royalty$/gi, replacement: '' },
            { pattern: /\s+hoops$/gi, replacement: '' },
            { pattern: /\s+concourse$/gi, replacement: '' },
            { pattern: /\s+huddle$/gi, replacement: '' },
            { pattern: /\s+speckle$/gi, replacement: '' },
            { pattern: /\s+tectonic$/gi, replacement: '' },
            { pattern: /\s+stadium$/gi, replacement: '' },
            { pattern: /\s+checkerboard$/gi, replacement: '' },
            { pattern: /\s+radiant$/gi, replacement: '' }
            
            // REMOVED: 'nix', 'nabers', 'booker' - these are part of actual player names!
        ];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    applyUltraConservativeFixes(playerName) {
        if (!playerName) return null;
        
        let fixedPlayerName = playerName;
        let needsUpdate = false;
        
        // Apply only the ultra-conservative fixes
        for (const fix of this.ultraConservativeFixes) {
            if (fix.pattern.test(fixedPlayerName)) {
                fixedPlayerName = fixedPlayerName.replace(fix.pattern, fix.replacement);
                needsUpdate = true;
            }
        }
        
        // Clean up extra spaces
        fixedPlayerName = fixedPlayerName.replace(/\s+/g, ' ').trim();
        
        // Only return the fixed version if it's different and still valid
        if (needsUpdate && fixedPlayerName.length > 0) {
            return this.db.capitalizePlayerName(fixedPlayerName);
        }
        
        // Return original if no changes needed
        return playerName;
    }

    async applyUltraConservativeFixesToDatabase() {
        console.log('🎯 Applying ultra-conservative player name fixes...\n');
        
        try {
            // Get all cards
            const cards = await this.db.allQuery(`
                SELECT id, title, player_name 
                FROM cards 
                ORDER BY id DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards to check`);
            
            let fixedCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;
            
            for (const card of cards) {
                try {
                    const originalPlayerName = card.player_name;
                    const fixedPlayerName = this.applyUltraConservativeFixes(originalPlayerName);
                    
                    if (fixedPlayerName && fixedPlayerName !== originalPlayerName) {
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET player_name = ?, last_updated = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `, [fixedPlayerName, card.id]);
                        
                        console.log(`✅ Fixed: "${originalPlayerName}" → "${fixedPlayerName}"`);
                        fixedCount++;
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
            
            console.log('\n📊 Ultra-Conservative Player Name Fix Summary');
            console.log('=============================================');
            console.log(`✅ Cards fixed: ${fixedCount}`);
            console.log(`⏭️ Cards unchanged: ${unchangedCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            console.log(`📈 Total processed: ${fixedCount + unchangedCount + errorCount}`);
            
        } catch (error) {
            console.error('❌ Error applying ultra-conservative fixes:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addUltraConservativePlayerNameFixesRoute(app) {
    app.post('/api/admin/apply-ultra-conservative-player-name-fixes', async (req, res) => {
        try {
            console.log('🎯 Applying ultra-conservative player name fixes...');
            
            const fixer = new UltraConservativePlayerNameFixes();
            await fixer.connect();
            await fixer.applyUltraConservativeFixesToDatabase();
            await fixer.close();

            res.json({
                success: true,
                message: 'Ultra-conservative player name fixes completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error applying ultra-conservative player name fixes:', error);
            res.status(500).json({
                success: false,
                message: 'Error applying ultra-conservative player name fixes',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { UltraConservativePlayerNameFixes, addUltraConservativePlayerNameFixesRoute };
