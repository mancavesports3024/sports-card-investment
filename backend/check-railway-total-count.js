const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function checkRailwayTotalCount() {
    console.log('🔍 Checking Railway database total count...\n');
    
    try {
        // Fetch a small sample to get pagination info
        const { stdout } = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/cards?limit=10\' -Method GET | Select-Object -ExpandProperty Content"');
        
        const data = JSON.parse(stdout.trim());
        
        if (!data.success || !data.cards) {
            console.error('❌ Invalid response from Railway');
            return;
        }
        
        const cards = data.cards;
        const pagination = data.pagination;
        
        console.log(`✅ Retrieved ${cards.length} cards from Railway database`);
        console.log('\n📊 PAGINATION INFO:');
        console.log('='.repeat(50));
        
        if (pagination) {
            console.log(`Page: ${pagination.page}`);
            console.log(`Limit: ${pagination.limit}`);
            console.log(`Total: ${pagination.total?.total || 'N/A'}`);
            console.log(`Total Pages: ${pagination.totalPages}`);
            console.log(`Has Next Page: ${pagination.hasNextPage}`);
            console.log(`Has Prev Page: ${pagination.hasPrevPage}`);
        } else {
            console.log('No pagination info found');
        }
        
        console.log('\n📋 SAMPLE CARDS:');
        console.log('='.repeat(50));
        
        cards.forEach((card, index) => {
            console.log(`${index + 1}. ID: ${card.id} - ${card.title}`);
        });
        
        // Try to get the total count by checking the highest ID
        const highestId = Math.max(...cards.map(c => c.id));
        console.log(`\n🔍 HIGHEST CARD ID: ${highestId}`);
        
        // Estimate total based on highest ID (assuming sequential IDs)
        console.log(`📊 ESTIMATED TOTAL CARDS: ${highestId} (based on highest ID)`);
        
    } catch (error) {
        console.error('❌ Error checking Railway total count:', error.message);
    }
}

checkRailwayTotalCount();
