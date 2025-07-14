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
const { 
  responseTimeMiddleware, 
  apiOptimizationMiddleware, 
  cacheControlMiddleware,
  rateLimitMiddleware 
} = require('./middleware/cacheMiddleware');

const app = express();
const PORT = process.env.PORT || 3001;

// Token refresh configuration
const TOKEN_REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours (eBay tokens expire in 24 hours)
let tokenRefreshTimer = null;

// CORS Configuration
const corsOptions = {
  origin: [
    'https://www.mancavesportscardsllc.com', // Production frontend
    'http://localhost:3000', // Local development
    'http://192.168.0.29:3000' // Local network
  ],
  credentials: true, // Allow cookies/sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests
app.options('*', cors(corsOptions));

// Performance optimization middleware
app.use(responseTimeMiddleware());
app.use(apiOptimizationMiddleware());
app.use(cacheControlMiddleware(1800)); // 30 minutes cache
app.use(rateLimitMiddleware(15 * 60 * 1000, 200)); // 15 minutes, 200 requests per IP

// Redis setup with fallback
let redisClient = null;
let sessionStore = null;

// Debug all Redis-related environment variables
console.log('🔍 All environment variables containing REDIS:');
Object.keys(process.env).forEach(key => {
  if (key.includes('REDIS')) {
    console.log(`  ${key}: ${process.env[key]}`);
  }
});

console.log('🔍 Redis setup - REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
if (process.env.REDIS_URL) {
  console.log('🔍 REDIS_URL value:', process.env.REDIS_URL);
}

// Async function to setup Redis
async function setupRedis() {
  if (process.env.REDIS_URL) {
    try {
      console.log('🔗 Attempting to connect to Redis...');
      console.log('🔗 Redis URL format check:', process.env.REDIS_URL.startsWith('redis://') ? 'Valid format' : 'Invalid format');
      
      redisClient = createClient({ url: process.env.REDIS_URL });
      
      // Add error handlers
      redisClient.on('error', (err) => {
        console.error('❌ Redis client error:', err);
      });
      
      redisClient.on('connect', () => {
        console.log('✅ Redis client connected successfully');
      });
      
      redisClient.on('ready', () => {
        console.log('✅ Redis client ready');
      });
      
      await redisClient.connect();
      sessionStore = new RedisStore({ client: redisClient });
      console.log('✅ Redis session store configured');
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed, falling back to memory store:', error.message);
      console.error('❌ Full error:', error);
      return false;
    }
  } else {
    console.log('⚠️  No REDIS_URL provided, using memory store for sessions');
    return false;
  }
}

// Initialize the server with proper session setup
async function initializeServer() {
  // Setup Redis first
  const redisConnected = await setupRedis();
  
  // Setup session middleware after Redis is ready
  app.use(session({
    store: sessionStore, // Will be null if Redis fails, defaulting to memory store
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Required for cross-origin in production
      domain: process.env.NODE_ENV === 'production' ? '.mancavesportscardsllc.com' : undefined // Allow subdomain cookies
    },
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());

  // Healthcheck route for Railway
  app.get('/', (req, res) => res.send('OK'));

  // Redis test endpoint
  app.get('/api/redis-test', async (req, res) => {
    try {
      if (!redisClient) {
        return res.json({ 
          status: 'error', 
          message: 'Redis client not configured',
          redisUrl: process.env.REDIS_URL ? 'Set' : 'Not set'
        });
      }
      
      // Test Redis connection
      await redisClient.set('test', 'Hello Redis!', 'EX', 60);
      const testValue = await redisClient.get('test');
      
      res.json({
        status: 'success',
        message: 'Redis is working!',
        testValue,
        redisUrl: process.env.REDIS_URL ? 'Configured' : 'Not configured',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Redis test failed',
        error: error.message,
        redisUrl: process.env.REDIS_URL ? 'Set' : 'Not set'
      });
    }
  });

  // Cache management endpoints
  const cacheService = require('./services/cacheService');
  
  app.get('/api/cache/stats', async (req, res) => {
    try {
      const stats = await cacheService.getStats();
      res.json({
        status: 'success',
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to get cache stats',
        error: error.message
      });
    }
  });

  app.post('/api/cache/clear', async (req, res) => {
    try {
      const { pattern } = req.body;
      if (pattern) {
        await cacheService.deletePattern(pattern);
        res.json({
          status: 'success',
          message: `Cleared cache pattern: ${pattern}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // Clear all cache
        await cacheService.deletePattern('*');
        res.json({
          status: 'success',
          message: 'Cleared all cache',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear cache',
        error: error.message
      });
    }
  });

  app.post('/api/cache/cleanup', async (req, res) => {
    try {
      await cacheService.cleanup();
      res.json({
        status: 'success',
        message: 'Cache cleanup completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to cleanup cache',
        error: error.message
      });
    }
  });

  // Routes
  app.use('/api/search-cards', require('./routes/searchCards').router);
  app.use('/api/search-history', require('./routes/searchHistory'));
  app.use('/api/live-listings', require('./routes/liveListings'));
  
  // Routes
  app.use('/api/auth', require('./routes/auth'));
  
  app.use('/api', require('./routes/imageAnalysis'));

  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   • POST /api/search-cards - Search for trading cards`);
    console.log(`   • GET /api/search-history - Get saved searches`);
    console.log(`   • POST /api/search-history - Save a search`);
    console.log(`   • GET /api/rate-limits - Check API limits`);
    console.log(`   • POST /api/refresh-token - Manually refresh token`);
    console.log(`   • GET /api/token-status - Check token status`);
    console.log(`🔐 Session store: ${sessionStore ? 'Redis' : 'Memory (⚠️  Not recommended for production)'}`);
    
    // Start automatic token refresh if credentials are available
    if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REFRESH_TOKEN) {
      console.log('🔄 Automatic token refresh enabled');
      refreshEbayToken(); // Initial refresh
    } else {
      console.log('⚠️  Automatic token refresh disabled. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REFRESH_TOKEN in .env file');
    }
  });
}

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
initializeServer().catch(console.error);