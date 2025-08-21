const NewPricingDatabase = require('./create-new-pricing-database.js');

class PlayerNameVerifier {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async verifyPlayerNames() {
        console.log('🔍 Verifying current player names...\n');
        
        try {
            // Get a sample of cards to check
            const cards = await this.db.allQuery(`
                SELECT id, title, player_name 
                FROM cards 
                ORDER BY id DESC
                LIMIT 50
            `);
            
            console.log(`📊 Checking ${cards.length} sample cards\n`);
            
            let goodCount = 0;
            let suspiciousCount = 0;
            let examples = [];
            
            for (const card of cards) {
                const playerName = card.player_name;
                const title = card.title;
                
                // Check for suspicious patterns
                const isSuspicious = this.isSuspiciousPlayerName(playerName);
                
                if (isSuspicious) {
                    suspiciousCount++;
                    examples.push({
                        id: card.id,
                        playerName: playerName,
                        title: title.substring(0, 100) + '...'
                    });
                } else {
                    goodCount++;
                }
            }
            
            console.log('📊 Player Name Verification Summary');
            console.log('================================');
            console.log(`✅ Good player names: ${goodCount}`);
            console.log(`⚠️ Suspicious player names: ${suspiciousCount}`);
            console.log(`📈 Total checked: ${goodCount + suspiciousCount}`);
            
            if (examples.length > 0) {
                console.log('\n⚠️ Examples of suspicious player names:');
                console.log('=====================================');
                examples.slice(0, 10).forEach(example => {
                    console.log(`ID ${example.id}: "${example.playerName}"`);
                    console.log(`   Title: ${example.title}`);
                    console.log('');
                });
            }
            
            // Also check for specific known issues
            console.log('\n🔍 Checking for specific known issues...');
            await this.checkSpecificIssues();
            
        } catch (error) {
            console.error('❌ Error verifying player names:', error);
            throw error;
        }
    }

    isSuspiciousPlayerName(playerName) {
        if (!playerName) return true;
        
        const lowerName = playerName.toLowerCase();
        
        // Single names that are likely incomplete
        const singleNames = ['bo', 'malik', 'devin', 'holo', 'orange', 'brady', 'kobe', 'jalen', 'jared', 'marco', 'stephon', 'justin', 'pete', 'amon-ra', 'brock', 'wyatt', 'tom', 'victor', 'david', 'jacob', 'julio', 'roman', 'kris', 'walter', 'josh', 'vladi', 'brooks', 'aaron', 'tyreek', 'shohei', 'barry', 'cameron', 'nikola', 'vladimir', 'francisco', 'esteban', 'spencer', 'drake', 'shedeur', 'ladd', 'arda', 'de von', 'jayson', 'tua', 'randy', 'keon', 'deni', 'tyson', 'breece'];
        
        // Check if it's a single suspicious name
        if (singleNames.includes(lowerName)) {
            return true;
        }
        
        // Check for other suspicious patterns
        return (
            lowerName === 'orange' ||
            lowerName === 'holo' ||
            lowerName.length < 3 ||
            /^[a-z]+$/.test(lowerName) && lowerName.length < 5
        );
    }

    async checkSpecificIssues() {
        try {
            // Check for specific problematic patterns
            const issues = [
                { pattern: 'bo', description: 'Single "Bo" (should be "Bo Nix")' },
                { pattern: 'malik', description: 'Single "Malik" (should be "Malik Nabers")' },
                { pattern: 'devin', description: 'Single "Devin" (should be "Devin Booker")' },
                { pattern: 'holo', description: 'Single "Holo" (should be "Tyranitar")' },
                { pattern: 'orange', description: 'Single "Orange" (likely wrong)' },
                { pattern: 'brady', description: 'Single "Brady" (should be "Tom Brady")' }
            ];
            
            for (const issue of issues) {
                const cards = await this.db.allQuery(`
                    SELECT COUNT(*) as count 
                    FROM cards 
                    WHERE LOWER(player_name) = ?
                `, [issue.pattern]);
                
                const count = cards[0].count;
                if (count > 0) {
                    console.log(`⚠️ Found ${count} cards with "${issue.description}"`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error checking specific issues:', error);
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addPlayerNameVerificationRoute(app) {
    app.post('/api/admin/verify-player-names', async (req, res) => {
        try {
            console.log('🔍 Verifying player names...');
            
            const verifier = new PlayerNameVerifier();
            await verifier.connect();
            await verifier.verifyPlayerNames();
            await verifier.close();

            res.json({
                success: true,
                message: 'Player name verification completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error verifying player names:', error);
            res.status(500).json({
                success: false,
                message: 'Error verifying player names',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { PlayerNameVerifier, addPlayerNameVerificationRoute };
