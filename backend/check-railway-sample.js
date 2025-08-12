const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function checkRailwaySample() {
    console.log('🔍 Checking Railway database sample...\n');
    
    try {
        // Fetch a small sample from Railway using PowerShell
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=10\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const cards = data.cards;
        console.log(`✅ Retrieved ${cards.length} cards from Railway database sample`);
        
        console.log('\n📊 RAILWAY SAMPLE ANALYSIS:');
        console.log('='.repeat(50));
        
        // Show detailed card information
        cards.forEach((card, index) => {
            console.log(`\n${index + 1}. ID: ${card.id}`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Summary: ${card.summary_title || 'N/A'}`);
            console.log(`   Sport: ${card.sport || 'N/A'}`);
            console.log(`   Year: ${card.year || 'N/A'}`);
            console.log(`   Brand: ${card.brand || 'N/A'}`);
            console.log(`   Raw Price: $${card.raw_average_price || 'N/A'}`);
            console.log(`   PSA 10 Price: $${card.psa10_price || 'N/A'}`);
            console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
            console.log(`   Created: ${card.created_at || 'N/A'}`);
            console.log(`   Updated: ${card.last_updated || 'N/A'}`);
        });
        
        // Count cards with prices
        const cardsWithPSA10 = cards.filter(c => c.psa10_price);
        const cardsWithRaw = cards.filter(c => c.raw_average_price);
        const cardsWithMultiplier = cards.filter(c => c.multiplier);
        
        console.log(`\n🔍 SAMPLE STATISTICS:`);
        console.log(`Cards with PSA 10 prices: ${cardsWithPSA10.length}/${cards.length}`);
        console.log(`Cards with raw prices: ${cardsWithRaw.length}/${cards.length}`);
        console.log(`Cards with multipliers: ${cardsWithMultiplier.length}/${cards.length}`);
        
        // Check for price anomalies
        const cardsWithBoth = cards.filter(c => c.raw_average_price && c.psa10_price);
        const anomalies = cardsWithBoth.filter(c => parseFloat(c.raw_average_price) > parseFloat(c.psa10_price));
        
        if (anomalies.length > 0) {
            console.log(`\n⚠️  PRICE ANOMALIES IN SAMPLE:`);
            anomalies.forEach(card => {
                console.log(`   ${card.title}: Raw $${card.raw_average_price} > PSA10 $${card.psa10_price}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking Railway sample:', error.message);
    }
}

checkRailwaySample();
