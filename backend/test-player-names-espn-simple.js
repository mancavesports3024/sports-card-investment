const NewPricingDatabase = require('./create-new-pricing-database.js');

class ESPNPlayerNameValidator {
    constructor() {
        this.db = new NewPricingDatabase();
        this.problematicNames = [];
        this.validNames = [];
        this.testResults = [];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
        
        // Ensure the database and tables exist
        try {
            await this.db.createTables();
            console.log('✅ Database tables ensured');
        } catch (error) {
            console.log('⚠️ Tables may already exist, continuing...');
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }

    async testPlayerNameWithESPN(playerName) {
        try {
            // ESPN API endpoint for player search
            const url = 'https://site.web.api.espn.com/apis/search/v2';
            const params = new URLSearchParams({
                query: playerName,
                limit: '5',
                type: 'player'
            });

            const response = await fetch(`${url}?${params}`, { 
                method: 'GET'
            });
            
            if (!response.ok) {
                return {
                    isValid: false,
                    results: 0,
                    reason: `HTTP Error: ${response.status} ${response.statusText}`
                };
            }
            
            const data = await response.json();
            
            if (data && data.results && data.results.length > 0) {
                return {
                    isValid: true,
                    results: data.results.length,
                    firstResult: data.results[0]?.displayText || 'Unknown'
                };
            } else {
                return {
                    isValid: false,
                    results: 0,
                    reason: 'No results found'
                };
            }
        } catch (error) {
            return {
                isValid: false,
                results: 0,
                reason: `API Error: ${error.message}`
            };
        }
    }

    async testESPNConnection() {
        try {
            console.log('🔍 Testing ESPN API connection...');
            
            // Simple test with a known player
            const testResult = await this.testPlayerNameWithESPN('Tom Brady');
            
            console.log(`📊 ESPN API test result:`, testResult);
            
            if (testResult.isValid) {
                console.log('✅ ESPN API is working correctly');
                return true;
            } else {
                console.log('❌ ESPN API test failed:', testResult.reason);
                return false;
            }
        } catch (error) {
            console.error('❌ ESPN API connection test failed:', error);
            return false;
        }
    }

    async validatePlayerNames() {
        try {
            console.log('🔍 Validating player names with ESPN API...');
            
            // First, let's check what's in the database
            const totalQuery = `SELECT COUNT(*) as total FROM cards`;
            const totalResult = await this.db.db.get(totalQuery);
            console.log(`📊 Total cards in database: ${totalResult.total}`);
            
            // Check how many have player_name
            const playerNameQuery = `SELECT COUNT(*) as count FROM cards WHERE player_name IS NOT NULL AND player_name != ''`;
            const playerNameResult = await this.db.db.get(playerNameQuery);
            console.log(`📊 Cards with player_name: ${playerNameResult.count}`);
            
            if (playerNameResult.count === 0) {
                console.log('⚠️ No cards with player names found in database');
                return;
            }
            
            // Get player names from database
            const query = `SELECT DISTINCT player_name, title FROM cards WHERE player_name IS NOT NULL AND player_name != '' LIMIT 10`;
            const results = await this.db.db.all(query);
            
            console.log(`📊 Found ${results.length} unique player names to test`);
            
            if (results.length === 0) {
                console.log('⚠️ No player names found in database');
                return;
            }
            
            // Test each player name
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const playerName = result.player_name.trim();
                const title = result.title;
                
                console.log(`\n🔍 Testing ${i + 1}/${results.length}: "${playerName}" (from: "${title}")`);
                
                const testResult = await this.testPlayerNameWithESPN(playerName);
                
                const resultData = {
                    playerName: playerName,
                    title: title,
                    isValid: testResult.isValid,
                    results: testResult.results,
                    reason: testResult.reason || 'Valid player found',
                    firstResult: testResult.firstResult
                };
                
                this.testResults.push(resultData);
                
                if (testResult.isValid) {
                    this.validNames.push(playerName);
                    console.log(`✅ Valid: "${playerName}" - Found ${testResult.results} results`);
                    if (testResult.firstResult) {
                        console.log(`   First result: ${testResult.firstResult}`);
                    }
                } else {
                    this.problematicNames.push(playerName);
                    console.log(`❌ Invalid: "${playerName}" - ${testResult.reason}`);
                }
                
                // Small delay to be nice to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            this.generateSummary();
            
        } catch (error) {
            console.error('❌ Error validating player names:', error);
            throw error; // Re-throw to see the error in the response
        }
    }

    generateSummary() {
        console.log('\n📊 ESPN Player Name Validation Summary');
        console.log('=====================================');
        
        const total = this.testResults.length;
        const valid = this.validNames.length;
        const problematic = this.problematicNames.length;
        
        console.log(`✅ Valid player names: ${valid}`);
        console.log(`❌ Problematic player names: ${problematic}`);
        console.log(`📈 Total tested: ${total}`);
        
        if (problematic > 0) {
            console.log('\n❌ Problematic Player Names (No ESPN Results):');
            console.log('==============================================');
            this.problematicNames.forEach((name, index) => {
                const result = this.testResults.find(r => r.playerName === name);
                console.log(`${index + 1}. "${name}" (from: "${result.title}") - ${result.reason}`);
            });
            
            console.log('\n💡 These player names may need fixing:');
            console.log('- They return no results from ESPN API');
            console.log('- They might be card terms, team names, or other non-player text');
            console.log('- They might be misspelled or incomplete player names');
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Review the problematic names above');
        console.log('2. Identify patterns in the problematic names');
        console.log('3. Update player name extraction logic to filter out these patterns');
        console.log('4. Re-run this validation to verify improvements');
    }
}

// Route function for API endpoint
function addESPNValidationRoute(app) {
    app.post('/api/admin/validate-player-names-espn', async (req, res) => {
        try {
            console.log('🔍 Validating player names with ESPN API...');
            const validator = new ESPNPlayerNameValidator();
            await validator.connect();
            await validator.validatePlayerNames();
            await validator.close();
            
            res.json({ 
                success: true, 
                message: 'ESPN player name validation completed successfully',
                validCount: validator.validNames.length,
                problematicCount: validator.problematicNames.length,
                totalTested: validator.testResults.length,
                problematicNames: validator.problematicNames.map(name => {
                    const result = validator.testResults.find(r => r.playerName === name);
                    return {
                        name: name,
                        title: result.title,
                        reason: result.reason
                    };
                }),
                validNames: validator.validNames.slice(0, 10), // Show first 10 valid names
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error validating player names with ESPN:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error validating player names with ESPN', 
                error: error.message, 
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ESPNPlayerNameValidator, addESPNValidationRoute };
