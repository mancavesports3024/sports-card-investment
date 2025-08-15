const https = require('https');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(endpoint, method = 'POST') {
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

async function clearAndUpdatePlayerNames() {
    console.log('🧹 Clearing and updating player names...\n');

    try {
        // 1. Clear all player names first
        console.log('🗑️ Clearing all player names...');
        const clearResult = await makeRequest('/api/admin/clear-player-names', 'POST');
        console.log('Clear result:', clearResult);

        // Wait a moment for the clear operation to complete
        console.log('⏳ Waiting for clear operation to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 2. Add player names with latest fixes
        console.log('\n👤 Adding player names with latest fixes...');
        const playerResult = await makeRequest('/api/admin/add-player-names', 'POST');
        console.log('Player names result:', playerResult);

        console.log('\n✅ Player name clear and update completed!');

    } catch (error) {
        console.error('❌ Error clearing and updating player names:', error);
    }
}

// Run the focused player name update
clearAndUpdatePlayerNames();
