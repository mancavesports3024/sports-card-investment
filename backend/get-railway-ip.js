const axios = require('axios');

async function getRailwayIP() {
    try {
        console.log('🔍 Getting Railway server IP address...');
        
        // Check what IP Railway sees us as
        const response = await axios.get('https://api.ipify.org?format=json');
        
        console.log(`📍 Railway server IP: ${response.data.ip}`);
        console.log(`\n📋 Next steps:`);
        console.log(`1. Go to your ProxyMesh dashboard`);
        console.log(`2. Click "Add an IP or Hostname"`);
        console.log(`3. Add this IP: ${response.data.ip}`);
        console.log(`4. Wait a few minutes for authorization`);
        
        return response.data.ip;
        
    } catch (error) {
        console.error('❌ Error getting IP:', error.message);
    }
}

getRailwayIP().catch(console.error);
