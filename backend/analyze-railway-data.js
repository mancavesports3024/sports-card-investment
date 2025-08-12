const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function analyzeRailwayData() {
    console.log('🔍 Analyzing Railway production database...\n');
    
    try {
        // Fetch data from Railway using PowerShell
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=100\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const cards = data.cards;
        console.log(`✅ Retrieved ${cards.length} cards from Railway database`);
        
        console.log('\n📊 RAILWAY DATABASE ANALYSIS:');
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
        const cardsWithPrices = cards.filter(c => c.raw_average_price && c.psa10_price);
        const priceAnomalies = cardsWithPrices.filter(c => c.raw_average_price > c.psa10_price);
        const nullMultipliers = cards.filter(c => !c.multiplier);
        const nullSummaries = cards.filter(c => !c.summary_title);
        
        console.log(`\n💰 PRICE ANALYSIS:`);
        console.log(`Cards with price data: ${cardsWithPrices.length}/${totalCards}`);
        console.log(`Price anomalies (raw > PSA10): ${priceAnomalies.length}`);
        console.log(`Cards with null multipliers: ${nullMultipliers.length}`);
        console.log(`Cards with null summaries: ${nullSummaries.length}`);
        
        // Show some sample cards
        console.log(`\n📋 SAMPLE CARDS (first 5):`);
        cards.slice(0, 5).forEach((card, index) => {
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
            priceAnomalies.forEach(card => {
                console.log(`   ${card.title}: Raw $${card.raw_average_price} > PSA10 $${card.psa10_price}`);
            });
        }
        
        // Data quality summary
        console.log(`\n🔍 DATA QUALITY SUMMARY:`);
        console.log(`Complete data: ${cards.filter(c => c.sport && c.year && c.raw_average_price && c.psa10_price && c.multiplier).length}/${totalCards}`);
        console.log(`Missing sport: ${cards.filter(c => !c.sport).length}`);
        console.log(`Missing year: ${cards.filter(c => !c.year).length}`);
        console.log(`Missing prices: ${cards.filter(c => !c.raw_average_price || !c.psa10_price).length}`);
        console.log(`Missing multipliers: ${nullMultipliers.length}`);
        
    } catch (error) {
        console.error('❌ Error analyzing Railway data:', error.message);
    }
}

analyzeRailwayData();
