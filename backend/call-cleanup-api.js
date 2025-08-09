const axios = require('axios');

async function callCleanupAPI() {
    try {
        console.log('🚀 Calling Railway cleanup API...');
        
        const response = await axios.post('https://web-production-9efa.up.railway.app/api/clean-summary-titles', {}, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout
        });
        
        console.log('✅ Success! Response:', response.data);
        
    } catch (error) {
        console.error('❌ Error calling cleanup API:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('Request failed:', error.message);
        } else {
            console.error('Error:', error.message);
        }
    }
}

callCleanupAPI();
