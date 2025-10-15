const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function checkProxyMeshLimits() {
    try {
        console.log('🔍 Checking ProxyMesh account limits and usage...');
        
        // Check if we have credentials
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        
        if (!username || !password) {
            console.log('❌ ProxyMesh credentials not found');
            return;
        }
        
        console.log(`✅ ProxyMesh Username: ${username}`);
        
        // Test each proxy server individually to see which ones work
        const proxyServers = [
            'us-ca.proxymesh.com:31280',
            'us-il.proxymesh.com:31280', 
            'us-ny.proxymesh.com:31280',
            'us-fl.proxymesh.com:31280',
            'us-wa.proxymesh.com:31280'
        ];
        
        console.log('\n🧪 Testing each ProxyMesh server individually...');
        
        for (let i = 0; i < proxyServers.length; i++) {
            const server = proxyServers[i];
            console.log(`\n--- Testing server ${i + 1}: ${server} ---`);
            
            try {
                const proxyUrl = `http://${username}:${password}@${server}`;
                const httpsAgent = new HttpsProxyAgent(proxyUrl);
                
                // Simple test request
                const testUrl = 'https://httpbin.org/ip'; // Returns IP info
                
                const startTime = Date.now();
                const response = await axios.get(testUrl, {
                    httpsAgent: httpsAgent,
                    timeout: 10000
                });
                const duration = Date.now() - startTime;
                
                console.log(`   ✅ Server ${i + 1}: SUCCESS (${duration}ms)`);
                console.log(`   📍 IP: ${JSON.parse(response.data).origin}`);
                
            } catch (error) {
                console.log(`   ❌ Server ${i + 1}: ${error.message}`);
                if (error.response) {
                    console.log(`      Status: ${error.response.status} ${error.response.statusText}`);
                    if (error.response.status === 402) {
                        console.log(`      🚨 402 ERROR: Likely account limit reached`);
                        console.log(`      Possible causes:`);
                        console.log(`        - Monthly bandwidth limit exceeded`);
                        console.log(`        - Request rate limit exceeded`);
                        console.log(`        - Account suspension or payment issue`);
                        if (error.response.data) {
                            console.log(`      Response: ${error.response.data.substring(0, 200)}`);
                        }
                    }
                }
            }
        }
        
        // Test rapid requests to trigger rate limit
        console.log(`\n🚀 Testing rapid requests to identify rate limit...`);
        const rapidTestUrl = 'https://httpbin.org/status/200';
        
        for (let i = 1; i <= 10; i++) {
            try {
                const proxyUrl = `http://${username}:${password}@${proxyServers[0]}`;
                const httpsAgent = new HttpsProxyAgent(proxyUrl);
                
                const startTime = Date.now();
                await axios.get(rapidTestUrl, {
                    httpsAgent: httpsAgent,
                    timeout: 5000
                });
                const duration = Date.now() - startTime;
                
                console.log(`   Request ${i}: ✅ (${duration}ms)`);
                
                // No delay - test rapid fire
                
            } catch (error) {
                console.log(`   Request ${i}: ❌ ${error.message}`);
                if (error.response?.status === 402) {
                    console.log(`   🚨 RATE LIMIT HIT at request ${i}!`);
                    break;
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Script error:', error.message);
    }
}

checkProxyMeshLimits().catch(console.error);

