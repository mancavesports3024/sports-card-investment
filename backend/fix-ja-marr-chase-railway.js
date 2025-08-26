class JaMarrChaseFixer {
    constructor() {
        this.API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';
        this.stats = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0
        };
    }

    // Get cards from Railway API
    async getCardsFromRailway(limit = 50, offset = 0) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/admin/cards?limit=${limit}&offset=${offset}`);
            const data = await response.json();
            
            if (data.success) {
                return data.cards || [];
            } else {
                throw new Error(data.error || 'Failed to fetch cards');
            }
        } catch (error) {
            console.error('❌ Error fetching cards from Railway:', error.message);
            return [];
        }
    }

    // Update a card on Railway
    async updateCardOnRailway(cardId, updatedData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/admin/card/${cardId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error(data.message || 'Failed to update card');
            }
        } catch (error) {
            console.error(`❌ Error updating card ${cardId}:`, error.message);
            return false;
        }
    }

    // Fix "Ja Marr Chase" to "Ja'Marr Chase"
    fixJaMarrChase(text) {
        if (!text) return text;
        
        // Fix various spellings of Ja'Marr Chase
        let fixed = text;
        
        // Fix "Ja Marr Chase" (missing apostrophe)
        fixed = fixed.replace(/\bJa Marr Chase\b/g, "Ja'Marr Chase");
        
        // Fix "JaMarr Chase" (no space)
        fixed = fixed.replace(/\bJaMarr Chase\b/g, "Ja'Marr Chase");
        
        // Fix "Ja'marr Chase" (lowercase m)
        fixed = fixed.replace(/\bJa'marr Chase\b/g, "Ja'Marr Chase");
        
        // Fix "JAMARR CHASE" (all caps)
        fixed = fixed.replace(/\bJAMARR CHASE\b/g, "Ja'Marr Chase");
        
        return fixed;
    }

    // Process a single card
    async processCard(card) {
        try {
            const originalPlayerName = card.player_name;
            const originalSummaryTitle = card.summary_title;
            
            // Fix player name
            const fixedPlayerName = this.fixJaMarrChase(originalPlayerName);
            
            // Fix summary title
            const fixedSummaryTitle = this.fixJaMarrChase(originalSummaryTitle);
            
            // Check if anything needs to be updated
            const playerNameChanged = fixedPlayerName !== originalPlayerName;
            const summaryTitleChanged = fixedSummaryTitle !== originalSummaryTitle;
            
            if (playerNameChanged || summaryTitleChanged) {
                console.log(`\n🔧 Fixing card ID ${card.id}:`);
                console.log(`   Title: ${card.title}`);
                
                if (playerNameChanged) {
                    console.log(`   Player Name: "${originalPlayerName}" → "${fixedPlayerName}"`);
                }
                
                if (summaryTitleChanged) {
                    console.log(`   Summary Title: "${originalSummaryTitle}" → "${fixedSummaryTitle}"`);
                }
                
                // Update the card on Railway
                const success = await this.updateCardOnRailway(card.id, {
                    ...card,
                    player_name: fixedPlayerName,
                    summary_title: fixedSummaryTitle
                });
                
                if (success) {
                    console.log(`   ✅ Updated successfully`);
                    this.stats.updated++;
                } else {
                    console.log(`   ❌ Failed to update`);
                    this.stats.errors++;
                }
            } else {
                this.stats.unchanged++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.stats.errors++;
        }
    }

    // Process all cards
    async fixAllJaMarrChase() {
        console.log('🚀 Starting Ja\'Marr Chase apostrophe fix...\n');
        
        let offset = 0;
        const limit = 50;
        let hasMoreCards = true;
        
        while (hasMoreCards) {
            console.log(`📋 Fetching cards ${offset + 1} to ${offset + limit}...`);
            
            const cards = await this.getCardsFromRailway(limit, offset);
            
            if (cards.length === 0) {
                console.log('📋 No more cards to process');
                hasMoreCards = false;
                break;
            }
            
            console.log(`📊 Processing ${cards.length} cards...\n`);
            
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                
                // Only process cards that contain "Chase" (to be more efficient)
                if (card.player_name && card.player_name.includes('Chase') || 
                    card.summary_title && card.summary_title.includes('Chase') ||
                    card.title && card.title.includes('Chase')) {
                    
                    await this.processCard(card);
                } else {
                    this.stats.unchanged++;
                }
                
                // Progress indicator
                if ((i + 1) % 10 === 0) {
                    console.log(`\n📊 Batch Progress: ${i + 1}/${cards.length} cards processed`);
                    console.log(`   Updated: ${this.stats.updated}`);
                    console.log(`   Unchanged: ${this.stats.unchanged}`);
                    console.log(`   Errors: ${this.stats.errors}`);
                }
            }
            
            this.stats.total += cards.length;
            offset += limit;
            
            // If we got fewer cards than the limit, we've reached the end
            if (cards.length < limit) {
                hasMoreCards = false;
            }
            
            // Add a small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.printFinalStats();
    }

    // Print final statistics
    printFinalStats() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🎯 FINAL STATISTICS');
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 Total cards processed: ${this.stats.total}`);
        console.log(`✅ Cards updated: ${this.stats.updated}`);
        console.log(`⏭️ Cards unchanged: ${this.stats.unchanged}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`${'='.repeat(60)}`);
    }

    // Test on a small sample first
    async testOnSample(limit = 10) {
        console.log(`🧪 Testing Ja'Marr Chase fix on sample of ${limit} cards...\n`);
        
        const cards = await this.getCardsFromRailway(limit, 0);
        
        console.log(`📊 Found ${cards.length} cards for testing`);
        
        let foundChaseCards = 0;
        
        for (const card of cards) {
            // Only show cards with "Chase" in them
            if (card.player_name && card.player_name.includes('Chase') || 
                card.summary_title && card.summary_title.includes('Chase') ||
                card.title && card.title.includes('Chase')) {
                
                foundChaseCards++;
                console.log(`\n${'='.repeat(60)}`);
                console.log(`Testing card ID ${card.id}:`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Player Name: "${card.player_name || 'NULL'}"`);
                console.log(`   Summary Title: "${card.summary_title || 'NULL'}"`);
                
                const fixedPlayerName = this.fixJaMarrChase(card.player_name);
                const fixedSummaryTitle = this.fixJaMarrChase(card.summary_title);
                
                if (fixedPlayerName !== card.player_name) {
                    console.log(`   🔄 Would fix Player Name: "${card.player_name}" → "${fixedPlayerName}"`);
                }
                
                if (fixedSummaryTitle !== card.summary_title) {
                    console.log(`   🔄 Would fix Summary Title: "${card.summary_title}" → "${fixedSummaryTitle}"`);
                }
                
                if (fixedPlayerName === card.player_name && fixedSummaryTitle === card.summary_title) {
                    console.log(`   ⏭️ No changes needed`);
                }
            }
        }
        
        if (foundChaseCards === 0) {
            console.log('\n❌ No cards with "Chase" found in this sample');
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log('🧪 Test completed - no database changes made');
        console.log(`${'='.repeat(60)}`);
    }
}

// Main execution
async function main() {
    const fixer = new JaMarrChaseFixer();
    
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        
        if (args.includes('--test') || args.includes('-t')) {
            const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 10;
            await fixer.testOnSample(parseInt(limit));
        } else {
            await fixer.fixAllJaMarrChase();
        }
        
    } catch (error) {
        console.error('❌ Error in main:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { JaMarrChaseFixer };
