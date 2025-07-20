const axios = require('axios');
require('dotenv').config();

/**
 * Debug OAuth issues
 */

async function debugOAuth() {
  console.log('🔍 OAuth Debug Information\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   EBAY_CLIENT_ID: ${process.env.EBAY_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   EBAY_CLIENT_SECRET: ${process.env.EBAY_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   EBAY_REDIRECT_URI: ${process.env.EBAY_REDIRECT_URI || '❌ Not set (using default)'}`);
  
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('\n❌ Missing required credentials');
    return;
  }
  
  console.log('\n🔑 Credential Details:');
  console.log(`   Client ID: ${process.env.EBAY_CLIENT_ID.substring(0, 10)}... (${process.env.EBAY_CLIENT_ID.length} chars)`);
  console.log(`   Client Secret: ${process.env.EBAY_CLIENT_SECRET.substring(0, 10)}... (${process.env.EBAY_CLIENT_SECRET.length} chars)`);
  
  // Test basic auth encoding
  console.log('\n🧪 Testing Basic Auth:');
  try {
    const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    console.log(`   Auth Header: ${auth.substring(0, 20)}...`);
    console.log('   ✅ Basic auth encoding successful');
  } catch (error) {
    console.log('   ❌ Basic auth encoding failed:', error.message);
    return;
  }
  
  // Generate authorization URL
  const redirectUri = process.env.EBAY_REDIRECT_URI || 'http://localhost:3002/auth/callback';
  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${process.env.EBAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory')}`;
  
  console.log('\n🌐 Authorization URL:');
  console.log(`   ${authUrl}`);
  
  console.log('\n📋 Manual Test Instructions:');
  console.log('1. Copy the authorization URL above');
  console.log('2. Paste it in your browser');
  console.log('3. Authorize the application');
  console.log('4. Copy the code from the redirect URL');
  console.log('5. Run: node test-token-exchange.js YOUR_CODE');
  
  console.log('\n⚠️  Common Issues:');
  console.log('   • Redirect URI must match exactly in eBay app settings');
  console.log('   • Authorization codes expire in 10 minutes');
  console.log('   • Codes can only be used once');
  console.log('   • Make sure redirect handler is running');
}

debugOAuth(); 