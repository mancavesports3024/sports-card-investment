const NewPricingDatabase = require('./create-new-pricing-database.js');

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
            
            // Simple test - just get a few player names to see if the database works
            const simpleQuery = `SELECT player_name FROM cards WHERE player_name IS NOT NULL LIMIT 5`;
            
            try {
                const results = await this.db.db.all(simpleQuery);
                console.log(`📊 Found ${results.length} sample player names`);
                
                if (results.length === 0) {
                    console.log('⚠️ No cards found in database');
                    this.analysisResults = [];
                    this.problematicNames = [];
                    return;
                }
                
                // Just analyze the first few names as a test
                for (const result of results) {
                    const playerName = result.player_name;
                    
                    if (playerName && playerName.trim()) {
                        const analysis = this.isLikelyProblematic(playerName.trim());
                        
                        const analysisResult = {
                            playerName: playerName.trim(),
                            count: 1,
                            isProblematic: analysis.isProblematic,
                            reason: analysis.reason
                        };
                        
                        this.analysisResults.push(analysisResult);
                        
                        if (analysis.isProblematic) {
                            this.problematicNames.push(playerName.trim());
                            console.log(`❌ Problematic: "${playerName}" - ${analysis.reason}`);
                        } else {
                            console.log(`✅ Valid: "${playerName}"`);
                        }
                    }
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
                problematicNames: analyzer.problematicNames.map(name => {
                    const result = analyzer.analysisResults.find(r => r.playerName === name);
                    return {
                        name: name,
                        count: result.count,
                        reason: result.reason
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
}

module.exports = { PlayerNameAnalyzer, addPlayerNameAnalysisRoute };
