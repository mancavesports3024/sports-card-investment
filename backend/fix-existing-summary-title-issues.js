const NewPricingDatabase = require('./create-new-pricing-database.js');

class ExistingSummaryTitleIssueFixer {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async fixExistingSummaryTitleIssues() {
        console.log('🔧 Starting to fix existing summary title issues...\n');
        
        try {
            // Get all cards that need fixing
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run
                FROM cards 
                ORDER BY created_at DESC
            `);

            console.log(`📊 Found ${cards.length} cards to process\n`);

            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const card of cards) {
                try {
                    // Use the SAME extraction order as the main addCard method
                    const year = card.year || this.extractYear(card.title);
                    
                    // Extract component fields using improved logic - EXTRACT CARD TYPE FIRST
                    const cardSet = this.db.extractCardSet(card.title);
                    const cardType = this.db.extractCardType(card.title);
                    const cardNumber = card.card_number || this.db.extractCardNumber(card.title);
                    
                    // Extract player name AFTER card type to avoid card types in player names
                    let playerName = null;
                    try {
                        // Remove card type from title before extracting player name
                        let titleForPlayerExtraction = card.title;
                        if (cardType && cardType.toLowerCase() !== 'base') {
                            // Remove the card type from the title to prevent it from being included in player name
                            const cardTypeRegex = new RegExp(`\\b${cardType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                            titleForPlayerExtraction = titleForPlayerExtraction.replace(cardTypeRegex, '');
                        }
                        
                        // Use the improved player name extraction method
                        playerName = this.db.extractPlayerName(titleForPlayerExtraction);
                    } catch (playerError) {
                        console.warn(`⚠️ Player name extraction failed for card ${card.id}: ${playerError.message}`);
                    }
                    
                    const printRun = card.print_run || this.extractPrintRun(card.title);
                    
                    // Check if it's an autograph
                    const isAuto = card.title.toLowerCase().includes('auto');

                    // Build new summary title using the CORRECT order: [Year] [Card Set] [Player] [Card Type] [auto] [Card Number] [Print Run]
                    let newSummaryTitle = '';

                    // Start with year
                    if (year) {
                        newSummaryTitle += year;
                    }

                    // Add card set (cleaned of sport names)
                    if (cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        const cleanedCardSet = this.cleanSportNamesFromCardSet(cardSet);
                        newSummaryTitle += cleanedCardSet;
                    }

                    // Add player name (but not if it's already in the card set)
                    if (playerName && cardSet && !cardSet.toLowerCase().includes(playerName.toLowerCase())) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        // Filter out team names from player name
                        const cleanPlayerName = this.db.filterTeamNamesFromPlayer(playerName);
                        newSummaryTitle += this.capitalizePlayerName(cleanPlayerName);
                    } else if (playerName && !cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        // Filter out team names from player name
                        const cleanPlayerName = this.db.filterTeamNamesFromPlayer(playerName);
                        newSummaryTitle += this.capitalizePlayerName(cleanPlayerName);
                    }

