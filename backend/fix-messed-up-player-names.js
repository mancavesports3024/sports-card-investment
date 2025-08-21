const NewPricingDatabase = require('./create-new-pricing-database.js');

class MessedUpPlayerNameFixer {
    constructor() {
        this.db = new NewPricingDatabase();
        
        // Known problematic changes that need to be reverted
        this.problematicChanges = [
            // Card brands/sets that were incorrectly kept as player names
            { pattern: /^Panini Level Devin$/, correct: 'Devin Booker' },
            { pattern: /^Panini Chronicles$/, correct: 'Justin Herbert' },
            { pattern: /^Panini #37 Brock$/, correct: 'Brock Purdy' },
            { pattern: /^Topps Purple$/, correct: 'Pete Alonso' },
            { pattern: /^Panini Donruss St\.$/, correct: 'Amon-Ra St. Brown' },
            { pattern: /^Panini Legend Marco$/, correct: 'Marco Van Basten' },
            { pattern: /^Score Bo Jackson$/, correct: 'Bo Jackson' },
            { pattern: /^Panini Jared Mccain$/, correct: 'Jared McCain' },
            { pattern: /^Graded 2024 Panini$/, correct: 'Stephon Castle' },
            { pattern: /^Topps 50\/50$/, correct: 'Shohei Ohtani' },
            { pattern: /^Panini Donruss Jalen$/, correct: 'Jalen Hurts' },
            
            // Common patterns that indicate the extraction went wrong
            { pattern: /^Panini\s+/, action: 'remove_prefix' },
            { pattern: /^Topps\s+/, action: 'remove_prefix' },
            { pattern: /^Score\s+/, action: 'remove_prefix' },
            { pattern: /^Upper Deck\s+/, action: 'remove_prefix' },
            { pattern: /^Fleer\s+/, action: 'remove_prefix' },
            { pattern: /^Donruss\s+/, action: 'remove_prefix' },
            { pattern: /^Bowman\s+/, action: 'remove_prefix' },
            { pattern: /^Leaf\s+/, action: 'remove_prefix' },
            { pattern: /^Skybox\s+/, action: 'remove_prefix' },
            { pattern: /^Pinnacle\s+/, action: 'remove_prefix' },
            { pattern: /^Stadium Club\s+/, action: 'remove_prefix' },
            { pattern: /^Finest\s+/, action: 'remove_prefix' },
            { pattern: /^Chrome\s+/, action: 'remove_prefix' },
            { pattern: /^Sapphire\s+/, action: 'remove_prefix' },
            { pattern: /^Prizm\s+/, action: 'remove_prefix' },
            { pattern: /^Mosaic\s+/, action: 'remove_prefix' },
            { pattern: /^Optic\s+/, action: 'remove_prefix' },
            { pattern: /^Select\s+/, action: 'remove_prefix' },
            { pattern: /^Update\s+/, action: 'remove_prefix' },
            { pattern: /^Refractor\s+/, action: 'remove_prefix' },
            { pattern: /^Rated\s+/, action: 'remove_prefix' },
            { pattern: /^Retro\s+/, action: 'remove_prefix' },
            { pattern: /^Choice\s+/, action: 'remove_prefix' },
            { pattern: /^Wave\s+/, action: 'remove_prefix' },
            { pattern: /^Scope\s+/, action: 'remove_prefix' },
            { pattern: /^Pulsar\s+/, action: 'remove_prefix' },
            { pattern: /^Genesis\s+/, action: 'remove_prefix' },
            { pattern: /^Firestorm\s+/, action: 'remove_prefix' },
            { pattern: /^Emergent\s+/, action: 'remove_prefix' },
            { pattern: /^Essentials\s+/, action: 'remove_prefix' },
            { pattern: /^Uptown\s+/, action: 'remove_prefix' },
            { pattern: /^Logo\s+/, action: 'remove_prefix' },
            { pattern: /^Lightboard\s+/, action: 'remove_prefix' },
            { pattern: /^Planetary\s+/, action: 'remove_prefix' },
            { pattern: /^Pursuit\s+/, action: 'remove_prefix' },
            { pattern: /^Mars\s+/, action: 'remove_prefix' },
            { pattern: /^Premium\s+/, action: 'remove_prefix' },
            { pattern: /^Box\s+/, action: 'remove_prefix' },
            { pattern: /^Set\s+/, action: 'remove_prefix' },
            { pattern: /^Pitch\s+/, action: 'remove_prefix' },
            { pattern: /^Prodigies\s+/, action: 'remove_prefix' },
            { pattern: /^Image\s+/, action: 'remove_prefix' },
            { pattern: /^Clear\s+/, action: 'remove_prefix' },
            { pattern: /^Cut\s+/, action: 'remove_prefix' },
            { pattern: /^Premier\s+/, action: 'remove_prefix' },
            { pattern: /^Young\s+/, action: 'remove_prefix' },
            { pattern: /^Guns\s+/, action: 'remove_prefix' },
            { pattern: /^Star\s+/, action: 'remove_prefix' },
            { pattern: /^Starquest\s+/, action: 'remove_prefix' },
            { pattern: /^Tint\s+/, action: 'remove_prefix' },
            { pattern: /^Pandora\s+/, action: 'remove_prefix' },
            { pattern: /^Allies\s+/, action: 'remove_prefix' },
            { pattern: /^Apex\s+/, action: 'remove_prefix' },
            { pattern: /^On\s+/, action: 'remove_prefix' },
            { pattern: /^Iconic\s+/, action: 'remove_prefix' },
            { pattern: /^Knows\s+/, action: 'remove_prefix' },
            { pattern: /^Classic\s+/, action: 'remove_prefix' },
            { pattern: /^Events\s+/, action: 'remove_prefix' },
            { pattern: /^Edition\s+/, action: 'remove_prefix' },
            { pattern: /^CC\s+/, action: 'remove_prefix' },
            { pattern: /^Mint2\s+/, action: 'remove_prefix' },
            { pattern: /^Kellogg\s+/, action: 'remove_prefix' },
            { pattern: /^ATL\s+/, action: 'remove_prefix' },
            { pattern: /^Colorado\s+/, action: 'remove_prefix' },
            { pattern: /^Picks\s+/, action: 'remove_prefix' },
            { pattern: /^Sky\s+/, action: 'remove_prefix' },
            { pattern: /^Winning Ticket\s+/, action: 'remove_prefix' },
            { pattern: /^Focus\s+/, action: 'remove_prefix' },
            { pattern: /^Stadium\s+/, action: 'remove_prefix' },
            { pattern: /^Checkerboard\s+/, action: 'remove_prefix' },
            { pattern: /^Radiant\s+/, action: 'remove_prefix' },
            { pattern: /^Supernatural\s+/, action: 'remove_prefix' },
            { pattern: /^Royalty\s+/, action: 'remove_prefix' },
            { pattern: /^Hoops\s+/, action: 'remove_prefix' },
            { pattern: /^Concourse\s+/, action: 'remove_prefix' },
            { pattern: /^Huddle\s+/, action: 'remove_prefix' },
            { pattern: /^Design\s+/, action: 'remove_prefix' },
            { pattern: /^Color\s+/, action: 'remove_prefix' },
            { pattern: /^Premium Box Set\s+/, action: 'remove_prefix' },
            { pattern: /^Tectonic\s+/, action: 'remove_prefix' },
            { pattern: /^Euro\s+/, action: 'remove_prefix' },
            { pattern: /^Heritage\s+/, action: 'remove_prefix' },
            { pattern: /^Collection\s+/, action: 'remove_prefix' },
            { pattern: /^Composite\s+/, action: 'remove_prefix' },
            { pattern: /^Japanese\s+/, action: 'remove_prefix' },
            { pattern: /^Stormfront\s+/, action: 'remove_prefix' },
            { pattern: /^Aquapolis\s+/, action: 'remove_prefix' },
            { pattern: /^Sword Shield\s+/, action: 'remove_prefix' },
            { pattern: /^Hacksaw\s+/, action: 'remove_prefix' },
            { pattern: /^Color Blast\s+/, action: 'remove_prefix' },
            { pattern: /^David Robinson\s+/, action: 'remove_prefix' },
            { pattern: /^Tyreek Hill\s+/, action: 'remove_prefix' },
            { pattern: /^Pitching\s+/, action: 'remove_prefix' },
            { pattern: /^Speckle\s+/, action: 'remove_prefix' },
            { pattern: /^Miami\s+/, action: 'remove_prefix' },
            { pattern: /^Montana Rice\s+/, action: 'remove_prefix' },
            { pattern: /^Ohtani Judge\s+/, action: 'remove_prefix' },
            { pattern: /^Ja Marr Chase\s+/, action: 'remove_prefix' },
            { pattern: /^Booker\s+/, action: 'remove_prefix' },
            { pattern: /^Arda Guler\s+/, action: 'remove_prefix' },
            { pattern: /^Esteban Ocon\s+/, action: 'remove_prefix' },
            { pattern: /^De Von Achane\s+/, action: 'remove_prefix' },
            { pattern: /^Spencer Rattler\s+/, action: 'remove_prefix' },
            { pattern: /^Drake Maye\s+/, action: 'remove_prefix' },
            { pattern: /^Shedeur Sanders\s+/, action: 'remove_prefix' },
            { pattern: /^X2001 Helmet Heroes\s+/, action: 'remove_prefix' },
            { pattern: /^Ladd Mcconkey\s+/, action: 'remove_prefix' },
            { pattern: /^Overdrive\s+/, action: 'remove_prefix' },
            { pattern: /^Vladimir Guerrero\s+/, action: 'remove_prefix' },
            { pattern: /^Francisco Lindor\s+/, action: 'remove_prefix' },
            { pattern: /^Wyatt Langford\s+/, action: 'remove_prefix' },
            { pattern: /^Tom Brady\s+/, action: 'remove_prefix' },
            { pattern: /^Tyranitar\s+/, action: 'remove_prefix' },
            { pattern: /^Nabers\s+/, action: 'remove_prefix' },
            { pattern: /^Victor Wembanyama\s+/, action: 'remove_prefix' },
            { pattern: /^Jacob Misiorowski\s+/, action: 'remove_prefix' },
            { pattern: /^Julio Rodriguez\s+/, action: 'remove_prefix' },
            { pattern: /^Roman Reigns\s+/, action: 'remove_prefix' },
            { pattern: /^Kobe Bryant Michael\s+/, action: 'remove_prefix' },
            { pattern: /^Kris Draper\s+/, action: 'remove_prefix' },
            { pattern: /^Walter Payton\s+/, action: 'remove_prefix' },
            { pattern: /^Josh Adamczewski\s+/, action: 'remove_prefix' },
            { pattern: /^Vladi Guerrero\s+/, action: 'remove_prefix' },
            { pattern: /^Brooks Koepka\s+/, action: 'remove_prefix' },
            { pattern: /^Bernabel\s+/, action: 'remove_prefix' },
            { pattern: /^Aaron Judge Catching\s+/, action: 'remove_prefix' },
            { pattern: /^Charizard\s+/, action: 'remove_prefix' },
            { pattern: /^Barry Sanders\s+/, action: 'remove_prefix' },
            { pattern: /^Cameron Brink\s+/, action: 'remove_prefix' },
            { pattern: /^Bo Nix\s+/, action: 'remove_prefix' },
            { pattern: /^Lewis\s+/, action: 'remove_prefix' },
            { pattern: /^Tom\s+/, action: 'remove_prefix' },
            { pattern: /^USA\s+/, action: 'remove_prefix' },
            { pattern: /^Denver\s+/, action: 'remove_prefix' },
            { pattern: /^New York\s+/, action: 'remove_prefix' },
            { pattern: /^Los Angeles\s+/, action: 'remove_prefix' },
            { pattern: /^Boston\s+/, action: 'remove_prefix' },
            { pattern: /^Dallas\s+/, action: 'remove_prefix' },
            { pattern: /^Houston\s+/, action: 'remove_prefix' },
            { pattern: /^Phoenix\s+/, action: 'remove_prefix' },
            { pattern: /^Portland\s+/, action: 'remove_prefix' },
            { pattern: /^Sacramento\s+/, action: 'remove_prefix' },
            { pattern: /^Minneapolis\s+/, action: 'remove_prefix' },
            { pattern: /^Oklahoma City\s+/, action: 'remove_prefix' },
            { pattern: /^Salt Lake City\s+/, action: 'remove_prefix' },
            { pattern: /^Memphis\s+/, action: 'remove_prefix' },
            { pattern: /^New Orleans\s+/, action: 'remove_prefix' },
            { pattern: /^San Antonio\s+/, action: 'remove_prefix' },
            { pattern: /^Orlando\s+/, action: 'remove_prefix' },
            { pattern: /^Atlanta\s+/, action: 'remove_prefix' },
            { pattern: /^Charlotte\s+/, action: 'remove_prefix' },
            { pattern: /^Washington\s+/, action: 'remove_prefix' },
            { pattern: /^Cleveland\s+/, action: 'remove_prefix' },
            { pattern: /^Indianapolis\s+/, action: 'remove_prefix' },
            { pattern: /^Milwaukee\s+/, action: 'remove_prefix' },
            { pattern: /^Philadelphia\s+/, action: 'remove_prefix' },
            { pattern: /^Brooklyn\s+/, action: 'remove_prefix' },
            { pattern: /^Toronto\s+/, action: 'remove_prefix' },
            { pattern: /^Montreal\s+/, action: 'remove_prefix' },
            { pattern: /^Vancouver\s+/, action: 'remove_prefix' },
            { pattern: /^Calgary\s+/, action: 'remove_prefix' },
            { pattern: /^Edmonton\s+/, action: 'remove_prefix' },
            { pattern: /^Winnipeg\s+/, action: 'remove_prefix' },
            { pattern: /^Ottawa\s+/, action: 'remove_prefix' },
            { pattern: /^Quebec\s+/, action: 'remove_prefix' },
            { pattern: /^Seattle\s+/, action: 'remove_prefix' },
            { pattern: /^Las Vegas\s+/, action: 'remove_prefix' },
            { pattern: /^Nashville\s+/, action: 'remove_prefix' },
            { pattern: /^Columbus\s+/, action: 'remove_prefix' },
            { pattern: /^Pittsburgh\s+/, action: 'remove_prefix' },
            { pattern: /^St Louis\s+/, action: 'remove_prefix' },
            { pattern: /^Kansas City\s+/, action: 'remove_prefix' },
            { pattern: /^Cincinnati\s+/, action: 'remove_prefix' },
            { pattern: /^Baltimore\s+/, action: 'remove_prefix' },
            { pattern: /^Jacksonville\s+/, action: 'remove_prefix' },
            { pattern: /^Tampa Bay\s+/, action: 'remove_prefix' },
            { pattern: /^Carolina\s+/, action: 'remove_prefix' },
            { pattern: /^Arizona\s+/, action: 'remove_prefix' },
            { pattern: /^Tennessee\s+/, action: 'remove_prefix' },
            { pattern: /^Colorado\s+/, action: 'remove_prefix' },
            { pattern: /^Atlanta\s+/, action: 'remove_prefix' },
            { pattern: /^Big\s+/, action: 'remove_prefix' },
            { pattern: /^Club\s+/, action: 'remove_prefix' },
            { pattern: /^Nix\s+/, action: 'remove_prefix' },
            { pattern: /^Liv\s+/, action: 'remove_prefix' },
            { pattern: /^Warming\s+/, action: 'remove_prefix' },
            { pattern: /^X2001\s+/, action: 'remove_prefix' },
            { pattern: /^Q0902\s+/, action: 'remove_prefix' },
            { pattern: /^Buffaloes\s+/, action: 'remove_prefix' },
            { pattern: /^Helmet Heroes\s+/, action: 'remove_prefix' },
            { pattern: /^Vision\s+/, action: 'remove_prefix' },
            { pattern: /^Explosive\s+/, action: 'remove_prefix' },
            { pattern: /^New\s+/, action: 'remove_prefix' },
            { pattern: /^Catching\s+/, action: 'remove_prefix' },
            { pattern: /^Hitting\s+/, action: 'remove_prefix' },
            { pattern: /^Batting\s+/, action: 'remove_prefix' },
            { pattern: /^Fielding\s+/, action: 'remove_prefix' },
            { pattern: /^Running\s+/, action: 'remove_prefix' },
            { pattern: /^Throwing\s+/, action: 'remove_prefix' },
            { pattern: /^Swinging\s+/, action: 'remove_prefix' },
            { pattern: /^Dunking\s+/, action: 'remove_prefix' },
            { pattern: /^Shooting\s+/, action: 'remove_prefix' },
            { pattern: /^Passing\s+/, action: 'remove_prefix' },
            { pattern: /^Rushing\s+/, action: 'remove_prefix' },
            { pattern: /^Tackling\s+/, action: 'remove_prefix' },
            { pattern: /^Blocking\s+/, action: 'remove_prefix' },
            { pattern: /^Kicking\s+/, action: 'remove_prefix' },
            { pattern: /^Scoring\s+/, action: 'remove_prefix' },
            { pattern: /^Defending\s+/, action: 'remove_prefix' },
            { pattern: /^Attacking\s+/, action: 'remove_prefix' },
            { pattern: /^Goalie\s+/, action: 'remove_prefix' },
            { pattern: /^Goaltender\s+/, action: 'remove_prefix' },
            { pattern: /^Defenseman\s+/, action: 'remove_prefix' },
            { pattern: /^Forward\s+/, action: 'remove_prefix' },
            { pattern: /^Center\s+/, action: 'remove_prefix' },
            { pattern: /^Guard\s+/, action: 'remove_prefix' },
            { pattern: /^Quarterback\s+/, action: 'remove_prefix' },
            { pattern: /^Running Back\s+/, action: 'remove_prefix' },
            { pattern: /^Wide Receiver\s+/, action: 'remove_prefix' },
            { pattern: /^Tight End\s+/, action: 'remove_prefix' },
            { pattern: /^Linebacker\s+/, action: 'remove_prefix' },
            { pattern: /^Cornerback\s+/, action: 'remove_prefix' },
            { pattern: /^Safety\s+/, action: 'remove_prefix' },
            { pattern: /^Pitcher\s+/, action: 'remove_prefix' },
            { pattern: /^Catcher\s+/, action: 'remove_prefix' },
            { pattern: /^Shortstop\s+/, action: 'remove_prefix' },
            { pattern: /^First Base\s+/, action: 'remove_prefix' },
            { pattern: /^Second Base\s+/, action: 'remove_prefix' },
            { pattern: /^Third Base\s+/, action: 'remove_prefix' },
            { pattern: /^Outfielder\s+/, action: 'remove_prefix' },
            { pattern: /^Infielder\s+/, action: 'remove_prefix' },
            { pattern: /^Designated Hitter\s+/, action: 'remove_prefix' },
            { pattern: /^DH\s+/, action: 'remove_prefix' },
            { pattern: /^Rookie\s+/, action: 'remove_prefix' },
            { pattern: /^RC\s+/, action: 'remove_prefix' },
            { pattern: /^Veteran\s+/, action: 'remove_prefix' },
            { pattern: /^All Star\s+/, action: 'remove_prefix' },
            { pattern: /^MVP\s+/, action: 'remove_prefix' },
            { pattern: /^Champion\s+/, action: 'remove_prefix' },
            { pattern: /^Winner\s+/, action: 'remove_prefix' }
        ];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    fixPlayerName(playerName) {
        if (!playerName) return null;
        
        // First check for exact matches that need specific corrections
        for (const fix of this.problematicChanges) {
            if (fix.pattern.test(playerName)) {
                if (fix.correct) {
                    return fix.correct;
                } else if (fix.action === 'remove_prefix') {
                    // Remove the problematic prefix and clean up
                    const cleaned = playerName.replace(fix.pattern, '').trim();
                    return cleaned || null;
                }
            }
        }
        
        // If no specific fix found, return original
        return playerName;
    }

    async fixMessedUpPlayerNames() {
        console.log('🔧 Fixing messed up player names...\n');
        
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
                    const fixedPlayerName = this.fixPlayerName(originalPlayerName);
                    
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
            
            console.log('\n📊 Player Name Fix Summary');
            console.log('==========================');
            console.log(`✅ Cards fixed: ${fixedCount}`);
            console.log(`⏭️ Cards unchanged: ${unchangedCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            console.log(`📈 Total processed: ${fixedCount + unchangedCount + errorCount}`);
            
        } catch (error) {
            console.error('❌ Error fixing player names:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addFixMessedUpPlayerNamesRoute(app) {
    app.post('/api/admin/fix-messed-up-player-names', async (req, res) => {
        try {
            console.log('🔧 Fixing messed up player names...');
            
            const fixer = new MessedUpPlayerNameFixer();
            await fixer.connect();
            await fixer.fixMessedUpPlayerNames();
            await fixer.close();

            res.json({
                success: true,
                message: 'Messed up player names fix completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error fixing messed up player names:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing messed up player names',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { MessedUpPlayerNameFixer, addFixMessedUpPlayerNamesRoute };
