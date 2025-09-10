const NewPricingDatabase = require('./create-new-pricing-database.js');

class SummaryTitleGenerator {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    /**
     * Generate summary title in format: Player Year Brand Card# Variation PrintRun
     * @param {Object} card - Card object from database
     * @returns {string} - Formatted summary title
     */
    generateSummaryTitle(card) {
        const components = [];

        // 1. Player Name
        if (card.player_name) {
            components.push(this.capitalizePlayerName(card.player_name));
        }

        // 2. Year
        if (card.year) {
            components.push(card.year.toString());
        }

        // 3. Brand (card_set)
        if (card.card_set) {
            components.push(this.cleanSportNamesFromCardSet(card.card_set));
        }

        // 4. Card Number
        if (card.card_number) {
            components.push(card.card_number);
        }

        // 5. Variation (card_type, but exclude "Base")
        if (card.card_type && card.card_type.toLowerCase() !== 'base') {
            components.push(card.card_type);
        }

        // 6. Auto designation (if autograph)
        if (card.is_autograph) {
            components.push('auto');
        }

        // 7. Print Run
        if (card.print_run) {
            components.push(card.print_run);
        }

        // Join components and clean up
        let summaryTitle = components.join(' ').trim();
        
        // Clean up any extra spaces and commas
        summaryTitle = summaryTitle.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Remove trailing punctuation
        summaryTitle = summaryTitle.replace(/[.,;!?]+$/, '');

        return summaryTitle;
    }

    /**
     * Update summary titles for all cards in database
     */
    async updateAllSummaryTitles() {
        try {
            console.log('🔄 Updating summary titles for all cards...');
            
            // Get all cards
            const cards = await this.db.getQuery('SELECT * FROM cards');
            console.log(`📊 Found ${cards.length} cards to update`);

            let updated = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    const newSummaryTitle = this.generateSummaryTitle(card);
                    
                    if (newSummaryTitle && newSummaryTitle !== card.summary_title) {
                        await this.db.runQuery(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [newSummaryTitle, card.id]
                        );
                        updated++;
                        
                        if (updated % 100 === 0) {
                            console.log(`✅ Updated ${updated} cards...`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error updating card ${card.id}:`, error.message);
                    errors++;
                }
            }

            console.log(`\n🎉 Summary title update complete!`);
            console.log(`✅ Updated: ${updated} cards`);
            console.log(`❌ Errors: ${errors} cards`);

        } catch (error) {
            console.error('❌ Error updating summary titles:', error);
            throw error;
        }
    }

    /**
     * Update summary title for a specific card
     * @param {number} cardId - Card ID to update
     */
    async updateCardSummaryTitle(cardId) {
        try {
            const card = await this.db.getQuery('SELECT * FROM cards WHERE id = ?', [cardId]);
            
            if (!card) {
                throw new Error(`Card with ID ${cardId} not found`);
            }

            const newSummaryTitle = this.generateSummaryTitle(card);
            
            await this.db.runQuery(
                'UPDATE cards SET summary_title = ? WHERE id = ?',
                [newSummaryTitle, cardId]
            );

            console.log(`✅ Updated card ${cardId}: "${newSummaryTitle}"`);
            return newSummaryTitle;

        } catch (error) {
            console.error(`❌ Error updating card ${cardId}:`, error);
            throw error;
        }
    }

    /**
     * Capitalize player name properly
     * @param {string} playerName - Player name to capitalize
     * @returns {string} - Capitalized player name
     */
    capitalizePlayerName(playerName) {
        if (!playerName) return null;
        
        // Handle dual player names (e.g., "Montana Rice" -> "Montana/Rice")
        if (playerName.includes(' ')) {
            const parts = playerName.split(' ');
            if (parts.length === 2) {
                return `${parts[0]}/${parts[1]}`;
            }
        }
        
        return playerName;
    }

    /**
     * Clean sport names from card set
     * @param {string} cardSet - Card set name
     * @returns {string} - Cleaned card set name
     */
    cleanSportNamesFromCardSet(cardSet) {
        if (!cardSet) return '';
        
        const sportNames = [
            'Basketball', 'Baseball', 'Football', 'Hockey', 'Soccer',
            'Tennis', 'Golf', 'Wrestling', 'Boxing', 'MMA'
        ];
        
        let cleaned = cardSet;
        for (const sport of sportNames) {
            cleaned = cleaned.replace(new RegExp(`\\b${sport}\\b`, 'gi'), '').trim();
        }
        
        return cleaned.replace(/\s+/g, ' ').trim();
    }

    /**
     * Test the summary title generator with sample cards
     */
    async testGenerator() {
        try {
            console.log('🧪 Testing summary title generator...\n');
            
            // Get a few sample cards
            const sampleCards = await this.db.getQuery('SELECT * FROM cards LIMIT 5');
            
            for (const card of sampleCards) {
                const newTitle = this.generateSummaryTitle(card);
                console.log(`Card ID: ${card.id}`);
                console.log(`Original: "${card.summary_title || 'N/A'}"`);
                console.log(`New:      "${newTitle}"`);
                console.log('---');
            }
            
        } catch (error) {
            console.error('❌ Error testing generator:', error);
            throw error;
        }
    }
}

module.exports = SummaryTitleGenerator;

// CLI usage
if (require.main === module) {
    const generator = new SummaryTitleGenerator();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'update-all':
            generator.updateAllSummaryTitles()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Error:', error);
                    process.exit(1);
                });
            break;
            
        case 'test':
            generator.testGenerator()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Error:', error);
                    process.exit(1);
                });
            break;
            
        case 'update-card':
            const cardId = process.argv[3];
            if (!cardId) {
                console.error('Usage: node summary-title-generator.js update-card <cardId>');
                process.exit(1);
            }
            generator.updateCardSummaryTitle(parseInt(cardId))
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('Error:', error);
                    process.exit(1);
                });
            break;
            
        default:
            console.log('Usage:');
            console.log('  node summary-title-generator.js update-all    - Update all summary titles');
            console.log('  node summary-title-generator.js test          - Test with sample cards');
            console.log('  node summary-title-generator.js update-card <id> - Update specific card');
            break;
    }
}
