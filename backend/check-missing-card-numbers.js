const NewPricingDatabase = require('./create-new-pricing-database.js');
const { CardBaseService } = require('./services/cardbaseService.js');

class MissingCardNumberChecker {
    constructor() {
        this.db = new NewPricingDatabase();
        this.cardbaseService = new CardBaseService();
    }

    async connect() {
        await this.db.connect();
    }

    async findCardsWithMissingNumbers() {
        console.log('🔍 Finding cards with missing card numbers...\n');
        
        try {
            // Get all cards that have no card_number or empty card_number
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run, is_rookie, is_autograph, sport
                FROM cards 
                WHERE card_number IS NULL OR card_number = '' OR card_number = 'null'
                ORDER BY id
            `);

            console.log(`📊 Found ${cards.length} cards with missing card numbers\n`);

            const results = {
                totalMissing: cards.length,
                cards: [],
                sampleCards: []
            };

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                
                // Try to extract card number from the title
                const extractedNumber = this.db.extractCardNumber(card.title);
                
                const cardInfo = {
                    id: card.id,
                    title: card.title,
                    summaryTitle: card.summary_title,
                    year: card.year,
                    cardSet: card.card_set,
                    playerName: card.player_name,
                    cardType: card.card_type,
                    currentCardNumber: card.card_number,
                    extractedCardNumber: extractedNumber,
                    hasExtractableNumber: !!extractedNumber,
                    printRun: card.print_run,
                    isRookie: card.is_rookie,
                    isAutograph: card.is_autograph,
                    sport: card.sport
                };

                results.cards.push(cardInfo);

                // Show first 10 as samples
                if (i < 10) {
                    results.sampleCards.push(cardInfo);
                    console.log(`${i + 1}. ID: ${card.id}`);
                    console.log(`   Title: ${card.title}`);
                    console.log(`   Summary: ${card.summary_title}`);
                    console.log(`   Extracted #: ${extractedNumber || 'None'}`);
                    console.log(`   Components: ${card.year} | ${card.card_set} | ${card.player_name} | ${card.card_type} | ${card.print_run || ''}`);
                    console.log('---');
                }
            }

            // Group by extraction status
            const withExtractableNumbers = results.cards.filter(c => c.hasExtractableNumber);
            const withoutExtractableNumbers = results.cards.filter(c => !c.hasExtractableNumber);

            console.log(`\n📈 Summary:`);
            console.log(`   🔧 Cards with extractable numbers: ${withExtractableNumbers.length}`);
            console.log(`   ❓ Cards needing CardBase lookup: ${withoutExtractableNumbers.length}`);
            console.log(`   📊 Total missing card numbers: ${results.totalMissing}`);

