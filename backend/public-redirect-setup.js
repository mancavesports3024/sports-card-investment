const express = require('express');
const app = express();
const PORT = 3001;

app.get('/auth/callback', (req, res) => {
  const code = req.query.code;
  
  if (code) {
    console.log('\n🎉 SUCCESS! Authorization code received:');
    console.log(`Code: ${code}`);
    console.log('\n📋 Now run this command:');
    console.log(`node get-refresh-token.js ${code}`);
    console.log('\n⚠️  Do this quickly - codes expire in 10 minutes!');
    
    res.send(`
      <html>
        <head><title>eBay OAuth Success</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✅ Authorization Successful!</h1>
          <p>Your authorization code has been received.</p>
          <p><strong>Code:</strong> ${code}</p>
          <p>Now run this command in your terminal:</p>
          <pre style="background: #f0f0f0; padding: 10px; border-radius: 5px;">node get-refresh-token.js ${code}</pre>
          <p><em>⚠️ Do this quickly - codes expire in 10 minutes!</em></p>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head><title>eBay OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Authorization Failed</h1>
          <p>No authorization code received.</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Redirect handler running on http://localhost:${PORT}`);
  console.log('\n📋 SETUP INSTRUCTIONS:');
  console.log('\n1️⃣ Install ngrok (if you haven\'t):');
  console.log('   npm install -g ngrok');
  console.log('\n2️⃣ In a new terminal, run:');
  console.log(`   ngrok http ${PORT}`);
  console.log('\n3️⃣ Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok.io)');
  console.log('\n4️⃣ Set your eBay app redirect URI to:');
  console.log('   https://YOUR_NGROK_URL/auth/callback');
  console.log('\n5️⃣ Use this URL for authorization:');
  console.log('   https://auth.ebay.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=https://YOUR_NGROK_URL/auth/callback&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory');
}); 