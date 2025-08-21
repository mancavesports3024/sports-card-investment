const NewPricingDatabase = require('./create-new-pricing-database.js');

class IncorrectUnknownSportsFixer {
    constructor() {
        this.db = new NewPricingDatabase();
        this.fixedCount = 0;
        this.skippedCount = 0;
        this.errorCount = 0;
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async fixIncorrectUnknownSports() {
        console.log('🔄 Starting to fix cards incorrectly marked as Unknown sport...\n');
        
        try {
            // Get cards with Unknown sport that might be fixable
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, sport, player_name 
                FROM cards 
                WHERE sport = 'Unknown'
                ORDER BY id DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards with Unknown sport to analyze`);
            
            if (cards.length === 0) {
                console.log('🎉 No cards with Unknown sport found!');
                return;
            }
            
            for (const card of cards) {
                await this.analyzeAndFixCard(card);
                
                // Add a small delay between cards
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Error fixing incorrect unknown sports:', error);
            throw error;
        }
    }

    async analyzeAndFixCard(card) {
        try {
            console.log(`\n🎯 Analyzing: ${card.title}`);
            console.log(`   Player name: ${card.player_name}`);
            
            // Try to detect sport using multiple methods
            let detectedSport = null;
            
            // Method 1: Use keyword detection on title
            const keywordSport = this.db.detectSportFromKeywords(card.title);
            if (keywordSport && keywordSport !== 'Unknown') {
                detectedSport = keywordSport;
                console.log(`   ✅ Keyword detection: ${detectedSport}`);
            }
            
            // Method 2: If we have a player name, try ESPN API
            if (!detectedSport && card.player_name) {
                try {
                    const espnSport = await this.db.espnDetector.detectSportFromPlayer(card.player_name);
                    if (espnSport && espnSport !== 'Unknown') {
                        detectedSport = espnSport;
                        console.log(`   ✅ ESPN API: ${detectedSport}`);
                    }
                } catch (error) {
                    console.log(`   ⚠️ ESPN API failed: ${error.message}`);
                }
            }
            
            // Method 3: Use comprehensive detection
            if (!detectedSport) {
                try {
                    const comprehensiveSport = await this.db.detectSportFromComprehensive(card.title, card.player_name);
                    if (comprehensiveSport && comprehensiveSport !== 'Unknown') {
                        detectedSport = comprehensiveSport;
                        console.log(`   ✅ Comprehensive detection: ${detectedSport}`);
                    }
                } catch (error) {
                    console.log(`   ⚠️ Comprehensive detection failed: ${error.message}`);
                }
            }
            
            // Method 4: Manual analysis based on title keywords
            if (!detectedSport) {
                const manualSport = this.manualSportDetection(card.title, card.player_name);
                if (manualSport) {
                    detectedSport = manualSport;
                    console.log(`   ✅ Manual detection: ${detectedSport}`);
                }
            }
            
            console.log(`   Final detected sport: ${detectedSport || 'Still Unknown'}`);
            
            // Update the card if we found a valid sport
            if (detectedSport && detectedSport !== 'Unknown') {
                await this.db.runQuery(`
                    UPDATE cards 
                    SET sport = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [detectedSport, card.id]);
                
                console.log(`   ✅ Fixed: Unknown → ${detectedSport}`);
                this.fixedCount++;
            } else {
                console.log(`   ⏭️ Could not determine sport - leaving as Unknown`);
                this.skippedCount++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error analyzing card ${card.id}:`, error.message);
            this.errorCount++;
        }
    }

    manualSportDetection(title, playerName) {
        const titleLower = title.toLowerCase();
        const playerLower = playerName ? playerName.toLowerCase() : '';
        
        // Baseball indicators
        if (titleLower.includes('bowman') || titleLower.includes('topps') || titleLower.includes('mlb') || 
            titleLower.includes('baseball') || titleLower.includes('yankees') || titleLower.includes('red sox') ||
            titleLower.includes('dodgers') || titleLower.includes('cubs') || titleLower.includes('cardinals') ||
            titleLower.includes('mike trout') || titleLower.includes('shohei ohtani') || titleLower.includes('juan soto')) {
            return 'Baseball';
        }
        
        // Basketball indicators
        if (titleLower.includes('prizm') || titleLower.includes('mosaic') || titleLower.includes('nba') ||
            titleLower.includes('basketball') || titleLower.includes('lakers') || titleLower.includes('celtics') ||
            titleLower.includes('warriors') || titleLower.includes('lebron') || titleLower.includes('curry') ||
            titleLower.includes('giannis') || titleLower.includes('luka doncic')) {
            return 'Basketball';
        }
        
        // Football indicators
        if (titleLower.includes('panini') || titleLower.includes('nfl') || titleLower.includes('football') ||
            titleLower.includes('cowboys') || titleLower.includes('patriots') || titleLower.includes('packers') ||
            titleLower.includes('mahomes') || titleLower.includes('allen') || titleLower.includes('burrow') ||
            titleLower.includes('herbert') || titleLower.includes('jackson')) {
            return 'Football';
        }
        
        // Hockey indicators
        if (titleLower.includes('hockey') || titleLower.includes('nhl') || titleLower.includes('blackhawks') ||
            titleLower.includes('bruins') || titleLower.includes('rangers') || titleLower.includes('matthews') ||
            titleLower.includes('mcdavid') || titleLower.includes('draisaitl')) {
            return 'Hockey';
        }
        
        // Soccer indicators
        if (titleLower.includes('soccer') || titleLower.includes('fifa') || titleLower.includes('premier league') ||
            titleLower.includes('manchester') || titleLower.includes('barcelona') || titleLower.includes('messi') ||
            titleLower.includes('ronaldo') || titleLower.includes('mbappe')) {
            return 'Soccer';
        }
        
        // Racing indicators
        if (titleLower.includes('f1') || titleLower.includes('formula 1') || titleLower.includes('racing') ||
            titleLower.includes('norris') || titleLower.includes('verstappen') || titleLower.includes('hamilton')) {
            return 'Racing';
        }
        
        // UFC indicators
        if (titleLower.includes('ufc') || titleLower.includes('mma') || titleLower.includes('fighter') ||
            titleLower.includes('mcgregor') || titleLower.includes('jones') || titleLower.includes('chimaev')) {
            return 'UFC';
        }
        
        return null;
    }

    printSummary() {
        console.log('\n📊 Incorrect Unknown Sports Fix Summary');
        console.log('======================================');
        console.log(`✅ Cards fixed: ${this.fixedCount}`);
        console.log(`⏭️ Cards skipped: ${this.skippedCount}`);
        console.log(`❌ Errors: ${this.errorCount}`);
        console.log(`📈 Total processed: ${this.fixedCount + this.skippedCount + this.errorCount}`);
        
        if (this.fixedCount > 0) {
            console.log('\n🎉 Successfully fixed incorrect unknown sports!');
        } else {
            console.log('\nℹ️ No cards were fixed - all Unknown sports may be correct');
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addFixIncorrectUnknownSportsRoute(app) {
    app.post('/api/admin/fix-incorrect-unknown-sports', async (req, res) => {
        try {
            console.log('🔄 Fix incorrect unknown sports endpoint called');
            
            const fixer = new IncorrectUnknownSportsFixer();
            await fixer.connect();
            await fixer.fixIncorrectUnknownSports();
            await fixer.close();

            res.json({
                success: true,
                message: 'Incorrect unknown sports fix completed successfully',
                results: {
                    fixed: fixer.fixedCount,
                    skipped: fixer.skippedCount,
                    errors: fixer.errorCount,
                    totalProcessed: fixer.fixedCount + fixer.skippedCount + fixer.errorCount
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in fix incorrect unknown sports endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing incorrect unknown sports',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { IncorrectUnknownSportsFixer, addFixIncorrectUnknownSportsRoute };
