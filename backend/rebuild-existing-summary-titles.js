const { NewPricingDatabase } = require('./create-new-pricing-database.js');

class ExistingSummaryTitleRebuilder {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async rebuildSummaryTitles() {
        console.log('🔄 Starting to rebuild summary titles for existing cards...\n');
        
        try {
            // Get all cards that need summary title updates
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run
                FROM cards 
                ORDER BY created_at DESC
                LIMIT 1000
            `);

            console.log(`📊 Found ${cards.length} cards to process\n`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const card of cards) {
                try {
                    // Extract components from the original title
                    const year = card.year || this.extractYear(card.title);
                    const cardSet = card.card_set || this.db.extractCardSet(card.title);
                    const playerName = card.player_name || this.db.titleGenerator.extractPlayer(card.title);
                    const cardType = card.card_type || this.db.extractCardType(card.title);
                    const cardNumber = card.card_number || this.db.extractCardNumber(card.title);
                    const printRun = card.print_run || this.extractPrintRun(card.title);
                    
                    // Check if it's an autograph
                    const isAuto = card.title.toLowerCase().includes('auto');

                    // Build new summary title
                    let newSummaryTitle = '';

                    // Start with year
                    if (year) {
                        newSummaryTitle += year;
                    }

                    // Add card set
                    if (cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += cardSet;
                    }

                    // Add player name (but not if it's already in the card set)
                    if (playerName && cardSet && !cardSet.toLowerCase().includes(playerName.toLowerCase())) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += this.db.capitalizePlayerName(playerName);
                    } else if (playerName && !cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += this.db.capitalizePlayerName(playerName);
                    }

                    // Add card type
                    if (cardType) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += cardType;
                    }

                    // Add "auto" if it's an autograph
                    if (isAuto) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += 'auto';
                    }

                    // Add card number
                    if (cardNumber) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += cardNumber;
                    }

                    // Add print run
                    if (printRun) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += printRun;
                    }

                    // Only update if the new summary title is different and not empty
                    if (newSummaryTitle.trim() && newSummaryTitle.trim() !== card.summary_title) {
                        // Update the card
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET summary_title = ?, 
                                year = ?, 
                                card_set = ?, 
                                player_name = ?, 
                                card_type = ?, 
                                card_number = ?, 
                                print_run = ?,
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [
                            newSummaryTitle.trim(),
                            year,
                            cardSet,
                            playerName ? this.db.capitalizePlayerName(playerName) : null,
                            cardType,
                            cardNumber,
                            printRun,
                            card.id
                        ]);

                        console.log(`✅ Updated card ${card.id}:`);
                        console.log(`   Old: "${card.summary_title}"`);
                        console.log(`   New: "${newSummaryTitle.trim()}"`);
                        console.log('---');
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }

                } catch (error) {
                    console.log(`❌ Error updating card ${card.id}: ${error.message}`);
                }
            }

            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Updated: ${updatedCount} cards`);
            console.log(`   ⏭️  Skipped: ${skippedCount} cards`);
            console.log(`   📝 Total processed: ${cards.length} cards`);

        } catch (error) {
            console.error('❌ Error rebuilding summary titles:', error);
            throw error;
        }
    }

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractPrintRun(title) {
        const printRunMatch = title.match(/\/(\d+)/);
        return printRunMatch ? '/' + printRunMatch[1] : null;
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addRebuildSummaryTitlesRoute(app) {
    app.post('/api/admin/rebuild-existing-summary-titles', async (req, res) => {
        try {
            console.log('🔄 Rebuild existing summary titles endpoint called');
            
            const rebuilder = new ExistingSummaryTitleRebuilder();
            await rebuilder.connect();
            await rebuilder.rebuildSummaryTitles();
            await rebuilder.close();

            res.json({
                success: true,
                message: 'Existing summary titles rebuilt successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in rebuild existing summary titles endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error rebuilding existing summary titles',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ExistingSummaryTitleRebuilder, addRebuildSummaryTitlesRoute };
