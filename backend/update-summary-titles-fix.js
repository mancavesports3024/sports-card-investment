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

async function updateSummaryTitles() {
    console.log('🔄 Updating summary titles with duplication fixes...\n');
    
    try {
        console.log('📝 Starting summary titles update...');
        const result = await makeRequest('/api/admin/update-summary-titles', 'POST');
        
        if (result.success) {
            console.log('✅ Summary titles updated successfully!');
            console.log('📊 Result:', result);
        } else {
            console.log('❌ Summary titles update failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Error updating summary titles:', error);
    }
}

// Run the summary titles update
updateSummaryTitles();

