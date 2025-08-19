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
                    // Extract year from title
                    let year = null;
                    const yearMatch = card.title.match(/(19|20)\d{2}/);
                    if (yearMatch) {
                        year = parseInt(yearMatch[0]);
                    }
                    
                    const cardSet = this.db.extractCardSet(card.title);
                    let cardType = this.db.extractCardType(card.title);
                    // Normalize card type to avoid duplicate brand words (e.g., Prizm) when already in set
                    cardType = this.db.normalizeCardType(cardType, cardSet);
                    const cardNumber = this.db.extractCardNumber(card.title);
                    
                    // Extract print run
                    let printRun = null;
                    const printRunMatch = card.title.match(/\/(\d+)/);
                    if (printRunMatch) {
                        printRun = '/' + printRunMatch[1];
                    }
                    
                    const isRookie = this.db.isRookieCard(card.title);
                    const isAutograph = this.db.isAutographCard(card.title);
                    const sport = this.db.detectSportFromKeywords(card.title);
                    
                    // Extract player name with improved filtering
                    const playerName = this.db.extractPlayerName(card.title);
                    const cleanPlayerName = playerName ? this.db.filterTeamNamesFromPlayer(playerName) : null;
                    const finalPlayerName = cleanPlayerName ? this.db.capitalizePlayerName(cleanPlayerName) : null;

                    // Build new summary title (matching addCard method exactly)
                    let newSummaryTitle = '';
                    
                    // Check if it's an autograph card
                    const isAuto = card.title.toLowerCase().includes('auto');
                    
                    // Start with year
                    if (year) {
                        newSummaryTitle += year;
                    }
                    
                    // Add card set (cleaned of sport names)
                    if (cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        const cleanedCardSet = this.db.cleanSportNamesFromCardSet(cardSet);
                        newSummaryTitle += cleanedCardSet;
                    }
                    
                    // Add card type (colors, parallels, etc.) - but exclude "Base" (comes BEFORE player)
                    if (cardType && cardType.toLowerCase() !== 'base') {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += cardType;
                    }

                    // Add player name (but not if it's already in the card set)
                    if (finalPlayerName && cardSet && !cardSet.toLowerCase().includes(finalPlayerName.toLowerCase())) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += finalPlayerName;
                    } else if (finalPlayerName && !cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += finalPlayerName;
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
                    
                    // Clean up any commas from the summary title
                    newSummaryTitle = newSummaryTitle.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
                    
                    // Remove unwanted terms from final summary title
                    const unwantedTerms = [
                        'psa', 'gem', 'mint', 'rc', 'rookie', 'yg', 'ssp', 'holo', 'velocity', 'notoriety',
                        'mvp', 'hof', 'nfl', 'debut', 'card', 'rated', '1st', 'first', 'university',
                        'rams', 'vikings', 'browns', 'chiefs', 'giants', 'ny giants', 'eagles', 'cowboys', 'falcons', 'panthers'
                    ];
                    
                    unwantedTerms.forEach(term => {
                        const regex = new RegExp(`\\b${term}\\b`, 'gi');
                        newSummaryTitle = newSummaryTitle.replace(regex, '');
                    });
                    
                    // Clean up extra spaces again
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
