const axios = require('axios');
const { exec } = require('child_process');
require('dotenv').config();

/**
 * Complete OAuth setup helper
 */

async function checkNgrokStatus() {
  return new Promise((resolve) => {
    exec('curl -s http://localhost:4040/api/tunnels', (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
        resolve(httpsTunnel ? httpsTunnel.public_url : null);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function setupOAuth() {
  console.log('🔧 eBay OAuth Setup Helper\n');
  
  // Check credentials
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('❌ Missing credentials in .env file');
    console.log('   Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET');
    return;
  }
  
  console.log('✅ Credentials found');
  console.log(`   Client ID: ${process.env.EBAY_CLIENT_ID.substring(0, 10)}...`);
  
  // Check if ngrok is running
  console.log('\n🔍 Checking ngrok status...');
  const ngrokUrl = await checkNgrokStatus();
  
  if (!ngrokUrl) {
    console.log('❌ Ngrok not running');
    console.log('\n📋 To start ngrok:');
    console.log('   1. Open a new terminal');
    console.log('   2. Run: ngrok http 3001');
    console.log('   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
    console.log('   4. Come back here and run this script again');
    return;
  }
  
  console.log(`✅ Ngrok running: ${ngrokUrl}`);
  
  // Generate the authorization URL
  const redirectUri = `${ngrokUrl}/auth/callback`;
  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${process.env.EBAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory')}`;
  
  console.log('\n📋 SETUP INSTRUCTIONS:');
  console.log('\n1️⃣ Update your eBay app settings:');
  console.log(`   Redirect URI: ${redirectUri}`);
  console.log('\n2️⃣ Visit this authorization URL:');
  console.log(`   ${authUrl}`);
  console.log('\n3️⃣ After authorization, you\'ll be redirected to:');
  console.log(`   ${redirectUri}?code=YOUR_CODE`);
  console.log('\n4️⃣ Copy the code and run:');
  console.log('   node get-refresh-token.js YOUR_CODE');
  
  console.log('\n⚠️  IMPORTANT:');
  console.log('   • Make sure the redirect handler is running (node redirect-handler.js)');
  console.log('   • Authorization codes expire in 10 minutes');
  console.log('   • The redirect URI must match exactly in your eBay app settings');
}

setupOAuth(); 