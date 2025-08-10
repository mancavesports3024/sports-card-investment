const axios = require('axios');

async function checkRailwaySports() {
    const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';
    
    try {
        console.log('🔍 Checking sport distribution in Railway database...\n');
        
        // Get database stats
        const statsResponse = await axios.get(`${RAILWAY_URL}/api/database-status`);
        const stats = statsResponse.data.stats;
        console.log(`📊 Database Stats: ${stats.total} total cards, ${stats.withPrices} with prices`);
        
        // Get recent cards to check sport detection
        const cardsResponse = await axios.get(`${RAILWAY_URL}/api/admin/cards?limit=20`);
        const cards = cardsResponse.data.cards;
        
        console.log('\n📋 Recent cards with sport detection:');
        console.log('=====================================');
        
        cards.forEach((card, index) => {
            console.log(`${index + 1}. ${card.title}`);
            console.log(`   Sport: ${card.sport || 'Unknown'}`);
            console.log(`   PSA 10: $${card.psa10_price || 'N/A'}`);
            console.log(`   Raw: $${card.raw_average_price || 'N/A'}`);
            console.log(`   PSA 9: $${card.psa9_average_price || 'N/A'}`);
            console.log('');
        });
        
        // Check for specific players we were testing
        console.log('🔍 Checking for specific test players:');
        console.log('=====================================');
        
        const testPlayers = ['Stephon Castle', 'Drake Maye', 'Victor Wembanyama', 'Rome Odunze', 'Lando Norris', 'Justin Herbert'];
        
        for (const player of testPlayers) {
            try {
                const searchResponse = await axios.get(`${RAILWAY_URL}/api/admin/cards?search=${encodeURIComponent(player)}&limit=5`);
                const foundCards = searchResponse.data.cards;
                
                if (foundCards.length > 0) {
                    console.log(`✅ Found ${foundCards.length} card(s) for ${player}:`);
                    foundCards.forEach(card => {
                        console.log(`   - ${card.title}`);
                        console.log(`     Sport: ${card.sport || 'Unknown'}`);
                    });
                } else {
                    console.log(`❌ No cards found for ${player}`);
                }
                console.log('');
            } catch (error) {
                console.log(`❌ Error searching for ${player}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking Railway database:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

checkRailwaySports().then(() => {
    console.log('✅ Check complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Check failed:', error);
    process.exit(1);
});
