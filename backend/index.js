// Trigger redeploy - trivial change
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Helper function to get Central Time timestamp
function getCentralTime() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+):(\d+)/, '$3-$1-$2 $4:$5:$6 CT');
}
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

  // API endpoint to search and view all cards (admin only)
  app.get('/api/admin/cards', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search || '';
      const sport = req.query.sport || '';
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice = parseFloat(req.query.maxPrice) || 999999;
      const sortBy = req.query.sortBy || 'lastUpdated';
      const sortOrder = req.query.sortOrder || 'DESC';
      
      const offset = (page - 1) * limit;
      
      const NewPricingDatabase = require('./create-new-pricing-database.js');
      const db = new NewPricingDatabase();
      
      await db.connect();
      
      // Build WHERE clause
      let whereConditions = ['1=1']; // Always true base condition
      let params = [];
      
      if (search) {
        whereConditions.push('(title LIKE ? OR summary_title LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      
      if (sport && sport !== 'all') {
        whereConditions.push('sport = ?');
        params.push(sport);
      }
      
      if (minPrice > 0) {
        whereConditions.push('(psa10_price >= ? OR raw_average_price >= ? OR psa9_average_price >= ?)');
        params.push(minPrice, minPrice, minPrice);
      }
      
      if (maxPrice < 999999) {
        whereConditions.push('(psa10_price <= ? OR raw_average_price <= ? OR psa9_average_price <= ?)');
        params.push(maxPrice, maxPrice, maxPrice);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM cards WHERE ${whereClause}`;
      const totalCount = await db.getQuery(countQuery, params);
      
      // Get cards with pagination
      const cardsQuery = `
        SELECT id, title, summary_title as summaryTitle, sport, psa10_price as psa10Price, raw_average_price as rawAveragePrice, 
               psa9_average_price as psa9AveragePrice, multiplier, last_updated as lastUpdated, notes as filterInfo, source, search_term as searchTerm
        FROM cards 
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const cards = await db.allQuery(cardsQuery, [...params, limit, offset]);
      
      await db.close();
      
      const total = totalCount.total || 0;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        success: true,
        cards: cards,
        pagination: {
          page: page,
          limit: limit,
          total: { total: total },
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          search,
          sport,
          minPrice,
          maxPrice,
          sortBy,
          sortOrder
        },
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('❌ Error fetching cards:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to analyze database quality (admin only)
  app.get('/api/admin/database-quality', async (req, res) => {
    try {
      const DatabaseQualityAnalyzer = require('./analyze-database-quality.js');
      const analyzer = new DatabaseQualityAnalyzer();
      
      await analyzer.connect();
      
      // Get basic stats
      const totalCards = await new Promise((resolve, reject) => {
        analyzer.updater.db.get('SELECT COUNT(*) as count FROM cards', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      // Missing price analysis
      const missingPsa10 = await new Promise((resolve, reject) => {
        analyzer.updater.db.get('SELECT COUNT(*) as count FROM cards WHERE psa10Price IS NULL OR psa10Price = 0', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      const missingRaw = await new Promise((resolve, reject) => {
        analyzer.updater.db.get('SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NULL OR rawAveragePrice = 0', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      const missingPsa9 = await new Promise((resolve, reject) => {
        analyzer.updater.db.get('SELECT COUNT(*) as count FROM cards WHERE psa9AveragePrice IS NULL OR psa9AveragePrice = 0', [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      // Complete vs incomplete data
      const noPrices = await new Promise((resolve, reject) => {
        analyzer.updater.db.get(`
          SELECT COUNT(*) as count FROM cards 
          WHERE (psa10Price IS NULL OR psa10Price = 0) 
          AND (rawAveragePrice IS NULL OR rawAveragePrice = 0) 
          AND (psa9AveragePrice IS NULL OR psa9AveragePrice = 0)
        `, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      const completePrices = await new Promise((resolve, reject) => {
        analyzer.updater.db.get(`
          SELECT COUNT(*) as count FROM cards 
          WHERE psa10Price > 0 AND rawAveragePrice > 0 AND psa9AveragePrice > 0
        `, [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      // Sport distribution
      const sports = await new Promise((resolve, reject) => {
        analyzer.updater.db.all(`
          SELECT sport, COUNT(*) as count 
          FROM cards 
          GROUP BY sport 
          ORDER BY count DESC
        `, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      analyzer.updater.db.close();
      
      res.json({
        success: true,
        analysis: {
          overview: {
            totalCards,
            completePrices,
            noPrices,
            dataQualityScore: Math.round((completePrices / totalCards) * 100)
          },
          missingPrices: {
            psa10: { count: missingPsa10, percentage: Math.round((missingPsa10 / totalCards) * 100) },
            raw: { count: missingRaw, percentage: Math.round((missingRaw / totalCards) * 100) },
            psa9: { count: missingPsa9, percentage: Math.round((missingPsa9 / totalCards) * 100) }
          },
          sports: sports
        },
        recommendations: [
          'Re-run price updates for cards with missing prices',
          'Clean up summary titles for better search accuracy',
          'Remove cards with "lot" in titles (bulk sales)',
          'Fix sport detection for unknown/missing sports',
          'Investigate price inconsistencies'
        ],
        timestamp: getCentralTime()
      });
    } catch (error) {
      console.error('Database quality analysis error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to update comprehensive database with card types
  app.post('/api/admin/update-comprehensive-database', async (req, res) => {
    try {
      console.log('🔄 Starting comprehensive database update via API...');
      
      const { RailwayComprehensiveDatabaseUpdater } = require('./update-railway-comprehensive-db.js');
      const updater = new RailwayComprehensiveDatabaseUpdater();
      
      await updater.connect();
      await updater.updateCardTypes();
      await updater.close();
      
      res.json({
        success: true,
        message: 'Comprehensive database updated successfully with card types',
        timestamp: getCentralTime()
      });
    } catch (error) {
      console.error('Comprehensive database update error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run sport detection over Railway database
  app.post('/api/admin/update-sport-detection', async (req, res) => {
    try {
      console.log('🔄 Starting sport detection update via API...');
      
      const { SportDetectionUpdater } = require('./update-sport-detection.js');
      const updater = new SportDetectionUpdater();
      
      await updater.connect();
      await updater.updateSportDetection();
      await updater.close();
      
      res.json({
        success: true,
        message: 'Sport detection update completed successfully',
        timestamp: getCentralTime()
      });
    } catch (error) {
      console.error('Sport detection update error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to remove duplicate Lamelo Ball card
  app.post('/api/admin/remove-duplicate-card', async (req, res) => {
    try {
      console.log('🔄 Starting duplicate card removal via API...');
      
      const { DuplicateCardRemover } = require('./remove-duplicate-card.js');
      const remover = new DuplicateCardRemover();
      
      await remover.connect();
      
      // Find and remove duplicates
      const duplicates = await remover.findDuplicateCards();
      
      if (duplicates.length === 0) {
        await remover.close();
        return res.json({
          success: true,
          message: 'No duplicate Lamelo Ball cards found',
          timestamp: getCentralTime()
        });
      }
      
      console.log(`📊 Found ${duplicates.length} Lamelo Ball cards`);
      
      if (duplicates.length > 1) {
        // Keep the oldest one and remove the rest
        const cardsToRemove = duplicates.slice(1);
        
        for (const card of cardsToRemove) {
          await remover.removeDuplicateCard(card.id);
          console.log(`✅ Removed duplicate card ID ${card.id}`);
        }
        
        await remover.close();
        
        res.json({
          success: true,
          message: `Removed ${cardsToRemove.length} duplicate Lamelo Ball card(s)`,
          removedCount: cardsToRemove.length,
          timestamp: getCentralTime()
        });
      } else {
        await remover.close();
        res.json({
          success: true,
          message: 'Only one Lamelo Ball card found - no duplicates to remove',
          timestamp: getCentralTime()
        });
      }
      
    } catch (error) {
      console.error('Duplicate removal error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to clean summary titles for all existing cards
  app.post('/api/admin/clean-summary-titles', async (req, res) => {
    try {
      console.log('🔄 Starting summary title cleanup via API...');
      
      const { SummaryTitleCleaner } = require('./clean-summary-titles.js');
      const cleaner = new SummaryTitleCleaner();
      
      await cleaner.connect();
      const results = await cleaner.cleanAllSummaryTitles();
      await cleaner.close();
      
      res.json({
        success: true,
        message: 'Summary title cleanup completed successfully',
        results: results,
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('Summary title cleanup error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to check Railway database structure
  app.get('/api/admin/check-database-structure', async (req, res) => {
    try {
      console.log('🔍 Checking Railway database structure...');
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      
      // Try different possible database paths
      const possiblePaths = [
        path.join(__dirname, 'scorecard.db'),
        path.join(__dirname, 'data', 'scorecard.db'),
        path.join(__dirname, 'new-scorecard.db'),
        path.join(__dirname, 'data', 'new-scorecard.db')
      ];
      
      let dbPath = null;
      let db = null;
      
      for (const testPath of possiblePaths) {
        try {
          db = new sqlite3.Database(testPath, sqlite3.OPEN_READONLY);
          console.log(`✅ Found database at: ${testPath}`);
          dbPath = testPath;
          break;
        } catch (err) {
          console.log(`❌ No database at: ${testPath}`);
        }
      }
      
      if (!db) {
        return res.status(404).json({
          success: false,
          error: 'No database found in any expected location',
          timestamp: getCentralTime()
        });
      }
      
      // Get list of tables
      const tables = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Get sample data from each table
      const tableInfo = {};
      for (const table of tables) {
        try {
          const sampleData = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${table.name} LIMIT 3`, [], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          
          const count = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM ${table.name}`, [], (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });
          
          tableInfo[table.name] = {
            count: count,
            sampleData: sampleData,
            columns: sampleData.length > 0 ? Object.keys(sampleData[0]) : []
          };
        } catch (err) {
          tableInfo[table.name] = { error: err.message };
        }
      }
      
      db.close();
      
      res.json({
        success: true,
        databasePath: dbPath,
        tables: tableInfo,
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('Database structure check error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to analyze wrong sports (admin only)
  app.get('/api/admin/analyze-sports', async (req, res) => {
    try {
      const SportFixer = require('./fix-wrong-sports.js');
      const fixer = new SportFixer();
      
      await fixer.connect();
      const analysis = await fixer.analyzeSportsForApi();
      fixer.updater.db.close();
      
      res.json({
        success: true,
        analysis,
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('❌ Error analyzing sports:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to fix wrong sports (admin only)
  app.post('/api/admin/fix-sports', async (req, res) => {
    try {
      const { dryRun = true, minConfidence = 70 } = req.body;
      const SportFixer = require('./fix-wrong-sports.js');
      const fixer = new SportFixer();
      
      await fixer.connect();
      const results = await fixer.fixWrongSports(dryRun, minConfidence);
      fixer.updater.db.close();
      
      res.json({
        success: true,
        results,
        message: dryRun ? 'Dry run completed - no changes made' : `Applied ${results.fixed} sport fixes`,
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('❌ Error fixing sports:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to recalculate multipliers (admin only)
  app.post('/api/admin/recalculate-multipliers', async (req, res) => {
    try {
      console.log('🔄 Starting multiplier recalculation process...');
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      
      // Connect to database
      const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
      const db = new sqlite3.Database(dbPath);
      
      // Get all cards with valid prices
      const cards = await new Promise((resolve, reject) => {
        db.all(`
          SELECT id, title, psa10_price, raw_average_price, multiplier 
          FROM cards 
          WHERE psa10_price IS NOT NULL 
          AND raw_average_price IS NOT NULL 
          AND psa10_price > 0 
          AND raw_average_price > 0
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      console.log(`📊 Found ${cards.length} cards with valid prices for multiplier calculation`);
      
      let updatedCount = 0;
      let errorCount = 0;
      const results = [];
      
      for (const card of cards) {
        try {
          const correctMultiplier = (card.psa10_price / card.raw_average_price).toFixed(2);
          const currentMultiplier = card.multiplier;
          
          // Check if multiplier needs fixing
          if (currentMultiplier !== correctMultiplier) {
            await new Promise((resolve, reject) => {
              db.run(`
                UPDATE cards 
                SET multiplier = ? 
                WHERE id = ?
              `, [correctMultiplier, card.id], function(err) {
                if (err) reject(err);
                else resolve();
              });
            });
            
            updatedCount++;
            results.push({
              id: card.id,
              title: card.title,
              oldMultiplier: currentMultiplier,
              newMultiplier: correctMultiplier,
              psa10Price: card.psa10_price,
              rawPrice: card.raw_average_price
            });
            
            if (updatedCount % 10 === 0) {
              console.log(`✅ Updated ${updatedCount} multipliers...`);
            }
          }
        } catch (error) {
          console.error(`❌ Error updating card ${card.id}:`, error.message);
          errorCount++;
        }
      }
      
      db.close();
      
      console.log(`✅ Multiplier recalculation completed!`);
      console.log(`📊 Results: ${updatedCount} cards updated, ${errorCount} errors`);
      
      res.json({
        success: true,
        message: `Recalculated multipliers for ${updatedCount} cards`,
        results: {
          totalCards: cards.length,
          updatedCount,
          errorCount,
          details: results.slice(0, 10) // Show first 10 results
        },
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('❌ Error recalculating multipliers:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run Railway debug script (admin only)
  app.post('/api/admin/run-railway-debug', async (req, res) => {
    try {
      console.log('🔍 Running Railway debug script...');
      
      res.json({
        success: true,
        message: "Railway debug script triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the debug script in background
      setImmediate(async () => {
        try {
          const { railwayDebugCleanup } = require('./railway-debug-cleanup.js');
          
          console.log('🔍 Starting Railway debug script...');
          await railwayDebugCleanup();
          
          console.log('✅ Railway debug script completed!');

        } catch (error) {
          console.error('❌ Error in Railway debug script:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway debug script:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to check Railway database structure (admin only)
  app.post('/api/admin/check-railway-database', async (req, res) => {
    try {
      console.log('🔍 Checking Railway database structure...');
      
      res.json({
        success: true,
        message: "Railway database check triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the database check in background
      setImmediate(async () => {
        try {
          const { checkRailwayDatabase } = require('./check-railway-database.js');
          
          console.log('🔍 Starting Railway database check...');
          await checkRailwayDatabase();
          
          console.log('✅ Railway database check completed!');

        } catch (error) {
          console.error('❌ Error in Railway database check:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway database check:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to check Railway files (admin only)
  app.post('/api/admin/check-railway-files', async (req, res) => {
    try {
      console.log('🔍 Checking Railway files...');
      
      res.json({
        success: true,
        message: "Railway files check triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the files check in background
      setImmediate(async () => {
        try {
          const { checkRailwayFiles } = require('./check-railway-files.js');
          
          console.log('🔍 Starting Railway files check...');
          await checkRailwayFiles();
          
          console.log('✅ Railway files check completed!');

        } catch (error) {
          console.error('❌ Error in Railway files check:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway files check:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run manual update test (admin only)
  app.post('/api/admin/manual-update-test', async (req, res) => {
    try {
      console.log('🔧 Running manual update test...');
      
      res.json({
        success: true,
        message: "Manual update test triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the manual update test in background
      setImmediate(async () => {
        try {
          const { manualUpdateTest } = require('./manual-update-test.js');
          
          console.log('🔧 Starting manual update test...');
          await manualUpdateTest();
          
          console.log('✅ Manual update test completed!');

        } catch (error) {
          console.error('❌ Error in manual update test:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering manual update test:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run database analysis (admin only)
  app.post('/api/admin/run-database-analysis', async (req, res) => {
    try {
      console.log('🔍 Running Railway database analysis...');
      
      res.json({
        success: true,
        message: "Database analysis triggered - running in background",
        timestamp: getCentralTime()
      });

                // Run the database analysis in background
          setImmediate(async () => {
            try {
              const DatabaseOptimizationAnalyzer = require('./database-optimization-analysis.js');
              const analyzer = new DatabaseOptimizationAnalyzer();
              
              console.log('🔍 Starting Railway database analysis...');
              await analyzer.connect();
              await analyzer.analyzeDatabase();
              analyzer.db.close();
              
              console.log('✅ Railway database analysis completed!');

            } catch (error) {
              console.error('❌ Error in Railway database analysis:', error);
            }
          });

    } catch (error) {
      console.error('Error triggering Railway database analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run price anomaly fixes (admin only)
  app.post('/api/admin/fix-price-anomalies', async (req, res) => {
    try {
      console.log('🔧 Running Railway price anomaly fixes...');
      
      res.json({
        success: true,
        message: "Price anomaly fixes triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the price anomaly fixes in background
      setImmediate(async () => {
        try {
          const PriceAnomalyFixer = require('./fix-price-anomalies.js');
          const fixer = new PriceAnomalyFixer();
          
          console.log('🔧 Starting Railway price anomaly fixes...');
          await fixer.connect();
          await fixer.findPriceAnomalies();
          await fixer.fixPriceAnomalies();
          await fixer.calculateMissingMultipliers();
          fixer.db.close();
          
          console.log('✅ Railway price anomaly fixes completed!');

        } catch (error) {
          console.error('❌ Error in Railway price anomaly fixes:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway price anomaly fixes:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run duplicate fixes (admin only)
  app.post('/api/admin/fix-duplicates', async (req, res) => {
    try {
      console.log('🔧 Running Railway duplicate fixes...');
      
      res.json({
        success: true,
        message: "Duplicate fixes triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the duplicate fixes in background
      setImmediate(async () => {
        try {
          const DuplicateFixer = require('./fix-duplicates.js');
          const fixer = new DuplicateFixer();
          
          console.log('🔧 Starting Railway duplicate fixes...');
          await fixer.connect();
          await fixer.findDuplicates();
          await fixer.mergeDuplicates();
          fixer.db.close();
          
          console.log('✅ Railway duplicate fixes completed!');

        } catch (error) {
          console.error('❌ Error in Railway duplicate fixes:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway duplicate fixes:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to add performance indexes (admin only)
  app.post('/api/admin/add-indexes', async (req, res) => {
    try {
      console.log('🔧 Adding Railway performance indexes...');
      
      res.json({
        success: true,
        message: "Performance indexes triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the index addition in background
      setImmediate(async () => {
        try {
          const PerformanceIndexer = require('./add-performance-indexes.js');
          const indexer = new PerformanceIndexer();
          
          console.log('🔧 Starting Railway performance index addition...');
          await indexer.connect();
          await indexer.addPerformanceIndexes();
          await indexer.optimizeDatabase();
          indexer.db.close();
          
          console.log('✅ Railway performance indexes completed!');

        } catch (error) {
          console.error('❌ Error in Railway performance indexes:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway performance indexes:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to run data validation (admin only)
  app.post('/api/admin/run-validation', async (req, res) => {
    try {
      console.log('🔧 Running Railway data validation...');
      
      res.json({
        success: true,
        message: "Data validation triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the data validation in background
      setImmediate(async () => {
        try {
          const DataValidationSystem = require('./data-validation-system.js');
          const validator = new DataValidationSystem();
          
          console.log('🔧 Starting Railway data validation...');
          await validator.connect();
          await validator.validateExistingData();
          await validator.addDatabaseConstraints();
          await validator.createDataQualityReport();
          validator.db.close();
          
          console.log('✅ Railway data validation completed!');

        } catch (error) {
          console.error('❌ Error in Railway data validation:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway data validation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to generate standardized summary titles (admin only)
  app.post('/api/admin/generate-standardized-titles', async (req, res) => {
    try {
      console.log('🔄 Running Railway standardized summary title generation...');
      
      res.json({
        success: true,
        message: "Standardized summary title generation triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the standardized title generation in background
      setImmediate(async () => {
        try {
          const { StandardizedSummaryTitleGeneratorFinal } = require('./generate-standardized-summary-titles-final.js');
          const generator = new StandardizedSummaryTitleGeneratorFinal();
          
          console.log('🔄 Starting Railway standardized summary title generation...');
          await generator.connect();
          await generator.generateAllStandardizedTitles();
          
          console.log('✅ Railway standardized summary title generation completed!');

        } catch (error) {
          console.error('❌ Error in Railway standardized summary title generation:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway standardized summary title generation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

  // API endpoint to view recently added cards
  app.get('/api/recent-cards', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
      const updater = new FastSQLitePriceUpdater();
      
      await updater.connect();
      
      const recentCards = await new Promise((resolve, reject) => {
        const query = `
          SELECT id, title, summaryTitle, sport, psa10Price, lastUpdated, filterInfo
          FROM cards 
          WHERE lastUpdated IS NOT NULL
          ORDER BY datetime(lastUpdated) DESC 
          LIMIT ?
        `;
        
        updater.db.all(query, [limit], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Parse filterInfo to show source information
            const cardsWithSource = rows.map(card => {
              let source = 'unknown';
              let searchTerm = 'unknown';
              
              try {
                if (card.filterInfo) {
                  const parsed = JSON.parse(card.filterInfo);
                  source = parsed.source || 'unknown';
                  searchTerm = parsed.searchTerm || 'unknown';
                }
              } catch (e) {
                // Keep defaults if parsing fails
              }
              
              return {
                ...card,
                source,
                searchTerm,
                price: card.psa10Price,
                addedDate: card.lastUpdated
              };
            });
            
            resolve(cardsWithSource);
          }
        });
      });
      
      updater.db.close();
      
      res.json({
        success: true,
        count: recentCards.length,
        cards: recentCards,
        timestamp: getCentralTime()
      });
      
    } catch (error) {
      console.error('❌ Error fetching recent cards:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCentralTime()
      });
    }
  });

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
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
    
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
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
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
        `SELECT id, title, raw_average_price as rawAveragePrice, psa9_average_price as psa9AveragePrice, last_updated as updated_at FROM cards 
         WHERE (raw_average_price IS NOT NULL OR psa9_average_price IS NOT NULL)
         AND last_updated IS NOT NULL 
         ORDER BY last_updated DESC LIMIT 5`,
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
          schedule: "Every 6 hours (0 */6 * * *) - Fast Batch Process",
          lastRun: recentCards.length > 0 ? recentCards[0].created_at : "No recent items",
          recentItems: recentCards
        },
        updatePrices: {
          schedule: "Daily at 2:00 AM (0 2 * * *)", 
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
        const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
        
        class AutomatedPriceUpdater {
          constructor() {
            this.updater = new FastSQLitePriceUpdater();
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
                // Use summaryTitle for cleaner searches (removes grading info)
                const searchTitle = card.summaryTitle || card.title;
                const rawResults = await this.updater.search130Point(searchTitle, false);
                const psa9Results = await this.updater.search130Point(searchTitle, true);
                
                let priceData = {};
                
                // Use the same logic as the actual price updater
                const rawAvg = rawResults.length > 0 ? 
                  rawResults.reduce((sum, sale) => sum + sale.price, 0) / rawResults.length : 0;
                
                const psa9Avg = psa9Results.length > 0 ? 
                  psa9Results.reduce((sum, sale) => sum + sale.price, 0) / psa9Results.length : 0;
                
                const priceDataForUpdate = {
                  raw: { avgPrice: rawAvg, count: rawResults.length, sales: rawResults },
                  psa9: { avgPrice: psa9Avg, count: psa9Results.length, sales: psa9Results },
                  source: '130point_api'
                };
                
                // Log the prices we found
                console.log(`   📈 ${card.summaryTitle || card.title}`);
                if (rawAvg > 0) {
                  console.log(`      💰 Raw: $${rawAvg.toFixed(2)} (${rawResults.length} cards)`);
                }
                if (psa9Avg > 0) {
                  console.log(`      💰 PSA 9: $${psa9Avg.toFixed(2)} (${psa9Results.length} cards)`);
                }
                
                if (rawAvg > 0 || psa9Avg > 0) {
                  await this.updater.updateCardPrices(card.id, priceDataForUpdate);
                  updated++;
                  console.log(`      ✅ Updated database for card ${card.id}`);
                } else {
                  console.log(`      ⚠️ No valid prices found - skipping database update`);
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
    
    // Regular database status check - use new pricing database system
    const NewPricingDatabase = require('./create-new-pricing-database.js');
    const db = new NewPricingDatabase();
    
    // Force creation of new database and tables
    await db.connect();
    await db.createTables();
    const stats = await db.getDatabaseStats();
    await db.close();
    
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

// Reset database endpoint - for starting fresh
app.post('/api/reset-database', async (req, res) => {
  try {
    console.log('🔄 Resetting database to start fresh...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Delete old database files
    const oldDbPath = path.join(__dirname, 'data', 'scorecard.db');
    const newDbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    if (fs.existsSync(oldDbPath)) {
      fs.unlinkSync(oldDbPath);
      console.log('🗑️ Deleted old database');
    }
    
    if (fs.existsSync(newDbPath)) {
      fs.unlinkSync(newDbPath);
      console.log('🗑️ Deleted existing new database');
    }
    
    // Create fresh new database
    const NewPricingDatabase = require('./create-new-pricing-database.js');
    const db = new NewPricingDatabase();
    
    await db.connect();
    await db.createTables();
    const stats = await db.getDatabaseStats();
    await db.close();
    
    console.log('✅ Fresh database created');
    
    res.json({
      success: true,
      message: 'Database reset successfully',
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test file system endpoint
app.get('/api/test-fs', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir);

    const fileStats = files.map(file => {
      const filePath = path.join(dataDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime
      };
    });

    res.json({
      success: true,
      dataDir,
      files: fileStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing file system:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Recreate comprehensive database on Railway
app.post('/api/recreate-comprehensive-database', async (req, res) => {
  try {
    console.log('🔄 Manual comprehensive database recreation triggered via API...');

    res.json({
      success: true,
      message: "Comprehensive database recreation triggered - running in background",
      timestamp: new Date().toISOString()
    });

    // Run the recreation in background
    setImmediate(async () => {
      try {
        const ComprehensiveDatabaseRecreator = require('./recreate-comprehensive-on-railway.js');
        const recreator = new ComprehensiveDatabaseRecreator();
        
        console.log('📊 Starting comprehensive database recreation...');
        const stats = await recreator.recreateDatabase();
        
        console.log('✅ Comprehensive database recreation completed!');
        console.log('Final stats:', stats);

      } catch (error) {
        console.error('❌ Error in comprehensive database recreation:', error);
      }
    });

  } catch (error) {
    console.error('Error triggering comprehensive database recreation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update missing raw/PSA 9 prices
app.post('/api/update-missing-prices', async (req, res) => {
  try {
    console.log('💰 Manual price update triggered via API...');

    res.json({
      success: true,
      message: "Price update triggered - running in background",
      timestamp: new Date().toISOString()
    });

    // Run the update in background
    setImmediate(async () => {
      try {
        const { ImprovedPriceUpdater } = require('./improve-price-updating.js');
        const updater = new ImprovedPriceUpdater();
        
        console.log('💰 Starting comprehensive price update...');
        const result = await updater.updateAllMissingPrices();
        
        console.log('✅ Price update completed!');
        console.log('Final result:', result);

      } catch (error) {
        console.error('❌ Error in price update:', error);
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

// Enhance comprehensive database
app.post('/api/enhance-comprehensive-database', async (req, res) => {
  try {
    console.log('🚀 Manual comprehensive database enhancement triggered via API...');

    res.json({
      success: true,
      message: "Comprehensive database enhancement triggered - running in background",
      timestamp: new Date().toISOString()
    });

    // Run the enhancement in background
    setImmediate(async () => {
      try {
        const { EnhancedComprehensiveDatabase } = require('./enhance-comprehensive-database.js');
        const enhancer = new EnhancedComprehensiveDatabase();
        
        console.log('🚀 Starting comprehensive database enhancement...');
        const result = await enhancer.enhanceDatabase();
        
        console.log('✅ Comprehensive database enhancement completed!');
        console.log('Final result:', result);

      } catch (error) {
        console.error('❌ Error in comprehensive database enhancement:', error);
      }
    });

  } catch (error) {
    console.error('Error triggering comprehensive database enhancement:', error);
    res.status(500).json({
      success: false,
      error: error.message,
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
    
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
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
    
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
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
    
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
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
    
    // Use the same database as the status endpoint
    const NewPricingDatabase = require('./create-new-pricing-database.js');
    const db = new NewPricingDatabase();
    await db.connect();
    
    await new Promise((resolve, reject) => {
      db.pricingDb.run('DELETE FROM cards', (err) => {
        if (err) {
          console.error('❌ Error clearing database:', err);
          reject(err);
        } else {
          console.log('✅ Database cleared successfully');
          resolve();
        }
      });
    });
    
    // Reset auto-increment counter
    await new Promise((resolve, reject) => {
      db.pricingDb.run('DELETE FROM sqlite_sequence WHERE name="cards"', (err) => {
        if (err) {
          console.error('❌ Error resetting sequence:', err);
          reject(err);
        } else {
          console.log('✅ Auto-increment counter reset');
          resolve();
        }
      });
    });
    
    await db.close();
    
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

// Manual trigger for pull new items
app.post('/api/trigger-pull-new-items', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Pull new items job triggered - running in background",
      timestamp: new Date().toISOString()
    });
    
    // Run the pull new items in background
    setImmediate(async () => {
      try {
        console.log('🚀 Manual pull new items triggered via API...');
        
        // Use the new pricing database system
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const { pullNewItems } = require('./new-pull-new-items.js');
        
        const db = new NewPricingDatabase();
        await db.connect();
        
        console.log('📊 Starting pull new items process...');
        await pullNewItems(db);
        
        console.log('✅ Pull new items completed!');
        await db.close();
        
      } catch (error) {
        console.error('❌ Error in pull new items:', error);
      }
    });
    
  } catch (error) {
    console.error('Error triggering pull new items:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual trigger for fast batch pull new items
app.post('/api/trigger-fast-batch-pull', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Fast batch pull new items job triggered - running in background",
      timestamp: new Date().toISOString()
    });
    
    // Run the fast batch pull in background
    setImmediate(async () => {
      try {
        console.log('⚡ Manual FAST BATCH pull new items triggered via API...');
        
        // Use the fast batch system
        const { pullNewItems } = require('./fast-batch-pull-new-items.js');
        
        console.log('⚡ Starting FAST BATCH new items pull...');
        const result = await pullNewItems();
        
        console.log('✅ Fast batch new items pull completed!');
        console.log('Final result:', result);
        
      } catch (error) {
        console.error('❌ Error in fast batch new items pull:', error);
      }
    });
    
  } catch (error) {
    console.error('Error triggering fast batch pull new items:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Fix Railway database schema - add missing psa10_average_price column
app.post('/api/fix-railway-database-schema', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Railway database schema fix triggered - running in background",
      timestamp: new Date().toISOString()
    });
    
    // Run the schema fix in background
    setImmediate(async () => {
      try {
        console.log('🔧 Fixing Railway database schema...');
        
        // Use the database fixer
        const { RailwayDatabaseFixer } = require('./fix-railway-database-schema.js');
        
        const fixer = new RailwayDatabaseFixer();
        await fixer.addMissingColumn();
        await fixer.close();
        
        console.log('✅ Railway database schema fix completed!');
        
      } catch (error) {
        console.error('❌ Error fixing Railway database schema:', error);
      }
    });
    
  } catch (error) {
    console.error('Error triggering Railway database schema fix:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/update-sports - Update sports in database using enhanced detection
app.post('/api/update-sports', async (req, res) => {
    try {
        console.log('🔄 Starting sport update process...');
        
        const { SportUpdater } = require('./update-sports-in-database.js');
        const updater = new SportUpdater();
        
        await updater.connect();
        await updater.updateSportsInDatabase();
        await updater.close();
        
        console.log('✅ Sport update completed successfully');
        res.json({ 
            success: true, 
            message: 'Sport update completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Sport update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Sport update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/update-sports-espn-v2 - Update sports using ESPN v2 API for existing cards
app.post('/api/update-sports-espn-v2', async (req, res) => {
    try {
        console.log('🔄 Starting ESPN v2 sport detection update process...');
        
        const { SportsUpdaterWithESPNV2 } = require('./update-sports-with-espn-v2.js');
        const updater = new SportsUpdaterWithESPNV2();
        
        await updater.connect();
        await updater.updateSportsForExistingCards();
        await updater.close();
        
        console.log('✅ ESPN v2 sport detection update completed successfully');
        res.json({ 
            success: true, 
            message: 'ESPN v2 sport detection update completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ESPN v2 sport detection update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'ESPN v2 sport detection update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/update-summary-titles - Update summary titles with new cleaning rules and WWE sport detection
app.post('/api/update-summary-titles', async (req, res) => {
    try {
        console.log('🔄 Starting summary title update process...');
        
        const { SummaryTitleUpdater } = require('./update-summary-titles-v2.js');
        const updater = new SummaryTitleUpdater();
        
        await updater.connect();
        await updater.updateSummaryTitles();
        await updater.close();
        
        console.log('✅ Summary title update completed successfully');
        res.json({ 
            success: true, 
            message: 'Summary title update completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Summary title update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Summary title update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/add-multiplier-field - Add multiplier field to database and calculate values
app.post('/api/add-multiplier-field', async (req, res) => {
    try {
        console.log('🔄 Starting multiplier field addition process...');
        
        const { MultiplierFieldAdder } = require('./add-multiplier-field.js');
        const adder = new MultiplierFieldAdder();
        
        await adder.connect();
        await adder.addMultiplierColumn();
        await adder.calculateMultipliers();
        await adder.close();
        
        console.log('✅ Multiplier field addition completed successfully');
        res.json({ 
            success: true, 
            message: 'Multiplier field added and calculated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Multiplier field addition failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Multiplier field addition failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/update-sports-improved-detection - Update sports using improved detection for existing cards
app.post('/api/update-sports-improved-detection', async (req, res) => {
    try {
        console.log('🔄 Starting improved sport detection update process...');
        
        const { SportsUpdaterWithImprovedDetection } = require('./update-sports-with-improved-detection.js');
        const updater = new SportsUpdaterWithImprovedDetection();
        
        await updater.connect();
        await updater.updateSportsForExistingCards();
        await updater.close();
        
        console.log('✅ Improved sport detection update completed successfully');
        res.json({ 
            success: true, 
            message: 'Improved sport detection update completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Improved sport detection update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Improved sport detection update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Initialize token refresh on startup
initializeServer().catch(console.error);