                    // Add card type (colors, parallels, etc.) - but exclude "Base"
                    if (cardType && cardType.toLowerCase() !== 'base') {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        // Properly capitalize card type (e.g., "REFRACTOR" -> "Refractor")
                        const capitalizedCardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
                        newSummaryTitle += capitalizedCardType;
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
                    
                    // Remove unwanted terms from final summary title (but NOT card types - those should be in the summary)
                    const unwantedTerms = [
                        'psa', 'gem', 'mint', 'rc', 'rookie', 'yg', 'ssp', 'holo', 'velocity', 'notoriety',
                        'mvp', 'hof', 'nfl', 'debut', 'card', 'rated', '1st', 'first', 'chrome', 'university',
                        'rams', 'vikings', 'browns', 'chiefs', 'giants', 'ny giants', 'eagles', 'cowboys', 'falcons', 'panthers'
                    ];
                    
                    unwantedTerms.forEach(term => {
                        const regex = new RegExp(`\\b${term}\\b`, 'gi');
                        newSummaryTitle = newSummaryTitle.replace(regex, '');
                    });
                    
                    // Clean up extra spaces again
                    newSummaryTitle = newSummaryTitle.replace(/\s+/g, ' ').trim();

                    // Only update if the new summary title is different and not empty
                    if (newSummaryTitle.trim() && newSummaryTitle.trim() !== card.summary_title) {
                        // Extract rookie and autograph attributes
                        const isRookie = this.isRookieCard(card.title);
                        const isAutograph = this.isAutographCard(card.title);
                        
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
                                is_rookie = ?,
                                is_autograph = ?,
                                last_updated = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [
                            newSummaryTitle.trim(),
                            year,
                            cardSet,
                            playerName ? this.capitalizePlayerName(playerName) : null,
                            cardType,
                            cardNumber,
                            printRun,
                            isRookie ? 1 : 0,
                            isAutograph ? 1 : 0,
                            card.id
                        ]);

                        console.log(`✅ Fixed card ${card.id}:`);
                        console.log(`   Old: "${card.summary_title}"`);
                        console.log(`   New: "${newSummaryTitle.trim()}"`);
                        console.log('---');
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }

                } catch (error) {
                    console.log(`❌ Error fixing card ${card.id}: ${error.message}`);
                    errorCount++;
                }
            }

            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Fixed: ${updatedCount} cards`);
            console.log(`   ⏭️  Skipped: ${skippedCount} cards`);
            console.log(`   ❌ Errors: ${errorCount} cards`);
            console.log(`   📝 Total processed: ${cards.length} cards`);

        } catch (error) {
            console.error('❌ Error fixing summary title issues:', error);
            throw error;
        }
    }

    // Clean sport names from card set (e.g., "Topps Football" -> "Topps")
    cleanSportNamesFromCardSet(cardSet) {
        if (!cardSet) return cardSet;
        
        const sportWords = [
            'football', 'baseball', 'basketball', 'hockey', 'soccer', 'mma', 'wrestling', 'golf', 'racing'
        ];
        
        let cleaned = cardSet;
        sportWords.forEach(sport => {
            const regex = new RegExp(`\\b${sport}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractPrintRun(title) {
        const printRunMatch = title.match(/\/(\d+)/);
        return printRunMatch ? '/' + printRunMatch[1] : null;
    }

    capitalizePlayerName(playerName) {
        if (!playerName) return null;
        
        // Convert to lowercase first
        const lowerName = playerName.toLowerCase();
        
        // Handle special cases for hyphens and apostrophes
        const words = lowerName.split(/[\s\-']/);
        const capitalizedWords = words.map(word => {
            if (word.length === 0) return word;
            
            // Handle special cases
            if (word === 'jr' || word === 'sr') return word.toUpperCase();
            if (word === 'ii' || word === 'iii' || word === 'iv') return word.toUpperCase();
            
            // Capitalize first letter
            return word.charAt(0).toUpperCase() + word.slice(1);
        });
        
        // Reconstruct with proper separators
        let result = capitalizedWords.join(' ');
        
        // Restore hyphens and apostrophes
        const originalName = playerName;
        const hyphenPositions = [];
        const apostrophePositions = [];
        
        // Find positions of hyphens and apostrophes in original name
        for (let i = 0; i < originalName.length; i++) {
            if (originalName[i] === '-') hyphenPositions.push(i);
            if (originalName[i] === "'") apostrophePositions.push(i);
        }
        
        // Restore hyphens
        hyphenPositions.forEach(pos => {
            const beforeHyphen = result.substring(0, pos);
            const afterHyphen = result.substring(pos);
            result = beforeHyphen + '-' + afterHyphen.substring(1);
        });
        
        // Restore apostrophes
        apostrophePositions.forEach(pos => {
            const beforeApostrophe = result.substring(0, pos);
            const afterApostrophe = result.substring(pos);
            result = beforeApostrophe + "'" + afterApostrophe.substring(1);
        });
        
        return result;
    }

    // Detect if a card is a rookie card
    isRookieCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for rookie indicators
        const rookiePatterns = [
            /\brookie\b/gi,
            /\brc\b/gi,
            /\byg\b/gi,
            /\byoung guns\b/gi,
            /\b1st bowman\b/gi,
            /\bfirst bowman\b/gi,
            /\bdebut\b/gi
        ];
        
        return rookiePatterns.some(pattern => pattern.test(titleLower));
    }

    // Detect if a card is an autograph card
    isAutographCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for autograph indicators
        const autographPatterns = [
            /\bautograph\b/gi,
            /\bauto\b/gi,
            /\bon card autograph\b/gi,
            /\bon card auto\b/gi,
            /\bsticker autograph\b/gi,
            /\bsticker auto\b/gi
        ];
        
        return autographPatterns.some(pattern => pattern.test(titleLower));
    }

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addFixExistingSummaryTitleIssuesRoute(app) {
    app.post('/api/admin/fix-existing-summary-title-issues', async (req, res) => {
        try {
            console.log('🔧 Fix existing summary title issues endpoint called');
            
            const fixer = new ExistingSummaryTitleIssueFixer();
            await fixer.connect();
            await fixer.fixExistingSummaryTitleIssues();
            await fixer.close();

            res.json({
                success: true,
                message: 'Existing summary title issues fixed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in fix existing summary title issues endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error fixing existing summary title issues',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ExistingSummaryTitleIssueFixer, addFixExistingSummaryTitleIssuesRoute };
