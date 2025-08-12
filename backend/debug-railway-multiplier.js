const axios = require('axios');

async function debugRailwayMultiplier() {
    try {
        console.log('🔍 Checking multiplier values in Railway database...\n');
        
        // Get cards from Railway admin endpoint
        const response = await axios.get('https://web-production-9efa.up.railway.app/api/admin/cards?limit=50');
        const cards = response.data.cards;
        
        console.log(`📊 Found ${cards.length} cards in Railway database`);
        
        // Filter cards with multiplier values
        const cardsWithMultiplier = cards.filter(card => 
            card.multiplier && 
            card.multiplier !== 'N/A' && 
            card.psa10Price && 
            card.rawAveragePrice
        );
        
        console.log(`📊 Found ${cardsWithMultiplier.length} cards with multiplier values\n`);
        
        if (cardsWithMultiplier.length > 0) {
            console.log('Sample cards with multiplier values:');
            console.log('Title | PSA10 Price | Raw Avg Price | Stored Multiplier | Calculated Multiplier');
            console.log('------|-------------|---------------|-------------------|---------------------');
            
            for (const card of cardsWithMultiplier.slice(0, 10)) {
                const calculated = (card.psa10Price / card.rawAveragePrice).toFixed(2);
                const title = card.title.length > 50 ? card.title.substring(0, 47) + '...' : card.title;
                console.log(`${title} | $${card.psa10Price} | $${card.rawAveragePrice} | ${card.multiplier}x | ${calculated}x`);
            }
            
            // Check for specific 6.96 multiplier
            const specificCards = cardsWithMultiplier.filter(card => 
                parseFloat(card.multiplier) === 6.96
            );
            
            if (specificCards.length > 0) {
                console.log('\n🔍 Cards with 6.96x multiplier:');
                for (const card of specificCards) {
                    const calculated = (card.psa10Price / card.rawAveragePrice).toFixed(2);
                    console.log(`Title: ${card.title}`);
                    console.log(`PSA10: $${card.psa10Price}, Raw: $${card.rawAveragePrice}`);
                    console.log(`Stored: ${card.multiplier}x, Calculated: ${calculated}x`);
                    console.log('---');
                }
            } else {
                console.log('\nNo cards found with 6.96x multiplier');
            }
            
            // Check for any multiplier > 5x
            const highMultipliers = cardsWithMultiplier.filter(card => 
                parseFloat(card.multiplier) > 5
            );
            
            if (highMultipliers.length > 0) {
                console.log('\n🔍 Cards with multiplier > 5x:');
                for (const card of highMultipliers.slice(0, 5)) {
                    const calculated = (card.psa10Price / card.rawAveragePrice).toFixed(2);
                    console.log(`Title: ${card.title}`);
                    console.log(`PSA10: $${card.psa10Price}, Raw: $${card.rawAveragePrice}`);
                    console.log(`Stored: ${card.multiplier}x, Calculated: ${calculated}x`);
                    console.log('---');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugRailwayMultiplier();

