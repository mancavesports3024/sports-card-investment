const NewPricingDatabase = require('./create-new-pricing-database.js');

class SimpleSummaryFixer {
    constructor() {
        this.db = null;
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

    // Simple extraction - just clean the title without adding extra info
    cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove common unwanted terms that shouldn't be in summary titles
        const unwantedTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'MT 10', 'MT10',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population',
            'RC', 'Rookie', 'ROOKIE', 'rookie'
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
        console.log('🔧 Simple Summary Title Fixer Starting...\n');
        
        try {
            await this.connect();
            
            // Get cards with obviously broken summary titles
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title 
                FROM cards 
                WHERE (
                    summary_title IS NULL OR 
                    summary_title LIKE '%PSA 10%' OR
                    summary_title LIKE '%GEM MINT%' OR
                    summary_title LIKE '%RC RC%' OR
                    summary_title LIKE '%ROOKIE ROOKIE%' OR
                    summary_title LIKE '%AUTO AUTO%' OR
                    summary_title LIKE '%PSA10%' OR
                    summary_title LIKE '%MT10%'
                )
                LIMIT 100
            `);
            
            console.log(`📊 Found ${cards.length} cards with obviously broken summary titles\n`);
            
            let fixed = 0;
            let unchanged = 0;
            
            for (const card of cards) {
                try {
                    const title = card.title || '';
                    const currentSummary = card.summary_title || '';
                    
                    // Generate simple, clean summary title
                    const newSummary = this.cleanTitle(title);
                    
                    // Only update if we have something meaningful and it's different
                    if (newSummary && 
                        newSummary.length > 10 && 
                        newSummary !== currentSummary &&
                        !newSummary.includes('PSA 10') &&
                        !newSummary.includes('GEM MINT')) {
                        
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
                const summaryTitle = card.summary_title || '';
                
                if (!summaryTitle || 
                    summaryTitle.includes('PSA 10') ||
                    summaryTitle.includes('GEM MINT') ||
                    summaryTitle.includes('RC RC') ||
                    summaryTitle.includes('ROOKIE ROOKIE')) {
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
            console.error('❌ Error in simple summary title fixer:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Export for use
module.exports = { SimpleSummaryFixer };

// For running directly
if (require.main === module) {
    const fixer = new SimpleSummaryFixer();
    fixer.fixSummaryTitles()
        .then(result => {
            console.log('\n✅ Simple Summary Title Fixer completed successfully!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Simple Summary Title Fixer failed:', error);
            process.exit(1);
        });
}
