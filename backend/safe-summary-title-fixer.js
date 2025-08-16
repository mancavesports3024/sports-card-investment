const NewPricingDatabase = require('./create-new-pricing-database.js');

class SafeSummaryTitleFixer {
    constructor() {
        this.db = null;
        this.cardSets = new Set();
        this.cardTypes = new Set();
        this.brands = new Set();
    }

    async connect() {
        this.db = new NewPricingDatabase();
        await this.db.connect();
        console.log('✅ Connected to Railway database');
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }

    // Learn from existing database data
    async learnFromDatabase() {
        console.log('🧠 Learning from existing database data...\n');

        try {
            // Extract card sets from existing titles
            const cardSetsQuery = await this.db.allQuery(`
                SELECT DISTINCT 
                    CASE 
                        WHEN title LIKE '%Bowman Chrome%' THEN 'Bowman Chrome'
                        WHEN title LIKE '%Bowman Draft%' THEN 'Bowman Draft'
                        WHEN title LIKE '%Topps Chrome%' THEN 'Topps Chrome'
                        WHEN title LIKE '%Panini Prizm%' THEN 'Panini Prizm'
                        WHEN title LIKE '%Panini Select%' THEN 'Panini Select'
                        WHEN title LIKE '%Panini Donruss%' THEN 'Panini Donruss'
                        WHEN title LIKE '%Bowman%' THEN 'Bowman'
                        WHEN title LIKE '%Topps%' THEN 'Topps'
                        WHEN title LIKE '%Panini%' THEN 'Panini'
                        ELSE NULL
                    END as card_set
                FROM cards 
                WHERE title IS NOT NULL AND title != ''
                ORDER BY card_set
            `);

            console.log(`📚 Learned ${cardSetsQuery.length} card sets from database`);

            // Add card sets to our learning
            cardSetsQuery.forEach(row => {
                if (row.card_set) this.cardSets.add(row.card_set);
            });

        } catch (error) {
            console.error('❌ Error learning from database:', error);
        }
    }

    // Extract year from title
    extractYear(title) {
        const yearMatch = title.match(/\b(19|20)\d{2}(?:[-]\d{2})?\b/);
        return yearMatch ? yearMatch[0] : null;
    }

    // Extract product/brand from title
    extractProduct(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('bowman chrome')) return 'Bowman Chrome';
        if (titleLower.includes('bowman draft')) return 'Bowman Draft';
        if (titleLower.includes('topps chrome')) return 'Topps Chrome';
        if (titleLower.includes('panini prizm')) return 'Panini Prizm';
        if (titleLower.includes('panini select')) return 'Panini Select';
        if (titleLower.includes('panini donruss')) return 'Panini Donruss';
        if (titleLower.includes('bowman')) return 'Bowman';
        if (titleLower.includes('topps')) return 'Topps';
        if (titleLower.includes('panini')) return 'Panini';
        
