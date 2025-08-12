const axios = require('axios');

async function analyzeRailwayDatabase() {
    console.log('🔍 Analyzing Railway production database...\n');
    
    try {
        // Call the Railway API to run database analysis
        const response = await axios.post('https://web-production-9efa.up.railway.app/api/admin/run-database-analysis', {}, {
            timeout: 30000 // 30 second timeout
        });
        
        console.log('✅ Railway database analysis completed successfully!');
        console.log('\n📊 ANALYSIS RESULTS:');
        console.log('='.repeat(50));
        console.log(response.data);
        
    } catch (error) {
        console.error('❌ Error analyzing Railway database:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received from Railway');
        } else {
            console.error('Error:', error.message);
        }
    }
}

analyzeRailwayDatabase();
