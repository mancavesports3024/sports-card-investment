const NewPricingDatabase = require('./create-new-pricing-database.js');

class TargetedPlayerNameFixes {
    constructor() {
        this.db = new NewPricingDatabase();
        
        // Only fix specific problematic patterns that we know from ESPN API failures
        this.specificFixes = [
            // Sport prefixes that should be removed from the beginning
            { pattern: /^wwe\s+/gi, replacement: '' },
            { pattern: /^wwf\s+/gi, replacement: '' },
            { pattern: /^formula\s+/gi, replacement: '' },
            { pattern: /^f1\s+/gi, replacement: '' },
            { pattern: /^wnba\s+/gi, replacement: '' },
            { pattern: /^nba\s+/gi, replacement: '' },
            { pattern: /^nfl\s+/gi, replacement: '' },
            { pattern: /^mlb\s+/gi, replacement: '' },
            { pattern: /^nhl\s+/gi, replacement: '' },
            { pattern: /^soccer\s+/gi, replacement: '' },
            { pattern: /^fifa\s+/gi, replacement: '' },
            { pattern: /^pga\s+/gi, replacement: '' },
            { pattern: /^ufc\s+/gi, replacement: '' },
            { pattern: /^mma\s+/gi, replacement: '' },
            { pattern: /^pokemon\s+/gi, replacement: '' },
            { pattern: /^pokémon\s+/gi, replacement: '' },
            
            // City names that should be removed from the end
            { pattern: /\s+chicago$/gi, replacement: '' },
            { pattern: /\s+detroit$/gi, replacement: '' },
            { pattern: /\s+denver$/gi, replacement: '' },
            { pattern: /\s+miami$/gi, replacement: '' },
            { pattern: /\s+new york$/gi, replacement: '' },
            { pattern: /\s+los angeles$/gi, replacement: '' },
            { pattern: /\s+boston$/gi, replacement: '' },
            { pattern: /\s+dallas$/gi, replacement: '' },
            { pattern: /\s+houston$/gi, replacement: '' },
            { pattern: /\s+phoenix$/gi, replacement: '' },
            { pattern: /\s+portland$/gi, replacement: '' },
            { pattern: /\s+sacramento$/gi, replacement: '' },
            { pattern: /\s+minneapolis$/gi, replacement: '' },
            { pattern: /\s+oklahoma city$/gi, replacement: '' },
            { pattern: /\s+salt lake city$/gi, replacement: '' },
            { pattern: /\s+memphis$/gi, replacement: '' },
            { pattern: /\s+new orleans$/gi, replacement: '' },
            { pattern: /\s+san antonio$/gi, replacement: '' },
            { pattern: /\s+orlando$/gi, replacement: '' },
            { pattern: /\s+atlanta$/gi, replacement: '' },
            { pattern: /\s+charlotte$/gi, replacement: '' },
            { pattern: /\s+washington$/gi, replacement: '' },
            { pattern: /\s+cleveland$/gi, replacement: '' },
            { pattern: /\s+indianapolis$/gi, replacement: '' },
            { pattern: /\s+milwaukee$/gi, replacement: '' },
            { pattern: /\s+philadelphia$/gi, replacement: '' },
            { pattern: /\s+brooklyn$/gi, replacement: '' },
            { pattern: /\s+toronto$/gi, replacement: '' },
            { pattern: /\s+montreal$/gi, replacement: '' },
            { pattern: /\s+vancouver$/gi, replacement: '' },
            { pattern: /\s+calgary$/gi, replacement: '' },
            { pattern: /\s+edmonton$/gi, replacement: '' },
            { pattern: /\s+winnipeg$/gi, replacement: '' },
            { pattern: /\s+ottawa$/gi, replacement: '' },
            { pattern: /\s+quebec$/gi, replacement: '' },
            { pattern: /\s+seattle$/gi, replacement: '' },
            { pattern: /\s+las vegas$/gi, replacement: '' },
            { pattern: /\s+nashville$/gi, replacement: '' },
            { pattern: /\s+columbus$/gi, replacement: '' },
            { pattern: /\s+pittsburgh$/gi, replacement: '' },
            { pattern: /\s+st louis$/gi, replacement: '' },
            { pattern: /\s+kansas city$/gi, replacement: '' },
            { pattern: /\s+cincinnati$/gi, replacement: '' },
            { pattern: /\s+baltimore$/gi, replacement: '' },
            { pattern: /\s+jacksonville$/gi, replacement: '' },
            { pattern: /\s+tampa bay$/gi, replacement: '' },
            { pattern: /\s+carolina$/gi, replacement: '' },
            { pattern: /\s+arizona$/gi, replacement: '' },
            { pattern: /\s+tennessee$/gi, replacement: '' },
            { pattern: /\s+colorado$/gi, replacement: '' },
            
            // Specific problematic terms from ESPN API failures
            { pattern: /\s+supernatural$/gi, replacement: '' },
            { pattern: /\s+pitching$/gi, replacement: '' },
            { pattern: /\s+catching$/gi, replacement: '' },
            { pattern: /\s+new$/gi, replacement: '' },
            { pattern: /\s+color$/gi, replacement: '' },
            { pattern: /\s+design$/gi, replacement: '' },
            { pattern: /\s+vision$/gi, replacement: '' },
            { pattern: /\s+explosive$/gi, replacement: '' },
            { pattern: /\s+buffaloes$/gi, replacement: '' },
            { pattern: /\s+usa$/gi, replacement: '' },
            { pattern: /\s+lewis$/gi, replacement: '' },
            { pattern: /\s+big$/gi, replacement: '' },
            { pattern: /\s+club$/gi, replacement: '' },
            { pattern: /\s+nix$/gi, replacement: '' },
            { pattern: /\s+liv$/gi, replacement: '' },
            { pattern: /\s+euro$/gi, replacement: '' },
            { pattern: /\s+warming$/gi, replacement: '' },
            { pattern: /\s+x2001$/gi, replacement: '' },
            { pattern: /\s+q0902$/gi, replacement: '' },
            { pattern: /\s+montana rice$/gi, replacement: '' },
            { pattern: /\s+ohtani judge$/gi, replacement: '' },
            { pattern: /\s+ja marr chase$/gi, replacement: '' },
            { pattern: /\s+booker$/gi, replacement: '' },
            { pattern: /\s+arda guler$/gi, replacement: '' },
            { pattern: /\s+esteban ocon$/gi, replacement: '' },
            { pattern: /\s+de von achane$/gi, replacement: '' },
            { pattern: /\s+spencer rattler$/gi, replacement: '' },
            { pattern: /\s+drake maye$/gi, replacement: '' },
            { pattern: /\s+shedeur sanders$/gi, replacement: '' },
            { pattern: /\s+ladd mcconkey$/gi, replacement: '' },
            { pattern: /\s+nikola jokic$/gi, replacement: '' },
            { pattern: /\s+vladimir guerrero$/gi, replacement: '' },
            { pattern: /\s+francisco lindor$/gi, replacement: '' },
            { pattern: /\s+wyatt langford$/gi, replacement: '' },
            { pattern: /\s+tom brady$/gi, replacement: '' },
            { pattern: /\s+tyranitar$/gi, replacement: '' },
            { pattern: /\s+hacksaw jim$/gi, replacement: '' },
            { pattern: /\s+nabers$/gi, replacement: '' },
            { pattern: /\s+victor wembanyama$/gi, replacement: '' },
            { pattern: /\s+david robinson$/gi, replacement: '' },
            { pattern: /\s+jacob misiorowski$/gi, replacement: '' },
            { pattern: /\s+julio rodriguez$/gi, replacement: '' },
            { pattern: /\s+roman reigns$/gi, replacement: '' },
            { pattern: /\s+kobe bryant michael$/gi, replacement: '' },
            { pattern: /\s+kris draper$/gi, replacement: '' },
            { pattern: /\s+walter payton$/gi, replacement: '' },
            { pattern: /\s+josh adamczewski$/gi, replacement: '' },
            { pattern: /\s+vladi guerrero$/gi, replacement: '' },
            { pattern: /\s+brooks koepka$/gi, replacement: '' },
            { pattern: /\s+bernabel$/gi, replacement: '' },
            { pattern: /\s+aaron judge catching$/gi, replacement: '' },
            { pattern: /\s+tyreek hill$/gi, replacement: '' },
            { pattern: /\s+shohei ohtani$/gi, replacement: '' },
            { pattern: /\s+charizard$/gi, replacement: '' },
            { pattern: /\s+barry sanders$/gi, replacement: '' },
            { pattern: /\s+cameron brink$/gi, replacement: '' },
            { pattern: /\s+bo nix$/gi, replacement: '' },
            { pattern: /\s+helmet heroes$/gi, replacement: '' },
            { pattern: /\s+stormfront$/gi, replacement: '' },
            { pattern: /\s+sword shield$/gi, replacement: '' },
            { pattern: /\s+aquapolis$/gi, replacement: '' },
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
            { pattern: /\s+color blast$/gi, replacement: '' },
            { pattern: /\s+tectonic$/gi, replacement: '' },
            { pattern: /\s+premium box set$/gi, replacement: '' },
            { pattern: /\s+winning ticket$/gi, replacement: '' },
            { pattern: /\s+focus$/gi, replacement: '' },
            { pattern: /\s+stadium$/gi, replacement: '' },
            { pattern: /\s+checkerboard$/gi, replacement: '' },
            { pattern: /\s+radiant$/gi, replacement: '' },
            { pattern: /\s+supernatural$/gi, replacement: '' },
            { pattern: /\s+storm chasers$/gi, replacement: '' },
            { pattern: /\s+storm-chasers$/gi, replacement: '' },
            { pattern: /\s+case hit$/gi, replacement: '' },
            { pattern: /\s+case-hit$/gi, replacement: '' },
            { pattern: /\s+case hits$/gi, replacement: '' },
            { pattern: /\s+case-hits$/gi, replacement: '' }
        ];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    applyTargetedFixes(playerName) {
        if (!playerName) return null;
        
        let fixedPlayerName = playerName;
        let needsUpdate = false;
        
        // Apply only the specific fixes we know are needed
        for (const fix of this.specificFixes) {
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

    async applyTargetedFixesToDatabase() {
        console.log('🎯 Applying targeted player name fixes...\n');
        
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
                    const fixedPlayerName = this.applyTargetedFixes(originalPlayerName);
                    
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
            
            console.log('\n📊 Targeted Player Name Fix Summary');
            console.log('==================================');
            console.log(`✅ Cards fixed: ${fixedCount}`);
            console.log(`⏭️ Cards unchanged: ${unchangedCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            console.log(`📈 Total processed: ${fixedCount + unchangedCount + errorCount}`);
            
        } catch (error) {
            console.error('❌ Error applying targeted fixes:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addTargetedPlayerNameFixesRoute(app) {
    app.post('/api/admin/apply-targeted-player-name-fixes', async (req, res) => {
        try {
            console.log('🎯 Applying targeted player name fixes...');
            
            const fixer = new TargetedPlayerNameFixes();
            await fixer.connect();
            await fixer.applyTargetedFixesToDatabase();
            await fixer.close();

            res.json({
                success: true,
                message: 'Targeted player name fixes completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error applying targeted player name fixes:', error);
            res.status(500).json({
                success: false,
                message: 'Error applying targeted player name fixes',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { TargetedPlayerNameFixes, addTargetedPlayerNameFixesRoute };
