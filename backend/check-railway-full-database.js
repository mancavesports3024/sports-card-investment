const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function checkRailwayFullDatabase() {
    console.log('🔍 Checking full Railway production database...\n');
    
    try {
        // Fetch all data from Railway using PowerShell
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=1000\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const cards = data.cards;
        console.log(`✅ Retrieved ${cards.length} cards from Railway database`);
        
        console.log('\n📊 FULL RAILWAY DATABASE ANALYSIS:');
        console.log('='.repeat(50));
        
        // Basic statistics
        const totalCards = cards.length;
        const sports = [...new Set(cards.map(c => c.sport).filter(Boolean))];
        const years = [...new Set(cards.map(c => c.year).filter(Boolean))];
        const brands = [...new Set(cards.map(c => c.brand).filter(Boolean))];
        
        console.log(`Total Cards: ${totalCards}`);
        console.log(`Unique Sports: ${sports.length} (${sports.join(', ')})`);
        console.log(`Unique Years: ${years.length} (${years.sort().join(', ')})`);
        console.log(`Unique Brands: ${brands.length} (${brands.join(', ')})`);
        
        // Price analysis
        const cardsWithRawPrices = cards.filter(c => c.raw_average_price);
        const cardsWithPSA10Prices = cards.filter(c => c.psa10_price);
        const cardsWithBothPrices = cards.filter(c => c.raw_average_price && c.psa10_price);
        const priceAnomalies = cardsWithBothPrices.filter(c => c.raw_average_price > c.psa10_price);
        const nullMultipliers = cards.filter(c => !c.multiplier);
        const nullSummaries = cards.filter(c => !c.summary_title);
        
        console.log(`\n💰 PRICE ANALYSIS:`);
        console.log(`Cards with raw prices: ${cardsWithRawPrices.length}/${totalCards}`);
        console.log(`Cards with PSA 10 prices: ${cardsWithPSA10Prices.length}/${totalCards}`);
        console.log(`Cards with both prices: ${cardsWithBothPrices.length}/${totalCards}`);
        console.log(`Price anomalies (raw > PSA10): ${priceAnomalies.length}`);
        console.log(`Cards with null multipliers: ${nullMultipliers.length}`);
        console.log(`Cards with null summaries: ${nullSummaries.length}`);
        
        // Show some sample cards with prices
        const cardsWithPrices = cards.filter(c => c.psa10_price);
        console.log(`\n📋 SAMPLE CARDS WITH PRICES (first 5):`);
        cardsWithPrices.slice(0, 5).forEach((card, index) => {
            console.log(`\n${index + 1}. ${card.title}`);
            console.log(`   Sport: ${card.sport || 'N/A'}`);
            console.log(`   Year: ${card.year || 'N/A'}`);
            console.log(`   Raw: $${card.raw_average_price || 'N/A'}`);
            console.log(`   PSA10: $${card.psa10_price || 'N/A'}`);
            console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
            console.log(`   Summary: ${card.summary_title || 'N/A'}`);
        });
        
        // Show anomalies if any
        if (priceAnomalies.length > 0) {
            console.log(`\n⚠️  PRICE ANOMALIES:`);
            priceAnomalies.slice(0, 10).forEach(card => {
                console.log(`   ${card.title}: Raw $${card.raw_average_price} > PSA10 $${card.psa10_price}`);
            });
            if (priceAnomalies.length > 10) {
                console.log(`   ... and ${priceAnomalies.length - 10} more`);
            }
        }
        
        // Data quality summary
        console.log(`\n🔍 DATA QUALITY SUMMARY:`);
        console.log(`Complete data: ${cards.filter(c => c.sport && c.year && c.raw_average_price && c.psa10_price && c.multiplier).length}/${totalCards}`);
        console.log(`Missing sport: ${cards.filter(c => !c.sport).length}`);
        console.log(`Missing year: ${cards.filter(c => !c.year).length}`);
        console.log(`Missing raw prices: ${cards.filter(c => !c.raw_average_price).length}`);
        console.log(`Missing PSA 10 prices: ${cards.filter(c => !c.psa10_price).length}`);
        console.log(`Missing multipliers: ${nullMultipliers.length}`);
        console.log(`Missing summaries: ${nullSummaries.length}`);
        
        // Price ranges
        if (cardsWithPSA10Prices.length > 0) {
            const psa10Prices = cardsWithPSA10Prices.map(c => parseFloat(c.psa10_price)).filter(p => !isNaN(p));
            const avgPSA10Price = psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length;
            const maxPSA10Price = Math.max(...psa10Prices);
            const minPSA10Price = Math.min(...psa10Prices);
            
            console.log(`\n💰 PRICE RANGES:`);
            console.log(`Average PSA 10 Price: $${avgPSA10Price.toFixed(2)}`);
            console.log(`Max PSA 10 Price: $${maxPSA10Price.toFixed(2)}`);
            console.log(`Min PSA 10 Price: $${minPSA10Price.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error('❌ Error checking Railway full database:', error.message);
    }
}

checkRailwayFullDatabase();
