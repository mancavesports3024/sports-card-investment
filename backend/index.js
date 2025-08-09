// Trigger redeploy - trivial change
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');
const fs = require('fs');
const path = require('path');

// Debug connect-redis structure - Railway deployment fix
const connectRedis = require('connect-redis');
// console.log('connect-redis structure:', Object.keys(connectRedis));
// console.log('connect-redis type:', typeof connectRedis);
// console.log('connect-redis.default type:', typeof connectRedis.default);

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

// Ensure featured_ebay_items.json exists at startup
const featuredFilePath = path.join(__dirname, 'data', 'featured_ebay_items.json');
  if (!fs.existsSync(featuredFilePath)) {
    const defaultItems = [
      "396562232611",
      "396409182852",
      "396420364849",
      "396814361496",
      "396814322747",
      "396395311328",
      "396398176039",
      "396399664743",
      "396399682791",
      "396806804172",
      "396814321328",
      "396814368775",
      "396406758593",
      "396406643392",
      "396069515947",
      "396193843686",
      "396193850211",
      "396066034218",
      "396067091301",
      "396814390046",
      "396818492484",
      "396818481683",
      "396461824345",
      "396814384386",
      "396818502777",
      "396433539437",
      "396818461635",
      "396818458907",
      "396818304516",
      "396814415369",
      "396469137213",
      "396462089473",
      "396818441066",
      "396805370126",
      "396803420759",
      "396803535898",
      "396398879500",
      "396265911242",
      "396266390556",
      "396803703906",
      "396803652374",
      "396394128674",
      "396803691925",
      "396803660393",
      "396803675227",
      "396817323293"
    ];
    fs.writeFileSync(featuredFilePath, JSON.stringify(defaultItems, null, 2));
    // console.log('✅ Created missing featured_ebay_items.json at startup');
  } else {
    // console.log('✅ featured_ebay_items.json already exists');
  }

// CORS Configuration
const corsOptions = {
  origin: [
    'https://www.mancavesportscardsllc.com', // Production frontend
    'http://localhost:3000', // Local development
    'http://192.168.0.29:3000' // Local network
  ],
  credentials: true, // Allow cookies/sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Referer',
    'User-Agent'
  ],
  exposedHeaders: ['X-Response-Time', 'X-Cache', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
};

// CORS middleware FIRST
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// JSON parsing
app.use(express.json({ limit: '10mb' }));

// Increase timeout for long-running requests
app.use((req, res, next) => {
  // Set timeout to 5 minutes for API requests
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  
  // Don't send error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(500).json({
    error: 'Internal server error',
    message: errorMessage,
    timestamp: new Date().toISOString()
  });
});

// Token refresh configuration
const TOKEN_REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours (eBay tokens expire in 24 hours)
let tokenRefreshTimer = null;

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
  
  // Health check endpoint for Railway deployment
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });
  });

  // CORS test endpoint
  app.options('/api/cors-test', (req, res) => {
    res.header('Access-Control-Allow-Origin', 'https://www.mancavesportscardsllc.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer, User-Agent');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });

  app.get('/api/cors-test', (req, res) => {
    res.json({
      success: true,
      message: 'CORS is working!',
      timestamp: new Date().toISOString(),
      headers: req.headers
    });
  });

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
app.use('/api/optimized-search-cards', require('./routes/optimizedSearchCards'));
app.use('/api/search-history', require('./routes/searchHistory'));
app.use('/api/live-listings', require('./routes/liveListings'));
  app.use('/api/news', require('./routes/news'));
  app.use('/api/ebay-bidding', require('./routes/ebayBidding'));
  app.use('/api/spreadsheet-manager', require('./routes/spreadsheetManager'));
  
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

// TEMPORARY: Debug endpoint to print current eBay access token
app.get('/api/debug-ebay-token', (req, res) => {
  res.json({ token: process.env.EBAY_AUTH_TOKEN });
});

