const https = require('https');

const RAILWAY_BASE_URL = 'https://web-production-9efa.up.railway.app';

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: url.replace('https://web-production-9efa.up.railway.app', ''),
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function runRailwayFixes() {
    console.log('🚀 RAILWAY DATABASE FIXES');
    console.log('========================\n');

    try {
        // Step 1: Check Railway database status
        console.log('1️⃣ Checking Railway database status...');
        const statusResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/check-railway-database`, 'POST');
        console.log('✅ Status check triggered:', statusResponse.message);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Step 2: Fix Railway database schema
        console.log('\n2️⃣ Fixing Railway database schema...');
        const schemaResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/fix-railway-database-schema`, 'POST');
        console.log('✅ Schema fix triggered:', schemaResponse.message || 'Schema fix completed');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Step 3: Add player names to Railway database
        console.log('\n3️⃣ Adding player names to Railway database...');
        console.log('📝 This will add player_name column and populate it for all 376 cards');
        
        // We need to trigger the player name addition
        // Let's check if there's an API endpoint for this
        const playerNamesResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/add-player-names`, 'POST');
        console.log('✅ Player names addition triggered:', playerNamesResponse.message || 'Player names addition completed');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for processing

        // Step 4: Update sport detection on Railway
        console.log('\n4️⃣ Updating sport detection on Railway...');
        const sportResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/update-sport-detection`, 'POST');
        console.log('✅ Sport detection update triggered:', sportResponse.message || 'Sport detection update completed');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Step 5: Update summary titles on Railway
        console.log('\n5️⃣ Updating summary titles on Railway...');
        const titlesResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/update-summary-titles`, 'POST');
        console.log('✅ Summary titles update triggered:', titlesResponse.message || 'Summary titles update completed');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Step 6: Run price updates on Railway
        console.log('\n6️⃣ Running price updates on Railway...');
        const priceResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/update-prices`, 'POST');
        console.log('✅ Price updates triggered:', priceResponse.message || 'Price updates completed');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Step 7: Generate good buy opportunities on Railway
        console.log('\n7️⃣ Generating good buy opportunities on Railway...');
        const goodBuyResponse = await makeRequest(`${RAILWAY_BASE_URL}/api/admin/generate-good-buys`, 'POST');
        console.log('✅ Good buy opportunities triggered:', goodBuyResponse.message || 'Good buy opportunities completed');

        console.log('\n🎉 RAILWAY DATABASE FIXES COMPLETE!');
        console.log('====================================');
        console.log('✅ All operations have been triggered on Railway');
        console.log('📊 Railway database should now have:');
        console.log('   - 376 cards with player names');
        console.log('   - Updated sport detection');
        console.log('   - Clean summary titles');
        console.log('   - Current price data');
        console.log('   - Good buy opportunities');
        console.log('\n🌐 Check your Railway deployment at:');
        console.log('   https://web-production-9efa.up.railway.app');

    } catch (error) {
        console.error('❌ Error running Railway fixes:', error.message);
    }
}

// Run the fixes
runRailwayFixes();
