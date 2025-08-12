const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function analyzeRailwayFull() {
    console.log('🔍 Analyzing FULL Railway database (all cards)...\n');
    
    try {
        // Fetch ALL data from Railway using PowerShell with a high limit
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=1000\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const cards = data.cards;
        console.log(`✅ Retrieved ${cards.length} cards from Railway database`);
        
        console.log('\n📊 FULL RAILWAY DATABASE ANALYSIS:');
        console.log('='.repeat(60));
        
        // Basic statistics
        const totalCards = cards.length;
        const sports = [...new Set(cards.map(c => c.sport).filter(Boolean))];
        
        console.log(`Total Cards: ${totalCards}`);
        console.log(`Unique Sports: ${sports.length} (${sports.join(', ')})`);
        
        // Price analysis using correct field names
        const cardsWithPSA10 = cards.filter(c => c.psa10Price);
        const cardsWithRaw = cards.filter(c => c.rawAveragePrice);
        const cardsWithPSA9 = cards.filter(c => c.psa9AveragePrice);
        const cardsWithMultiplier = cards.filter(c => c.multiplier);
        
        console.log(`\n💰 PRICE ANALYSIS:`);
        console.log(`Cards with PSA 10 prices: ${cardsWithPSA10.length}/${totalCards}`);
        console.log(`Cards with raw prices: ${cardsWithRaw.length}/${totalCards}`);
        console.log(`Cards with PSA 9 prices: ${cardsWithPSA9.length}/${totalCards}`);
        console.log(`Cards with multipliers: ${cardsWithMultiplier.length}/${totalCards}`);
        
        // Check for price anomalies
        const cardsWithBoth = cards.filter(c => c.rawAveragePrice && c.psa10Price);
        const anomalies = cardsWithBoth.filter(c => parseFloat(c.rawAveragePrice) > parseFloat(c.psa10Price));
        
        console.log(`\n🔍 PRICE ANOMALIES:`);
        console.log(`Cards with both raw and PSA 10: ${cardsWithBoth.length}/${totalCards}`);
        console.log(`Price anomalies (raw > PSA10): ${anomalies.length}`);
        
        if (anomalies.length > 0) {
            console.log('\n⚠️  ANOMALIES FOUND:');
            anomalies.forEach(card => {
                console.log(`   ${card.title}: Raw $${card.rawAveragePrice} > PSA10 $${card.psa10Price}`);
            });
        }
        
        // Price ranges
        if (cardsWithPSA10.length > 0) {
            const psa10Prices = cardsWithPSA10.map(c => parseFloat(c.psa10Price)).filter(p => !isNaN(p));
            const avgPSA10Price = psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length;
            const maxPSA10Price = Math.max(...psa10Prices);
            const minPSA10Price = Math.min(...psa10Prices);
            
            console.log(`\n💰 PRICE RANGES:`);
            console.log(`Average PSA 10 Price: $${avgPSA10Price.toFixed(2)}`);
            console.log(`Max PSA 10 Price: $${maxPSA10Price.toFixed(2)}`);
            console.log(`Min PSA 10 Price: $${minPSA10Price.toFixed(2)}`);
        }
        
        // Data quality summary
        console.log(`\n🔍 DATA QUALITY SUMMARY:`);
        console.log(`Complete data (sport + prices + multiplier): ${cards.filter(c => c.sport && c.psa10Price && c.rawAveragePrice && c.multiplier).length}/${totalCards}`);
        console.log(`Missing sport: ${cards.filter(c => !c.sport).length}`);
        console.log(`Missing PSA 10 prices: ${cards.filter(c => !c.psa10Price).length}`);
        console.log(`Missing raw prices: ${cards.filter(c => !c.rawAveragePrice).length}`);
        console.log(`Missing multipliers: ${cards.filter(c => !c.multiplier).length}`);
        
        // Show some sample cards from different parts of the database
        console.log(`\n📋 SAMPLE CARDS (first, middle, last):`);
        const firstCard = cards[0];
        const middleCard = cards[Math.floor(cards.length / 2)];
        const lastCard = cards[cards.length - 1];
        
        [firstCard, middleCard, lastCard].forEach((card, index) => {
            const position = index === 0 ? 'FIRST' : index === 1 ? 'MIDDLE' : 'LAST';
            console.log(`\n${position} CARD (ID: ${card.id}):`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Sport: ${card.sport || 'N/A'}`);
            console.log(`   PSA 10: $${card.psa10Price || 'N/A'}`);
            console.log(`   Raw: $${card.rawAveragePrice || 'N/A'}`);
            console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
        });
        
    } catch (error) {
        console.error('❌ Error analyzing Railway full database:', error.message);
    }
}

analyzeRailwayFull();
