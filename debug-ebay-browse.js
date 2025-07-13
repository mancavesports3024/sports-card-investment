const axios = require('axios');

async function testEbayBrowseAPI() {
  try {
    console.log('🔍 Testing eBay Browse API directly...');
    
    // Get the token from the deployed app
    const tokenResponse = await axios.get('https://web-production-9efa.up.railway.app/api/token-status');
    console.log('Token status response:', tokenResponse.data);
    
    // We need to get the actual token from the backend
    // Let me test the live listings endpoint with more detailed logging
    console.log('\n🔍 Testing live listings endpoint with detailed logging...');
    
    const liveResponse = await axios.get('https://web-production-9efa.up.railway.app/api/live-listings?query=Pokemon&grade=Raw');
    console.log('Live listings response:', JSON.stringify(liveResponse.data, null, 2));
    
    // Let me also test with a different approach - check if the backend is logging anything
    console.log('\n🔍 Testing with a broader search...');
    const broadResponse = await axios.get('https://web-production-9efa.up.railway.app/api/live-listings?query=card&grade=Raw');
    console.log('Broad search response:', JSON.stringify(broadResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testEbayBrowseAPI(); 