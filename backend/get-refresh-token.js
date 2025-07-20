const axios = require('axios');
require('dotenv').config();

/**
 * Helper script to get your initial eBay refresh token
 * 
 * Steps to use this script:
 * 1. Go to https://developer.ebay.com/my/keys
 * 2. Create a new application or use existing one
 * 3. Get your Client ID and Client Secret
 * 4. Set up your redirect URI (e.g., http://localhost:3001/auth/callback)
 * 5. Run this script with your authorization code
 */

async function getRefreshToken(authorizationCode) {
  try {
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
      console.log('❌ Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in your .env file first');
      console.log('   You can get these from: https://developer.ebay.com/my/keys');
      return;
    }

    if (!authorizationCode || authorizationCode === 'YOUR_AUTHORIZATION_CODE') {
      console.log('❌ Please provide a valid authorization code');
      console.log('   Usage: node get-refresh-token.js YOUR_AUTHORIZATION_CODE');
      console.log('\n📋 STEP-BY-STEP GUIDE TO GET AUTHORIZATION CODE:');
      console.log('\n1️⃣ Go to your eBay Developer Portal:');
      console.log('   https://developer.ebay.com/my/keys');
      console.log('\n2️⃣ Find your application and click "View"');
      console.log('\n3️⃣ Copy your Client ID and Client Secret to .env file');
      console.log('\n4️⃣ Set your redirect URI to: http://localhost:3001/auth/callback');
      console.log('\n5️⃣ Visit this URL (replace YOUR_CLIENT_ID with your actual Client ID):');
      console.log(`   https://auth.ebay.com/oauth2/authorize?client_id=${process.env.EBAY_CLIENT_ID}&response_type=code&redirect_uri=http://localhost:3001/auth/callback&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory`);
      console.log('\n6️⃣ Authorize the application');
      console.log('\n7️⃣ Copy the "code" parameter from the redirect URL');
      console.log('   Example: http://localhost:3001/auth/callback?code=YOUR_CODE_HERE');
      console.log('\n8️⃣ Run: node get-refresh-token.js YOUR_CODE_HERE');
      console.log('\n⚠️  IMPORTANT: Authorization codes expire in 10 minutes!');
      return;
    }

    console.log('🔄 Exchanging authorization code for refresh token...');
    console.log(`   Client ID: ${process.env.EBAY_CLIENT_ID.substring(0, 10)}...`);
    console.log(`   Authorization Code: ${authorizationCode.substring(0, 10)}...`);

    // eBay OAuth token refresh endpoint
    const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    
    // Prepare the request
    const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(tokenUrl,
      `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${encodeURIComponent(process.env.EBAY_REDIRECT_URI || 'http://localhost:3001/auth/callback')}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );

    console.log('✅ Success! Here are your tokens:');
    console.log('\n📋 Add these to your .env file:');
    console.log(`EBAY_REFRESH_TOKEN=${response.data.refresh_token}`);
    console.log(`EBAY_AUTH_TOKEN=${response.data.access_token}`);
    
    console.log('\n⏰ Token expires in:', response.data.expires_in, 'seconds');
    console.log('🔄 Refresh token will be used to automatically get new access tokens');
    console.log('\n🚀 Now restart your server and automatic token refresh will be enabled!');

  } catch (error) {
    console.error('❌ Failed to get refresh token:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      const errorData = error.response.data;
      console.log('\n💡 Troubleshooting based on error:');
      
      if (errorData.error === 'invalid_grant') {
        console.log('   🔴 INVALID GRANT - Most common causes:');
        console.log('      • Authorization code expired (they expire in 10 minutes)');
        console.log('      • Authorization code was already used');
        console.log('      • Client ID/Secret mismatch');
        console.log('      • Redirect URI mismatch');
        console.log('\n   🔧 SOLUTION:');
        console.log('      1. Get a fresh authorization code (step 5 above)');
        console.log('      2. Make sure your redirect URI is exactly: http://localhost:3001/auth/callback');
        console.log('      3. Verify your Client ID and Secret are correct');
        console.log('      4. Try again immediately after getting the code');
      } else if (errorData.error === 'invalid_client') {
        console.log('   🔴 INVALID CLIENT:');
        console.log('      • Check your Client ID and Secret');
        console.log('      • Make sure they match your eBay application');
      } else if (errorData.error === 'redirect_uri_mismatch') {
        console.log('   🔴 REDIRECT URI MISMATCH:');
        console.log('      • Set redirect URI to exactly: http://localhost:3001/auth/callback');
        console.log('      • In your eBay application settings');
      }
    }
    
    console.log('\n📞 Still having issues?');
    console.log('   • Double-check your eBay application settings');
    console.log('   • Make sure your app has the right scopes');
    console.log('   • Try creating a new application if needed');
  }
}

// Get authorization code from command line argument
const authCode = process.argv[2];
getRefreshToken(authCode); 