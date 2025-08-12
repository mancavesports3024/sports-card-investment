const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function debugRailwayFieldNames() {
    console.log('🔍 Debugging Railway API field names...\n');
    
    try {
        // Fetch a single card from Railway using PowerShell
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=1\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards || data.cards.length === 0) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const card = data.cards[0];
        console.log(`✅ Retrieved card ID: ${card.id}`);
        
        console.log('\n📊 ACTUAL FIELD NAMES AND VALUES:');
        console.log('='.repeat(50));
        
        // Log all field names and their values
        Object.keys(card).forEach(key => {
            console.log(`${key}: ${JSON.stringify(card[key])}`);
        });
        
        console.log('\n🔍 FIELD NAME ANALYSIS:');
        console.log('='.repeat(50));
        
        // Check for price-related fields
        const priceFields = Object.keys(card).filter(key => 
            key.toLowerCase().includes('price') || 
            key.toLowerCase().includes('psa') ||
            key.toLowerCase().includes('raw') ||
            key.toLowerCase().includes('average')
        );
        
        console.log('Price-related fields found:');
        priceFields.forEach(field => {
            console.log(`   ${field}: ${JSON.stringify(card[field])}`);
        });
        
        // Check for other important fields
        const otherFields = Object.keys(card).filter(key => 
            !priceFields.includes(key)
        );
        
        console.log('\nOther fields:');
        otherFields.forEach(field => {
            console.log(`   ${field}: ${JSON.stringify(card[field])}`);
        });
        
    } catch (error) {
        console.error('❌ Error debugging Railway field names:', error.message);
    }
}

debugRailwayFieldNames();
