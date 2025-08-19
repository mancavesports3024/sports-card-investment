const NewPricingDatabase = require('./create-new-pricing-database.js');

class SimpleSummaryTitleFixer {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async fixSummaryTitles() {
        console.log('🔧 Regenerating summary titles for existing cards...\n');
        
        try {
            // Get all cards
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run, is_autograph
                FROM cards 
                ORDER BY id
            `);

            console.log(`📊 Found ${cards.length} cards to process\n`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const card of cards) {
                try {
                    // Build new summary title using the simple, correct logic
                    let newSummaryTitle = '';

                    // Start with year
                    if (card.year) {
                        newSummaryTitle += card.year;
                    }

                    // Add card set (use the full card set name from database)
                    if (card.card_set) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += card.card_set;
                    }

                    // Add player name
                    if (card.player_name) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += card.player_name;
                    }

                    // Add card type (but exclude "Base")
                    if (card.card_type && card.card_type.toLowerCase() !== 'base') {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += card.card_type;
                    }

                    // Add "auto" if it's an autograph
                    if (card.is_autograph) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += 'auto';
                    }

                    // Add card number
                    if (card.card_number) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += card.card_number;
                    }

                    // Add print run
                    if (card.print_run) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += card.print_run;
                    }

                    // Clean up extra spaces
                    newSummaryTitle = newSummaryTitle.replace(/\s+/g, ' ').trim();

                    // Only update if the new summary title is different
                    if (newSummaryTitle && newSummaryTitle !== card.summary_title) {
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET summary_title = ?, 
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [newSummaryTitle, card.id]);

                        console.log(`✅ Fixed card ${card.id}:`);
                        console.log(`   Old: "${card.summary_title}"`);
                        console.log(`   New: "${newSummaryTitle}"`);
                        console.log('---');
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }

                } catch (error) {
                    console.log(`❌ Error fixing card ${card.id}: ${error.message}`);
                }
            }

            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Updated: ${updatedCount} cards`);
            console.log(`   ⏭️  Skipped: ${skippedCount} cards`);
            console.log(`   📝 Total processed: ${cards.length} cards`);

        } catch (error) {
            console.error('❌ Error fixing summary titles:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addFixSummaryTitlesRoute(app) {
    app.post('/api/admin/fix-summary-titles-simple', async (req, res) => {
        try {
            console.log('🔧 Fix summary titles simple endpoint called');
            
            const fixer = new SimpleSummaryTitleFixer();
            await fixer.connect();
            await fixer.fixSummaryTitles();
            await fixer.close();

            res.json({
                success: true,
                message: 'Summary titles fixed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in fix summary titles endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing summary titles',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { SimpleSummaryTitleFixer, addFixSummaryTitlesRoute };
