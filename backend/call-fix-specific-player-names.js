const https = require('https');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(endpoint, method = 'POST', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve({
                        status: 'success',
                        data: result
                    });
                } catch (error) {
                    resolve({
                        status: 'error',
                        code: res.statusCode,
                        message: 'Invalid JSON response',
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                status: 'error',
                code: 500,
                message: error.message
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({
                status: 'error',
                code: 408,
                message: 'Request timeout'
            });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function fixSpecificPlayerNames() {
    console.log('🔧 Calling specific player name fix endpoint...\n');
    
    try {
        const result = await makeRequest('/api/admin/fix-specific-player-names');
        
        if (result.status === 'success') {
            console.log('✅ Specific player name fixes completed successfully!');
            console.log(`📊 ${result.data.cardsUpdated} cards updated`);
            console.log('📝 Message:', result.data.message);
            console.log('🕐 Timestamp:', result.data.timestamp);
        } else {
            console.error('❌ Failed to fix specific player names:', result);
        }
        
    } catch (error) {
        console.error('❌ Error calling fix endpoint:', error);
    }
}

// Run the fix
fixSpecificPlayerNames();
