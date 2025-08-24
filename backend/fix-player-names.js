const NewPricingDatabase = require('./create-new-pricing-database.js');

class PlayerNameFixer {
    constructor() {
        this.db = new NewPricingDatabase();
        this.fixedCount = 0;
        this.totalCount = 0;
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
        
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

    cleanPlayerName(playerName) {
        if (!playerName || typeof playerName !== 'string') {
            return playerName;
        }

        let cleaned = playerName.trim();

        // Remove card numbers (e.g., #279, #26, #36)
        cleaned = cleaned.replace(/#\d+/g, '');

        // Remove special characters except apostrophes and hyphens
        cleaned = cleaned.replace(/[^a-zA-Z\s'\-]/g, ' ');

        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Words to remove (card brands, terms, team names, etc.)
        const wordsToRemove = [
            // Card brands
            'donruss', 'topps', 'panini', 'fleer', 'prizm', 'chrome', 'optic', 'select', 'score', 'bowman', 'heritage', 'gallery', 'museum',
            'contenders', 'prestige', 'absolute', 'limited', 'threads', 'upper deck',
            
            // Card terms
            'psa', 'gem', 'mint', 'holo', 'refractor', 'numbered', 'print', 'run', 'edition', 'variation', 'insert', 'parallel', 'rainbow',
            'gold', 'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'sapphire', 'ruby', 'amethyst', 'onyx', 'obsidian',
            'case hit', 'storm chasers', 'winning ticket', 'focus', 'supernatural', 'rookie', 'auto', 'autograph', 'signature', 'graded',
            
            // Team names
            'bears', 'lakers', 'bulls', '49ers', 'chicago', 'detroit', 'new york', 'los angeles', 'boston', 'philadelphia', 'miami', 'atlanta',
            'houston', 'dallas', 'denver', 'seattle', 'portland', 'minnesota', 'milwaukee', 'cleveland', 'cincinnati', 'pittsburgh',
            'baltimore', 'washington', 'tampa', 'orlando', 'phoenix', 'las vegas', 'san francisco', 'san diego', 'oakland', 'sacramento',
            'memphis', 'new orleans', 'oklahoma', 'utah', 'indiana', 'kentucky', 'tennessee', 'missouri', 'arkansas', 'louisiana',
            'mississippi', 'alabama', 'georgia', 'florida', 'south carolina', 'north carolina', 'virginia', 'west virginia', 'maryland',
            'delaware', 'new jersey', 'connecticut', 'rhode island', 'vermont', 'new hampshire', 'maine', 'massachusetts', 'pennsylvania',
            'ohio', 'michigan', 'wisconsin', 'illinois', 'iowa', 'nebraska', 'kansas', 'texas', 'new mexico', 'arizona', 'nevada',
            'california', 'oregon', 'washington', 'idaho', 'montana', 'wyoming', 'colorado', 'north dakota', 'south dakota',
            
            // Sports terms
            'football', 'basketball', 'baseball', 'hockey', 'soccer', 'wwe', 'formula', 'racing', 'nascar', 'f1', 'indycar', 'motorsport',
            'pitching', 'batting', 'fielding', 'running', 'throwing', 'catching',
            
            // Common non-player words
            'bo', 'malik', 'devin', 'holo', 'orange', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey'
        ];

        // Split into words and filter out unwanted words
        const words = cleaned.toLowerCase().split(' ');
        const filteredWords = words.filter(word => {
            return word.length > 0 && !wordsToRemove.includes(word);
        });

        // Reconstruct the name with proper capitalization
        const cleanedName = filteredWords
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return cleanedName.trim();
    }

    async fixPlayerNames() {
        try {
            console.log('🔧 Starting player name cleanup...');

            // Get all cards with player names
            const query = `SELECT id, player_name, title FROM cards WHERE player_name IS NOT NULL AND player_name != ''`;
            const results = await this.db.allQuery(query);
            
            this.totalCount = results.length;
            console.log(`📊 Found ${this.totalCount} cards with player names to process`);

            let processedCount = 0;
            let fixedCount = 0;

            for (const card of results) {
                const originalName = card.player_name;
                const cleanedName = this.cleanPlayerName(originalName);

                // Only update if the name actually changed
                if (cleanedName !== originalName && cleanedName.length > 0) {
                    const updateQuery = `UPDATE cards SET player_name = ? WHERE id = ?`;
                    await this.db.runQuery(updateQuery, [cleanedName, card.id]);
                    
                    console.log(`✅ Fixed: "${originalName}" → "${cleanedName}" (from: "${card.title}")`);
                    fixedCount++;
                }

                processedCount++;
                if (processedCount % 100 === 0) {
                    console.log(`📈 Processed ${processedCount}/${this.totalCount} cards...`);
                }
            }

            this.fixedCount = fixedCount;
            console.log(`\n🎉 Player name cleanup completed!`);
            console.log(`📊 Total processed: ${processedCount}`);
            console.log(`🔧 Names fixed: ${fixedCount}`);
            console.log(`✅ Names unchanged: ${processedCount - fixedCount}`);

        } catch (error) {
            console.error('❌ Error fixing player names:', error);
        }
    }

    async showSampleResults() {
        try {
            console.log('\n📋 Sample of fixed player names:');
            console.log('================================');

            const query = `SELECT player_name, title FROM cards WHERE player_name IS NOT NULL AND player_name != '' ORDER BY RANDOM() LIMIT 10`;
            const results = await this.db.allQuery(query);

            results.forEach((card, index) => {
                console.log(`${index + 1}. "${card.player_name}" (from: "${card.title}")`);
            });

        } catch (error) {
            console.error('❌ Error showing sample results:', error);
        }
    }
}

// Main execution
async function main() {
    const fixer = new PlayerNameFixer();
    
    try {
        await fixer.connect();
        await fixer.fixPlayerNames();
        await fixer.showSampleResults();
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await fixer.close();
    }
}

// Export for use as module
module.exports = { PlayerNameFixer };

// Run if called directly
if (require.main === module) {
    main();
}