        return null;
    }

    // Extract player name from title (simplified, safe approach)
    extractPlayer(title) {
        if (!title) return null;
        
        // Convert to uppercase for consistent filtering
        let cleanTitle = title.toUpperCase();
        
        // Remove years
        cleanTitle = cleanTitle.replace(/\b(19|20)\d{2}\b/g, '');
        
        // Remove card brands/sets
        const brands = ['PANINI', 'TOPPS', 'BOWMAN', 'FLEER', 'DONRUSS', 'UPPER DECK', 'CHROME', 'PRIZM', 'SELECT'];
        brands.forEach(brand => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${brand}\\b`, 'g'), '');
        });
        
        // Remove card types/colors
        const cardTypes = ['PRIZM', 'CHROME', 'FINEST', 'HERITAGE', 'GREEN', 'BLUE', 'RED', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW', 'BLACK', 'WHITE', 'SILVER', 'GOLD', 'BRONZE', 'COPPER', 'PLATINUM', 'DIAMOND', 'EMERALD', 'RUBY', 'SAPPHIRE', 'REFRACTOR', 'AUTO', 'RC', 'ROOKIE', 'PSA', 'GEM', 'MINT', 'MT'];
        cardTypes.forEach(type => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${type}\\b`, 'g'), '');
        });
        
        // Remove card numbers and PSA grades
        cleanTitle = cleanTitle.replace(/\b#\d+\b/g, '');
        cleanTitle = cleanTitle.replace(/\bPSA\s+\d+\b/g, '');
        cleanTitle = cleanTitle.replace(/\b\d{8,}\b/g, '');
        cleanTitle = cleanTitle.replace(/\b\d{1,3}\b/g, '');
        
        // Remove emojis and special characters
        cleanTitle = cleanTitle.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu, '');
        
        // Clean up extra spaces and trim
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        
        // If nothing left, return empty string
        if (!cleanTitle || cleanTitle.length < 3) {
            return '';
        }
        
        // Format the player name with proper case
        const formattedName = cleanTitle.split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
        
        return formattedName;
    }

    // Extract color/numbering from title
    extractColorNumbering(title) {
        const patterns = [
            // Card numbers with # symbol
            /#\d+/g,
            // Print run numbers (like /150, /5)
            /\/\d+\b/g,
            // Colors
            /\b(Red|Blue|Green|Yellow|Orange|Purple|Pink|Gold|Silver|Bronze|Black|White)\b/gi,
            // Special editions
            /\b(1st Edition|First Edition|Limited Edition|Special Edition)\b/gi
        ];

        const found = [];
        const foundTerms = new Set();
        
        for (const pattern of patterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
                const value = match[0];
                
                // Skip PSA grades
                if (value === '10' || value === '9' || value === '8' || value === '7' || value === '6' || value === '5' || value === '4' || value === '3' || value === '2' || value === '1') {
                    if (title.toLowerCase().includes('psa ' + value) || title.toLowerCase().includes('psa' + value)) {
                        continue;
                    }
                }
                
                // Skip if we've already found this term
                if (foundTerms.has(value)) {
                    continue;
                }
                
                found.push(value);
                foundTerms.add(value);
            }
        }

        return found.length > 0 ? found.join(' ') : null;
    }

    // Check if title contains autograph-related terms
    hasAutograph(title) {
        const titleLower = title.toLowerCase();
        const autoTerms = ['auto', 'autograph', 'signed', 'signature'];
        return autoTerms.some(term => titleLower.includes(term));
    }

    // Generate standardized summary title
    generateStandardizedTitle(title) {
        const year = this.extractYear(title);
        const product = this.extractProduct(title);
        const player = this.extractPlayer(title);
        const colorNumbering = this.extractColorNumbering(title);
        const hasAuto = this.hasAutograph(title);

        const parts = [];
        
        if (year) parts.push(year);
        if (product) parts.push(product);
        if (player) parts.push(player);
        if (colorNumbering) parts.push(colorNumbering);
        if (hasAuto) parts.push('Auto');

        let standardizedTitle = parts.join(' ').trim();
        
        // If we couldn't extract enough information, return a cleaned version of the original
        if (parts.length < 2) {
            return this.cleanTitle(title);
        }

        return standardizedTitle;
    }

    // Clean title as fallback
    cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove common unwanted terms
        const unwantedTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'MT 10', 'MT10',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population'
        ];

        unwantedTerms.forEach(term => {
            const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });

        // Remove extra spaces and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    // Main function to fix summary titles
    async fixSummaryTitles() {
        console.log('🔧 Safe Summary Title Fixer Starting...\n');
        
        try {
            await this.connect();
            await this.learnFromDatabase();
            
            // Get all cards with broken summary titles (too short or missing)
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title 
                FROM cards 
                WHERE (
                    summary_title IS NULL OR 
                    LENGTH(summary_title) < 30 OR
                    summary_title LIKE '%2024%' OR
                    summary_title LIKE '%2023%' OR
                    summary_title LIKE '%2010%' OR
                    summary_title LIKE '%1964%'
                )
                AND LENGTH(summary_title) < 50
                LIMIT 50
            `);
            
            console.log(`📊 Found ${cards.length} cards with broken summary titles\n`);
            
            let fixed = 0;
            let unchanged = 0;
            
            for (const card of cards) {
                try {
                    const title = card.title || '';
                    const currentSummary = card.summary_title || '';
                    
                    // Generate new summary title
                    const newSummary = this.generateStandardizedTitle(title);
                    
                                         // Only update if the new summary is better (longer and more descriptive)
                     if (newSummary && 
                         newSummary !== currentSummary && 
                         newSummary.length > currentSummary.length &&
                         newSummary.length > 10) {
                        
                        await this.db.runQuery(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [newSummary, card.id]
                        );
                        
                        console.log(`✅ Fixed card ${card.id}:`);
                        console.log(`   Old: "${currentSummary}"`);
                        console.log(`   New: "${newSummary}"`);
                        console.log('');
                        
                        fixed++;
                    } else {
                        unchanged++;
                    }
                } catch (error) {
                    console.error(`❌ Error fixing card ${card.id}:`, error);
                }
            }
            
            console.log(`🎉 Fixed ${fixed} out of ${cards.length} cards`);
            console.log(`📊 Unchanged: ${unchanged}`);
            
            // Check health score
            const allCards = await this.db.allQuery('SELECT * FROM cards');
            let summaryTitleIssues = 0;
            
            allCards.forEach(card => {
                const title = card.title || '';
                const summaryTitle = card.summary_title || '';
                const playerName = title.split(' ').slice(0, 2).join(' ').trim();
                
                if (!summaryTitle || (playerName && !summaryTitle.includes(playerName)) || 
                    !summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman)\b/i)) {
                    summaryTitleIssues++;
                }
            });
            
            const healthScore = allCards.length > 0 ? ((allCards.length - summaryTitleIssues) / allCards.length * 100).toFixed(1) : 0;
            
            console.log(`📊 Updated Health Score: ${healthScore}%`);
            console.log(`📊 Remaining Summary Title Issues: ${summaryTitleIssues}`);
            
            return {
                success: true,
                totalProcessed: cards.length,
                fixed: fixed,
                unchanged: unchanged,
                healthScore: healthScore,
                remainingIssues: summaryTitleIssues
            };
            
        } catch (error) {
            console.error('❌ Error in safe summary title fixer:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Export for use
module.exports = { SafeSummaryTitleFixer };

// For running directly
if (require.main === module) {
    const fixer = new SafeSummaryTitleFixer();
    fixer.fixSummaryTitles()
        .then(result => {
            console.log('\n✅ Safe Summary Title Fixer completed successfully!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Safe Summary Title Fixer failed:', error);
            process.exit(1);
        });
}
