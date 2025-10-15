const NewPricingDatabase = require('./create-new-pricing-database.js');

class ImprovedSummaryTitleGenerator {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
    }

    async generateImprovedSummaryTitles() {
        console.log('🔄 Generating improved summary titles...\n');
        
        try {
            // Get all cards with their component fields
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, year, card_set, player_name, card_type, card_number, print_run, is_autograph, is_rookie
                FROM cards 
                ORDER BY id
                LIMIT 1000
            `);

            console.log(`📊 Found ${cards.length} cards to process\n`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const card of cards) {
                try {
                    const newSummaryTitle = this.buildSummaryTitle(card);
                    
                    // Only update if the new summary title is different and not empty
                    if (newSummaryTitle && newSummaryTitle.trim() !== card.summary_title) {
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET summary_title = ?
                            WHERE id = ?
                        `, [newSummaryTitle.trim(), card.id]);

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
            console.error('❌ Error generating improved summary titles:', error);
            throw error;
        }
    }

    buildSummaryTitle(card) {
        const components = [];

        // New format: Player Year Brand Card# Variation PrintRun

        // 1. Player Name (if available)
        if (card.player_name) {
            components.push(this.capitalizePlayerName(card.player_name));
        }

        // 2. Year (if available)
        if (card.year) {
            components.push(card.year.toString());
        }

        // 3. Brand/Card Set (if available)
        if (card.card_set) {
            components.push(card.card_set);
        }

        // 4. Card Number (if available)
        if (card.card_number) {
            components.push(card.card_number);
        }

        // 5. Variation (Card Type if available and not "Base")
        if (card.card_type && card.card_type.toLowerCase() !== 'base') {
            components.push(card.card_type);
        }

        // 6. Auto designation (if it's an autograph - part of variation)
        if (card.is_autograph) {
            components.push('auto');
        }

        // 7. Print Run (if available)
        if (card.print_run) {
            components.push(card.print_run);
        }

        // Join components and clean up
        let summaryTitle = components.join(' ').trim();

        // Clean up any extra spaces
        summaryTitle = summaryTitle.replace(/\s+/g, ' ');

        // Remove any trailing punctuation
        summaryTitle = summaryTitle.replace(/[.,;!?]+$/, '');

        return summaryTitle;
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

    async close() {
        await this.db.close();
    }
}

// Add to Express routes
function addImprovedSummaryTitleRoute(app) {
    app.post('/api/admin/generate-improved-summary-titles', async (req, res) => {
        try {
            console.log('🔄 Generate improved summary titles endpoint called');
            
            const generator = new ImprovedSummaryTitleGenerator();
            await generator.connect();
            await generator.generateImprovedSummaryTitles();
            await generator.close();

            res.json({
                success: true,
                message: 'Improved summary titles generated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in generate improved summary titles endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating improved summary titles',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { ImprovedSummaryTitleGenerator, addImprovedSummaryTitleRoute };
