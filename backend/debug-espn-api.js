const axios = require('axios');

async function debugESPNAPI() {
    try {
        console.log('🔍 Debugging ESPN API...');
        
        const response = await axios.get('https://site.web.api.espn.com/apis/common/v3/search', {
            params: {
                q: 'Aaron Rodgers',
                limit: 5
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.espn.com/',
                'Origin': 'https://www.espn.com'
            },
            timeout: 10000
        });

        console.log(`📄 Status: ${response.status}`);
        console.log(`📄 URL: ${response.config.url}`);
        console.log(`📄 Headers:`, response.headers);
        
        const data = response.data;
        console.log(`\n📋 Full Response Data:`);
        console.log(JSON.stringify(data, null, 2));
        
        // Check if there are any other properties
        console.log(`\n🔍 Response Properties:`);
        for (const key in data) {
            console.log(`   - ${key}: ${typeof data[key]} ${Array.isArray(data[key]) ? `(array, length: ${data[key].length})` : ''}`);
        }
        
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Headers:`, error.response.headers);
            console.error(`   Data:`, error.response.data);
        }
    }
}

debugESPNAPI().then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
});

