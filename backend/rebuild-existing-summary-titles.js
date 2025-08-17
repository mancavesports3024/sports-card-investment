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
                const cardSet = card.card_set || this.db.extractCardSet(card.title);
                const playerName = card.player_name || this.extractPlayer(card.title);
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

    extractYear(title) {
        const yearMatch = title.match(/(19|20)\d{2}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }

    extractPrintRun(title) {
        const printRunMatch = title.match(/\/(\d+)/);
        return printRunMatch ? '/' + printRunMatch[1] : null;
    }

    extractCardTypeWithFiltering(title) {
        const titleLower = title.toLowerCase();
        
                                             // Filter out terms that shouldn't be card types
        const filteredTitle = titleLower
            .replace(/\brookie\b/g, '') // Remove "rookie" from card type detection
            .replace(/\brc\b/g, '') // Remove "rc" from card type detection
            .replace(/\byg\b/g, '') // Remove "yg" from card type detection
            .replace(/\bauto\b/g, '') // Remove "auto" from card type detection
            .replace(/\bautograph\b/g, '') // Remove "autograph" from card type detection
            .replace(/\bgraded\b/g, '') // Remove "graded" from card type detection
            .replace(/\bungraded\b/g, '') // Remove "ungraded" from card type detection
            .replace(/\bpop\b/g, '') // Remove "pop" from card type detection
            .replace(/\bpopulation\b/g, '') // Remove "population" from card type detection
            .replace(/\bcolor\b/g, '') // Remove "color" from card type detection
            .replace(/\bpsa\b/g, '') // Remove "psa" from card type detection
            .replace(/\bgem\b/g, '') // Remove "gem" from card type detection
            .replace(/\bmint\b/g, '') // Remove "mint" from card type detection
            .replace(/\bssp\b/g, '') // Remove "ssp" from card type detection
            .replace(/\bholo\b/g, '') // Remove "holo" from card type detection
            .replace(/\bvelocity\b/g, '') // Remove "velocity" from card type detection
            .replace(/\bnotoriety\b/g, ''); // Remove "notoriety" from card type detection
        
                         // Enhanced color/parallel patterns
        const colorPatterns = [
            // Specific color + Prizm combinations (prioritize these)
            { pattern: /\b(gold prizm)\b/gi, name: 'Gold Prizm' },
            { pattern: /\b(silver prizm)\b/gi, name: 'Silver Prizm' },
            { pattern: /\b(black prizm)\b/gi, name: 'Black Prizm' },
            { pattern: /\b(green prizm)\b/gi, name: 'Green Prizm' },
            { pattern: /\b(blue prizm)\b/gi, name: 'Blue Prizm' },
            { pattern: /\b(red prizm)\b/gi, name: 'Red Prizm' },
            { pattern: /\b(yellow prizm)\b/gi, name: 'Yellow Prizm' },
            { pattern: /\b(orange prizm)\b/gi, name: 'Orange Prizm' },
            { pattern: /\b(purple prizm)\b/gi, name: 'Purple Prizm' },
            { pattern: /\b(pink prizm)\b/gi, name: 'Pink Prizm' },
            { pattern: /\b(bronze prizm)\b/gi, name: 'Bronze Prizm' },
            { pattern: /\b(white prizm)\b/gi, name: 'White Prizm' },
            { pattern: /\b(teal prizm)\b/gi, name: 'Teal Prizm' },
            { pattern: /\b(neon green prizm)\b/gi, name: 'Neon Green Prizm' },
            // Additional color combinations
            { pattern: /\b(teal velocity)\b/gi, name: 'Teal Velocity' },
            { pattern: /\b(holo prizm)\b/gi, name: 'Holo Prizm' },
            // Additional color variations
            { pattern: /\b(gold)\b/gi, name: 'Gold' },
            { pattern: /\b(silver)\b/gi, name: 'Silver' },
            { pattern: /\b(black)\b/gi, name: 'Black' },
            { pattern: /\b(green)\b/gi, name: 'Green' },
            { pattern: /\b(blue)\b/gi, name: 'Blue' },
            { pattern: /\b(red)\b/gi, name: 'Red' },
            { pattern: /\b(yellow)\b/gi, name: 'Yellow' },
            { pattern: /\b(orange)\b/gi, name: 'Orange' },
            { pattern: /\b(purple)\b/gi, name: 'Purple' },
            { pattern: /\b(pink)\b/gi, name: 'Pink' },
            { pattern: /\b(bronze)\b/gi, name: 'Bronze' },
            { pattern: /\b(white)\b/gi, name: 'White' },
            { pattern: /\b(teal)\b/gi, name: 'Teal' },
            { pattern: /\b(neon green)\b/gi, name: 'Neon Green' },
            // Basic colors (including those with slashes) - return the actual color name
            { pattern: /(?:^|\s|\/)(red|blue|green|yellow|orange|purple|pink|gold|silver|bronze|black|white|neon green|teal)(?:\s|$|\/)/gi, name: 'match' },
            // Refractors
            { pattern: /\b(refractor|refractors)\b/gi, name: 'Refractor' },
            // Prizm variants
            { pattern: /\b(prizm|prizmatic)\b/gi, name: 'Prizm' },
            // Holo variants
            { pattern: /\b(holo|holographic)\b/gi, name: 'Holo' },
            // Chrome variants
            { pattern: /\b(chrome)\b/gi, name: 'Chrome' },
            // X-Fractor
            { pattern: /\b(x-fractor|x-fractors)\b/gi, name: 'X-Fractor' },
            // Cracked Ice
            { pattern: /\b(cracked ice)\b/gi, name: 'Cracked Ice' },
            // Stained Glass
            { pattern: /\b(stained glass)\b/gi, name: 'Stained Glass' },
            // World Champion Boxers
            { pattern: /\b(world champion boxers)\b/gi, name: 'World Champion Boxers' },
            // Fast Break
            { pattern: /\b(fast break)\b/gi, name: 'Fast Break' },
            // Genesis
            { pattern: /\b(genesis)\b/gi, name: 'Genesis' },
            // Premier Level
            { pattern: /\b(premier level)\b/gi, name: 'Premier Level' },
            // Premier
            { pattern: /\b(premier)\b/gi, name: 'Premier' },
            // Level
            { pattern: /\b(level)\b/gi, name: 'Level' },
            // Club
            { pattern: /\b(club)\b/gi, name: 'Club' },
            // Flashback
            { pattern: /\b(flashback)\b/gi, name: 'Flashback' },
            // Emergent
            { pattern: /\b(emergent)\b/gi, name: 'Emergent' },
            // Real One
            { pattern: /\b(real one)\b/gi, name: 'Real One' },
            // RPA
            { pattern: /\b(rpa)\b/gi, name: 'RPA' },
            // Mania
            { pattern: /\b(mania)\b/gi, name: 'Mania' },
            // WWE variants
            { pattern: /\b(wwe)\b/gi, name: 'WWE' },
            // Geometric
            { pattern: /\b(geometric)\b/gi, name: 'Geometric' },
            // Honeycomb
            { pattern: /\b(honeycomb)\b/gi, name: 'Honeycomb' },
            // Pride
            { pattern: /\b(pride)\b/gi, name: 'Pride' },
            // Kaleidoscopic
            { pattern: /\b(kaleidoscopic)\b/gi, name: 'Kaleidoscopic' },
            // Scale variants
            { pattern: /\b(dragon scale)\b/gi, name: 'Dragon Scale' },
            // Vintage
            { pattern: /\b(vintage)\b/gi, name: 'Vintage' },
            // Stars
            { pattern: /\b(stars)\b/gi, name: 'Stars' },
            // Independence Day
            { pattern: /\b(independence day)\b/gi, name: 'Independence Day' },
            // Father's Day
            { pattern: /\b(father's day)\b/gi, name: 'Father\'s Day' },
            // Mother's Day
            { pattern: /\b(mother's day)\b/gi, name: 'Mother\'s Day' },
            // Memorial Day
            { pattern: /\b(memorial day)\b/gi, name: 'Memorial Day' },
            // Camo
            { pattern: /\b(camo)\b/gi, name: 'Camo' },
            // Vinyl
            { pattern: /\b(vinyl)\b/gi, name: 'Vinyl' },
            // Premium Set
            { pattern: /\b(premium set)\b/gi, name: 'Premium Set' },
            // Checkerboard
            { pattern: /\b(checkerboard)\b/gi, name: 'Checkerboard' },
            // Die-cut (match both forms but treat as single type)
            { pattern: /\b(die-cut|die cut)\b/gi, name: 'Die-Cut' },
            // National Landmarks
            { pattern: /\b(national landmarks)\b/gi, name: 'National Landmarks' },
            // Lava Lamp
            { pattern: /\b(lava lamp)\b/gi, name: 'Lava Lamp' },
            // Dazzle
            { pattern: /\b(dazzle)\b/gi, name: 'Dazzle' },
            // Velocity
            { pattern: /\b(velocity)\b/gi, name: 'Velocity' },
            // Hyper
            { pattern: /\b(hyper)\b/gi, name: 'Hyper' },
            // Dragon
            { pattern: /\b(dragon)\b/gi, name: 'Dragon' },
            // Laser
            { pattern: /\b(laser)\b/gi, name: 'Laser' },
            // Liberty
            { pattern: /\b(liberty)\b/gi, name: 'Liberty' },
                                             // Marvels
                                 { pattern: /\b(marvels)\b/gi, name: 'Marvels' },
                                 // Fire
                                 { pattern: /\b(fire)\b/gi, name: 'Fire' },
                                 // Firestorm
                                 { pattern: /\b(firestorm)\b/gi, name: 'Firestorm' },
                                 // Voltage
                                 { pattern: /\b(voltage)\b/gi, name: 'Voltage' },
            // Career Stat Line
            { pattern: /\b(career stat line)\b/gi, name: 'Career Stat Line' },
                                             // Downtown
                                 { pattern: /\b(downtown)\b/gi, name: 'Downtown' },
                                 // Base (for base cards)
                                 { pattern: /\b(base)\b/gi, name: 'Base' },
                                 // Pulsar
                                 { pattern: /\b(pulsar)\b/gi, name: 'Pulsar' },
                                 // Bomb Squad
                                 { pattern: /\b(bomb squad)\b/gi, name: 'Bomb Squad' },
                                 { pattern: /\b(bs\d+)\b/gi, name: 'Bomb Squad' },
                                 // Rapture
                                 { pattern: /\b(rapture)\b/gi, name: 'Rapture' },
                                 // Velocity
                                 { pattern: /\b(velocity)\b/gi, name: 'Velocity' },
                                 // Notoriety
                                 { pattern: /\b(notoriety)\b/gi, name: 'Notoriety' },
                                 // Holo
                                 { pattern: /\b(holo)\b/gi, name: 'Holo' },
                                 // SSP
                                 { pattern: /\b(ssp)\b/gi, name: 'SSP' }
                             ];

                 const foundTypes = [];
         for (const { pattern, name } of colorPatterns) {
             const matches = filteredTitle.match(pattern);
             if (matches) {
                 if (name === 'match') {
                     // For basic colors, use the actual matched color name
                     matches.forEach(match => {
                                                 // Extract the color name from the match (remove surrounding characters)
                        const colorMatch = match.match(/(?:^|\s|\/)(red|blue|green|yellow|orange|purple|pink|gold|silver|bronze|black|white|teal|neon green)(?:\s|$|\/)/i);
                        if (colorMatch) {
                            foundTypes.push(colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1).toLowerCase());
                        }
                     });
                 } else {
                     // Use the standardized name instead of the actual matches to avoid duplicates
                     foundTypes.push(name);
                 }
             }
         }

        // Remove duplicates and format
        const uniqueTypes = [...new Set(foundTypes)];
        const cardType = uniqueTypes.join(' ').trim();

        return cardType || null;
    }

    extractPlayer(title) {
        // Import the DatabaseDrivenStandardizedTitleGenerator to use its extractPlayer method
        const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
        const generator = new DatabaseDrivenStandardizedTitleGenerator();
        return generator.extractPlayer(title);
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
