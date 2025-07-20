const axios = require('axios');
require('dotenv').config();

/**
 * Manual token setup - alternative to OAuth flow
 * This gets a simple application access token (no refresh)
 */

async function getManualToken() {
  try {
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
      console.log('❌ Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in your .env file');
      return;
    }

    console.log('🔄 Getting eBay Application Access Token...');
    console.log('   Note: This token will expire in 24 hours and needs manual renewal');

    // eBay Application Access Token endpoint
    const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    
    // Prepare the request for application access token
    const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(tokenUrl,
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );

    console.log('✅ Success! Here is your token:');
    console.log('\n📋 Add this to your .env file:');
    console.log(`EBAY_AUTH_TOKEN=${response.data.access_token}`);
    
    console.log('\n⏰ Token expires in:', response.data.expires_in, 'seconds');
    console.log('⚠️  This token will need manual renewal every 24 hours');
    console.log('💡 For automatic renewal, use the OAuth flow instead');

  } catch (error) {
    console.error('❌ Failed to get application access token:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Possible issues:');
      console.log('   • Check your Client ID and Secret');
      console.log('   • Make sure your app has the right scopes');
      console.log('   • Verify your app is active in eBay Developer Portal');
    }
  }
}

getManualToken(); 