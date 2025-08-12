const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function analyzeRailwayComplete() {
    console.log('🔍 Analyzing COMPLETE Railway database (all 385 cards)...\n');
    
    try {
        let allCards = [];
        const totalPages = 39; // Based on pagination info
        const limit = 10; // Cards per page
        
        console.log(`📊 Fetching ${totalPages} pages with ${limit} cards each...`);
        
        // Fetch all pages
        for (let page = 1; page <= totalPages; page++) {
            console.log(`   Fetching page ${page}/${totalPages}...`);
            
            const { stdout } = await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://web-production-9efa.up.railway.app/api/admin/cards?page=${page}&limit=${limit}' -Method GET | Select-Object -ExpandProperty Content"`);
            
            const data = JSON.parse(stdout.trim());
            
            if (data.success && data.cards) {
                allCards = allCards.concat(data.cards);
            }
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Retrieved ${allCards.length} cards from Railway database`);
        
        console.log('\n📊 COMPLETE RAILWAY DATABASE ANALYSIS:');
        console.log('='.repeat(60));
        
        // Basic statistics
        const totalCards = allCards.length;
        const sports = [...new Set(allCards.map(c => c.sport).filter(Boolean))];
        
        console.log(`Total Cards: ${totalCards}`);
        console.log(`Unique Sports: ${sports.length} (${sports.join(', ')})`);
        
        // Price analysis using correct field names
        const cardsWithPSA10 = allCards.filter(c => c.psa10Price);
        const cardsWithRaw = allCards.filter(c => c.rawAveragePrice);
        const cardsWithPSA9 = allCards.filter(c => c.psa9AveragePrice);
        const cardsWithMultiplier = allCards.filter(c => c.multiplier);
        
        console.log(`\n💰 PRICE ANALYSIS:`);
        console.log(`Cards with PSA 10 prices: ${cardsWithPSA10.length}/${totalCards}`);
        console.log(`Cards with raw prices: ${cardsWithRaw.length}/${totalCards}`);
        console.log(`Cards with PSA 9 prices: ${cardsWithPSA9.length}/${totalCards}`);
        console.log(`Cards with multipliers: ${cardsWithMultiplier.length}/${totalCards}`);
        
        // Check for price anomalies
        const cardsWithBoth = allCards.filter(c => c.rawAveragePrice && c.psa10Price);
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
        console.log(`Complete data (sport + prices + multiplier): ${allCards.filter(c => c.sport && c.psa10Price && c.rawAveragePrice && c.multiplier).length}/${totalCards}`);
        console.log(`Missing sport: ${allCards.filter(c => !c.sport).length}`);
        console.log(`Missing PSA 10 prices: ${allCards.filter(c => !c.psa10Price).length}`);
        console.log(`Missing raw prices: ${allCards.filter(c => !c.rawAveragePrice).length}`);
        console.log(`Missing multipliers: ${allCards.filter(c => !c.multiplier).length}`);
        
        // Show sample cards from different parts of the database
        console.log(`\n📋 SAMPLE CARDS (first, middle, last):`);
        const firstCard = allCards[0];
        const middleCard = allCards[Math.floor(allCards.length / 2)];
        const lastCard = allCards[allCards.length - 1];
        
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
        console.error('❌ Error analyzing Railway complete database:', error.message);
    }
}

analyzeRailwayComplete();