            return results;

        } catch (error) {
            console.error('❌ Error finding cards with missing numbers:', error);
            throw error;
        }
    }

    async fixMissingCardNumbers() {
        console.log('🔧 Starting batch fix for missing card numbers...\n');
        
        try {
            const missingCards = await this.findCardsWithMissingNumbers();
            
            let fixedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const fixedCards = [];

            for (const card of missingCards.cards) {
                try {
                    console.log(`🔍 Processing card ${card.id}: "${card.title}"`);
                    
                    let newCardNumber = null;
                    let source = '';

                    // First, try to extract from title if we haven't already
                    if (!card.hasExtractableNumber) {
                        const extracted = this.db.extractCardNumber(card.title);
                        if (extracted) {
                            newCardNumber = extracted;
                            source = 'title_extraction';
                            console.log(`   ✅ Found in title: ${newCardNumber}`);
                        }
                    } else {
                        newCardNumber = card.extractedCardNumber;
                        source = 'title_extraction';
                        console.log(`   ✅ Using extracted: ${newCardNumber}`);
                    }

                    // If still no number, try CardBase API
                    if (!newCardNumber) {
                        console.log(`   🔍 Trying CardBase lookup...`);
                        
                        // Build search query for CardBase
                        const searchQuery = this.buildCardBaseSearchQuery(card);
                        console.log(`   🔍 Search query: "${searchQuery}"`);
                        
                        try {
                            const cardbaseResult = await this.cardbaseService.searchCard(searchQuery);
                            
                            if (cardbaseResult && cardbaseResult.cardNumber) {
                                newCardNumber = cardbaseResult.cardNumber;
                                source = 'cardbase_api';
                                console.log(`   ✅ Found via CardBase: ${newCardNumber}`);
                            } else {
                                console.log(`   ❌ No CardBase result`);
                            }
                        } catch (cardbaseError) {
                            console.log(`   ❌ CardBase error: ${cardbaseError.message}`);
                        }
                    }

                    // Update the card if we found a number
                    if (newCardNumber) {
                        // Update the card_number field
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET card_number = ?, last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [newCardNumber, card.id]);

                        // Rebuild the summary title
                        const newSummaryTitle = await this.db.generateSummaryTitle({
                            year: card.year,
                            card_set: card.cardSet,
                            card_type: card.cardType,
                            player_name: card.playerName,
                            card_number: newCardNumber,
                            print_run: card.printRun,
                            is_autograph: card.isAutograph
                        });

                        await this.db.runQuery(`
                            UPDATE cards 
                            SET summary_title = ?, last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [newSummaryTitle, card.id]);

                        fixedCards.push({
                            id: card.id,
                            oldNumber: card.currentCardNumber,
                            newNumber: newCardNumber,
                            source: source,
                            newSummaryTitle: newSummaryTitle
                        });

                        console.log(`   ✅ Fixed: ${card.currentCardNumber || 'null'} → ${newCardNumber}`);
                        console.log(`   📝 New summary: ${newSummaryTitle}`);
                        fixedCount++;
                    } else {
                        console.log(`   ⏭️ Skipped: No card number found`);
                        skippedCount++;
                    }

                    console.log('---');

                } catch (error) {
                    console.log(`   ❌ Error processing card ${card.id}: ${error.message}`);
                    errorCount++;
                }
            }

            console.log(`\n📊 Batch Fix Summary:`);
            console.log(`   ✅ Fixed: ${fixedCount} cards`);
            console.log(`   ⏭️ Skipped: ${skippedCount} cards`);
            console.log(`   ❌ Errors: ${errorCount} cards`);
            console.log(`   📊 Total processed: ${missingCards.totalMissing} cards`);

            return {
                success: true,
                fixedCount,
                skippedCount,
                errorCount,
                totalProcessed: missingCards.totalMissing,
                fixedCards: fixedCards.slice(0, 10) // Return first 10 for display
            };

        } catch (error) {
            console.error('❌ Error in batch fix:', error);
            throw error;
        }
    }

    buildCardBaseSearchQuery(card) {
        const parts = [];
        
        if (card.year) {
            parts.push(card.year);
        }
        
        if (card.cardSet) {
            parts.push(card.cardSet);
        }
        
        if (card.cardType && card.cardType.toLowerCase() !== 'base') {
            parts.push(card.cardType);
        }
        
        if (card.playerName) {
            parts.push(card.playerName);
        }
        
        if (card.isAutograph) {
            parts.push('auto');
        }
        
        return parts.join(' ');
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addMissingCardNumberRoutes(app) {
    // GET /api/admin/check-missing-card-numbers - Find cards with missing card numbers
    app.post('/api/admin/check-missing-card-numbers', async (req, res) => {
        try {
            console.log('🔍 Checking for cards with missing card numbers...');
            
            const checker = new MissingCardNumberChecker();
            await checker.connect();
            const results = await checker.findCardsWithMissingNumbers();
            await checker.close();

            res.json({
                success: true,
                results: results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error checking missing card numbers:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking missing card numbers',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // POST /api/admin/fix-missing-card-numbers - Batch fix missing card numbers
    app.post('/api/admin/fix-missing-card-numbers', async (req, res) => {
        try {
            console.log('🔧 Starting batch fix for missing card numbers...');
            
            const checker = new MissingCardNumberChecker();
            await checker.connect();
            const results = await checker.fixMissingCardNumbers();
            await checker.close();

            res.json({
                success: true,
                results: results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error fixing missing card numbers:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing missing card numbers',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { MissingCardNumberChecker, addMissingCardNumberRoutes };
