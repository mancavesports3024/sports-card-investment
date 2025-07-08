const express = require('express');
const app = express();
const PORT = 3002;

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
  console.log(`📋 Set your eBay app redirect URI to: http://localhost:${PORT}/auth/callback`);
  console.log(`📋 Or use ngrok: ngrok http ${PORT}`);
}); 