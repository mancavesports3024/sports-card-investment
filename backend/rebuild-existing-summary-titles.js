const NewPricingDatabase = require('./create-new-pricing-database.js');

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
                // Always re-extract card set to apply latest fixes (like Skybox vs USA Basketball priority)
                const cardSet = this.db.extractCardSet(card.title);
                const playerName = card.player_name || this.db.extractPlayerName(card.title);
                // Always re-extract card type to apply latest fixes (like Skybox deduplication)
                const cardType = this.db.extractCardType(card.title);
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

                    // Add card set (cleaned of sport names)
                    if (cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        const cleanedCardSet = this.cleanSportNamesFromCardSet(cardSet);
                        newSummaryTitle += cleanedCardSet;
                    }

                    // Add player name (but not if it's already in the card set)
                    if (playerName && cardSet && !cardSet.toLowerCase().includes(playerName.toLowerCase())) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += this.capitalizePlayerName(playerName);
                    } else if (playerName && !cardSet) {
                        if (newSummaryTitle) newSummaryTitle += ' ';
                        newSummaryTitle += this.capitalizePlayerName(playerName);
                    }

                                         // Add card type (but exclude "Base")
                     if (cardType && cardType.toLowerCase() !== 'base') {
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
                     
                             // Clean up any commas from the summary title
        newSummaryTitle = newSummaryTitle.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Remove unwanted terms from final summary title
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
