const { ImprovedCardExtraction } = require('./improved-card-extraction.js');

class RailwayPlayerNameFixer {
    constructor() {
        this.extractor = new ImprovedCardExtraction();
        this.stats = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0
        };
        this.API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';
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

    // Process a single card
    async processCard(card) {
        try {
            console.log(`\n🔍 Processing card ID ${card.id}:`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Current player_name: ${card.player_name || 'NULL'}`);
            
            // Extract player name using improved system
            const extractedPlayerName = this.extractor.extractPlayerName(card.title);
            
            if (!extractedPlayerName) {
                console.log(`   ❌ No player name extracted`);
                this.stats.unchanged++;
                return;
            }
            
            console.log(`   ✅ Extracted player name: ${extractedPlayerName}`);
            
            // Check if the player name actually changed
            if (card.player_name && extractedPlayerName.toLowerCase() === card.player_name.toLowerCase()) {
                console.log(`   ⏭️ Player name unchanged`);
                this.stats.unchanged++;
                return;
            }
            
            // Update the card on Railway
            const success = await this.updateCardOnRailway(card.id, {
                ...card,
                player_name: extractedPlayerName
            });
            
            if (success) {
                console.log(`   ✅ Updated: "${card.player_name || 'NULL'}" → "${extractedPlayerName}"`);
                this.stats.updated++;
            } else {
                console.log(`   ❌ Failed to update card ${card.id}`);
                this.stats.errors++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.stats.errors++;
        }
    }

    // Process all cards
    async fixAllPlayerNames() {
        console.log('🚀 Starting Railway player name fixing process...\n');
        
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
                console.log(`\n${'='.repeat(60)}`);
                console.log(`Card ${this.stats.total + i + 1} (Batch ${Math.floor(offset / limit) + 1})`);
                console.log(`${'='.repeat(60)}`);
                
                await this.processCard(card);
                
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
        console.log(`✅ Player names updated: ${this.stats.updated}`);
        console.log(`⏭️ Player names unchanged: ${this.stats.unchanged}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`📈 Success rate: ${((this.stats.updated / this.stats.total) * 100).toFixed(1)}%`);
        console.log(`${'='.repeat(60)}`);
    }

    // Test on a small sample first
    async testOnSample(limit = 5) {
        console.log(`🧪 Testing on sample of ${limit} cards from Railway...\n`);
        
        const cards = await this.getCardsFromRailway(limit, 0);
        
        console.log(`📊 Found ${cards.length} cards for testing`);
        
        for (const card of cards) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Testing card ID ${card.id}:`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Current player_name: ${card.player_name || 'NULL'}`);
            
            const extractedPlayerName = this.extractor.extractPlayerName(card.title);
            console.log(`   ✅ Extracted player name: ${extractedPlayerName || 'NOT FOUND'}`);
            
            if (extractedPlayerName && (!card.player_name || extractedPlayerName.toLowerCase() !== card.player_name.toLowerCase())) {
                console.log(`   🔄 Would update: "${card.player_name || 'NULL'}" → "${extractedPlayerName}"`);
            } else {
                console.log(`   ⏭️ Would leave unchanged`);
            }
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log('🧪 Test completed - no database changes made');
        console.log(`${'='.repeat(60)}`);
    }
}

// Main execution
async function main() {
    const fixer = new RailwayPlayerNameFixer();
    
    try {
        // Check command line arguments
        const args = process.argv.slice(2);
        
        if (args.includes('--test') || args.includes('-t')) {
            const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 5;
            await fixer.testOnSample(parseInt(limit));
        } else {
            await fixer.fixAllPlayerNames();
        }
        
    } catch (error) {
        console.error('❌ Error in main:', error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { RailwayPlayerNameFixer };
