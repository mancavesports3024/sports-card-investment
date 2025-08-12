const axios = require('axios');

async function checkRailwayDataSample() {
    console.log('🔍 Checking Railway production database sample...\n');
    
    try {
        // Get a sample of cards from Railway
        const response = await axios.get('https://web-production-9efa.up.railway.app/api/admin/cards?limit=10', {
            timeout: 30000
        });
        
        console.log('✅ Railway database sample retrieved successfully!');
        console.log('\n📊 SAMPLE DATA ANALYSIS:');
        console.log('='.repeat(50));
        
        const cards = response.data.cards || [];
        console.log(`Total cards in sample: ${cards.length}`);
        
        if (cards.length > 0) {
            console.log('\n📋 SAMPLE CARD DETAILS:');
            cards.forEach((card, index) => {
                console.log(`\n${index + 1}. ${card.title}`);
                console.log(`   Sport: ${card.sport}`);
                console.log(`   Year: ${card.year}`);
                console.log(`   Raw Price: $${card.raw_average_price || 'N/A'}`);
                console.log(`   PSA 10 Price: $${card.psa10_price || 'N/A'}`);
                console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
                console.log(`   Summary: ${card.summary_title || 'N/A'}`);
            });
            
            // Analyze the sample
            const prices = cards.filter(c => c.raw_average_price && c.psa10_price);
            const anomalies = prices.filter(c => c.raw_average_price > c.psa10_price);
            const nullMultipliers = cards.filter(c => !c.multiplier);
            
            console.log('\n🔍 SAMPLE ANALYSIS:');
            console.log(`Cards with price data: ${prices.length}/${cards.length}`);
            console.log(`Price anomalies (raw > PSA10): ${anomalies.length}`);
            console.log(`Cards with null multipliers: ${nullMultipliers.length}`);
            
            if (anomalies.length > 0) {
                console.log('\n⚠️  PRICE ANOMALIES FOUND:');
                anomalies.forEach(card => {
                    console.log(`   ${card.title}: Raw $${card.raw_average_price} > PSA10 $${card.psa10_price}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking Railway database sample:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received from Railway');
        } else {
            console.error('Error:', error.message);
        }
    }
}

checkRailwayDataSample();
