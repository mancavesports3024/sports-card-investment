const NewPricingDatabase = require('./create-new-pricing-database.js');

class ComprehensiveSummaryFixer {
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

    // Clean summary title by removing unwanted terms
    cleanSummaryTitle(summaryTitle) {
        if (!summaryTitle) return '';
        
        let cleaned = summaryTitle.trim();
        
        // Remove common unwanted terms that shouldn't be in summary titles
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

        // Remove duplicate terms
        cleaned = cleaned.replace(/\b(RC)\s+\1\b/gi, '$1');
        cleaned = cleaned.replace(/\b(ROOKIE)\s+\1\b/gi, '$1');
        cleaned = cleaned.replace(/\b(AUTO)\s+\1\b/gi, '$1');
        
        // Remove extra spaces and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    // Generate clean summary title from original title
    generateCleanSummaryTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove common unwanted terms that shouldn't be in summary titles
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
        console.log('🔧 Comprehensive Summary Title Fixer Starting...\n');
        
        try {
            await this.connect();
            
            // Get all cards to check for issues
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title 
                FROM cards 
                ORDER BY id
            `);
            
            console.log(`📊 Found ${cards.length} cards to check\n`);
            
            let fixed = 0;
            let unchanged = 0;
            let issues = 0;
            
            for (const card of cards) {
                try {
                    const title = card.title || '';
                    const currentSummary = card.summary_title || '';
                    
                    // Check if current summary has issues
                    const hasIssues = currentSummary.includes('PSA 10') || 
                                     currentSummary.includes('GEM MINT') ||
                                     currentSummary.includes('RC RC') ||
                                     currentSummary.includes('ROOKIE ROOKIE') ||
                                     currentSummary.includes('AUTO AUTO');
                    
                    if (hasIssues) {
                        issues++;
                        console.log(`🔍 Found issue in card ${card.id}:`);
                        console.log(`   Title: "${title}"`);
                        console.log(`   Current Summary: "${currentSummary}"`);
                        
                        // Try to clean the current summary first
                        let newSummary = this.cleanSummaryTitle(currentSummary);
                        
                        // If cleaning didn't help much, generate from title
                        if (newSummary.length < 10 || newSummary.includes('PSA 10') || newSummary.includes('GEM MINT')) {
                            newSummary = this.generateCleanSummaryTitle(title);
                        }
                        
                        if (newSummary && newSummary.length > 10 && newSummary !== currentSummary) {
                            await this.db.runQuery(
                                'UPDATE cards SET summary_title = ? WHERE id = ?',
                                [newSummary, card.id]
                            );
                            
                            console.log(`   New Summary: "${newSummary}"`);
                            console.log('');
                            
                            fixed++;
                        } else {
                            console.log(`   No fix applied (summary too short or same)`);
                            console.log('');
                            unchanged++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error);
                }
            }
            
            console.log(`🎉 Fixed ${fixed} out of ${cards.length} cards`);
            console.log(`📊 Issues found: ${issues}`);
            console.log(`📊 Unchanged: ${unchanged}`);
            
            // Check final health score
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
            
            console.log(`📊 Final Health Score: ${healthScore}%`);
            console.log(`📊 Remaining Summary Title Issues: ${summaryTitleIssues}`);
            
            return {
                success: true,
                totalProcessed: cards.length,
                fixed: fixed,
                unchanged: unchanged,
                issuesFound: issues,
                healthScore: healthScore,
                remainingIssues: summaryTitleIssues
            };
            
        } catch (error) {
            console.error('❌ Error in comprehensive summary title fixer:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Export for use
module.exports = { ComprehensiveSummaryFixer };

// For running directly
if (require.main === module) {
    const fixer = new ComprehensiveSummaryFixer();
    fixer.fixSummaryTitles()
        .then(result => {
            console.log('\n✅ Comprehensive Summary Title Fixer completed successfully!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Comprehensive Summary Title Fixer failed:', error);
            process.exit(1);
        });
}
