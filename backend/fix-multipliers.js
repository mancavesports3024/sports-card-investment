const axios = require('axios');

class MultiplierFixer {
    constructor() {
        this.baseUrl = 'https://web-production-9efa.up.railway.app';
    }

    async fixMultipliers() {
        try {
            console.log('🔧 Starting multiplier fix process...\n');
            
            // Get all cards from Railway
            const response = await axios.get(`${this.baseUrl}/api/admin/cards?limit=1000`);
            const cards = response.data.cards;
            
            console.log(`📊 Found ${cards.length} cards in Railway database`);
            
            // Filter cards that need multiplier calculation
            const cardsToFix = cards.filter(card => 
                card.psa10Price && 
                card.rawAveragePrice && 
                card.psa10Price > 0 && 
                card.rawAveragePrice > 0
            );
            
            console.log(`📊 Found ${cardsToFix.length} cards with valid prices for multiplier calculation\n`);
            
            let fixedCount = 0;
            let errorCount = 0;
            
            for (const card of cardsToFix) {
                try {
                    const correctMultiplier = (card.psa10Price / card.rawAveragePrice).toFixed(2);
                    const currentMultiplier = card.multiplier;
                    
                    // Check if multiplier needs fixing
                    if (currentMultiplier !== correctMultiplier) {
                        console.log(`🔧 Fixing card: ${card.title.substring(0, 60)}...`);
                        console.log(`   PSA10: $${card.psa10Price}, Raw: $${card.rawAveragePrice}`);
                        console.log(`   Old: ${currentMultiplier}x → New: ${correctMultiplier}x`);
                        
                        // Update the multiplier via API
                        await this.updateCardMultiplier(card.id, correctMultiplier);
                        
                        fixedCount++;
                        console.log(`   ✅ Fixed!\n`);
                    }
                } catch (error) {
                    console.error(`❌ Error fixing card ${card.id}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log(`✅ Multiplier fix completed!`);
            console.log(`📊 Results:`);
            console.log(`   - Cards processed: ${cardsToFix.length}`);
            console.log(`   - Cards fixed: ${fixedCount}`);
            console.log(`   - Errors: ${errorCount}`);
            
        } catch (error) {
            console.error('❌ Error in multiplier fix process:', error.message);
        }
    }

    async updateCardMultiplier(cardId, multiplier) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/admin/update-card`, {
                id: cardId,
                multiplier: multiplier
            });
            
            if (response.data.success) {
                return true;
            } else {
                throw new Error(response.data.error || 'Update failed');
            }
        } catch (error) {
            throw new Error(`Failed to update card ${cardId}: ${error.message}`);
        }
    }
}

async function main() {
    const fixer = new MultiplierFixer();
    await fixer.fixMultipliers();
}

main();