// SQLite Price Updater endpoint for Railway testing
app.post('/api/update-prices', async (req, res) => {
  try {
    const { batchSize = 5 } = req.body; // Default to 5 cards for testing
    
    console.log(`🚀 Starting SQLite price update with batch size: ${batchSize}`);
    
    // Import and run the SQLite price updater
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    
    // Start the update process
    await updater.processBatch(batchSize);
    
    res.json({
      success: true,
      message: `Price update completed for ${batchSize} cards`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in price update endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cron Job Status endpoint
app.get('/api/cron-status', async (req, res) => {
  try {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'data', 'scorecard.db');
    const db = new sqlite3.Database(dbPath);
    
    // Get the most recent cards (which would indicate pull-new-items ran)
    const recentCards = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, title, created_at FROM cards 
         WHERE created_at IS NOT NULL 
         ORDER BY created_at DESC LIMIT 5`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    // Get cards with recent price updates (which would indicate update-prices ran)
    const recentPriceUpdates = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, title, rawAveragePrice, psa9AveragePrice, updated_at FROM cards 
         WHERE (rawAveragePrice IS NOT NULL OR psa9AveragePrice IS NOT NULL)
         AND updated_at IS NOT NULL 
         ORDER BY updated_at DESC LIMIT 5`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    db.close();
    
    res.json({
      success: true,
      cronJobStatus: {
        pullNewItems: {
          schedule: "Every 6 hours (0 */6 * * *)",
          lastRun: recentCards.length > 0 ? recentCards[0].created_at : "No recent items",
          recentItems: recentCards
        },
        updatePrices: {
          schedule: "Every 8 hours (0 */8 * * *)", 
          lastRun: recentPriceUpdates.length > 0 ? recentPriceUpdates[0].updated_at : "No recent updates",
          recentUpdates: recentPriceUpdates
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking cron status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual trigger for price updates
app.post('/api/trigger-price-update', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Price update job triggered - running in background",
      timestamp: new Date().toISOString()
    });
    
    // Run the price update in background
    setImmediate(async () => {
      try {
        console.log('🚀 Manual price update triggered via API...');
        
        // Use the same logic as update-prices.js
        const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
        
        class AutomatedPriceUpdater {
          constructor() {
            this.updater = new SQLitePriceUpdater();
          }
          
          async updatePrices() {
            console.log('=====================================');
            await this.updater.connect();
            
            // Get 200 cards that need updates
            const cardsToUpdate = await this.getCardsNeedingUpdates();
            console.log(`📊 Found ${cardsToUpdate.length} cards that need price updates`);
            
            if (cardsToUpdate.length === 0) {
              console.log('✅ All cards have recent price data!');
              this.updater.db.close();
              return;
            }
            
            // Process cards
            let processed = 0;
            let updated = 0;
            
            for (const card of cardsToUpdate) {
              processed++;
              console.log(`\n🔄 Processing ${processed}/${cardsToUpdate.length}: ${card.title}`);
              
              try {
                const rawResults = await this.updater.search130Point(card, false);
                const psa9Results = await this.updater.search130Point(card, true);
                
                let priceData = {};
                
                if (rawResults && rawResults.length > 0) {
                  const rawAvg = rawResults.reduce((sum, item) => sum + item.price, 0) / rawResults.length;
                  priceData.rawAveragePrice = rawAvg;
                }
                
                if (psa9Results && psa9Results.length > 0) {
                  const psa9Avg = psa9Results.reduce((sum, item) => sum + item.price, 0) / psa9Results.length;
                  priceData.psa9AveragePrice = psa9Avg;
                }
                
                if (Object.keys(priceData).length > 0) {
                  await this.updater.updateCardPrices(card.id, priceData);
                  updated++;
                }
                
                // Rate limiting
                if (processed < cardsToUpdate.length) {
                  const delay = 1500 + Math.random() * 1000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                
              } catch (error) {
                console.error(`❌ Error updating ${card.title}:`, error.message);
              }
            }
            
            console.log(`\n🎉 Price update completed! Updated ${updated}/${processed} cards`);
            this.updater.db.close();
          }
          
          async getCardsNeedingUpdates() {
            return new Promise((resolve, reject) => {
              // Use the same logic as update-prices.js
              const query = `
                SELECT id, title, summaryTitle, sport, filterInfo, 
                       rawAveragePrice, psa9AveragePrice, lastUpdated
                FROM cards 
                WHERE 
                    -- Missing both prices
                    (rawAveragePrice IS NULL AND psa9AveragePrice IS NULL) OR
                    -- Missing raw price but has PSA 9
                    (rawAveragePrice IS NULL AND psa9AveragePrice IS NOT NULL) OR
                    -- Missing PSA 9 price but has raw
                    (rawAveragePrice IS NOT NULL AND psa9AveragePrice IS NULL) OR
                    -- Old data (older than 7 days)
                    (lastUpdated IS NULL OR datetime(lastUpdated) < datetime('now', '-7 days'))
                ORDER BY
                    -- Priority: no prices first, then missing prices, then old data
                    CASE 
                        WHEN rawAveragePrice IS NULL AND psa9AveragePrice IS NULL THEN 1
                        WHEN rawAveragePrice IS NULL OR psa9AveragePrice IS NULL THEN 2
                        ELSE 3
                    END,
                    CASE WHEN lastUpdated IS NULL THEN 1 ELSE 0 END,
                    lastUpdated ASC
                LIMIT 200
              `;
              
              this.updater.db.all(query, [], (err, rows) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(rows);
                }
              });
            });
          }
        }
        
        const automatedUpdater = new AutomatedPriceUpdater();
        await automatedUpdater.updatePrices();
        console.log('✅ Manual price update completed');
      } catch (error) {
        console.error('❌ Manual price update failed:', error);
      }
    });
    
  } catch (error) {
    console.error('Error triggering price update:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// SQLite Database Status endpoint (with optional cleanup)
app.get('/api/database-status', async (req, res) => {
  try {
    // Check if cleanup was requested
    const { cleanup } = req.query;
    
    if (cleanup === 'summary-titles') {
      console.log('🧹 Starting summary title cleanup via database-status endpoint...');
      const { cleanSummaryTitles } = require('./api-clean-summary-titles.js');
      const cleanupResult = await cleanSummaryTitles();
      
      return res.json({
        success: true,
        message: 'Summary title cleanup completed',
        cleanupResult,
        timestamp: new Date().toISOString()
      });
    }
    
    // Regular database status check
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    
    await updater.connect();
    const stats = await updater.getDatabaseStats();
    updater.db.close();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting database status:', error);
    
    // Check if it's a database not found error
    if (error.message.includes('filename cannot be null') || error.message.includes('no such file')) {
      res.json({
        success: false,
        error: 'Database not found',
        message: 'SQLite database has not been created yet. Use /api/create-database to initialize it.',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get database status',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Test file system endpoint
app.get('/api/test-fs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const currentDir = __dirname;
    const dataDir = path.join(currentDir, 'data');
    const dbPath = path.join(dataDir, 'scorecard.db');
    
    const info = {
      currentDir,
      dataDir,
      dbPath,
      dataDirExists: fs.existsSync(dataDir),
      dbExists: fs.existsSync(dbPath),
      canWriteDataDir: false,
      canWriteCurrentDir: false
    };
    
    // Test write permissions
    try {
      fs.accessSync(currentDir, fs.constants.W_OK);
      info.canWriteCurrentDir = true;
    } catch (e) {
      info.canWriteCurrentDir = false;
    }
    
    try {
      fs.accessSync(dataDir, fs.constants.W_OK);
      info.canWriteDataDir = true;
    } catch (e) {
      info.canWriteDataDir = false;
    }
    
    res.json({
      success: true,
      fileSystemInfo: info,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check file system',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create SQLite Database endpoint
app.post('/api/create-database', async (req, res) => {
  try {
    console.log('🗄️ Creating SQLite database on Railway...');
    
    // First try a simple test
    const fs = require('fs');
    const path = require('path');
    const sqlite3 = require('sqlite3').verbose();
    
    const dataDir = path.join(__dirname, 'data');
    const dbPath = path.join(dataDir, 'test.db');
    
    console.log(`📁 Testing with path: ${dbPath}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Try to create a simple test database
    await new Promise((resolve, reject) => {
      const testDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('❌ Error creating test database:', err);
          reject(err);
        } else {
          testDb.run('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)', (err) => {
            if (err) {
              console.error('❌ Error creating test table:', err);
              reject(err);
            } else {
              console.log('✅ Test database created successfully');
              testDb.close();
              resolve();
            }
          });
        }
      });
    });
    
    // Now create the real database
    const { createDatabase, migrateData } = require('./create-sqlite-database.js');
    await createDatabase();
    
    // Try to migrate data from JSON to SQLite (optional)
    try {
      console.log('📦 Attempting to migrate data from JSON to SQLite...');
      await migrateData();
      res.json({
        success: true,
        message: 'SQLite database created and populated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (migrationError) {
      console.log('⚠️ Migration failed, but database created successfully:', migrationError.message);
      res.json({
        success: true,
        message: 'SQLite database created successfully (no data migration - JSON file not found)',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create database',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// View price data endpoint
app.get('/api/price-data', async (req, res) => {
  try {
    console.log('📊 Fetching price data from SQLite database...');
    
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    await updater.connect();
    
    // Get all cards with their price data
    const cards = await new Promise((resolve, reject) => {
      updater.db.all(`
        SELECT id, title, summaryTitle, sport, 
               rawAveragePrice, psa9AveragePrice, priceComparisons,
               lastUpdated, created_at
        FROM cards 
        ORDER BY created_at DESC
        LIMIT 50
      `, (err, rows) => {
        if (err) {
          console.error('❌ Error fetching price data:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    // Parse price comparisons JSON for each card
    const cardsWithParsedData = cards.map(card => {
      let parsedComparisons = null;
      if (card.priceComparisons) {
        try {
          parsedComparisons = JSON.parse(card.priceComparisons);
        } catch (e) {
          console.log('⚠️ Error parsing price comparisons for card:', card.id);
        }
      }
      
      return {
        id: card.id,
        title: card.title,
        summaryTitle: card.summaryTitle,
        sport: card.sport,
        rawAveragePrice: card.rawAveragePrice,
        psa9AveragePrice: card.psa9AveragePrice,
        priceComparisons: parsedComparisons,
        lastUpdated: card.lastUpdated,
        created_at: card.created_at
      };
    });
    
    updater.db.close();
    
    res.json({
      success: true,
      totalCards: cardsWithParsedData.length,
      cards: cardsWithParsedData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching price data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add real card data endpoint
app.post('/api/add-cards', async (req, res) => {
  try {
    console.log('📦 Adding real card data to SQLite database...');
    
    const { cards } = req.body;
    
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request body must contain a "cards" array with card data',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📊 Processing ${cards.length} cards...`);
    
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    await updater.connect();
    
    let inserted = 0;
    let errors = 0;
    
    // Process cards in batches to avoid memory issues
    const BATCH_SIZE = 100;
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);
      
      for (const card of batch) {
        try {
          // Extract price comparison data if it exists
          let rawPrice = null;
          let psa9Price = null;
          let priceComparisons = null;
          
          if (card.priceComparisons) {
            rawPrice = card.priceComparisons.raw?.avgPrice || null;
            psa9Price = card.priceComparisons.psa9?.avgPrice || null;
            priceComparisons = JSON.stringify(card.priceComparisons);
          }
          
          await new Promise((resolve, reject) => {
            updater.db.run(`
              INSERT INTO cards (
                title, summaryTitle, psa10Price, psa10PriceDate,
                rawAveragePrice, psa9AveragePrice, sport, filterInfo,
                priceComparisons, lastUpdated, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
              card.title || '',
              card.summaryTitle || '',
              card.psa10Price || null,
              card.psa10PriceDate || null,
              rawPrice,
              psa9Price,
              card.sport || null,
              card.filterInfo ? JSON.stringify(card.filterInfo) : null,
              priceComparisons,
              card.lastUpdated || null
            ], function(err) {
              if (err) {
                console.error('❌ Error inserting card:', err);
                errors++;
                reject(err);
              } else {
                inserted++;
                resolve();
              }
            });
          });
        } catch (error) {
          console.error('❌ Error processing card:', error.message);
          errors++;
        }
      }
      
      // Log progress
      if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= cards.length) {
        console.log(`📈 Progress: ${Math.min(i + BATCH_SIZE, cards.length)}/${cards.length} cards processed`);
      }
    }
    
    updater.db.close();
    
    res.json({
      success: true,
      message: `Successfully added ${inserted} cards to database`,
      stats: {
        totalProcessed: cards.length,
        inserted: inserted,
        errors: errors
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error adding cards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add cards',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sample summary titles endpoint for inspection
app.get('/api/sample-summary-titles', async (req, res) => {
  try {
    console.log('🔍 Sampling summary titles from production database...');
    
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    await updater.connect();
    
    // Get various samples of summary titles
    const samples = await new Promise((resolve, reject) => {
      const queries = [
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%PSA%' LIMIT 10",
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%CERT%' LIMIT 10", 
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%GEM%' LIMIT 10",
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%MT%' LIMIT 10",
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%110664432%' LIMIT 5",
        "SELECT id, summaryTitle FROM cards WHERE summaryTitle LIKE '%MOBLEY%' LIMIT 5",
        "SELECT id, summaryTitle FROM cards ORDER BY RANDOM() LIMIT 20"
      ];
      
      Promise.all(queries.map(query => {
        return new Promise((resolveQuery, rejectQuery) => {
          updater.db.all(query, (err, rows) => {
            if (err) rejectQuery(err);
            else resolveQuery(rows);
          });
        });
      })).then(([psaCards, certCards, gemCards, mtCards, specificCard, mobleyCards, randomCards]) => {
        resolve({
          psaCards: psaCards || [],
          certCards: certCards || [],
          gemCards: gemCards || [],
          mtCards: mtCards || [],
          specificCard: specificCard || [],
          mobleyCards: mobleyCards || [],
          randomCards: randomCards || []
        });
      }).catch(reject);
    });
    
    updater.db.close();
    
    res.json({
      success: true,
      message: 'Summary title samples retrieved',
      samples: samples,
      totalSamples: {
        psa: samples.psaCards.length,
        cert: samples.certCards.length,
        gem: samples.gemCards.length,
        mt: samples.mtCards.length,
        specific: samples.specificCard.length,
        mobley: samples.mobleyCards.length,
        random: samples.randomCards.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error sampling summary titles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sample summary titles',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clean summary titles endpoint
app.post('/api/clean-summary-titles', async (req, res) => {
  try {
    console.log('🧹 Starting summary title cleanup...');
    
    const { cleanSummaryTitles } = require('./api-clean-summary-titles.js');
    const result = await cleanSummaryTitles();
    
    res.json({
      success: true,
      message: 'Summary title cleanup completed successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error cleaning summary titles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean summary titles',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear database endpoint (for testing)
app.delete('/api/clear-database', async (req, res) => {
  try {
    console.log('🗑️ Clearing SQLite database...');
    
    const { SQLitePriceUpdater } = require('./sqlite-price-updater.js');
    const updater = new SQLitePriceUpdater();
    await updater.connect();
    
    await new Promise((resolve, reject) => {
      updater.db.run('DELETE FROM cards', (err) => {
        if (err) {
          console.error('❌ Error clearing database:', err);
          reject(err);
        } else {
          console.log('✅ Database cleared successfully');
          resolve();
        }
      });
    });
    
    updater.db.close();
    
    res.json({
      success: true,
      message: 'Database cleared successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear database',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize token refresh on startup
initializeServer().catch(console.error);