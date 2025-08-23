const NewPricingDatabase = require('./create-new-pricing-database.js');
const axios = require('axios');

class PlayerNameAnalyzer {
    constructor() {
        this.db = new NewPricingDatabase();
        this.problematicNames = [];
        this.analysisResults = [];
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
            console.log(`🔍 Testing ESPN API for: "${playerName}"`);
            
            // ESPN API endpoint for player search
            const url = 'https://site.web.api.espn.com/apis/search/v2';
            const params = new URLSearchParams({
                query: playerName,
                limit: '5',
                type: 'player'
            });

            console.log(`🌐 ESPN API URL: ${url}?${params}`);
            const response = await axios.get(`${url}?${params}`);
            
            if (response.status !== 200) {
                return {
                    isValid: false,
                    results: 0,
                    reason: `HTTP Error: ${response.status} ${response.statusText}`
                };
            }
            
            const data = response.data;
            
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

    async diagnoseDatabase() {
        try {
            console.log('🔍 Diagnosing database...');
            
            // Check what tables exist
            const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table'`;
            const tables = await this.db.allQuery(tablesQuery);
            console.log('📋 Tables in database:', tables.map(t => t.name));
            
            // Check if cards table exists
            if (tables.some(t => t.name === 'cards')) {
                console.log('✅ Cards table exists');
                
                // Check table structure
                const structureQuery = `PRAGMA table_info(cards)`;
                const structure = await this.db.allQuery(structureQuery);
                console.log('📋 Cards table structure:', structure.map(col => `${col.name} (${col.type})`));
                
                // Check total count
                const countQuery = `SELECT COUNT(*) as total FROM cards`;
                const countResult = await this.db.getQuery(countQuery);
                console.log(`📊 Total cards: ${countResult.total}`);
                
                // Check for any player_name values
                const playerNameQuery = `SELECT player_name FROM cards WHERE player_name IS NOT NULL LIMIT 5`;
                const playerNames = await this.db.allQuery(playerNameQuery);
                console.log(`📊 Sample player names:`, playerNames.map(p => p.player_name));
                
            } else {
                console.log('❌ Cards table does not exist');
            }
            
        } catch (error) {
            console.error('❌ Database diagnosis failed:', error);
        }
    }

    isLikelyProblematic(playerName) {
        if (!playerName || playerName.trim().length < 2) return { isProblematic: true, reason: 'Empty or too short' };
        
        const name = playerName.trim().toLowerCase();
        
        // Check for obvious non-player terms (updated)
        const nonPlayerTerms = [
            'base', 'parallel', 'chrome', 'prizm', 'optic', 'select', 'donruss', 'topps',
            'panini', 'fleer', 'upper deck', 'bowman', 'heritage', 'gallery', 'museum',
            'contenders', 'prestige', 'score', 'absolute', 'limited', 'threads',
            'rookie', 'auto', 'autograph', 'signature', 'graded', 'psa', 'gem', 'mint',
            'holo', 'refractor', 'numbered', 'print', 'run', 'edition', 'variation',
            'insert', 'parallel', 'rainbow', 'gold', 'silver', 'bronze', 'platinum',
            'diamond', 'emerald', 'sapphire', 'ruby', 'amethyst', 'onyx', 'obsidian',
            'case hit', 'storm chasers', 'winning ticket', 'focus', 'supernatural',
            'pitching', 'batting', 'fielding', 'running', 'throwing', 'catching',
            'chicago', 'detroit', 'new york', 'los angeles', 'boston', 'philadelphia',
            'miami', 'atlanta', 'houston', 'dallas', 'denver', 'seattle', 'portland',
            'minnesota', 'milwaukee', 'cleveland', 'cincinnati', 'pittsburgh',
            'baltimore', 'washington', 'tampa', 'orlando', 'phoenix', 'las vegas',
            'san francisco', 'san diego', 'oakland', 'sacramento', 'memphis',
            'new orleans', 'oklahoma', 'utah', 'indiana', 'kentucky', 'tennessee',
            'missouri', 'arkansas', 'louisiana', 'mississippi', 'alabama', 'georgia',
            'florida', 'south carolina', 'north carolina', 'virginia', 'west virginia',
            'maryland', 'delaware', 'new jersey', 'connecticut', 'rhode island',
            'vermont', 'new hampshire', 'maine', 'massachusetts', 'pennsylvania',
            'ohio', 'michigan', 'wisconsin', 'illinois', 'iowa', 'nebraska',
            'kansas', 'oklahoma', 'texas', 'new mexico', 'arizona', 'nevada',
            'california', 'oregon', 'washington', 'idaho', 'montana', 'wyoming',
            'colorado', 'north dakota', 'south dakota', 'minnesota', 'iowa',
            'wwe', 'formula', 'racing', 'nascar', 'f1', 'indycar', 'motorsport'
        ];
        
        // Check if the name contains any non-player terms
        for (const term of nonPlayerTerms) {
            if (name.includes(term)) {
                return { isProblematic: true, reason: `Contains card/team term: "${term}"` };
            }
        }
        
        // Check for single words that are likely not player names
        const singleWords = ['bo', 'malik', 'devin', 'holo', 'orange', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey'];
        if (singleWords.includes(name)) {
            return { isProblematic: true, reason: `Single word that's likely not a player name: "${name}"` };
        }
        
        // Check for very short names (less than 3 characters)
        if (name.length < 3) {
            return { isProblematic: true, reason: `Too short: "${name}" (${name.length} chars)` };
        }
        
        // Check for names that are all lowercase and very short (likely incomplete)
        if (name === name.toLowerCase() && name.length < 5) {
            return { isProblematic: true, reason: `All lowercase and too short: "${name}"` };
        }
        
        // Check for names with numbers
        if (/\d/.test(name)) {
            return { isProblematic: true, reason: `Contains numbers: "${name}"` };
        }
        
        // Check for names with special characters (except apostrophes and hyphens)
        if (/[^a-z\s'\-]/.test(name)) {
            return { isProblematic: true, reason: `Contains special characters: "${name}"` };
        }
        
        return { isProblematic: false, reason: 'Valid player name' };
    }

    async analyzePlayerNames() {
        try {
            console.log('🔍 Analyzing player names in database...');
            
            // First, let's see what's in the database
            const totalQuery = `SELECT COUNT(*) as total FROM cards`;
            const totalResult = await this.db.getQuery(totalQuery);
            this.totalCards = totalResult.total;
            console.log(`📊 Total cards in database: ${this.totalCards}`);
            
            // Check how many have player_name
            const playerNameQuery = `SELECT COUNT(*) as count FROM cards WHERE player_name IS NOT NULL AND player_name != ''`;
            const playerNameResult = await this.db.getQuery(playerNameQuery);
            this.cardsWithPlayerNames = playerNameResult.count;
            console.log(`📊 Cards with player_name: ${this.cardsWithPlayerNames}`);
            
            // Get a sample of cards to analyze
            const sampleQuery = `SELECT player_name, title FROM cards WHERE player_name IS NOT NULL AND player_name != '' LIMIT 20`;
            
            try {
                const results = await this.db.allQuery(sampleQuery);
                console.log(`📊 Found ${results.length} sample cards with player names`);
                
                if (results.length === 0) {
                    console.log('⚠️ No cards with player names found in database');
                    this.analysisResults = [];
                    this.problematicNames = [];
                    return;
                }
                
                // Analyze the sample
                for (const result of results) {
                    const playerName = result.player_name;
                    const title = result.title;
                    
                    if (playerName && playerName.trim()) {
                        const analysis = this.isLikelyProblematic(playerName.trim());
                        
                        const analysisResult = {
                            playerName: playerName.trim(),
                            title: title,
                            count: 1,
                            isProblematic: analysis.isProblematic,
                            reason: analysis.reason
                        };
                        
                        this.analysisResults.push(analysisResult);
                        
                        if (analysis.isProblematic) {
                            this.problematicNames.push(playerName.trim());
                            console.log(`❌ Problematic: "${playerName}" (from: "${title}") - ${analysis.reason}`);
                        } else {
                            console.log(`✅ Valid: "${playerName}" (from: "${title}")`);
                        }
                    }
                }
                
                // Validate problematic names with ESPN API
                if (this.problematicNames.length > 0) {
                    console.log('\n🔍 Validating problematic names with ESPN API...');
                    console.log(`📋 About to validate ${this.problematicNames.length} names:`, this.problematicNames);
                    try {
                        await this.validateProblematicNamesWithESPN();
                        console.log('✅ ESPN validation completed successfully');
                        
                        // Verify ESPN validation was added
                        const validatedCount = this.analysisResults.filter(r => r.espnValidation).length;
                        console.log(`📊 Verified ${validatedCount} results have ESPN validation`);
                        
                        // Debug: Show which results have ESPN validation
                        this.analysisResults.forEach((result, index) => {
                            console.log(`📝 Result ${index + 1}: "${result.playerName}" - has ESPN validation: ${!!result.espnValidation}`);
                        });
                    } catch (error) {
                        console.error('❌ ESPN validation failed:', error.message);
                    }
                } else {
                    console.log('ℹ️ No problematic names to validate with ESPN');
                }
                
                // Generate summary
                this.generateSummary();
                
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
                this.analysisResults = [];
                this.problematicNames = [];
            }
            
        } catch (error) {
            console.error('❌ Error analyzing player names:', error);
            this.analysisResults = [];
            this.problematicNames = [];
        }
    }

    async validateProblematicNamesWithESPN() {
        try {
            console.log(`🔍 Testing ${this.problematicNames.length} problematic names with ESPN API...`);
            console.log('📋 Problematic names to test:', this.problematicNames);
            
            for (let i = 0; i < this.problematicNames.length; i++) {
                const playerName = this.problematicNames[i];
                const result = this.analysisResults.find(r => r.playerName === playerName);
                
                console.log(`\n🔍 Testing ${i + 1}/${this.problematicNames.length}: "${playerName}" (from: "${result.title}")`);
                
                const espnResult = await this.testPlayerNameWithESPN(playerName);
                
                // Add ESPN validation result to the analysis result
                result.espnValidation = {
                    isValid: espnResult.isValid,
                    results: espnResult.results,
                    reason: espnResult.reason,
                    firstResult: espnResult.firstResult
                };
                
                console.log(`📝 Added ESPN validation to result for "${playerName}":`, result.espnValidation);
                
                if (espnResult.isValid) {
                    console.log(`✅ ESPN Valid: "${playerName}" - Found ${espnResult.results} results`);
                    if (espnResult.firstResult) {
                        console.log(`   First result: ${espnResult.firstResult}`);
                    }
                } else {
                    console.log(`❌ ESPN Invalid: "${playerName}" - ${espnResult.reason}`);
                }
                
                // Small delay to be nice to the API
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            console.log('\n📊 ESPN Validation Summary:');
            console.log('==========================');
            const espnValid = this.analysisResults.filter(r => r.espnValidation && r.espnValidation.isValid).length;
            const espnInvalid = this.analysisResults.filter(r => r.espnValidation && !r.espnValidation.isValid).length;
            console.log(`✅ ESPN Valid: ${espnValid}`);
            console.log(`❌ ESPN Invalid: ${espnInvalid}`);
            
        } catch (error) {
            console.error('❌ Error validating with ESPN API:', error);
        }
    }

    generateSummary() {
        console.log('\n📊 Player Name Analysis Summary');
        console.log('===============================');
        
        const total = this.analysisResults.length;
        const valid = this.analysisResults.filter(r => !r.isProblematic).length;
        const problematic = this.problematicNames.length;
        
        console.log(`✅ Valid player names: ${valid}`);
        console.log(`❌ Problematic player names: ${problematic}`);
        console.log(`📈 Total analyzed: ${total}`);
        
        if (problematic > 0) {
            console.log('\n❌ Problematic Player Names:');
            console.log('============================');
            this.problematicNames.forEach((name, index) => {
                const result = this.analysisResults.find(r => r.playerName === name);
                console.log(`${index + 1}. "${name}" (${result.count} cards) - ${result.reason}`);
            });
            
            console.log('\n💡 These player names may need fixing:');
            console.log('- They contain card terms, team names, or other non-player text');
            console.log('- They are single words that are likely not player names');
            console.log('- They are too short or incomplete');
            console.log('- They contain numbers or special characters');
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Review the problematic names above');
        console.log('2. Identify patterns in the problematic names');
        console.log('3. Update player name extraction logic to filter out these patterns');
        console.log('4. Re-run this analysis to verify improvements');
    }
}

// Route function for API endpoint
function addPlayerNameAnalysisRoute(app) {
    app.post('/api/admin/analyze-player-names', async (req, res) => {
        try {
            console.log('🔍 Analyzing player names...');
            const analyzer = new PlayerNameAnalyzer();
            await analyzer.connect();
            await analyzer.analyzePlayerNames();
            await analyzer.close();
            
            res.json({ 
                success: true, 
                message: 'Player name analysis completed successfully',
                problematicCount: analyzer.problematicNames.length,
                totalAnalyzed: analyzer.analysisResults.length,
                databaseStats: {
                    totalCards: analyzer.totalCards || 0,
                    cardsWithPlayerNames: analyzer.cardsWithPlayerNames || 0
                },
                problematicNames: analyzer.problematicNames.map(name => {
                    const result = analyzer.analysisResults.find(r => r.playerName === name);
                    
                    // Debug: Log what we found
                    console.log(`🔍 DEBUG - Mapping "${name}":`, {
                        hasResult: !!result,
                        resultKeys: result ? Object.keys(result) : 'NO RESULT',
                        hasEspnValidation: result ? !!result.espnValidation : false,
                        espnValidation: result ? result.espnValidation : 'NO RESULT'
                    });
                    
                    // Always include ESPN validation - create it directly
                    const espnValidation = result.espnValidation || {
                        isValid: false,
                        results: 0,
                        reason: 'ESPN validation not performed',
                        firstResult: null
                    };
                    
                    return {
                        name: name,
                        title: result.title,
                        count: result.count,
                        reason: result.reason,
                        espnValidation: espnValidation
                    };
                }),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error analyzing player names:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error analyzing player names', 
                error: error.message, 
                timestamp: new Date().toISOString()
            });
        }
    });

    // Add diagnostic endpoint
    app.post('/api/admin/diagnose-database', async (req, res) => {
        try {
            console.log('🔍 Diagnosing database...');
            const analyzer = new PlayerNameAnalyzer();
            await analyzer.connect();
            await analyzer.diagnoseDatabase();
            await analyzer.close();
            
            res.json({ 
                success: true, 
                message: 'Database diagnosis completed successfully',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error diagnosing database:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error diagnosing database', 
                error: error.message, 
                timestamp: new Date().toISOString()
            });
        }
    });

    // Add test endpoint to debug ESPN validation
    app.post('/api/admin/test-espn-validation', async (req, res) => {
        try {
            console.log('🧪 Testing ESPN validation...');
            const analyzer = new PlayerNameAnalyzer();
            await analyzer.connect();
            
            // Test with a simple player name
            const testName = "Tom Brady";
            console.log(`🧪 Testing ESPN validation for: "${testName}"`);
            
            const espnResult = await analyzer.testPlayerNameWithESPN(testName);
            console.log(`🧪 ESPN result:`, espnResult);
            
            await analyzer.close();
            
            res.json({ 
                success: true, 
                message: 'ESPN validation test completed',
                testName: testName,
                espnResult: espnResult,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error testing ESPN validation:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error testing ESPN validation', 
                error: error.message, 
                timestamp: new Date().toISOString()
            });
        }
    });

    // Add endpoint to fix player names
    app.post('/api/admin/fix-player-names', async (req, res) => {
        try {
            console.log('🔧 Starting player name fix...');
            const { PlayerNameFixer } = require('./fix-player-names-railway.js');
            const fixer = new PlayerNameFixer();
            
            await fixer.connect();
            await fixer.fixPlayerNames();
            await fixer.showSampleResults();
            await fixer.close();
            
            res.json({ 
                success: true, 
                message: 'Player name fix completed successfully',
                fixedCount: fixer.fixedCount,
                totalCount: fixer.totalCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error fixing player names:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error fixing player names', 
                error: error.message, 
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { PlayerNameAnalyzer, addPlayerNameAnalysisRoute };
