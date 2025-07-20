require('dotenv').config();
const axios = require('axios');

async function debugEbayAPI() {
  console.log('🔍 Debugging eBay API Authentication...\n');
  
  // Check environment variables
  console.log('1. Environment Variables:');
  console.log(`   EBAY_AUTH_TOKEN: ${process.env.EBAY_AUTH_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`   EBAY_ENDPOINT: ${process.env.EBAY_ENDPOINT || 'Using default sandbox'}`);
  
  if (!process.env.EBAY_AUTH_TOKEN) {
    console.log('\n❌ EBAY_AUTH_TOKEN is not set in your .env file');
    return;
  }
  
  // Test token format
  console.log(`\n2. Token Format Check:`);
  console.log(`   Token length: ${process.env.EBAY_AUTH_TOKEN.length} characters`);
  console.log(`   Token starts with: ${process.env.EBAY_AUTH_TOKEN.substring(0, 10)}...`);
  
  // Test API call
  console.log('\n3. Testing API Call...');
  
  const endpoint = process.env.EBAY_ENDPOINT || 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search';
  
  try {
    const response = await axios.get(endpoint, {
      params: {
        q: 'test',
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${process.env.EBAY_AUTH_TOKEN}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API call successful!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Items found: ${response.data.itemSummaries?.length || 0}`);
    
  } catch (error) {
    console.log('❌ API call failed!');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    
    if (error.response?.status === 401) {
      console.log('\n💡 401 Error suggests:');
      console.log('   - Token is invalid or expired');
      console.log('   - Token format is incorrect');
      console.log('   - Token doesn\'t have required permissions');
    } else if (error.response?.status === 403) {
      console.log('\n💡 403 Error suggests:');
      console.log('   - Token doesn\'t have required scopes');
      console.log('   - App not approved for Browse API');
    } else if (error.response?.status === 429) {
      console.log('\n💡 429 Error suggests:');
      console.log('   - Rate limit exceeded');
      console.log('   - Too many requests');
    }
  }
}

debugEbayAPI(); 