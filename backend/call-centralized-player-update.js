/**
 * Call Centralized Player Update API
 * 
 * This script calls the new API endpoint to update all player names
 * using the new centralized SimplePlayerExtractor system.
 */

const https = require('https');
const http = require('http');

// Railway app URL
const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(endpoint, method = 'POST') {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, RAILWAY_URL);
        const client = url.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = client.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({
                        status: res.statusCode < 400 ? 'success' : 'error',
                        data: result,
                        statusCode: res.statusCode
                    });
                } catch (error) {
                    resolve({
                        status: 'error',
                        data: data,
                        statusCode: res.statusCode,
                        error: error.message
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function callCentralizedPlayerUpdate() {
    console.log('🚀 Calling centralized player name update API...\n');

    try {
        console.log('📡 Making request to Railway API...');
        const result = await makeRequest('/api/admin/update-player-names-centralized', 'POST');
        
        if (result.status === 'success') {
            console.log('✅ Centralized player name update completed successfully!');
            console.log('📊 Response:', JSON.stringify(result.data, null, 2));
        } else {
            console.log('❌ Centralized player name update failed:');
            console.log('Status Code:', result.statusCode);
            console.log('Response:', JSON.stringify(result.data, null, 2));
        }

    } catch (error) {
        console.error('❌ Error calling centralized player update API:', error);
    }
}

// Run the API call
callCentralizedPlayerUpdate();
