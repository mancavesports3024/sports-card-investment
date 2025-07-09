const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');

// Debug connect-redis structure - Railway deployment fix
const connectRedis = require('connect-redis');
console.log('connect-redis structure:', Object.keys(connectRedis));
console.log('connect-redis type:', typeof connectRedis);
console.log('connect-redis.default type:', typeof connectRedis.default);

// Try different patterns to get RedisStore
let RedisStore;
if (typeof connectRedis === 'function') {
  RedisStore = connectRedis(session);
} else if (connectRedis.default && typeof connectRedis.default === 'function') {
  RedisStore = connectRedis.default(session);
} else if (connectRedis.RedisStore) {
  RedisStore = connectRedis.RedisStore;
} else {
  throw new Error('Unable to import RedisStore from connect-redis');
}

const { createClient } = require('redis');
const passport = require('passport');

const app = express();
const PORT = process.env.PORT || 3001;

// Token refresh configuration
const TOKEN_REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours (eBay tokens expire in 24 hours)
let tokenRefreshTimer = null;

// Middleware
app.use(cors());
app.use(express.json());
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // Set to true if using HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sports Card Tracker API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes
app.use('/api/search-cards', require('./routes/searchCards').router);
app.use('/api/search-history', require('./routes/searchHistory'));
app.use('/api/live-listings', require('./routes/liveListings'));
app.use('/api/auth', require('./routes/auth'));

// Function to refresh eBay token automatically
async function refreshEbayToken() {
  try {
    console.log('🔄 Attempting to refresh eBay token...');
    
    // Check if we have the required credentials
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET || !process.env.EBAY_REFRESH_TOKEN) {
      console.log('❌ Missing credentials for token refresh. Please set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REFRESH_TOKEN in your .env file');
      return;
    }

    // eBay OAuth token refresh endpoint
    const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    
    // Prepare the request
    const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(tokenUrl, 
      'grant_type=refresh_token&refresh_token=' + process.env.EBAY_REFRESH_TOKEN,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );

    // Update the token
    const newToken = response.data.access_token;
    process.env.EBAY_AUTH_TOKEN = newToken;
    
    console.log('✅ eBay token refreshed successfully');
    console.log(`   New token expires in: ${response.data.expires_in} seconds`);
    
    // Schedule next refresh (23 hours from now to be safe)
    scheduleNextTokenRefresh();
    
  } catch (error) {
    console.error('❌ Failed to refresh eBay token:', error.response?.data || error.message);
    
    // Try again in 1 hour if refresh failed
    setTimeout(refreshEbayToken, 60 * 60 * 1000);
  }
}

// Function to schedule the next token refresh
function scheduleNextTokenRefresh() {
  // Clear existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }
  
  // Schedule next refresh
  tokenRefreshTimer = setTimeout(refreshEbayToken, TOKEN_REFRESH_INTERVAL);
  
  const nextRefresh = new Date(Date.now() + TOKEN_REFRESH_INTERVAL);
  console.log(`⏰ Next token refresh scheduled for: ${nextRefresh.toISOString()}`);
}

// Manual token refresh endpoint (for testing)
app.post('/api/refresh-token', async (req, res) => {
  try {
    await refreshEbayToken();
    res.json({ 
      success: true, 
      message: 'Token refresh initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to refresh token',
      message: error.message 
    });
  }
});

// Endpoint to check current token status
app.get('/api/token-status', (req, res) => {
  const hasToken = !!process.env.EBAY_AUTH_TOKEN;
  const tokenLength = process.env.EBAY_AUTH_TOKEN ? process.env.EBAY_AUTH_TOKEN.length : 0;
  const hasRefreshCredentials = !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REFRESH_TOKEN);
  
  res.json({
    hasToken,
    tokenLength,
    hasRefreshCredentials,
    maskedToken: hasToken ? `${process.env.EBAY_AUTH_TOKEN.substring(0, 10)}...${process.env.EBAY_AUTH_TOKEN.substring(tokenLength - 10)}` : null,
    nextRefresh: tokenRefreshTimer ? new Date(Date.now() + TOKEN_REFRESH_INTERVAL).toISOString() : null,
    timestamp: new Date().toISOString()
  });
});

// Initialize token refresh on startup
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   • POST /api/search-cards - Search for cards`);
  console.log(`   • GET /api/search-history - Get saved searches`);
  console.log(`   • POST /api/search-history - Save a search`);
  console.log(`   • GET /api/rate-limits - Check API limits`);
  console.log(`   • POST /api/refresh-token - Manually refresh token`);
  console.log(`   • GET /api/token-status - Check token status`);
  
  // Start automatic token refresh if credentials are available
  if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REFRESH_TOKEN) {
    console.log('🔄 Automatic token refresh enabled');
    refreshEbayToken(); // Initial refresh
  } else {
    console.log('⚠️  Automatic token refresh disabled. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REFRESH_TOKEN in .env file');
  }
}); 