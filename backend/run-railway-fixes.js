const https = require('https');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: endpoint,
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
                    resolve({ success: false, error: 'Invalid JSON response', data: data });
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
    console.log('🚀 Starting Railway database fixes...\n');

    try {
        // 1. Check Railway database structure
        console.log('🔍 Checking Railway database structure...');
        const checkResult = await makeRequest('/api/admin/check-railway-database', 'POST');
        console.log('Database check result:', checkResult);

        // 2. Fix database schema
        console.log('\n🔧 Fixing Railway database schema...');
        const schemaResult = await makeRequest('/api/fix-railway-database-schema', 'POST');
        console.log('Schema fix result:', schemaResult);

        // 3. Add player names
        console.log('\n👤 Adding player names...');
        const playerResult = await makeRequest('/api/admin/add-player-names', 'POST');
        console.log('Player names result:', playerResult);

        // 4. Update sport detection
        console.log('\n⚽ Updating sport detection...');
        const sportResult = await makeRequest('/api/admin/update-sport-detection', 'POST');
        console.log('Sport detection result:', sportResult);

        // 5. Update summary titles
        console.log('\n📝 Updating summary titles...');
        const titleResult = await makeRequest('/api/admin/update-summary-titles', 'POST');
        console.log('Summary titles result:', titleResult);

        // 6. Update prices
        console.log('\n💰 Updating prices...');
        const priceResult = await makeRequest('/api/admin/update-prices', 'POST');
        console.log('Price update result:', priceResult);

        // 7. Generate good buy opportunities
        console.log('\n🎯 Generating good buy opportunities...');
        const goodBuyResult = await makeRequest('/api/admin/generate-good-buys', 'POST');
        console.log('Good buy opportunities result:', goodBuyResult);

        console.log('\n✅ All Railway fixes completed!');

    } catch (error) {
        console.error('❌ Error running Railway fixes:', error);
    }
}

// Run the fixes
runRailwayFixes();
