const EbayScraperService = require('./services/ebayScraperService.js');

async function debug402Errors() {
    const ebayService = new EbayScraperService();
    
    try {
        console.log('🔍 Debugging 402 Payment Required errors...');
        console.log('🔧 ProxyMesh Configuration Check:');
        console.log(`   Username set: ${process.env.PROXYMESH_USERNAME ? 'YES' : 'NO'}`);
        console.log(`   Password set: ${process.env.PROXYMESH_PASSWORD ? 'YES' : 'NO'}`);
        console.log(`   Using proxy: ${ebayService.useProxy ? 'YES' : 'NO'}`);
        
        if (ebayService.useProxy) {
            console.log(`   Available proxy servers: ${ebayService.proxyServers.length}`);
            ebayService.proxyServers.forEach((server, i) => {
                console.log(`      ${i + 1}: ${server}`);
            });
        }
        
        // Test a simple search that was causing 402 errors
        const testUrl = 'https://www.ebay.com/sch/i.html?_nkw=2024+Bowman+Chrome&_sacat=0&LH_Complete=1&LH_Sold=1&Graded=Yes&Grade=9&_dcat=261328';
        
        console.log('\n🧪 Testing direct ProxyMesh request...');
        console.log(`🌐 Test URL: ${testUrl}`);
        
        // Get current proxy configuration
        const proxyAgent = ebayService.getNextProxy();
        
        if (proxyAgent) {
            console.log('🔗 Using proxy agent for test...');
        } else {
            console.log('❌ No proxy agent configured');
            return;
        }
        
        const axios = require('axios');
        
        try {
            const response = await axios.get(testUrl, {
                httpsAgent: proxyAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            console.log(`✅ Response Status: ${response.status}`);
            console.log(`📄 Response Length: ${response.data.length} characters`);
            console.log(`📋 Response Headers:`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            console.log(`   Server: ${response.headers['server'] || 'Not specified'}`);
            
            // Check if it's a CAPTCHA page
            if (response.data.includes('Pardon Our Interruption')) {
                console.log('❌ Still getting CAPTCHA/security pages through proxy');
            } else if (response.data.includes('2024')) {
                console.log('✅ Got real eBay content through proxy');
            } else {
                console.log('⚠️ Got unexpected content');
                console.log(`📄 First 300 chars: ${response.data.substring(0, 300)}`);
            }
            
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
            console.log(`📊 Error details:`);
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Status Text: ${error.response?.statusText}`);
            console.log(`   Headers: ${JSON.stringify(error.response?.headers, null, 2)}`);
            
            if (error.response?.status === 402) {
                console.log('\n🚨 402 PAYMENT REQUIRED ANALYSIS:');
                console.log('   This typically means:');
                console.log('   1. ProxyMesh account has insufficient credits/balance');
                console.log('   2. ProxyMesh subscription expired or suspended');
                console.log('   3. Request exceeded ProxyMesh plan limits');
                console.log('   4. Authentication failed (wrong username/password)');
                console.log('   5. IP not properly authorized in ProxyMesh dashboard');
                
                console.log('\n🔍 Response body (if any):');
                if (error.response?.data) {
                    console.log(error.response.data.substring(0, 500));
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Debug script error:', error.message);
    }
}

debug402Errors().catch(console.error);
