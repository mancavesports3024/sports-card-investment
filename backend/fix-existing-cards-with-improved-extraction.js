const NewPricingDatabase = require('./create-new-pricing-database.js');

class ExistingCardsFixer {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async fixExistingCards() {
        console.log('🔧 Re-extracting components for existing cards with improved logic...\n');
        
        try {
            // Get all cards
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run, is_rookie, is_autograph, sport
                FROM cards 
                ORDER BY id
            `);

            console.log(`📊 Found ${cards.length} cards to process\n`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const card of cards) {
                try {
                    console.log(`🔍 Processing card ${card.id}: "${card.title}"`);
                    
                    // Re-extract all components using the improved logic
                    const year = this.db.extractYear(card.title);
                    const cardSet = this.db.extractCardSet(card.title);
                    const cardType = this.db.extractCardType(card.title);
                    const cardNumber = this.db.extractCardNumber(card.title);
                    const printRun = this.db.extractPrintRun(card.title);
                    const isRookie = this.db.isRookieCard(card.title);
                    const isAutograph = this.db.isAutographCard(card.title);
                    const sport = this.db.detectSportFromKeywords(card.title);
                    
                    // Extract player name with improved filtering
                    const playerName = this.db.extractPlayerName(card.title);
                    const cleanPlayerName = playerName ? this.db.filterTeamNamesFromPlayer(playerName) : null;
                    const finalPlayerName = cleanPlayerName ? this.db.capitalizePlayerName(cleanPlayerName) : null;

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

                    // Add player name
                    if (finalPlayerName) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += finalPlayerName;
                    }

                    // Add card type (but exclude "Base")
                    if (cardType && cardType.toLowerCase() !== 'base') {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += cardType;
                    }

                    // Add "auto" if it's an autograph
                    if (isAutograph) {
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

                    // Clean up extra spaces
                    newSummaryTitle = newSummaryTitle.replace(/\s+/g, ' ').trim();

                    // Check if any component has changed
                    const hasChanges = 
                        year !== card.year ||
                        cardSet !== card.card_set ||
                        finalPlayerName !== card.player_name ||
                        cardType !== card.card_type ||
                        cardNumber !== card.card_number ||
                        printRun !== card.print_run ||
                        isRookie !== card.is_rookie ||
                        isAutograph !== card.is_autograph ||
                        sport !== card.sport ||
                        newSummaryTitle !== card.summary_title;

                    if (hasChanges) {
                        // Update the card with new components
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET year = ?, 
                                card_set = ?, 
                                player_name = ?, 
                                card_type = ?, 
                                card_number = ?, 
                                print_run = ?, 
                                is_rookie = ?, 
                                is_autograph = ?, 
                                sport = ?,
                                summary_title = ?, 
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [
                            year, cardSet, finalPlayerName, cardType, cardNumber, 
                            printRun, isRookie, isAutograph, sport, newSummaryTitle, card.id
                        ]);

                        console.log(`✅ Fixed card ${card.id}:`);
                        console.log(`   Old player name: "${card.player_name}" -> New: "${finalPlayerName}"`);
                        console.log(`   Old card type: "${card.card_type}" -> New: "${cardType}"`);
                        console.log(`   Old summary: "${card.summary_title}"`);
                        console.log(`   New summary: "${newSummaryTitle}"`);
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
            console.error('❌ Error fixing existing cards:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addFixExistingCardsRoute(app) {
    app.post('/api/admin/fix-existing-cards-extraction', async (req, res) => {
        try {
            console.log('🔧 Fix existing cards extraction endpoint called');
            
            const fixer = new ExistingCardsFixer();
            await fixer.connect();
            await fixer.fixExistingCards();
            await fixer.close();

            res.json({
                success: true,
                message: 'Existing cards fixed with improved extraction',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in fix existing cards extraction endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing existing cards',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ExistingCardsFixer, addFixExistingCardsRoute };
