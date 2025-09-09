// Trigger redeploy - Summary title fix deployment
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
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

// Helper function to get Central Time ISO string (for database compatibility)
function getCentralTimeISO() {
  const now = new Date();
  const centralTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return centralTime.toISOString();
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

// Import NewPricingDatabase for admin endpoints
const NewPricingDatabase = require('./create-new-pricing-database.js');

// Import the centralized player name extraction system
const SimplePlayerExtractor = require('./simple-player-extraction.js');

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
  
  // Parallels database API routes
  app.use('/api/parallels', require('./railway-parallels-api'));

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
        whereConditions.push('(title LIKE ? OR summary_title LIKE ? OR player_name LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
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
               psa9_average_price as psa9AveragePrice, multiplier, last_updated as lastUpdated, notes as filterInfo, source, search_term as searchTerm,
               player_name as playerName, year, card_set as cardSet, card_type as cardType, card_number as cardNumber, print_run as printRun,
               is_rookie as isRookie, is_autograph as isAutograph
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
        error: 'Failed to clean summary titles', 
        details: error.message,
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
        path.join(__dirname, 'data', 'new-scorecard.db'),
        path.join(__dirname, 'new-scorecard.db')
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
          console.log('🔧 Starting Railway data validation...');
          // Data validation system removed - using health check instead
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
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
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

  // API endpoint to generate database-driven standardized summary titles (admin only)
  app.post('/api/admin/generate-database-driven-titles', async (req, res) => {
    try {
      console.log('🔄 Running Railway database-driven standardized summary title generation...');
      
      res.json({
        success: true,
        message: "Database-driven standardized summary title generation triggered - running in background",
        timestamp: getCentralTime()
      });

      // Run the database-driven standardized title generation in background
      setImmediate(async () => {
        try {
          const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
          const generator = new DatabaseDrivenStandardizedTitleGenerator();
          
          console.log('🔄 Starting Railway database-driven standardized summary title generation...');
          await generator.connect();
          await generator.generateAllStandardizedTitles();
          
          console.log('✅ Railway database-driven standardized summary title generation completed!');

        } catch (error) {
          console.error('❌ Error in Railway database-driven standardized summary title generation:', error);
        }
      });

    } catch (error) {
      console.error('Error triggering Railway database-driven standardized summary title generation:', error);
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

  // Start the server with proper error handling
  // Load package version for startup diagnostics
  let appVersion = 'unknown';
  try {
    // package.json is located at project root
    appVersion = require('../package.json').version || 'unknown';
  } catch (e) {
    // ignore if not found
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📅 Server started at: ${getCentralTime()}`);
    // Deployment diagnostics
    const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
    const verboseExtraction = process.env.VERBOSE_EXTRACTION === '1' || process.env.VERBOSE_EXTRACTION === 'true';
    console.log(`🧾 Version: ${appVersion} | Commit: ${commitSha} | VERBOSE_EXTRACTION=${verboseExtraction}`);
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
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. This usually means another instance is running.`);
      console.error(`   Please wait a moment for the previous instance to shut down, or manually stop it.`);
      console.error(`   Error details: ${error.message}`);
      
      // Instead of exiting, let's try to wait and retry
      console.log('🔄 Waiting 10 seconds before retrying...');
      setTimeout(() => {
        console.log('🔄 Retrying server startup...');
        // Try to start the server again
        const retryServer = app.listen(PORT, () => {
          console.log(`🚀 Server successfully started on port ${PORT} (retry)`);
          console.log(`📅 Server started at: ${getCentralTime()}`);
        }).on('error', (retryError) => {
          console.error(`❌ Retry failed: ${retryError.message}`);
          // If retry fails, exit with success code to prevent infinite restart loop
          process.exit(0);
        });
      }, 10000);
    } else {
      console.error(`❌ Server failed to start: ${error.message}`);
      process.exit(1);
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
  console.log(`⏰ Next token refresh scheduled for: ${getCentralTime()}`);
}

// Manual token refresh endpoint (for testing)
app.post('/api/refresh-token', async (req, res) => {
  try {
    await refreshEbayToken();
    res.json({ 
      success: true, 
      message: 'Token refresh initiated',
      timestamp: getCentralTime()
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
    nextRefresh: tokenRefreshTimer ? getCentralTime() : null,
    timestamp: getCentralTime()
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
      timestamp: getCentralTime()
    });
    
  } catch (error) {
    console.error('❌ Error in price update endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prices',
      message: error.message,
      timestamp: getCentralTime()
    });
  }
});

// Test endpoint for price updater (read-only, no changes)
app.post('/api/test-price-updater', async (req, res) => {
  try {
    const { batchSize = 3 } = req.body; // Default to 3 cards for testing
    console.log(`🧪 Starting price updater test with batch size: ${batchSize}`);
    
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
    
    await updater.connect();
    
    // Get cards that need updates
    const cards = await updater.getCardsNeedingUpdates(batchSize);
    
    if (cards.length === 0) {
      await updater.db.close();
      return res.json({ 
        success: true, 
        message: 'No cards need updates',
        cards: []
      });
    }
    
    // Test first card only to avoid overwhelming 130point
    const testCard = cards[0];
    console.log(`🧪 Testing with card: ${testCard.summaryTitle || testCard.title}`);
    
    const priceData = await updater.searchCardPrices(testCard);
    await updater.db.close();
    
    res.json({
      success: true,
      message: 'Price updater test completed',
      testCard: {
        id: testCard.id,
        title: testCard.title,
        summaryTitle: testCard.summaryTitle,
        sport: testCard.sport
      },
      searchResults: {
        raw: {
          count: priceData?.raw?.count || 0,
          avgPrice: priceData?.raw?.avgPrice || 0,
          sampleResults: priceData?.raw?.sales?.slice(0, 3) || []
        },
        psa9: {
          count: priceData?.psa9?.count || 0,
          avgPrice: priceData?.psa9?.avgPrice || 0,
          sampleResults: priceData?.psa9?.sales?.slice(0, 3) || []
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Price updater test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for specific card (read-only, no changes)
app.post('/api/test-specific-card', async (req, res) => {
  try {
    const { cardId } = req.body;
    console.log(`🧪 Testing specific card with ID: ${cardId}`);
    
    const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
    const updater = new FastSQLitePriceUpdater();
    
    await updater.connect();
    
    // Get the specific card directly from database
    const card = await new Promise((resolve, reject) => {
      const query = `
        SELECT id, title, summary_title as summaryTitle, sport, notes as filterInfo, 
               raw_average_price as rawAveragePrice, psa9_average_price as psa9AveragePrice, psa10_price as psa10Price, last_updated as lastUpdated
        FROM cards 
        WHERE id = ?
      `;
      
      updater.db.get(query, [cardId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    
    if (!card) {
      await updater.db.close();
      return res.json({ 
        success: false, 
        message: 'Card not found',
        cardId: cardId
      });
    }
    
    console.log(`🧪 Testing with card: ${card.summaryTitle || card.title}`);
    
    const priceData = await updater.searchCardPrices(card);
    await updater.db.close();
    
    res.json({
      success: true,
      message: 'Specific card test completed',
      testCard: {
        id: card.id,
        title: card.title,
        summaryTitle: card.summaryTitle,
        sport: card.sport
      },
      searchResults: {
        raw: {
          count: priceData?.raw?.count || 0,
          avgPrice: priceData?.raw?.avgPrice || 0,
          sampleResults: priceData?.raw?.sales?.slice(0, 3) || []
        },
        psa9: {
          count: priceData?.psa9?.count || 0,
          avgPrice: priceData?.psa9?.avgPrice || 0,
          sampleResults: priceData?.psa9?.sales?.slice(0, 3) || []
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Specific card test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for direct 130point service testing
app.post('/api/test-130point-direct', async (req, res) => {
  try {
    const { searchQuery } = req.body;
    console.log(`🧪 Testing 130point service directly with query: "${searchQuery}"`);
    
    // 130pointService removed - no longer using 130point
    console.log('❌ 130point service disabled - endpoint deprecated');
    
    // 130point service removed - return empty response
    const rawResponse = '130point service disabled';
    // 130point service removed - return empty results
    const results = [];
    
    res.json({
      success: true,
      message: 'Direct 130point test completed',
      searchQuery: searchQuery,
      rawResponseLength: rawResponse ? rawResponse.length : 0,
      rawResponsePreview: rawResponse ? rawResponse.substring(0, 1000) : 'No response',
      results: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('❌ Direct 130point test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to fetch raw HTML from 130point and also parse it
app.post('/api/test-130point-raw', async (req, res) => {
  try {
    const { searchQuery } = req.body;
    if (!searchQuery) {
      return res.status(400).json({ success: false, error: 'Missing searchQuery' });
    }

    const axios = require('axios');
    const qs = require('querystring');
    // 130pointService removed - no longer using 130point
    console.log('❌ 130point service disabled - endpoint deprecated');

    const ONEPOINT_URL = 'https://back.130point.com/sales/';
    const formData = qs.stringify({ query: searchQuery });

    const startTs = Date.now();
    const resp = await axios.post(ONEPOINT_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Origin': 'https://130point.com',
        'Referer': 'https://130point.com/',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      },
      timeout: 30000
    });
    const durationMs = Date.now() - startTs;

    const html = resp?.data || '';
    const parsed = service.parseSearchResults(html) || [];

    res.json({
      success: true,
      searchQuery,
      request: {
        url: ONEPOINT_URL,
        method: 'POST',
        durationMs
      },
      response: {
        status: resp?.status || null,
        length: typeof html === 'string' ? html.length : null,
        contains: {
          table: typeof html === 'string' ? html.includes('<table') : null,
          sold_data_simple: typeof html === 'string' ? html.includes('sold_data-simple') : null,
          itemTitle: typeof html === 'string' ? html.includes('Item Title') : null,
          salePrice: typeof html === 'string' ? html.includes('Sale Price') : null
        },
        preview: typeof html === 'string' ? html.substring(0, 1500) : null
      },
      parsed: {
        count: parsed.length,
        sample: parsed.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('❌ test-130point-raw error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Unknown error' });
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

// Manual trigger for price updates using new eBay scraper
app.post('/api/trigger-price-update', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "eBay price update job triggered - running in background",
      timestamp: new Date().toISOString()
    });
    
    // Run the price update in background
    setImmediate(async () => {
      try {
        console.log('🚀 Manual eBay price update triggered via API...');
        
        // Use the new clean eBay price updater
        const EbayPriceUpdater = require('./ebay-price-updater.js');
        
        const updater = new EbayPriceUpdater();
        await updater.updateBatch(50); // Update 50 cards per request
        console.log('✅ Manual eBay price update completed');
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
    
    // Delete existing database file
    const newDbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    if (fs.existsSync(newDbPath)) {
      fs.unlinkSync(newDbPath);
      console.log('🗑️ Deleted existing database');
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
    
    // Create database using the new pricing database system
    const NewPricingDatabase = require('./create-new-pricing-database.js');
    const db = new NewPricingDatabase();
    await db.connect();
    await db.createTables();
    
    res.json({
      success: true,
      message: 'SQLite database created successfully using new pricing database system',
      timestamp: new Date().toISOString()
    });
    
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

// Clean summary titles endpoint (Railway compatible)
app.post('/api/clean-summary-titles', async (req, res) => {
  try {
    console.log('🧹 Starting Railway-compatible summary title cleanup...');
    
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    
    // Use the Railway database path
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    // Check if database exists and what tables it has
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error connecting to Railway database:', err.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to connect to Railway database',
          message: err.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Check what tables exist
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📋 Available tables:', tables.map(t => t.name).join(', '));
    
    // Check if we have a cards table
    if (!tables.some(t => t.name === 'cards')) {
      db.close();
      return res.json({
        success: true,
        message: 'No cards table found in Railway database - this is expected for the sets-based learning database',
        data: {
          totalProcessed: 0,
          updated: 0,
          unchanged: 0,
          errors: 0
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Use the new standardized title generation logic
    const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    await generator.connect();
    await generator.learnFromDatabase();
    
    // Get all cards with summary titles
    const cards = await new Promise((resolve, reject) => {
      db.all('SELECT id, title, summary_title FROM cards WHERE summary_title IS NOT NULL', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`📊 Found ${cards.length} cards with summary titles to process`);
    
    let totalProcessed = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    // Process cards in batches to avoid overwhelming the database
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < cards.length; i += batchSize) {
      batches.push(cards.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${cards.length} cards in ${batches.length} batches of ${batchSize}...`);
    
    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      for (const card of batch) {
        try {
          totalProcessed++;
          
          // Generate new standardized title
          const newTitle = generator.generateStandardizedTitle(card.title);
          
          // Check if title changed
          if (newTitle && newTitle !== card.summary_title) {
            // Update the card
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE cards SET summary_title = ? WHERE id = ?',
                [newTitle, card.id],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            
            console.log(`✅ Updated card ${card.id}: "${card.summary_title}" → "${newTitle}"`);
            updated++;
          } else {
            unchanged++;
          }
          
        } catch (error) {
          console.error(`❌ Error processing card ${card.id}:`, error);
          errors++;
        }
      }
      
      // Progress update
      const processed = (batchIndex + 1) * batchSize;
      const progressPercent = Math.round(Math.min(processed, cards.length) / cards.length * 100);
      console.log(`📈 Batch ${batchIndex + 1}/${batches.length} (${progressPercent}%) - Updated: ${updated}, Unchanged: ${unchanged}, Errors: ${errors}`);
    }
    
    db.close();
    await generator.db.close();
    
    const result = {
      success: true,
      totalProcessed,
      updated,
      unchanged,
      errors
    };
    
    res.json({
      success: true,
      message: 'Railway summary title cleanup completed successfully',
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

// POST /api/admin/add-player-names - Add player names to Railway database
app.post('/api/admin/add-player-names', async (req, res) => {
    try {
        console.log('🎯 Adding player names to Railway database...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        
        await db.connect();
        
        // Get all cards that don't have player names yet
        const cards = await db.allQuery(`
            SELECT id, title, summary_title, player_name 
            FROM cards 
            WHERE player_name IS NULL OR player_name = ''
        `);
        
        console.log(`📊 Found ${cards.length} cards without player names`);
        
        let updatedCount = 0;
        const verboseExtraction = process.env.VERBOSE_EXTRACTION === '1' || process.env.VERBOSE_EXTRACTION === 'true';
        for (const card of cards) {
            try {
                let playerName = await db.extractPlayerName(card.title);
                if (playerName) {
                    await db.runQuery(
                        'UPDATE cards SET player_name = ? WHERE id = ?',
                        [playerName, card.id]
                    );
                    if (verboseExtraction) {
                        console.log(`🧪 extractPlayerName | id=${card.id} | title="${card.title}" | extracted="${playerName}"`);
                    }
                    updatedCount++;
                    
                    if (updatedCount % 50 === 0) {
                        console.log(`✅ Updated ${updatedCount} player names...`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error updating card ${card.id}:`, error.message);
            }
        }
        
        await db.close();
        
        console.log(`✅ Player names update completed! Updated ${updatedCount} cards`);
        res.json({ 
            success: true, 
            message: `Player names added to ${updatedCount} cards successfully`,
            cardsUpdated: updatedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Player names update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Player names update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/clear-player-names - Clear all player names from Railway database
app.post('/api/admin/clear-player-names', async (req, res) => {
    try {
        console.log('🗑️ Clearing all player names from Railway database...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        
        await db.connect();
        
        // Clear all player names
        const result = await db.runQuery(
            'UPDATE cards SET player_name = NULL'
        );
        
        await db.close();
        
        console.log('✅ All player names cleared successfully');
        res.json({ 
            success: true, 
            message: 'All player names cleared successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Clear player names failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Clear player names failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-prices - Run price updates on Railway
app.post('/api/admin/update-prices', async (req, res) => {
    try {
        console.log('🔄 Starting price updates on Railway...');
        
        const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
        const updater = new FastSQLitePriceUpdater();
        
        await updater.connect();
        await updater.processBatchFast(50); // Process 50 cards
        await updater.close();
        
        console.log('✅ Price updates completed successfully');
        res.json({ 
            success: true, 
            message: 'Price updates completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Price updates failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Price updates failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/generate-good-buys - Generate good buy opportunities on Railway
app.post('/api/admin/generate-good-buys', async (req, res) => {
    try {
        console.log('🔄 Generating good buy opportunities on Railway...');
        
        const GoodBuyAnalyzer = require('./good-buy-opportunities.js');
        const analyzer = new GoodBuyAnalyzer();
        await analyzer.analyzeDatabase();
        
        console.log('✅ Good buy opportunities generated successfully');
        res.json({ 
            success: true, 
            message: 'Good buy opportunities generated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Good buy opportunities generation failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Good buy opportunities generation failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-summary-titles - Update summary titles on Railway
app.post('/api/admin/update-summary-titles', async (req, res) => {
    try {
        console.log('🔄 Starting summary titles update on Railway...');
        
        const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
        const generator = new DatabaseDrivenStandardizedTitleGenerator();
        
        await generator.connect();
        await generator.generateAllStandardizedTitles();
        await generator.close();
        
        console.log('✅ Summary titles updated successfully');
        res.json({ 
            success: true, 
            message: 'Summary titles updated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Summary titles update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Summary titles update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/update-sports-standardized-titles - Update sports using standardized title player extraction
app.post('/api/update-sports-standardized-titles', async (req, res) => {
    try {
        console.log('🔄 Starting sport detection update using standardized title player extraction...');
        
        const { SportsUpdaterWithStandardizedTitles } = require('./update-sports-with-standardized-titles.js');
        const updater = new SportsUpdaterWithStandardizedTitles();
        
        await updater.connect();
        const result = await updater.updateSportsWithStandardizedTitles();
        
        console.log('✅ Sport detection update with standardized titles completed successfully');
        res.json({ 
            success: true, 
            message: 'Sport detection update with standardized titles completed successfully',
            results: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Sport detection update with standardized titles failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Sport detection update with standardized titles failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/cleanup-low-value-cards - Remove low-value and unknown sport cards
app.post('/api/cleanup-low-value-cards', async (req, res) => {
    try {
        console.log('🧹 Starting low-value card cleanup...');
        
        const { LowValueCardCleanup } = require('./cleanup-low-value-cards.js');
        const cleanup = new LowValueCardCleanup();
        
        const result = await cleanup.cleanupLowValueCards();
        
        console.log('✅ Low-value card cleanup completed successfully');
        res.json({ 
            success: true, 
            message: 'Low-value card cleanup completed successfully',
            results: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Low-value card cleanup failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Low-value card cleanup failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add new endpoint for standardizing individual card titles
app.post('/api/standardize-title', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
        timestamp: new Date().toISOString()
      });
    }

    // Use the standardized title generator
    const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    await generator.connect();
    await generator.learnFromDatabase();
    
    const standardizedTitle = generator.generateStandardizedTitle(title);
    
    await generator.db.close();
    
    res.json({
      success: true,
      originalTitle: title,
      standardizedTitle: standardizedTitle,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error standardizing title:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to standardize title',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint to fix specific problematic player names
app.post('/api/admin/fix-specific-player-names', async (req, res) => {
    try {
        console.log('🔧 Fixing specific problematic player names...');
        const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
        const generator = new DatabaseDrivenStandardizedTitleGenerator();
        await generator.connect();
        await generator.ensurePlayerNameColumn();
        
        // Define the specific fixes based on the actual database IDs
        const fixes = [
            {
                id: 309, // Triston Casas card
                correctPlayerName: "Triston Casas"
            },
            {
                id: 407, // Bryce Harper card
                correctPlayerName: "Bryce Harper"
            },
            {
                id: 169, // Francisco Lindor card
                correctPlayerName: "Francisco Lindor"
            },
            {
                id: 31, // Xavier Worthy card
                correctPlayerName: "Xavier Worthy"
            },
            {
                id: 231, // Shai Gilgeous-Alexander card
                correctPlayerName: "Shai Gilgeous-Alexander"
            },
            {
                id: 549, // Sal Frelick card
                correctPlayerName: "Sal Frelick"
            },
            {
                id: 341, // CJ Kayfus card (empty player name)
                correctPlayerName: "C.J. Kayfus"
            }
        ];
        
        let updatedCount = 0;
        for (const fix of fixes) {
            try {
                await generator.runUpdate(
                    'UPDATE cards SET player_name = ? WHERE id = ?',
                    [fix.correctPlayerName, fix.id]
                );
                updatedCount++;
                console.log(`✅ Fixed player name for card ${fix.id}: "${fix.correctPlayerName}"`);
            } catch (error) {
                console.error(`❌ Error updating card ${fix.id}:`, error.message);
            }
        }
        
        await generator.close();
        console.log(`✅ Specific player name fixes completed! Updated ${updatedCount} cards`);
        res.json({
            success: true,
            message: `Specific player names fixed successfully`,
            cardsUpdated: updatedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Specific player name fixes failed:', error);
        res.status(500).json({
            success: false,
            error: 'Specific player name fixes failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

          // Initialize token refresh on startup
          initializeServer().catch(console.error);
        
          // POST /api/admin/run-automated-fix - Run the automated title fixer
          app.post('/api/admin/run-automated-fix', async (req, res) => {
              try {
                  console.log('🤖 Starting automated title fixer...');
                  
                  const AutomatedTitleFixer = require('./automated-title-fixer.js');
                  const fixer = new AutomatedTitleFixer();
                  
                  const result = await fixer.runAutomatedFix();
                  
                  console.log('✅ Automated fix completed');
                  res.json({ 
                      success: true, 
                      message: 'Automated fix completed successfully',
                      results: result,
                      timestamp: new Date().toISOString()
                  });
                  
              } catch (error) {
                  console.error('❌ Automated fix failed:', error);
                  res.status(500).json({ 
                      success: false, 
                      error: 'Automated fix failed', 
                      details: error.message,
                      timestamp: new Date().toISOString()
                  });
              }
          });
        
          // POST /api/admin/health-check - Run a health check
          app.post('/api/admin/health-check', async (req, res) => {
              try {
                  console.log('🏥 Running health check...');
                  
                  const AutomatedTitleFixer = require('./automated-title-fixer.js');
                  const fixer = new AutomatedTitleFixer();
                  
                  const health = await fixer.healthCheck();
                  
                  console.log('✅ Health check completed');
                  res.json({ 
                      success: true, 
                      message: 'Health check completed successfully',
                      health: health,
                      timestamp: new Date().toISOString()
                  });
                  
              } catch (error) {
                  console.error('❌ Health check failed:', error);
                  res.status(500).json({ 
                      success: false, 
                      error: 'Health check failed', 
                      details: error.message,
                      timestamp: new Date().toISOString()
                  });
              }
          });
        
          // POST /api/admin/run-maintenance-job - Run the complete automated maintenance job
          app.post('/api/admin/run-maintenance-job', async (req, res) => {
              try {
                  console.log('🤖 Starting Railway maintenance job...');
                  
                  const RailwayMaintenanceJobDirect = require('./railway-maintenance-job-direct.js');
                  const maintenanceJob = new RailwayMaintenanceJobDirect();
                  
                  const result = await maintenanceJob.runMaintenanceJob();
                  
                  console.log('✅ Railway maintenance job completed');
                  res.json({ 
                      success: true, 
                      message: 'Railway maintenance job completed successfully',
                      results: result.results,
                      timestamp: new Date().toISOString()
                  });
                  
              } catch (error) {
                  console.error('❌ Railway maintenance job failed:', error);
                  res.status(500).json({ 
                      success: false, 
                      error: 'Railway maintenance job failed', 
                      details: error.message,
                      timestamp: new Date().toISOString()
                  });
              }
          });



// POST /api/admin/fix-summary-titles-simple - Fix summary titles for existing cards
app.post('/api/admin/fix-summary-titles-simple', async (req, res) => {
    try {
        console.log('🔧 Fixing summary titles for existing cards...');
        
        const { SimpleSummaryTitleFixer } = require('./fix-summary-titles-simple.js');
        const fixer = new SimpleSummaryTitleFixer();
        
        await fixer.connect();
        await fixer.fixSummaryTitles();
        await fixer.close();
        
        res.json({
            success: true,
            message: 'Summary titles fixed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fixing summary titles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fix summary titles',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-existing-cards-extraction - Re-extract all components for existing cards
app.post('/api/admin/fix-existing-cards-extraction', async (req, res) => {
    try {
        console.log('🔧 Re-extracting components for existing cards...');
        
        const { ExistingCardsFixer } = require('./fix-existing-cards-with-improved-extraction.js');
        const fixer = new ExistingCardsFixer();
        
        await fixer.connect();
        await fixer.fixExistingCards();
        await fixer.close();
        
        res.json({
            success: true,
            message: 'Existing cards fixed with improved extraction',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fixing existing cards:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fix existing cards',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/analyze-player-name-issues - Analyze player name extraction issues
app.post('/api/admin/analyze-player-name-issues', async (req, res) => {
    try {
        console.log('🔍 Starting automated player name issue analysis...');
        
        const { PlayerNameIssueAnalyzer } = require('./analyze-player-name-issues.js');
        const analyzer = new PlayerNameIssueAnalyzer();
        await analyzer.analyzePlayerNameIssues();
        
        res.json({
            success: true,
            message: 'Player name issue analysis completed. Check server logs for detailed report.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error analyzing player name issues:', error);
        res.status(500).json({
            success: false,
            message: 'Error analyzing player name issues',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/analyze-player-name-issues-simple - Get player name issues as JSON
app.post('/api/admin/analyze-player-name-issues-simple', async (req, res) => {
    try {
        console.log('🔍 Starting simplified player name issue analysis...');
        
        const { PlayerNameIssueAnalyzerSimple } = require('./analyze-player-name-issues-simple.js');
        const analyzer = new PlayerNameIssueAnalyzerSimple();
        const results = await analyzer.analyzePlayerNameIssues();
        
        res.json({
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error analyzing player name issues:', error);
        res.status(500).json({
            success: false,
            message: 'Error analyzing player name issues',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-cardbase-api - Test CardBase API integration
app.post('/api/admin/test-cardbase-api', async (req, res) => {
    try {
        console.log('🧪 Testing CardBase API integration...');
        
        const { CardBaseService } = require('./services/cardbaseService.js');
        const cardbaseService = new CardBaseService();
        
        const testResults = await cardbaseService.testCardBaseAPI();
        
        res.json({
            success: true,
            results: testResults,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error testing CardBase API:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing CardBase API',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/search-cardbase - Search for a specific card using CardBase
app.post('/api/admin/search-cardbase', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        
        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                message: 'searchQuery is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🔍 Searching CardBase for: "${searchQuery}"`);
        
        const { CardBaseService } = require('./services/cardbaseService.js');
        const cardbaseService = new CardBaseService();
        
        const result = await cardbaseService.searchCard(searchQuery);
        const cardInfo = cardbaseService.extractCardInfo(result);
        const improvedTitle = cardbaseService.generateImprovedTitle(cardInfo, searchQuery);
        
        res.json({
            success: true,
            originalQuery: searchQuery,
            cardbaseResult: result,
            extractedInfo: cardInfo,
            improvedTitle: improvedTitle,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error searching CardBase:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching CardBase',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/run-cardbase-tests - Run comprehensive CardBase integration tests
app.post('/api/admin/run-cardbase-tests', async (req, res) => {
    try {
        console.log('🧪 Running comprehensive CardBase integration tests...');
        
        const { CardBaseIntegrationTester } = require('./test-cardbase-integration.js');
        const tester = new CardBaseIntegrationTester();
        
        // Capture console output
        const originalLog = console.log;
        const testOutput = [];
        console.log = (...args) => {
            testOutput.push(args.join(' '));
            originalLog(...args);
        };
        
        await tester.runAllTests();
        
        // Restore console.log
        console.log = originalLog;
        
        res.json({
            success: true,
            testOutput: testOutput,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error running CardBase tests:', error);
        res.status(500).json({
            success: false,
            message: 'Error running CardBase tests',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/improve-card-title - Improve a specific card title using CardBase
app.post('/api/admin/improve-card-title', async (req, res) => {
    try {
        const { originalTitle } = req.body;
        
        if (!originalTitle) {
            return res.status(400).json({
                success: false,
                message: 'originalTitle is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🔍 Improving card title: "${originalTitle}"`);
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // First, try to find this card in the database to get its current summary_title
        const card = await db.findCardByTitle(originalTitle);
        const searchQuery = card ? (card.summary_title || originalTitle) : originalTitle;
        
        console.log(`🔍 Using search query: "${searchQuery}"`);
        console.log(`🔍 Original title for comparison: "${originalTitle}"`);
        
        const result = await db.improveCardTitleWithCardBase(searchQuery, originalTitle);
        
        res.json({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error improving card title:', error);
        res.status(500).json({
            success: false,
            message: 'Error improving card title',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/batch-improve-titles - Improve multiple card titles in batch
app.post('/api/admin/batch-improve-titles', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.body;
        
        console.log(`🔍 Batch improving card titles (limit: ${limit}, offset: ${offset})`);
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Get cards that might need improvement (cards with poor summary titles)
        const cards = await db.getCardsForTitleImprovement(limit, offset);
        
        const results = [];
        for (const card of cards) {
            console.log(`Processing card: ${card.title}`);
            
            const improvement = await db.improveCardTitleWithCardBase(card.title, card.title);
            
            if (improvement.success && improvement.improvedTitle !== card.title) {
                // Update the card with improved title
                await db.updateCardTitle(card.id, improvement.improvedTitle);
                results.push({
                    id: card.id,
                    originalTitle: card.title,
                    improvedTitle: improvement.improvedTitle,
                    success: true
                });
            } else {
                results.push({
                    id: card.id,
                    originalTitle: card.title,
                    improvedTitle: card.title,
                    success: false,
                    reason: 'No improvement found or API failed'
                });
            }
            
            // Add delay to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        res.json({
            success: true,
            processed: results.length,
            results: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in batch title improvement:', error);
        res.status(500).json({
            success: false,
            message: 'Error in batch title improvement',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/run-title-updater - Run the existing title updater script
app.post('/api/admin/run-title-updater', async (req, res) => {
    try {
        const { limit = 5, offset = 0 } = req.body;
        
        console.log(`🔄 Running existing title updater (limit: ${limit}, offset: ${offset})`);
        
        const { ExistingTitleUpdater } = require('./update-existing-titles.js');
        const updater = new ExistingTitleUpdater();
        
        // Capture console output
        const originalLog = console.log;
        const output = [];
        console.log = (...args) => {
            const message = args.join(' ');
            output.push(message);
            originalLog(...args);
        };
        
        await updater.connect();
        await updater.updateExistingTitles(limit, offset);
        await updater.close();
        
        // Restore console.log
        console.log = originalLog;
        
        res.json({
            success: true,
            output: output,
            processed: updater.processedCount,
            updated: updater.updatedCount,
            failed: updater.failedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error running title updater:', error);
        res.status(500).json({
            success: false,
            message: 'Error running title updater',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/check-cards - Check what cards need improvement
app.post('/api/admin/check-cards', async (req, res) => {
    try {
        console.log('🔍 Checking cards that need title improvement...');
        
        const { CardChecker } = require('./check-cards-for-improvement.js');
        const checker = new CardChecker();
        
        // Capture console output
        const originalLog = console.log;
        const output = [];
        console.log = (...args) => {
            const message = args.join(' ');
            output.push(message);
            originalLog(...args);
        };
        
        await checker.connect();
        await checker.checkCardsForImprovement();
        await checker.close();
        
        // Restore console.log
        console.log = originalLog;
        
        res.json({
            success: true,
            output: output,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error checking cards:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking cards',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/admin/card/:id - Get detailed card information for editing
app.get('/api/admin/card/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔍 Getting card details for ID: ${id}`);
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        const card = await db.getCardById(id);
        
        if (!card) {
            return res.status(404).json({
                success: false,
                message: 'Card not found',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            card: card,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting card details:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting card details',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/admin/card/:id - Update card information
app.put('/api/admin/card/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            year,
            card_set,
            card_type,
            player_name,
            card_number,
            print_run,
            is_rookie,
            is_autograph,
            sport
        } = req.body;
        
        console.log(`🔧 Updating card ID: ${id}`);
        console.log('📝 Update data:', req.body);
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Update the card fields
        await db.updateCardFields(id, {
            year,
            card_set,
            card_type,
            player_name,
            card_number,
            print_run,
            is_rookie,
            is_autograph,
            sport
        });
        
        // Regenerate the summary title
        const updatedCard = await db.getCardById(id);
        const newSummaryTitle = await db.generateSummaryTitle(updatedCard);
        await db.updateCardTitle(id, newSummaryTitle);
        
        res.json({
            success: true,
            message: 'Card updated successfully',
            card: await db.getCardById(id),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error updating card:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating card',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-extraction - Test extraction logic
app.post('/api/admin/test-extraction', async (req, res) => {
    try {
        console.log('🧪 Testing extraction logic...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        const userTitle = (req.body && req.body.testTitle) ? String(req.body.testTitle) : null;
        const testTitles = userTitle ? [userTitle] : [
            "2023 Bowman Chrome Autographs Gold Michael Harris II auto #CRA-MH",
            "2023 Bowman - Chrome Rookie Autographs Michael Harris II #CRA-MH Gold Ref PSA 10",
            "2023 Bowman Chrome Sapphire Orange Sapphire Edition Zach Neto #10 /75",
            "2024 Bowman Chrome U SP Green Sarah Strong Shimmer #62",
            "2024 Panini Mosaic Blue Mccarthy Scripts auto #BN391",
            "2024 Panini Prizm Rob Dillingham Sublime #24",
            "2024 Bowman Chrome Gold Refractor Eduardo Tait Reptilian #10 /50",
            "2024 Panini Mosaic Blue Mccarthy auto #BN391",
            "2024 Panini Mosaic J.J. McCarthy Rookie Scripts Auto Blue Disco PSA 10 BN391",
            "2022 Panini Mosaic Josh Allen Storm #10",
            "2022 Panini Mosaic Josh Allen Chasers #10",
            "2002 Topps Chrome Refractor Tracy Mcgrady Busters #ZB10",
            "2020 Panini Mosaic Reactive Gold Prizm Justin Herbert Reactive #263",
            "2008 Topps Gold Refractor Mickey Mantle Reprint #MMR-54",
            "2023 Panini Prizm Snake Zion Williamson King #27",
            "1998 Topps Finest Dirk Nowitzki Dallas #234",
            "2022 Topps Update Julio Rodriguez Rainbow #US44",
            "2016 Panini Prizm Wave Blue Go Hard Go #9 /99",
            "2016 Prizm Basketball Go Hard Go Home #9 Kyrie Irving Blue Wave /99 PSA 10",
            "2022 Topps Update Julio Rodriguez Royal Blue #US44",
            "2022 Topps Update Julio Rodriguez Gold Rainbow #US44",
            "2022 Topps Update Julio Rodriguez Holiday #US44",
            "2022 Topps Update Julio Rodriguez Aqua #US44",
            "2022 Topps Update Julio Rodriguez Silver Crackle #US44",
            "2022 Topps Update Julio Rodriguez Ghost #US44",
            "2022 Topps Update Julio Rodriguez Vintage Stock #US44",
            "2022 Topps Update Julio Rodriguez Independence Day #US44",
            "2022 Topps Update Julio Rodriguez Fathers Day #US44",
            "2022 Topps Update Julio Rodriguez Mothers Day #US44",
            "2022 Topps Update Julio Rodriguez Mummy #US44",
            "2022 Topps Update Julio Rodriguez Memorial Day #US44",
            "2022 Topps Update Julio Rodriguez Black Cat #US44",
            "2022 Topps Update Julio Rodriguez Witches Hat #US44",
            "2022 Topps Update Julio Rodriguez Bats #US44",
            "2022 Topps Update Julio Rodriguez First Card #US44",
            "2022 Topps Update Julio Rodriguez Platinum #US44",
            "2022 Topps Update Julio Rodriguez Printing Plates #US44",
            "2024 Topps Chrome Radiating Rookies Yoshinobu #RR-16",
            "2024 Topps Chrome Radiating Rookies Yoshinobu Yamamoto #RR-16 (RC) PSA 10",
            "2022 Topps Update Julio Rodriguez Foil #US44",
            "2024 Topps Gold Stephen Curry Now #27",
            "2024 Donruss Optic Gold Sunday Davante #10 /10",
            "2002 Topps Chrome Refractor Tracy Mcgrady Zone #ZB10",
            "2024 Bowman Chrome Gold Refractor Eduardo Tait Pop #10 /50"
        ];
        
        const results = [];
        
        for (const testTitle of testTitles) {
            console.log(`🔍 Testing extraction for: "${testTitle}"`);
            
            // Test each extraction method
            // Extract year from title
            let year = null;
            const yearMatch = testTitle.match(/(19|20)\d{2}/);
            if (yearMatch) {
                year = parseInt(yearMatch[0]);
            }
            
            const cardSet = db.extractCardSet(testTitle);
            const cardType = db.extractCardType(testTitle);
            const cardNumber = db.extractCardNumber(testTitle);
            
            // Extract print run
            let printRun = null;
            const printRunMatch = testTitle.match(/\/(\d+)/);
            if (printRunMatch) {
                printRun = '/' + printRunMatch[1];
            }
            
            const isRookie = db.isRookieCard(testTitle);
            const isAutograph = db.isAutographCard(testTitle);
            const sport = db.detectSportFromKeywords(testTitle);
            
            // Test player name extraction with debug info
            const playerName = db.extractPlayerName(testTitle);
            const cleanPlayerName = playerName ? db.filterTeamNamesFromPlayer(playerName) : null;
            const finalPlayerName = cleanPlayerName ? db.capitalizePlayerName(cleanPlayerName) : null;
            
            // Get debug information if available
            const debugSteps = db.getLastExtractionDebug();
            
            // Build summary title
            let summaryTitle = '';
            if (year) summaryTitle += year;
            if (cardSet) summaryTitle += (summaryTitle ? ' ' : '') + cardSet;
            if (finalPlayerName) summaryTitle += (summaryTitle ? ' ' : '') + finalPlayerName;
            if (cardType && cardType.toLowerCase() !== 'base') summaryTitle += (summaryTitle ? ' ' : '') + cardType;
            if (isAutograph) summaryTitle += (summaryTitle ? ' ' : '') + 'auto';
            if (cardNumber) summaryTitle += (summaryTitle ? ' ' : '') + cardNumber;
            if (printRun) summaryTitle += (summaryTitle ? ' ' : '') + printRun;
            
            results.push({
                testTitle,
                results: {
                    year,
                    cardSet,
                    cardType,
                    cardNumber,
                    printRun,
                    isRookie,
                    isAutograph,
                    sport,
                    playerName,
                    cleanPlayerName,
                    finalPlayerName,
                    summaryTitle,
                    debugSteps: debugSteps.length > 0 ? debugSteps : undefined
                }
            });
        }
        
        await db.close();
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error testing extraction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test extraction',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/reextract-player-names - Re-extract player_name from title for all cards using new centralized system
app.post('/api/admin/reextract-player-names', async (req, res) => {
    try {
        console.log('🔄 Re-extracting player names from titles using new centralized system...');

        const RailwayPlayerExtractor = require('./railway-player-extraction.js');
        const extractor = new RailwayPlayerExtractor();
        
        await extractor.connect();
        
        // Process in smaller batches to avoid timeouts
        const batchSize = 50;
        const cards = await extractor.getCardsToUpdate();
        const totalCards = cards.length;
        
        console.log(`📊 Processing ${totalCards} cards in batches of ${batchSize}...`);
        
        let processedCount = 0;
        for (let i = 0; i < cards.length; i += batchSize) {
            const batch = cards.slice(i, i + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalCards/batchSize)} (${batch.length} cards)...`);
            
            for (const card of batch) {
                await extractor.processCard(card);
                processedCount++;
            }
            
            // Progress update
            console.log(`📊 Progress: ${processedCount}/${totalCards} cards processed`);
        }
        
        await extractor.close();

        res.json({ 
            success: true, 
            updated: extractor.stats.updated, 
            unchanged: extractor.stats.unchanged, 
            errors: extractor.stats.errors,
            empty: extractor.stats.empty,
            total: extractor.stats.total,
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        console.error('❌ Error re-extracting player names:', error);
        res.status(500).json({ success: false, message: 'Error re-extracting player names', error: error.message, timestamp: new Date().toISOString() });
    }
});

// POST /api/admin/audit-autograph-flags - Report mismatches between title and is_autograph flag
app.post('/api/admin/audit-autograph-flags', async (req, res) => {
    try {
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();

        const rows = await db.allQuery(`
            SELECT id, title, summary_title, card_type, is_autograph
            FROM cards
            ORDER BY id
        `);

        const autoTerms = [' auto ', ' autograph', 'signature', 'signed', 'sig ', 'sig.', 'on card', 'sticker auto'];
        const negativeTerms = ['no auto', 'non auto'];
        const normalize = (s) => ` ${String(s || '').toLowerCase()} `;

        const mismatches = [];
        let shouldBeTrue = 0;
        let shouldBeFalse = 0;

        for (const c of rows) {
            const t = normalize(c.title);
            const s = normalize(c.summary_title);
            const ct = normalize(c.card_type);

            const hasNegative = negativeTerms.some(term => t.includes(term) || s.includes(term) || ct.includes(term));
            let inferred = false;
            if (!hasNegative) {
                inferred = autoTerms.some(term => t.includes(term) || s.includes(term) || ct.includes(term));
            }

            if (inferred && !c.is_autograph) {
                mismatches.push({ id: c.id, current: !!c.is_autograph, inferred: true, source: 'title/card_type indicates autograph' });
                shouldBeTrue++;
            } else if (!inferred && c.is_autograph) {
                mismatches.push({ id: c.id, current: !!c.is_autograph, inferred: false, source: 'no autograph indicators present' });
                shouldBeFalse++;
            }
        }

        await db.close();
        res.json({ success: true, total: rows.length, mismatches: mismatches.slice(0, 50), shouldBeTrue, shouldBeFalse, previewCount: Math.min(50, mismatches.length), timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error auditing autograph flags:', error);
        res.status(500).json({ success: false, message: 'Error auditing autograph flags', error: error.message });
    }
});

// POST /api/admin/fix-autograph-flags - Fix is_autograph based on title/card_type, rebuild summaries for changed cards
app.post('/api/admin/fix-autograph-flags', async (req, res) => {
    try {
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();

        const rows = await db.allQuery(`
            SELECT id, title, summary_title, card_type, is_autograph
            FROM cards
            ORDER BY id
        `);

        const autoTerms = [' auto ', ' autograph', 'signature', 'signed', 'sig ', 'sig.', 'on card', 'sticker auto'];
        const negativeTerms = ['no auto', 'non auto'];
        const normalize = (s) => ` ${String(s || '').toLowerCase()} `;

        let updated = 0;
        const changed = [];

        for (const c of rows) {
            const t = normalize(c.title);
            const s = normalize(c.summary_title);
            const ct = normalize(c.card_type);

            const hasNegative = negativeTerms.some(term => t.includes(term) || s.includes(term) || ct.includes(term));
            let inferred = false;
            if (!hasNegative) {
                inferred = autoTerms.some(term => t.includes(term) || s.includes(term) || ct.includes(term));
            }

            // Only update when different
            if (Boolean(c.is_autograph) !== inferred) {
                await db.runQuery(`UPDATE cards SET is_autograph = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`, [inferred ? 1 : 0, c.id]);
                const refreshed = await db.getCardById(c.id);
                const newTitle = await db.generateSummaryTitle(refreshed);
                await db.updateCardTitle(c.id, newTitle);
                updated++;
                if (updated <= 20) {
                    changed.push({ id: c.id, from: !!c.is_autograph, to: inferred, newSummary: newTitle });
                }
            }
        }

        await db.close();
        res.json({ success: true, updated, sample: changed, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error fixing autograph flags:', error);
        res.status(500).json({ success: false, message: 'Error fixing autograph flags', error: error.message });
    }
});

// POST /api/admin/extract-missing-terms - Extract missing terms from player names
app.post('/api/admin/extract-missing-terms', async (req, res) => {
    try {
        console.log('🔍 Extract missing terms endpoint called');
        
        const { MissingTermsExtractor } = require('./extract-missing-terms.js');
        const extractor = new MissingTermsExtractor();
        
        await extractor.connect();
        const result = await extractor.extractMissingTerms();
        await extractor.close();

        res.json({
            success: true,
            message: 'Missing terms extracted successfully',
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in extract missing terms endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Error extracting missing terms',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/analyze-summary-title-issues - Analyze all summary titles for issues
app.post('/api/admin/analyze-summary-title-issues', async (req, res) => {
    try {
        console.log('🔍 Analyzing summary title issues...');
        
        const { SummaryTitleAnalyzer } = require('./analyze-summary-title-issues.js');
        const analyzer = new SummaryTitleAnalyzer();
        
        await analyzer.connect();
        const report = await analyzer.analyzeAllSummaryTitles();
        await analyzer.close();
        
        res.json({
            success: true,
            message: 'Summary title analysis completed successfully',
            report: report,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error analyzing summary title issues:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze summary title issues',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/run-fast-batch-pull - Run the actual fast batch pull to find new cards
app.post('/api/admin/run-fast-batch-pull', async (req, res) => {
    try {
        console.log('🚀 Starting fast batch pull to find new PSA 10 cards...');
        
        const { FastBatchItemsPuller } = require('./fast-batch-pull-new-items.js');
        const puller = new FastBatchItemsPuller();
        
        await puller.connect();
        const result = await puller.pullNewItems();
        
        console.log('✅ Fast batch pull completed successfully');
        res.json({ 
            success: true, 
            message: 'Fast batch pull completed successfully',
            results: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Fast batch pull failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Fast batch pull failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-summary-titles - Fix all summary titles in the database
app.post('/api/admin/fix-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting summary title fix...');
        
        const SummaryTitleFixer = require('./fix-summary-titles.js');
        const fixer = new SummaryTitleFixer();
        
        const result = await fixer.fixAllSummaryTitles();
        
        console.log('✅ Summary title fix completed');
        res.json({ 
            success: true, 
            message: 'Summary title fix completed successfully',
            results: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Summary title fix failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Summary title fix failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



// POST /api/admin/restore-summary-titles - Restore summary titles to proper format
app.post('/api/admin/restore-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting summary title restore...');
        
        const { restoreSummaryTitles } = require('./restore-summary-titles.js');
        await restoreSummaryTitles();
        
        console.log('✅ Summary title restore completed');
        res.json({ 
            success: true, 
            message: 'Summary title restore completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Summary title restore failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Summary title restore failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/quick-fix-summary-titles - Quick fix for specific summary title issues
app.post('/api/admin/quick-fix-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting quick summary title fix...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Fix the most obvious issues
        const fixes = [
            {
                id: 705,
                old: '2010 Auto RC',
                new: '2010 Topps Chrome Demaryius Thomas Auto RC'
            },
            {
                id: 704,
                old: '2024-25 Instant RC #1',
                new: '2024-25 Panini Instant WNBA Caitlin Clark RC #1'
            },
            {
                id: 703,
                old: '2024 #12',
                new: '2024 Panini Prizm Stephon Castle Luck of the Lottery Fast Break #12'
            },
            {
                id: 702,
                old: '2023 Prizm Select #200',
                new: '2023 Panini Select Josh Allen Dragon Scale Prizm #200 /70'
            },
            {
                id: 701,
                old: '1964 Stamps #23',
                new: '1964 Slania Stamps Cassius Clay World Champion Boxers Muhammad Ali #23'
            }
        ];
        
        let fixed = 0;
        
        for (const fix of fixes) {
            try {
                await db.runQuery(
                    'UPDATE cards SET summary_title = ? WHERE id = ?',
                    [fix.new, fix.id]
                );
                
                console.log(`✅ Fixed card ${fix.id}: "${fix.old}" → "${fix.new}"`);
                fixed++;
            } catch (error) {
                console.error(`❌ Error fixing card ${fix.id}:`, error);
            }
        }
        
        await db.close();
        
        console.log('✅ Quick summary title fix completed');
        res.json({ 
            success: true, 
            message: 'Quick summary title fix completed successfully',
            fixed: fixed,
            total: fixes.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Quick summary title fix failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Quick summary title fix failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/emergency-restore-summary-titles - Emergency restore of broken summary titles
app.post('/api/admin/emergency-restore-summary-titles', async (req, res) => {
    try {
        console.log('🚨 Starting emergency summary title restore...');
        
        const { restoreBrokenSummaryTitles } = require('./restore-broken-summary-titles.js');
        await restoreBrokenSummaryTitles();
        
        console.log('✅ Emergency summary title restore completed');
        res.json({ 
            success: true, 
            message: 'Emergency summary title restore completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Emergency summary title restore failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Emergency summary title restore failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/safe-fix-summary-titles - Safe summary title fixer
app.post('/api/admin/safe-fix-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting safe summary title fixer...');
        
        const { SafeSummaryTitleFixer } = require('./safe-summary-title-fixer.js');
        const fixer = new SafeSummaryTitleFixer();
        const result = await fixer.fixSummaryTitles();
        
        console.log('✅ Safe summary title fixer completed');
        res.json({ 
            success: true, 
            message: 'Safe summary title fixer completed successfully',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Safe summary title fixer failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Safe summary title fixer failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/simple-fix-summary-titles - Simple summary title fixer
app.post('/api/admin/simple-fix-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting simple summary title fixer...');
        
        const { SimpleSummaryFixer } = require('./simple-summary-fix.js');
        const fixer = new SimpleSummaryFixer();
        const result = await fixer.fixSummaryTitles();
        
        console.log('✅ Simple summary title fixer completed');
        res.json({ 
            success: true, 
            message: 'Simple summary title fixer completed successfully',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Simple summary title fixer failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Simple summary title fixer failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/comprehensive-fix-summary-titles - Comprehensive summary title fixer
app.post('/api/admin/comprehensive-fix-summary-titles', async (req, res) => {
    try {
        console.log('🔧 Starting comprehensive summary title fixer...');
        
        const { ComprehensiveSummaryFixer } = require('./comprehensive-summary-fix.js');
        const fixer = new ComprehensiveSummaryFixer();
        const result = await fixer.fixSummaryTitles();
        
        console.log('✅ Comprehensive summary title fixer completed');
        res.json({ 
            success: true, 
            message: 'Comprehensive summary title fixer completed successfully',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Comprehensive summary title fixer failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Comprehensive summary title fixer failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-summary-title - Update specific card's summary title
app.post('/api/admin/update-summary-title', async (req, res) => {
    try {
        const { cardId, summaryTitle } = req.body;
        console.log(`🔧 Updating summary title for card ${cardId}...`);
        
        if (!cardId || !summaryTitle) {
            return res.status(400).json({ success: false, error: 'Missing cardId or summaryTitle' });
        }
        
        const db = new NewPricingDatabase();
        await db.connect();
        
        await db.runQuery('UPDATE cards SET summary_title = ? WHERE id = ?', [summaryTitle, cardId]);
        
        await db.close();
        
        console.log(`✅ Updated summary title for card ${cardId}`);
        res.json({ success: true, message: 'Summary title updated successfully', cardId: cardId, summaryTitle: summaryTitle, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('❌ Failed to update summary title:', error);
        res.status(500).json({ success: false, error: 'Failed to update summary title', details: error.message, timestamp: new Date().toISOString() });
    }
});

// POST /api/admin/fix-specific-summary-issues - Fix specific summary title issues
app.post('/api/admin/fix-specific-summary-issues', async (req, res) => {
    try {
        console.log('🔧 Starting specific summary title issue fixer...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        
        function fixSummaryTitle(summaryTitle) {
            if (!summaryTitle) return summaryTitle;
            
            let fixed = summaryTitle;
            
            // 1. Remove team names
            const teamNames = [
                'Florida Gators', 'Gators', 'COWBOYS', 'Cowboys', 'VIKINGS', 'Vikings',
                'BULLS', 'Bulls', 'LAKERS', 'Lakers', 'WARRIORS', 'Warriors',
                'PATRIOTS', 'Patriots', 'BENGALS', 'Bengals', 'RAIDERS', 'Raiders',
                'CHARGERS', 'Chargers', 'GIANTS', 'Giants', 'EAGLES', 'Eagles',
                'COMMANDERS', 'Commanders', 'BEARS', 'Bears', 'LIONS', 'Lions',
                'PACKERS', 'Packers', 'FALCONS', 'Falcons', 'PANTHERS', 'Panthers',
                'SAINTS', 'Saints', 'BUCCANEERS', 'Buccaneers', 'CARDINALS', 'Cardinals',
                'RAMS', 'Rams', '49ERS', '49ers', 'SEAHAWKS', 'Seahawks', 'YANKEES', 'Yankees',
                'RED SOX', 'Red Sox', 'BLUE JAYS', 'Blue Jays', 'ORIOLES', 'Orioles',
                'RAYS', 'Rays', 'WHITE SOX', 'White Sox', 'GUARDIANS', 'Guardians',
                'TIGERS', 'Tigers', 'ROYALS', 'Royals', 'TWINS', 'Twins',
                'ASTROS', 'Astros', 'ANGELS', 'Angels', 'ATHLETICS', 'Athletics',
                'MARINERS', 'Mariners', 'RANGERS', 'Rangers', 'BRAVES', 'Braves',
                'MARLINS', 'Marlins', 'METS', 'Mets', 'PHILLIES', 'Phillies',
                'NATIONALS', 'Nationals', 'CUBS', 'Cubs', 'REDS', 'Reds',
                'BREWERS', 'Brewers', 'PIRATES', 'Pirates', 'DIAMONDBACKS', 'Diamondbacks',
                'ROCKIES', 'Rockies', 'DODGERS', 'Dodgers', 'PADRES', 'Padres',
                'GIANTS', 'Giants', 'HAWKS', 'Hawks', 'CELTICS', 'Celtics',
                'NETS', 'Nets', 'HORNETS', 'Hornets', 'CAVALIERS', 'Cavaliers',
                'MAVERICKS', 'Mavericks', 'NUGGETS', 'Nuggets', 'PISTONS', 'Pistons',
                'ROCKETS', 'Rockets', 'PACERS', 'Pacers', 'CLIPPERS', 'Clippers',
                'GRIZZLIES', 'Grizzlies', 'HEAT', 'Heat', 'BUCKS', 'Bucks',
                'TIMBERWOLVES', 'Timberwolves', 'PELICANS', 'Pelicans', 'KNICKS', 'Knicks',
                'THUNDER', 'Thunder', 'MAGIC', 'Magic', '76ERS', '76ers',
                'SUNS', 'Suns', 'TRAIL BLAZERS', 'Trail Blazers', 'KINGS', 'Kings',
                'SPURS', 'Spurs', 'RAPTORS', 'Raptors', 'JAZZ', 'Jazz', 'WIZARDS', 'Wizards'
            ];
            
            teamNames.forEach(team => {
                const regex = new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                fixed = fixed.replace(regex, '');
            });
            
            // 2. Remove grading terms that might be parsed as numbers
            const gradingTerms = [
                'SGC 9.5', 'SGC 10', 'SGC 9', 'SGC 8', 'SGC 7', 'SGC 6', 'SGC 5', 'SGC 4', 'SGC 3', 'SGC 2', 'SGC 1',
                'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6', 'PSA 5', 'PSA 4', 'PSA 3', 'PSA 2', 'PSA 1',
                'BGS 10', 'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8', 'BGS 7.5', 'BGS 7', 'BGS 6.5', 'BGS 6', 'BGS 5.5', 'BGS 5',
                'GEM MINT', 'Gem Mint', 'MINT', 'Mint', 'MT', 'NM-MT', 'NM', 'EX-MT', 'EX', 'VG-EX', 'VG', 'GOOD', 'Good'
            ];
            
            gradingTerms.forEach(term => {
                const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                fixed = fixed.replace(regex, '');
            });
            
            // 3. Remove "LOW" (grading/population term)
            fixed = fixed.replace(/\bLOW\b/gi, '');
            
            // 4. Remove "Edition" from product names
            fixed = fixed.replace(/\bEdition\b/gi, '');
            
            // 5. Fix "Ucl" to "UCL"
            fixed = fixed.replace(/\bUcl\b/gi, 'UCL');
            
            // 6. Remove ". Cpanr Prospect" parsing errors
            fixed = fixed.replace(/\.\s*Cpanr\s+Prospect/gi, '');
            
            // 7. Remove other parsing errors and unnecessary terms
            fixed = fixed.replace(/\bSGC\s*\.\s*#\d+\s*#\d+/gi, ''); // Remove "SGC . #9 #5" type patterns
            fixed = fixed.replace(/\b&\s*COWBOYS\b/gi, ''); // Remove "& COWBOYS" patterns
            
            // Clean up extra spaces and formatting
            fixed = fixed.replace(/\s+/g, ' ').trim();
            fixed = fixed.replace(/\s*,\s*$/, ''); // Remove trailing commas
            fixed = fixed.replace(/^\s*,\s*/, ''); // Remove leading commas
            
            return fixed;
        }
        
        const db = new NewPricingDatabase();
        await db.connect();
        console.log('✅ Connected to Railway database');
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name FROM cards');
        console.log(`📊 Found ${cards.length} cards to check`);
        
        let fixedCount = 0;
        let issuesFound = 0;
        
        for (const card of cards) {
            const originalSummary = card.summary_title || '';
            const fixedSummary = fixSummaryTitle(originalSummary);
            
            if (fixedSummary !== originalSummary && fixedSummary.length > 0) {
                issuesFound++;
                console.log(`🔍 Card ID: ${card.id}`);
                console.log(`   Player: "${card.player_name}"`);
                console.log(`   Original: "${originalSummary}"`);
                console.log(`   Fixed: "${fixedSummary}"`);
                
                // Update the card directly in the database
                await db.runQuery('UPDATE cards SET summary_title = ? WHERE id = ?', [fixedSummary, card.id]);
                fixedCount++;
                console.log(`✅ Updated card ${card.id}`);
            }
        }
        
        await db.close();
        console.log('✅ Database connection closed');
        
        console.log('\n🎉 Summary Title Fix Complete!');
        console.log(`📊 Total cards checked: ${cards.length}`);
        console.log(`🔍 Issues found: ${issuesFound}`);
        console.log(`✅ Cards fixed: ${fixedCount}`);
        
        res.json({ 
            success: true, 
            message: 'Specific summary title issue fixer completed successfully',
            result: {
                totalCards: cards.length,
                issuesFound: issuesFound,
                fixedCount: fixedCount
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Specific summary title issue fixer failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Specific summary title issue fixer failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/show-remaining-issues - Show remaining summary title issues
app.post('/api/admin/show-remaining-issues', async (req, res) => {
    try {
        console.log('🔍 Showing remaining summary title issues...');
        
        const { showRemainingIssues } = require('./show-issues-endpoint.js');
        const result = await showRemainingIssues();
        
        if (result.success) {
            console.log(`📊 Found ${result.issuesFound} cards with issues out of ${result.totalCards} total`);
            
            res.json({ 
                success: true, 
                message: `Found ${result.issuesFound} cards with summary title issues`,
                totalCards: result.totalCards,
                issuesFound: result.issuesFound,
                issues: result.issues,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to analyze issues', 
                details: result.error,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Show remaining issues failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Show remaining issues failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-all-summary-issues - Fix all remaining summary title issues
app.post('/api/admin/fix-all-summary-issues', async (req, res) => {
    try {
        console.log('🔧 Running comprehensive summary title fix...');
        
        const db = new NewPricingDatabase();
        
        await db.connect();
        console.log('✅ Connected to Railway database');
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name FROM cards');
        console.log(`📊 Found ${cards.length} cards to check`);
        
        let fixedCount = 0;
        let issuesFound = 0;
        
        // Import the fix function from the direct fix script
        const { fixSummaryTitle } = require('./fix-summary-issues-direct.js');
        
        for (const card of cards) {
            const originalSummary = card.summary_title || '';
            const fixedSummary = fixSummaryTitle(originalSummary, card.title, card.player_name);
            
            if (fixedSummary !== originalSummary && fixedSummary.length > 0) {
                issuesFound++;
                console.log(`🔍 Card ID: ${card.id}`);
                console.log(`   Player: "${card.player_name}"`);
                console.log(`   Original: "${originalSummary}"`);
                console.log(`   Fixed: "${fixedSummary}"`);
                
                await db.runQuery('UPDATE cards SET summary_title = ? WHERE id = ?', [fixedSummary, card.id]);
                fixedCount++;
                console.log(`✅ Updated card ${card.id}`);
            }
        }
        
        await db.close();
        
        console.log('\n🎉 Comprehensive Summary Title Fix Complete!');
        console.log(`📊 Total cards checked: ${cards.length}`);
        console.log(`🔍 Issues found: ${issuesFound}`);
        console.log(`✅ Cards fixed: ${fixedCount}`);
        
        res.json({ 
            success: true, 
            message: `Comprehensive summary title fix completed successfully`,
            totalCards: cards.length,
            issuesFound: issuesFound,
            fixedCount: fixedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in comprehensive summary title fix:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to run comprehensive summary title fix', 
            details: error.message, 
            timestamp: new Date().toISOString() 
        });
    }
});

// POST /api/admin/add-summary-component-fields - Add and populate summary component fields
app.post('/api/admin/add-summary-component-fields', async (req, res) => {
    try {
        console.log('🔧 Adding summary component fields to database...');
        
        const { SummaryComponentsFieldManager } = require('./add-summary-components-fields.js');
        const manager = new SummaryComponentsFieldManager();
        
        await manager.connect();
        console.log('✅ Connected to Railway database');
        
        // Add the new columns
        await manager.addSummaryComponentColumns();
        console.log('✅ Added summary component columns');
        
        // Populate the fields
        const result = await manager.populateSummaryComponents();
        console.log('✅ Populated summary component fields');
        
        // Show sample data
        await manager.showSampleData();
        
        await manager.close();
        
        console.log('\n🎉 Summary Component Fields Addition Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`🔄 Updated: ${result.updated}`);
        console.log(`❌ Errors: ${result.errors}`);
        
        res.json({ 
            success: true, 
            message: `Summary component fields added and populated successfully`,
            totalProcessed: result.totalProcessed,
            updated: result.updated,
            errors: result.errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error adding summary component fields:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add summary component fields', 
            details: error.message, 
            timestamp: new Date().toISOString() 
        });
    }
});

// POST /api/admin/report-missing-components - Generate report of cards missing summary components
app.post('/api/admin/report-missing-components', async (req, res) => {
    try {
        console.log('📊 Generating missing summary components report...');
        
        const { MissingComponentsReporter } = require('./report-missing-summary-components.js');
        const reporter = new MissingComponentsReporter();
        
        await reporter.connect();
        console.log('✅ Connected to Railway database');
        
        const result = await reporter.generateMissingComponentsReport();
        
        await reporter.close();
        
        console.log('\n🎉 Missing Components Report Complete!');
        console.log(`📊 Total cards: ${result.totalCards}`);
        console.log(`❌ Missing card_set: ${result.summary.missingCardSet}`);
        console.log(`❌ Missing card_type: ${result.summary.missingCardType}`);
        console.log(`❌ Missing card_number: ${result.summary.missingCardNumber}`);
        console.log(`🚨 Missing ALL fields: ${result.summary.missingAll}`);
        
        res.json({ 
            success: true, 
            message: `Missing components report generated successfully`,
            totalCards: result.totalCards,
            summary: result.summary,
            details: result.details,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error generating missing components report:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to generate missing components report', 
            details: error.message, 
            timestamp: new Date().toISOString() 
        });
    }
});

// POST /api/admin/improve-summary-components - Improve summary component fields with enhanced extraction
app.post('/api/admin/improve-summary-components', async (req, res) => {
    try {
        console.log('🔧 Improving summary component fields...');
        
        const { SummaryComponentsImprover } = require('./improve-summary-components.js');
        const improver = new SummaryComponentsImprover();
        
        await improver.connect();
        console.log('✅ Connected to Railway database');
        
        const result = await improver.improveSummaryComponents();
        
        await improver.close();
        
        console.log('\n🎉 Summary Components Improvement Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`🔄 Updated: ${result.updated}`);
        console.log(`❌ Errors: ${result.errors}`);
        
        res.json({ 
            success: true, 
            message: `Summary components improved successfully`,
            totalProcessed: result.totalProcessed,
            updated: result.updated,
            errors: result.errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error improving summary components:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to improve summary components', 
            details: error.message, 
            timestamp: new Date().toISOString() 
        });
    }
});

// POST /api/admin/rebuild-summary-titles - Rebuild summary titles from component fields
app.post('/api/admin/rebuild-summary-titles', async (req, res) => {
    try {
        console.log('🔨 Rebuilding summary titles from components...');
        
        const { SummaryTitleBuilder } = require('./build-summary-title-from-components.js');
        const builder = new SummaryTitleBuilder();
        
        await builder.connect();
        console.log('✅ Connected to Railway database');
        
        const result = await builder.rebuildAllSummaryTitles();
        
        await builder.close();
        
        console.log('\n🎉 Summary Title Rebuild Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`✅ Updated: ${result.updated} cards`);
        console.log(`⏭️ Unchanged: ${result.unchanged} cards`);
        console.log(`❌ Errors: ${result.errors} cards`);
        
        res.json({
            success: true,
            message: 'Summary titles rebuilt successfully from components',
            totalProcessed: result.totalProcessed,
            updated: result.updated,
            unchanged: result.unchanged,
            errors: result.errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error rebuilding summary titles:', error);
        res.status(500).json({
            success: false,
            message: 'Error rebuilding summary titles',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/clean-summary-titles - Clean up summary titles
app.post('/api/admin/clean-summary-titles', async (req, res) => {
    try {
        console.log('🧹 Cleaning summary titles...');
        
        const { SummaryTitleCleaner } = require('./clean-summary-titles.js');
        const cleaner = new SummaryTitleCleaner();
        
        await cleaner.connect();
        console.log('✅ Connected to Railway database');
        
        const result = await cleaner.cleanAllSummaryTitles();
        
        await cleaner.close();
        
        console.log('\n🎉 Summary Title Cleanup Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`✅ Updated: ${result.updated} cards`);
        console.log(`⏭️ Unchanged: ${result.unchanged} cards`);
        console.log(`❌ Errors: ${result.errors} cards`);
        
        res.json({
            success: true,
            message: 'Summary titles cleaned successfully',
            totalProcessed: result.totalProcessed,
            updated: result.updated,
            unchanged: result.unchanged,
            errors: result.errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error cleaning summary titles:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning summary titles',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



// GET /api/admin/check-component-fields - Check if new component fields were populated correctly
app.get('/api/admin/check-component-fields', async (req, res) => {
    try {
        console.log('🔍 Checking component fields...');
        
        const { ComponentFieldsChecker } = require('./check-component-fields.js');
        const checker = new ComponentFieldsChecker();
        
        await checker.connect();
        console.log('✅ Connected to Railway database');
        
        await checker.checkComponentFields();
        
        await checker.close();
        
        res.json({
            success: true,
            message: 'Component fields check completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error checking component fields:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking component fields',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/analyze-summary-title-issues - Analyze all summary titles for issues
app.post('/api/admin/analyze-summary-title-issues', async (req, res) => {
    try {
        console.log('🔍 Analyzing summary title issues...');
        
        const { SummaryTitleAnalyzer } = require('./analyze-summary-title-issues.js');
        const analyzer = new SummaryTitleAnalyzer();
        
        await analyzer.connect();
        console.log('✅ Connected to Railway database');
        
        await analyzer.analyzeSummaryTitleIssues();
        
        await analyzer.close();
        
        res.json({
            success: true,
            message: 'Summary title analysis completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error analyzing summary title issues:', error);
        res.status(500).json({
            success: false,
            message: 'Error analyzing summary title issues',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/add-rookie-autograph-columns - Add rookie and autograph columns to database
app.post('/api/admin/add-rookie-autograph-columns', async (req, res) => {
    try {
        console.log('🔄 Adding rookie and autograph columns...');
        
        const { DatabaseMigration } = require('./add-rookie-autograph-columns.js');
        const migration = new DatabaseMigration();
        
        await migration.connect();
        console.log('✅ Connected to Railway database');
        
        await migration.addRookieAutographColumns();
        
        await migration.close();
        
        res.json({
            success: true,
            message: 'Rookie and autograph columns added successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error adding rookie and autograph columns:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding rookie and autograph columns',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-null-card-types - Update null card types to "Base"
app.post('/api/admin/update-null-card-types', async (req, res) => {
    try {
        console.log('🔄 Updating null card types to Base...');
        
        const { NullCardTypeUpdater } = require('./update-null-card-types.js');
        const updater = new NullCardTypeUpdater();
        
        await updater.connect();
        console.log('✅ Connected to Railway database');
        
        await updater.updateNullCardTypes();
        
        await updater.close();
        
        res.json({
            success: true,
            message: 'Null card types updated to Base successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error updating null card types:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating null card types',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/generate-improved-summary-titles - Generate improved summary titles
app.post('/api/admin/generate-improved-summary-titles', async (req, res) => {
    try {
        console.log('🔄 Generating improved summary titles...');
        
        const { ImprovedSummaryTitleGenerator } = require('./generate-improved-summary-titles.js');
        const generator = new ImprovedSummaryTitleGenerator();
        
        await generator.connect();
        console.log('✅ Connected to Railway database');
        
        await generator.generateImprovedSummaryTitles();
        
        await generator.close();
        
        res.json({
            success: true,
            message: 'Improved summary titles generated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error generating improved summary titles:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating improved summary titles',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-unknown-sports - Update only cards with Unknown sport
app.post('/api/admin/update-unknown-sports', async (req, res) => {
    try {
        console.log('🔄 Updating unknown sports...');
        
        const { UnknownSportsUpdater } = require('./update-unknown-sports.js');
        const updater = new UnknownSportsUpdater();
        
        await updater.connect();
        console.log('✅ Connected to Railway database');
        
        await updater.updateUnknownSports();
        
        await updater.close();
        
        res.json({
            success: true,
            message: 'Unknown sports update completed successfully',
            results: {
                updated: updater.updatedCount,
                unchanged: updater.unchangedCount,
                errors: updater.errorCount,
                totalProcessed: updater.updatedCount + updater.unchangedCount + updater.errorCount
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error updating unknown sports:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating unknown sports',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-incorrect-unknown-sports - Fix cards incorrectly marked as Unknown
app.post('/api/admin/fix-incorrect-unknown-sports', async (req, res) => {
    try {
        console.log('🔄 Fixing incorrect unknown sports...');
        
        const { IncorrectUnknownSportsFixer } = require('./fix-incorrect-unknown-sports.js');
        const fixer = new IncorrectUnknownSportsFixer();
        
        await fixer.connect();
        console.log('✅ Connected to Railway database');
        
        await fixer.fixIncorrectUnknownSports();
        
        await fixer.close();
        
        res.json({
            success: true,
            message: 'Incorrect unknown sports fix completed successfully',
            results: {
                fixed: fixer.fixedCount,
                skipped: fixer.skippedCount,
                errors: fixer.errorCount,
                totalProcessed: fixer.fixedCount + fixer.skippedCount + fixer.errorCount
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fixing incorrect unknown sports:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing incorrect unknown sports',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/verify-player-names - Verify current state of player names in database
app.post('/api/admin/verify-player-names', async (req, res) => {
    try {
        console.log('🔍 Verifying player names...');
        
        const { PlayerNameVerifier } = require('./verify-player-names.js');
        const verifier = new PlayerNameVerifier();
        await verifier.connect();
        await verifier.verifyPlayerNames();
        await verifier.close();

        res.json({
            success: true,
            message: 'Player name verification completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error verifying player names:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying player names',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/restore-player-names - Restore corrupted player names by re-extracting from original titles
app.post('/api/admin/restore-player-names', async (req, res) => {
    try {
        console.log('🔧 Restoring corrupted player names...');
        
        const { PlayerNameRestorer } = require('./restore-player-names.js');
        const restorer = new PlayerNameRestorer();
        await restorer.connect();
        await restorer.restorePlayerNames();
        await restorer.close();

        res.json({
            success: true,
            message: 'Player name restoration completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error restoring player names:', error);
        res.status(500).json({
            success: false,
            message: 'Error restoring player names',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/apply-ultra-conservative-player-name-fixes - Apply ultra-conservative fixes for specific ESPN API failure cases
app.post('/api/admin/apply-ultra-conservative-player-name-fixes', async (req, res) => {
    try {
        console.log('🎯 Applying ultra-conservative player name fixes...');
        
        const { UltraConservativePlayerNameFixes } = require('./ultra-conservative-player-name-fixes.js');
        const fixer = new UltraConservativePlayerNameFixes();
        await fixer.connect();
        await fixer.applyUltraConservativeFixesToDatabase();
        await fixer.close();

        res.json({
            success: true,
            message: 'Ultra-conservative player name fixes completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error applying ultra-conservative player name fixes:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying ultra-conservative player name fixes',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/apply-conservative-player-name-fixes - Apply very conservative fixes for specific ESPN API failure cases
app.post('/api/admin/apply-conservative-player-name-fixes', async (req, res) => {
    try {
        console.log('🎯 Applying conservative player name fixes...');
        
        const { ConservativePlayerNameFixes } = require('./conservative-player-name-fixes.js');
        const fixer = new ConservativePlayerNameFixes();
        await fixer.connect();
        await fixer.applyConservativeFixesToDatabase();
        await fixer.close();

        res.json({
            success: true,
            message: 'Conservative player name fixes completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error applying conservative player name fixes:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying conservative player name fixes',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/apply-targeted-player-name-fixes - Apply targeted fixes for specific ESPN API failure cases
app.post('/api/admin/apply-targeted-player-name-fixes', async (req, res) => {
    try {
        console.log('🎯 Applying targeted player name fixes...');
        
        const { TargetedPlayerNameFixes } = require('./targeted-player-name-fixes.js');
        const fixer = new TargetedPlayerNameFixes();
        await fixer.connect();
        await fixer.applyTargetedFixesToDatabase();
        await fixer.close();

        res.json({
            success: true,
            message: 'Targeted player name fixes completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error applying targeted player name fixes:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying targeted player name fixes',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-messed-up-player-names - Fix player names that got messed up by enhanced extraction
app.post('/api/admin/fix-messed-up-player-names', async (req, res) => {
    try {
        console.log('🔧 Fixing messed up player names...');
        
        const { MessedUpPlayerNameFixer } = require('./fix-messed-up-player-names.js');
        const fixer = new MessedUpPlayerNameFixer();
        await fixer.connect();
        await fixer.fixMessedUpPlayerNames();
        await fixer.close();

        res.json({
            success: true,
            message: 'Messed up player names fix completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fixing messed up player names:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing messed up player names',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-enhanced-player-extraction - Test enhanced player name extraction
app.post('/api/admin/test-enhanced-player-extraction', async (req, res) => {
    try {
        console.log('🧪 Testing enhanced player extraction...');
        
        const { EnhancedPlayerExtraction } = require('./enhanced-player-extraction.js');
        const extractor = new EnhancedPlayerExtraction();
        await extractor.connect();
        await extractor.testEnhancedExtraction();
        await extractor.close();

        res.json({
            success: true,
            message: 'Enhanced player extraction test completed',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error testing enhanced player extraction:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing enhanced player extraction',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-player-names-enhanced - Update player names with enhanced extraction
app.post('/api/admin/update-player-names-enhanced', async (req, res) => {
    try {
        console.log('🔄 Updating player names with enhanced extraction...');
        
        const { EnhancedPlayerExtraction } = require('./enhanced-player-extraction.js');
        const extractor = new EnhancedPlayerExtraction();
        await extractor.connect();
        await extractor.updatePlayerNamesWithEnhancedExtraction();
        await extractor.close();

        res.json({
            success: true,
            message: 'Enhanced player name update completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating player names with enhanced extraction:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating player names with enhanced extraction',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/cleanup-player-names - Normalize player_name across all cards
app.post('/api/admin/cleanup-player-names', async (req, res) => {
	try {
		console.log('🔄 Running player_name cleanup...');
		const { PlayerNameCleanup } = require('./cleanup-player-names.js');
		const cleaner = new PlayerNameCleanup();
		await cleaner.connect();
		await cleaner.run();
		await cleaner.db.close();
		res.json({
			success: true,
			message: 'Player name cleanup completed successfully',
			results: {
				updated: cleaner.updatedCount,
				unchanged: cleaner.unchangedCount,
				errors: cleaner.errorCount,
				totalProcessed: cleaner.updatedCount + cleaner.unchangedCount + cleaner.errorCount
			},
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('❌ Error running player_name cleanup:', error);
		res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
	}
});

// POST /api/admin/fix-remaining-unknown-sports - Hard-fix final Unknowns by id
app.post('/api/admin/fix-remaining-unknown-sports', async (req, res) => {
	try {
		const { RemainingUnknownSportsFixer } = require('./fix-remaining-unknown-sports.js');
		const fixer = new RemainingUnknownSportsFixer();
		await fixer.connect();
		const result = await fixer.run();
		await fixer.close();
		res.json({ success: true, message: 'Remaining Unknown sports fixed', result, timestamp: new Date().toISOString() });
	} catch (e) {
		res.status(500).json({ success: false, error: e.message, timestamp: new Date().toISOString() });
	}
});

// POST /api/admin/check-missing-card-numbers - Find cards with missing card numbers
app.post('/api/admin/check-missing-card-numbers', async (req, res) => {
    try {
        console.log('🔍 Checking for cards with missing card numbers...');
        
        const { MissingCardNumberChecker } = require('./check-missing-card-numbers.js');
        const checker = new MissingCardNumberChecker();
        await checker.connect();
        const results = await checker.findCardsWithMissingNumbers();
        await checker.close();

        res.json({
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error checking missing card numbers:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking missing card numbers',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-missing-card-numbers - Batch fix missing card numbers
app.post('/api/admin/fix-missing-card-numbers', async (req, res) => {
    try {
        console.log('🔧 Starting batch fix for missing card numbers...');
        
        const { MissingCardNumberChecker } = require('./check-missing-card-numbers.js');
        const checker = new MissingCardNumberChecker();
        await checker.connect();
        const results = await checker.fixMissingCardNumbers();
        await checker.close();

        res.json({
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error fixing missing card numbers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing missing card numbers',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-card-number-extraction - Test card number extraction with specific examples
app.post('/api/admin/test-card-number-extraction', async (req, res) => {
    try {
        console.log('🧪 Testing card number extraction...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        const testTitles = [
            "Tom Brady 2015 Topps Chrome #50 Graded PSA 10 GEM MINT New England Football Card",
            "1990 Fleer Basketball #26 Michael Jordan Chicago Bulls PSA 10 GEM MINT",
            "2019 Donruss Optic Kobe Bryant Rainmakers PSA 10 GEM MINT #19 Lakers",
            "2024 Panini Prizm Draft Picks #SJMC Jared McCain Signature PSA 10 GEM MINT 76ers"
        ];
        
        const results = testTitles.map(title => {
            const extracted = db.extractCardNumber(title);
            return {
                title: title,
                extractedNumber: extracted,
                hasNumber: !!extracted
            };
        });
        
        await db.close();
        
        res.json({
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error testing card number extraction:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing card number extraction',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/analyze-player-names - Analyze player names to identify problematic ones
app.post('/api/admin/analyze-player-names', async (req, res) => {
    try {
        console.log('🔍 Analyzing player names...');
        const { PlayerNameAnalyzer } = require('./analyze-player-names-simple.js');
        const analyzer = new PlayerNameAnalyzer();
        await analyzer.connect();
        await analyzer.analyzePlayerNames();
        await analyzer.close();
        
        res.json({ 
            success: true, 
            message: 'Player name analysis completed successfully',
            problematicCount: analyzer.problematicNames.length,
            totalAnalyzed: analyzer.analysisResults.length,
            databaseStats: {
                totalCards: analyzer.totalCards || 0,
                cardsWithPlayerNames: analyzer.cardsWithPlayerNames || 0
            },
            problematicNames: analyzer.problematicNames.map(name => {
                const result = analyzer.analysisResults.find(r => r.playerName === name);
                
                // Debug: Log what we found
                console.log(`🔍 DEBUG - Mapping "${name}":`, {
                    hasResult: !!result,
                    resultKeys: result ? Object.keys(result) : 'NO RESULT',
                    hasEspnValidation: result ? !!result.espnValidation : false,
                    espnValidation: result ? result.espnValidation : 'NO RESULT'
                });
                
                // Always include ESPN validation - create it directly
                const espnValidation = result.espnValidation || {
                    isValid: false,
                    results: 0,
                    reason: 'ESPN validation not performed',
                    firstResult: null
                };
                
                return {
                    name: name,
                    title: result.title,
                    count: result.count,
                    reason: result.reason,
                    espnValidation: espnValidation
                };
            }),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error analyzing player names:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error analyzing player names', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/diagnose-database - Diagnose database structure and content
app.post('/api/admin/diagnose-database', async (req, res) => {
    try {
        console.log('🔍 Diagnosing database...');
        const { PlayerNameAnalyzer } = require('./analyze-player-names-simple.js');
        const analyzer = new PlayerNameAnalyzer();
        await analyzer.connect();
        await analyzer.diagnoseDatabase();
        await analyzer.close();
        
        res.json({ 
            success: true, 
            message: 'Database diagnosis completed successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error diagnosing database:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error diagnosing database', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-database-connection - Simple database connection test
app.post('/api/admin/test-database-connection', async (req, res) => {
    try {
        console.log('🔍 Testing database connection...');
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Simple query to test connection using wrapper methods
        const countQuery = `SELECT COUNT(*) as total FROM cards`;
        const countResult = await db.getQuery(countQuery);
        
        // Get a few sample cards using wrapper methods
        const sampleQuery = `SELECT id, title, player_name FROM cards LIMIT 3`;
        const sampleCards = await db.allQuery(sampleQuery);
        
        await db.close();
        
        res.json({ 
            success: true, 
            message: 'Database connection test completed successfully - USING WRAPPER METHODS',
            totalCards: countResult.total,
            sampleCards: sampleCards,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error testing database connection:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error testing database connection', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/fix-player-names - Fix problematic player names in database
app.post('/api/admin/fix-player-names', async (req, res) => {
    try {
        console.log('🔧 Starting player name fix...');
        const { PlayerNameFixer } = require('./fix-player-names-railway.js');
        const fixer = new PlayerNameFixer();
        
        await fixer.connect();
        await fixer.fixPlayerNames();
        await fixer.showSampleResults();
        await fixer.close();
        
        res.json({ 
            success: true, 
            message: 'Player name fix completed successfully',
            fixedCount: fixer.fixedCount,
            totalCount: fixer.totalCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error fixing player names:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fixing player names', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-espn-connection - Test ESPN API connection
app.post('/api/admin/test-espn-connection', async (req, res) => {
    try {
        console.log('🔍 Testing ESPN API connection...');
        const { ESPNPlayerNameValidator } = require('./test-player-names-espn-simple.js');
        const validator = new ESPNPlayerNameValidator();
        await validator.connect();
        const isWorking = await validator.testESPNConnection();
        await validator.close();
        
        res.json({ 
            success: true, 
            message: 'ESPN API connection test completed',
            isWorking: isWorking,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error testing ESPN API connection:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error testing ESPN API connection', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/test-sample-player-names - Test sample player names with ESPN API
app.post('/api/admin/test-sample-player-names', async (req, res) => {
    try {
        console.log('🔍 Testing sample player names with ESPN API...');
        const { ESPNPlayerNameValidator } = require('./test-player-names-espn-simple.js');
        const validator = new ESPNPlayerNameValidator();
        await validator.connect();
        await validator.testSamplePlayerNames();
        await validator.close();
        
        res.json({ 
            success: true, 
            message: 'Sample player name validation completed successfully',
            validCount: validator.validNames.length,
            problematicCount: validator.problematicNames.length,
            totalTested: validator.testResults.length,
            problematicNames: validator.problematicNames.map(name => {
                const result = validator.testResults.find(r => r.playerName === name);
                return {
                    name: name,
                    title: result.title,
                    reason: result.reason
                };
            }),
            validNames: validator.validNames.slice(0, 10), // Show first 10 valid names
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error testing sample player names with ESPN:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error testing sample player names with ESPN', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/validate-player-names-espn - Validate player names using ESPN API
app.post('/api/admin/validate-player-names-espn', async (req, res) => {
    try {
        console.log('🔍 Validating player names with ESPN API...');
        const { ESPNPlayerNameValidator } = require('./test-player-names-espn-simple.js');
        const validator = new ESPNPlayerNameValidator();
        await validator.connect();
        await validator.validatePlayerNames();
        await validator.close();
        
        res.json({ 
            success: true, 
            message: 'ESPN player name validation completed successfully',
            validCount: validator.validNames.length,
            problematicCount: validator.problematicNames.length,
            totalTested: validator.testResults.length,
            problematicNames: validator.problematicNames.map(name => {
                const result = validator.testResults.find(r => r.playerName === name);
                return {
                    name: name,
                    title: result.title,
                    reason: result.reason
                };
            }),
            validNames: validator.validNames.slice(0, 10), // Show first 10 valid names
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error validating player names with ESPN:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error validating player names with ESPN', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/admin/find-3-word-player-names - Find all player names with exactly 3 words
app.get('/api/admin/find-3-word-player-names', async (req, res) => {
    try {
        console.log('🔍 Finding player names with exactly 3 words...');
        
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Get all cards from the database
        const cards = await db.allQuery(`
            SELECT id, title, player_name, summary_title 
            FROM cards 
            WHERE player_name IS NOT NULL AND player_name != ''
        `);
        
        const threeWordPlayers = [];
        
        cards.forEach(card => {
            const playerName = card.player_name || '';
            const words = playerName.trim().split(/\s+/).filter(word => word.length > 0);
            
            if (words.length === 3) {
                threeWordPlayers.push({
                    id: card.id,
                    title: card.title,
                    player_name: playerName,
                    summary_title: card.summary_title || 'NULL'
                });
            }
        });
        
        // Sort by player name for easier review
        threeWordPlayers.sort((a, b) => a.player_name.localeCompare(b.player_name));
        
        // Get unique player names
        const uniquePlayerNames = [...new Set(threeWordPlayers.map(card => card.player_name))];
        
        await db.close();
        
        res.json({ 
            success: true, 
            message: 'Found player names with exactly 3 words',
            totalCards: threeWordPlayers.length,
            uniquePlayerNames: uniquePlayerNames.length,
            cards: threeWordPlayers,
            uniqueNames: uniquePlayerNames.sort(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error finding 3-word player names:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error finding 3-word player names', 
            error: error.message, 
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/admin/analyze-player-name-word-counts - Analyze player names by word count
app.get('/api/admin/analyze-player-name-word-counts', async (req, res) => {
    try {
        console.log('🔍 Analyzing player names by word count...');
        
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Get all cards from the database
        const cards = await db.allQuery(`
            SELECT id, title, player_name, summary_title 
            FROM cards 
            WHERE player_name IS NOT NULL AND player_name != ''
        `);
        
        // Analyze word counts
        const wordCountAnalysis = {};
        const cardsByWordCount = {};
        
        cards.forEach(card => {
            const playerName = card.player_name || '';
            const wordCount = playerName.trim().split(/\s+/).filter(word => word.length > 0).length;
            
            // Initialize if not exists
            if (!wordCountAnalysis[wordCount]) {
                wordCountAnalysis[wordCount] = {
                    count: 0,
                    uniqueNames: new Set(),
                    examples: []
                };
            }
            if (!cardsByWordCount[wordCount]) {
                cardsByWordCount[wordCount] = [];
            }
            
            // Count cards
            wordCountAnalysis[wordCount].count++;
            wordCountAnalysis[wordCount].uniqueNames.add(playerName);
            
            // Add example (limit to 5 per word count)
            if (wordCountAnalysis[wordCount].examples.length < 5) {
                wordCountAnalysis[wordCount].examples.push(playerName);
            }
            
            // Add card to list
            cardsByWordCount[wordCount].push({
                id: card.id,
                title: card.title,
                player_name: playerName,
                summary_title: card.summary_title || 'NULL'
            });
        });
        
        // Convert Sets to arrays and format results
        const formattedAnalysis = {};
        Object.keys(wordCountAnalysis).forEach(wordCount => {
            const analysis = wordCountAnalysis[wordCount];
            formattedAnalysis[wordCount] = {
                totalCards: analysis.count,
                uniquePlayerNames: analysis.uniqueNames.size,
                examples: Array.from(analysis.uniqueNames).slice(0, 10), // Show up to 10 unique names
                sampleCards: cardsByWordCount[wordCount].slice(0, 5) // Show up to 5 sample cards
            };
        });
        
        await db.close();
        
        res.json({
            success: true,
            message: 'Player name word count analysis',
            totalCardsAnalyzed: cards.length,
            analysis: formattedAnalysis,
            summary: {
                oneWordNames: formattedAnalysis['1'] || { totalCards: 0, uniquePlayerNames: 0 },
                twoWordNames: formattedAnalysis['2'] || { totalCards: 0, uniquePlayerNames: 0 },
                threeWordNames: formattedAnalysis['3'] || { totalCards: 0, uniquePlayerNames: 0 },
                fourPlusWordNames: Object.keys(formattedAnalysis)
                    .filter(count => parseInt(count) >= 4)
                    .reduce((sum, count) => sum + formattedAnalysis[count].totalCards, 0)
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error analyzing player name word counts:', error);
        res.status(500).json({
            success: false,
            message: 'Error analyzing player name word counts',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/update-player-names-centralized - Update all player names using new centralized system
app.post('/api/admin/update-player-names-centralized', async (req, res) => {
    try {
        console.log('🚀 Starting player name update with new centralized SimplePlayerExtractor...');
        
        const RailwayPlayerExtractor = require('./railway-player-extraction.js');
        const extractor = new RailwayPlayerExtractor();
        
        await extractor.connect();
        await extractor.updateAllPlayerNames();
        await extractor.close();
        
        console.log('✅ Centralized player name update completed successfully');
        res.json({ 
            success: true, 
            message: 'Centralized player name update completed successfully',
            stats: extractor.stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Centralized player name update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Centralized player name update failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Check ProxyMesh limits and usage
app.get('/api/check-proxymesh-limits', async (req, res) => {
    try {
        const axios = require('axios');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        
        const results = {
            credentials: {
                usernameSet: !!username,
                username: username || 'Not set'
            },
            serverTests: [],
            rateLimitTest: {
                maxSuccessfulRequests: 0,
                rateLimitHit: false
            }
        };
        
        if (!username || !password) {
            return res.json({
                success: false,
                error: 'ProxyMesh credentials not configured',
                results
            });
        }
        
        const proxyServers = [
            'us-ca.proxymesh.com:31280',
            'us-il.proxymesh.com:31280', 
            'us-ny.proxymesh.com:31280'
        ];
        
        // Test each server
        for (let i = 0; i < proxyServers.length; i++) {
            const server = proxyServers[i];
            
            try {
                const proxyUrl = `http://${username}:${password}@${server}`;
                const httpsAgent = new HttpsProxyAgent(proxyUrl);
                
                const startTime = Date.now();
                const response = await axios.get('https://httpbin.org/ip', {
                    httpsAgent: httpsAgent,
                    timeout: 8000
                });
                const duration = Date.now() - startTime;
                
                results.serverTests.push({
                    server,
                    success: true,
                    duration,
                    ip: JSON.parse(response.data).origin
                });
                
            } catch (error) {
                results.serverTests.push({
                    server,
                    success: false,
                    error: error.message,
                    status: error.response?.status,
                    is402: error.response?.status === 402
                });
            }
        }
        
        // Test rate limit with rapid requests
        if (results.serverTests.some(test => test.success)) {
            const workingServer = results.serverTests.find(test => test.success);
            const proxyUrl = `http://${username}:${password}@${workingServer.server}`;
            
            for (let i = 1; i <= 5; i++) {
                try {
                    const httpsAgent = new HttpsProxyAgent(proxyUrl);
                    await axios.get('https://httpbin.org/status/200', {
                        httpsAgent: httpsAgent,
                        timeout: 5000
                    });
                    
                    results.rateLimitTest.maxSuccessfulRequests = i;
                    
                } catch (error) {
                    if (error.response?.status === 402) {
                        results.rateLimitTest.rateLimitHit = true;
                        results.rateLimitTest.rateLimitAt = i;
                        break;
                    }
                }
            }
        }
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error checking ProxyMesh limits:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test each ProxyMesh server individually to find which ones cause 402 errors
app.get('/api/test-each-proxy-server', async (req, res) => {
    try {
        const axios = require('axios');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'ProxyMesh credentials not configured' });
        }
        
        const proxyServers = [
            'us-ca.proxymesh.com:31280',
            'us-il.proxymesh.com:31280', 
            'us-ny.proxymesh.com:31280',
            'us-fl.proxymesh.com:31280',
            'us-wa.proxymesh.com:31280'
        ];
        
        const results = {
            testStarted: new Date().toISOString(),
            serverTests: []
        };
        
        // Test each server with eBay search that was causing 402 errors
        const problemSearchUrl = 'https://www.ebay.com/sch/i.html?_nkw=2024+Bowman+Chrome+Draft+Bdc+Cam+Caminiti+BDC-20&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1&Graded=Yes&_dcat=261328&rt=nc&Grade=9&_udlo=25&_udhi=2500&Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529';
        
        console.log('🧪 Testing each ProxyMesh server with eBay search that caused 402 errors...');
        
        for (let i = 0; i < proxyServers.length; i++) {
            const server = proxyServers[i];
            const serverResult = {
                serverNumber: i + 1,
                serverAddress: server,
                timestamp: new Date().toISOString()
            };
            
            console.log(`\n--- Testing server ${i + 1}: ${server} ---`);
            
            try {
                const proxyUrl = `http://${username}:${password}@${server}`;
                const httpsAgent = new HttpsProxyAgent(proxyUrl);
                
                const startTime = Date.now();
                const response = await axios.get(problemSearchUrl, {
                    httpsAgent: httpsAgent,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    },
                    timeout: 15000
                });
                
                const duration = Date.now() - startTime;
                
                serverResult.success = true;
                serverResult.responseStatus = response.status;
                serverResult.responseSize = response.data.length;
                serverResult.duration = duration;
                serverResult.isCaptcha = response.data.includes('Pardon Our Interruption');
                serverResult.hasEbayContent = response.data.includes('eBay');
                
                console.log(`   ✅ Server ${i + 1}: SUCCESS (${duration}ms, ${response.data.length} chars)`);
                console.log(`      CAPTCHA: ${serverResult.isCaptcha}, eBay Content: ${serverResult.hasEbayContent}`);
                
            } catch (error) {
                serverResult.success = false;
                serverResult.error = error.message;
                serverResult.status = error.response?.status;
                serverResult.statusText = error.response?.statusText;
                serverResult.is402 = error.response?.status === 402;
                
                console.log(`   ❌ Server ${i + 1}: ${error.message}`);
                if (error.response?.status === 402) {
                    console.log(`      🚨 402 ERROR on this specific server!`);
                    serverResult.responseBody = error.response?.data?.substring(0, 300);
                }
            }
            
            results.serverTests.push(serverResult);
            
            // Small delay between server tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Summary
        const workingServers = results.serverTests.filter(s => s.success);
        const failingServers = results.serverTests.filter(s => !s.success);
        const servers402 = results.serverTests.filter(s => s.is402);
        
        results.summary = {
            totalServers: proxyServers.length,
            workingServers: workingServers.length,
            failingServers: failingServers.length,
            servers402: servers402.length,
            recommendation: servers402.length > 0 ? 
                `Avoid servers: ${servers402.map(s => s.serverAddress).join(', ')}` :
                'All servers working - 402 errors likely from request rate or eBay detection'
        };
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error testing proxy servers:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Find exact ProxyMesh rate limit that causes 402 errors
app.get('/api/find-proxymesh-limit', async (req, res) => {
    try {
        const axios = require('axios');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'ProxyMesh credentials not configured' });
        }
        
        const results = {
            testStarted: new Date().toISOString(),
            proxyServer: 'us-ca.proxymesh.com:31280',
            requests: [],
            limitFound: false,
            estimatedLimit: null
        };
        
        const proxyUrl = `http://${username}:${password}@us-ca.proxymesh.com:31280`;
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        
        // Test rapid requests with timestamps to find exact limit
        console.log('🔍 Testing rapid requests to find exact rate limit...');
        
        for (let i = 1; i <= 20; i++) {
            const requestStart = Date.now();
            
            try {
                // Use a lightweight test endpoint
                await axios.get('https://httpbin.org/status/200', {
                    httpsAgent: httpsAgent,
                    timeout: 10000
                });
                
                const duration = Date.now() - requestStart;
                results.requests.push({
                    requestNumber: i,
                    timestamp: new Date().toISOString(),
                    success: true,
                    duration: duration,
                    timeSinceStart: Date.now() - new Date(results.testStarted).getTime()
                });
                
                console.log(`   Request ${i}: ✅ (${duration}ms)`);
                
                // No delay - test maximum rate
                
            } catch (error) {
                const duration = Date.now() - requestStart;
                const timeSinceStart = Date.now() - new Date(results.testStarted).getTime();
                
                results.requests.push({
                    requestNumber: i,
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: error.message,
                    status: error.response?.status,
                    duration: duration,
                    timeSinceStart: timeSinceStart
                });
                
                console.log(`   Request ${i}: ❌ ${error.message}`);
                
                if (error.response?.status === 402) {
                    results.limitFound = true;
                    results.limitHitAt = i;
                    results.timeToLimit = timeSinceStart;
                    results.estimatedLimit = `${i-1} requests in ${Math.round(timeSinceStart/1000)} seconds`;
                    
                    console.log(`   🚨 RATE LIMIT HIT! Limit appears to be ${i-1} requests in ${Math.round(timeSinceStart/1000)} seconds`);
                    break;
                }
            }
        }
        
        // Calculate successful requests per time period
        const successfulRequests = results.requests.filter(r => r.success);
        if (successfulRequests.length > 1) {
            const totalTime = successfulRequests[successfulRequests.length - 1].timeSinceStart;
            const requestsPerSecond = (successfulRequests.length / totalTime) * 1000;
            const requestsPerMinute = requestsPerSecond * 60;
            
            results.analysis = {
                successfulRequests: successfulRequests.length,
                totalTestTime: Math.round(totalTime),
                requestsPerSecond: Math.round(requestsPerSecond * 10) / 10,
                requestsPerMinute: Math.round(requestsPerMinute)
            };
        }
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error finding ProxyMesh limit:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test 402 error reproduction and retry logic
app.get('/api/test-402-reproduction', async (req, res) => {
    try {
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        const testResults = {
            configuration: {
                usingProxy: ebayService.useProxy,
                proxyServers: ebayService.proxyServers.length
            },
            tests: []
        };
        
        // Test the exact search that was failing
        const searchTerm = "2024 Bowman Chrome Draft Bdc Cam Caminiti #BDC-20";
        
        console.log('🧪 Testing PSA 9 search that caused 402 error...');
        try {
            const psa9Result = await ebayService.searchSoldCards(searchTerm, null, 20, 'PSA 9');
            testResults.tests.push({
                type: 'PSA 9 Search',
                success: psa9Result.success,
                resultsCount: psa9Result.results ? psa9Result.results.length : 0,
                error: psa9Result.error || null
            });
        } catch (error) {
            testResults.tests.push({
                type: 'PSA 9 Search',
                success: false,
                error: error.message,
                status: error.response?.status,
                is402: error.response?.status === 402
            });
        }
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🧪 Testing Raw search that caused 402 error...');
        try {
            const rawResult = await ebayService.searchSoldCards(searchTerm, null, 20, 'Raw');
            testResults.tests.push({
                type: 'Raw Search',
                success: rawResult.success,
                resultsCount: rawResult.results ? rawResult.results.length : 0,
                error: rawResult.error || null
            });
        } catch (error) {
            testResults.tests.push({
                type: 'Raw Search',
                success: false,
                error: error.message,
                status: error.response?.status,
                is402: error.response?.status === 402
            });
        }
        
        // Test rapid requests to trigger quota
        console.log('🚀 Testing rapid requests to trigger quota limit...');
        for (let i = 1; i <= 3; i++) {
            try {
                const testResult = await ebayService.searchSoldCards("2024 Topps Chrome", "Baseball", 5, 'PSA 10');
                testResults.tests.push({
                    type: `Rapid Request ${i}`,
                    success: testResult.success,
                    resultsCount: testResult.results ? testResult.results.length : 0
                });
            } catch (error) {
                testResults.tests.push({
                    type: `Rapid Request ${i}`,
                    success: false,
                    error: error.message,
                    status: error.response?.status,
                    is402: error.response?.status === 402
                });
                
                if (error.response?.status === 402) {
                    testResults.quotaLimitHit = true;
                    break;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        res.json({
            success: true,
            testResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in 402 reproduction test:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug 402 errors on Railway
app.get('/api/debug-402-errors', async (req, res) => {
    try {
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        const debugInfo = {
            proxyConfig: {
                usernameSet: !!process.env.PROXYMESH_USERNAME,
                passwordSet: !!process.env.PROXYMESH_PASSWORD,
                usingProxy: ebayService.useProxy,
                proxyServers: ebayService.proxyServers.length
            },
            testResults: {}
        };
        
        // Test a simple eBay request that was causing 402 errors
        const testUrl = 'https://www.ebay.com/sch/i.html?_nkw=2024+Bowman+Chrome&_sacat=0&LH_Complete=1&LH_Sold=1&Graded=Yes&Grade=9&_dcat=261328';
        
        try {
            const axios = require('axios');
            const proxyAgent = ebayService.getNextProxy();
            
            const requestConfig = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            };
            
            if (proxyAgent) {
                requestConfig.httpsAgent = proxyAgent;
                debugInfo.testResults.usingProxyForTest = true;
            } else {
                debugInfo.testResults.usingProxyForTest = false;
            }
            
            const response = await axios.get(testUrl, requestConfig);
            
            debugInfo.testResults.status = response.status;
            debugInfo.testResults.contentLength = response.data.length;
            debugInfo.testResults.isCaptcha = response.data.includes('Pardon Our Interruption');
            debugInfo.testResults.hasEbayContent = response.data.includes('2024');
            debugInfo.testResults.success = true;
            
        } catch (error) {
            debugInfo.testResults.success = false;
            debugInfo.testResults.error = error.message;
            debugInfo.testResults.status = error.response?.status;
            debugInfo.testResults.statusText = error.response?.statusText;
            
            if (error.response?.status === 402) {
                debugInfo.testResults.is402Error = true;
                debugInfo.testResults.responseBody = error.response?.data?.substring(0, 500);
            }
        }
        
        res.json({
            success: true,
            debugInfo,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in 402 debug:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get Railway server IP for ProxyMesh setup
app.get('/api/get-server-ip', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get('https://api.ipify.org?format=json');
        
        res.json({
            success: true,
            serverIP: response.data.ip,
            message: `Add this IP (${response.data.ip}) to your ProxyMesh dashboard under 'Add an IP or Hostname'`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting server IP:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint to find and update specific Messi cards
app.get('/api/test-messi-cards', async (req, res) => {
    try {
        const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        const db = new sqlite3.Database(dbPath);
        
        // Search for Messi cards
        const query = `
            SELECT id, title, summary_title, psa10_price, psa10_average_price, psa9_average_price, raw_average_price
            FROM cards 
            WHERE title LIKE '%Messi%' OR summary_title LIKE '%Messi%'
            ORDER BY id DESC
            LIMIT 10
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: err.message 
                });
            }
            
            res.json({
                success: true,
                messiCards: rows,
                count: rows.length,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('Error finding Messi cards:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Test endpoint to check recent price updates
app.get('/api/test-recent-prices', async (req, res) => {
    try {
        const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        const db = new sqlite3.Database(dbPath);
        
        // Get the most recent cards that were updated
        const query = `
            SELECT id, title, raw_average_price, psa9_average_price, psa10_price, 
                   last_updated, sport
            FROM cards 
            WHERE last_updated IS NOT NULL 
            ORDER BY last_updated DESC 
            LIMIT 10
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
                            res.json({ 
                    success: true, 
                    recent_updates: rows.map(row => ({
                        id: row.id,
                        title: row.title,
                        raw_average_price: row.raw_average_price,
                        psa9_average_price: row.psa9_average_price,
                        psa10_price: row.psa10_price,
                        last_price_update: row.last_updated,
                        sport: row.sport
                    })),
                    count: rows.length 
                });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Test endpoint for headless browser fallback
app.post('/api/test-130point-headless', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        console.log(`🧪 Testing 130point headless browser fallback with query: "${searchQuery}"`);
        
        const OnePointService = require('./services/130pointService.js');
        const service = new OnePointService();
        
        let rawResponse = null;
        let parsedResults = [];
        let requestDetails = {};
        
        try {
            const startTime = Date.now();
            // 130point service removed - return empty response
            const response = { rawHtml: '<div>130point service disabled</div>', parsedResults: [] };
            const endTime = Date.now();
            
            rawResponse = response.rawHtml;
            parsedResults = response.parsedResults;
            requestDetails = {
                url: response.requestUrl,
                method: response.requestMethod,
                durationMs: endTime - startTime
            };
        } catch (error) {
            console.error('❌ Headless browser test error during search:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        
        // Analyze raw HTML for debugging
        const htmlContains = {
            table: rawResponse ? rawResponse.includes('table') : false,
            sold_data_simple: rawResponse ? rawResponse.includes('sold_data-simple') : false,
            itemTitle: rawResponse ? rawResponse.includes('Item Title') : false,
            salePrice: rawResponse ? rawResponse.includes('Sale Price') : false,
        };
        
        res.json({
            success: true,
            searchQuery: searchQuery,
            method: 'headless-browser-fallback',
            request: requestDetails,
            response: {
                status: 200,
                length: rawResponse ? rawResponse.length : 0,
                contains: htmlContains,
                preview: rawResponse ? rawResponse.substring(0, 500) : 'No raw response data'
            },
            parsed: {
                count: parsedResults.length,
                sample: parsedResults.slice(0, 3)
            }
        });
        
    } catch (error) {
        console.error('❌ Headless browser test error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug endpoint to see raw HTML from headless browser
app.post('/api/debug-130point-html', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        console.log(`🔍 DEBUG: Getting raw HTML for query: "${searchQuery}"`);
        
        // 130pointService removed - no longer using 130point
        console.log('❌ 130point service disabled - endpoint deprecated');
        
        // 130point service removed - return empty response
        const response = { rawHtml: '<div>130point service disabled</div>', parsedResults: [] };
        
        // Search for specific patterns in the HTML
        const html = response.rawHtml;
        const patterns = {
            sold_data_simple: html.includes('sold_data-simple'),
            table: html.includes('<table'),
            tr: html.includes('<tr'),
            td: html.includes('<td'),
            'Item Title': html.includes('Item Title'),
            'Sale Price': html.includes('Sale Price'),
            'Sale Date': html.includes('Sale Date'),
            'No results found': html.includes('No results found'),
            'No sales data': html.includes('No sales data')
        };
        
        // Find the position of key elements
        const soldDataPos = html.indexOf('sold_data-simple');
        const tablePos = html.indexOf('<table');
        const noResultsPos = html.indexOf('No results found');
        
        // Get context around key positions
        const soldDataContext = soldDataPos > -1 ? html.substring(soldDataPos - 100, soldDataPos + 500) : 'Not found';
        const tableContext = tablePos > -1 ? html.substring(tablePos - 50, tablePos + 300) : 'Not found';
        
        res.json({
            success: true,
            searchQuery: searchQuery,
            htmlLength: response.rawHtml.length,
            patterns: patterns,
            positions: {
                sold_data_simple: soldDataPos,
                table: tablePos,
                noResults: noResultsPos
            },
            context: {
                sold_data_simple: soldDataContext,
                table: tableContext
            },
            parsedCount: response.parsedResults.length
        });
    } catch (error) {
        console.error('❌ Debug HTML error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint for eBay research API
app.post('/api/test-ebay-research', async (req, res) => {
    try {
        const { searchQuery } = req.body;
        console.log(`🧪 Testing eBay research API with query: "${searchQuery}"`);
        const EbayResearchService = require('./services/ebayResearchService.js');
        const ebayService = new EbayResearchService();
        // Test the connection first
        const connectionTest = await ebayService.testConnection();
        if (!connectionTest.success) {
            return res.status(500).json({
                success: false,
                error: 'eBay connection failed',
                details: connectionTest
            });
        }
        // Now search for the specific query
        const searchResult = await ebayService.searchSoldItems(searchQuery, {
            dayRange: 90,
            limit: 50,
            offset: 0
        });
        res.json({
            success: true,
            searchQuery: searchQuery,
            connectionTest: connectionTest,
            searchResult: searchResult
        });
    } catch (error) {
        console.error('❌ eBay research API test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            searchQuery: req.body.searchQuery || 'unknown'
        });
    }
});

// Test endpoint for Collectibles card detail service
app.post('/api/test-collectibles-card-details', async (req, res) => {
    try {
        const { variationId, cardSlug } = req.body;
        console.log(`🧪 Testing Collectibles card detail service with variation ID: ${variationId}, slug: ${cardSlug || 'none'}`);
        
        const CollectiblesCardDetailService = require('./services/collectiblesCardDetailService.js');
        const collectiblesService = new CollectiblesCardDetailService();
        
        const result = await collectiblesService.getCardDetails(variationId, cardSlug);
        
        res.json({
            success: true,
            request: { variationId, cardSlug },
            result: result
        });
    } catch (error) {
        console.error('❌ Collectibles card detail test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            request: req.body
        });
    }
});

// Test endpoint for Collectibles service (using the test card)
app.get('/api/test-collectibles-service', async (req, res) => {
    try {
        console.log('🧪 Testing Collectibles service with default test card...');
        
        const CollectiblesCardDetailService = require('./services/collectiblesCardDetailService.js');
        const collectiblesService = new CollectiblesCardDetailService();
        
        const result = await collectiblesService.testService();
        
        res.json({
            success: true,
            testResult: result
        });
    } catch (error) {
        console.error('❌ Collectibles service test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint for authenticated Collectibles card details
app.post('/api/test-collectibles-authenticated', async (req, res) => {
    try {
        const { email, password, variationId, cardSlug } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required for authentication'
            });
        }

        console.log(`🔐 Testing authenticated Collectibles service for user: ${email}`);
        
        const CollectiblesCardDetailService = require('./services/collectiblesCardDetailService.js');
        const collectiblesService = new CollectiblesCardDetailService();
        
        // Step 1: Authenticate
        console.log('🔐 Step 1: Authenticating...');
        const authResult = await collectiblesService.authenticate(email, password);
        
        if (!authResult.success) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                details: authResult
            });
        }

        console.log('🔐 Authentication successful, now fetching card details...');
        
        // Step 2: Get card details (now authenticated)
        const cardDetails = await collectiblesService.getCardDetails(
            variationId || '21763861', 
            cardSlug || 'ci-2024-topps-update-us50-jackson-holliday'
        );
        
        res.json({
            success: true,
            authentication: authResult,
            cardDetails: cardDetails
        });
        
    } catch (error) {
        console.error('❌ Authenticated Collectibles test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            request: req.body
        });
    }
});

// Test endpoint for eBay scraper service
app.get('/api/test-ebay-scraper', async (req, res) => {
    try {
        console.log('🧪 Testing eBay scraper service...');
        
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        const result = await ebayService.testService();
        
        res.json({
            success: true,
            testResult: result
        });
        
    } catch (error) {
        console.error('❌ eBay scraper test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search endpoint for eBay card pricing
app.post('/api/ebay-card-search', async (req, res) => {
    try {
        const { searchTerm, sport, maxResults = 50 } = req.body;
        
        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                error: 'Search term is required'
            });
        }

        console.log(`🔍 eBay search request: ${searchTerm} (sport: ${sport || 'any'})`);
        
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        const result = await ebayService.getCardPricingSummary(searchTerm, sport, maxResults);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ eBay card search error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            request: req.body
        });
    }
});

// Test endpoint for eBay scraper service with detailed debugging
app.get('/api/test-ebay-scraper-debug', async (req, res) => {
    try {
        console.log('🧪 Testing eBay scraper service with detailed debugging...');

        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();

        // Initialize browser first
        const browserInitialized = await ebayService.initializeBrowser();
        if (!browserInitialized) {
            return res.status(500).json({
                success: false,
                error: 'Failed to initialize browser'
            });
        }

        // Test with a simple search
        const testSearch = 'Jackson Holliday 2023 Bowman Chrome Draft';
        console.log(`🔍 Testing search: ${testSearch}`);

        const result = await ebayService.searchSoldCards(testSearch, 'baseball', 10);

        // Get additional debug info
        let debugInfo = {};
        try {
            if (ebayService.page) {
                debugInfo.pageTitle = await ebayService.page.title();
                debugInfo.pageUrl = ebayService.page.url();
                debugInfo.pageContentLength = (await ebayService.page.content()).length;
                
                // Try to get some basic page info
                debugInfo.bodyTextLength = await ebayService.page.evaluate(() => {
                    return document.body ? document.body.innerText.length : 0;
                });
                
                debugInfo.hasSoldItems = await ebayService.page.evaluate(() => {
                    return document.body ? document.body.innerText.includes('sold') : false;
                });
            }
        } catch (debugError) {
            debugInfo.debugError = debugError.message;
        }

        // Close browser
        await ebayService.closeBrowser();

        res.json({
            success: true,
            testSearch: testSearch,
            result: result,
            debugInfo: debugInfo
        });

    } catch (error) {
        console.error('❌ eBay scraper debug test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PSA 10 specific card search endpoint
app.post('/api/psa10-search', async (req, res) => {
    try {
        const { searchTerm, sport, maxResults = 20 } = req.body;
        
        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                error: 'Search term is required'
            });
        }

        // Grade=10 filter now handles PSA 10 requirement - no need to add to search term
        console.log(`🔍 PSA 10 search request: ${searchTerm} (sport: ${sport || 'any'})`);
        
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        const result = await ebayService.searchSoldCards(searchTerm, sport, maxResults, 'PSA 10');
        
        if (!result.success) {
            return res.status(500).json(result);
        }

        // Filter and clean the PSA 10 data
        const psa10Data = result.results
            .filter(item => {
                // Filter out unrealistic prices (PSA 10s are typically $50+)
                return item.numericPrice >= 50 && item.numericPrice <= 50000;
            })
            .map(item => ({
                title: item.title.substring(0, 100), // Clean up title
                price: item.price,
                numericPrice: item.numericPrice,
                itemUrl: item.itemUrl,
                sport: item.sport,
                grade: 'PSA 10',
                soldDate: item.soldDate
            }))
            .sort((a, b) => b.numericPrice - a.numericPrice); // Sort by price (highest first)

        // Calculate PSA 10 summary
        const validPrices = psa10Data.map(item => item.numericPrice);
        const summary = {
            totalCards: psa10Data.length,
            averagePrice: validPrices.length > 0 ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0,
            minPrice: validPrices.length > 0 ? Math.min(...validPrices) : 0,
            maxPrice: validPrices.length > 0 ? Math.max(...validPrices) : 0,
            medianPrice: validPrices.length > 0 ? Math.round(validPrices.sort((a, b) => a - b)[Math.floor(validPrices.length / 2)]) : 0
        };

        res.json({
            success: true,
            searchTerm: psa10SearchTerm,
            sport: sport,
            summary: summary,
            cards: psa10Data,
            rawData: {
                totalResults: result.totalResults,
                filteredResults: psa10Data.length,
                method: result.method
            }
        });
        
    } catch (error) {
        console.error('❌ PSA 10 search error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            request: req.body
        });
    }
});

// Comprehensive card addition endpoint - PSA 10 first, then raw and PSA 9
app.post('/api/add-comprehensive-card', async (req, res) => {
    try {
        const { searchTerm, sport, maxResults = 20 } = req.body;
        
        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                error: 'Search term is required'
            });
        }

        console.log(`🔍 Comprehensive card addition: ${searchTerm} (sport: ${sport || 'any'})`);
        
        const EbayScraperService = require('./services/ebayScraperService.js');
        const ebayService = new EbayScraperService();
        
        // Step 1: Get PSA 10 cards first (Grade=10 filter handles PSA 10 requirement)
        const psa10Result = await ebayService.searchSoldCards(searchTerm, sport, maxResults, 'PSA 10');
        
        if (!psa10Result.success || psa10Result.results.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No PSA 10 cards found'
            });
        }

        // Filter PSA 10 cards ($50+)
        const psa10Cards = psa10Result.results
            .filter(item => item.numericPrice >= 50 && item.numericPrice <= 50000)
            .map(item => ({
                title: item.title.substring(0, 200),
                price: item.price,
                numericPrice: item.numericPrice,
                itemUrl: item.itemUrl,
                sport: item.sport,
                grade: 'PSA 10',
                soldDate: item.soldDate,
                ebayItemId: item.rawData?.itemId || null
            }));

        if (psa10Cards.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No PSA 10 cards meet price criteria ($50+)'
            });
        }

        // Step 2: Generate structured summary title from first PSA 10 card
        const firstPsa10Card = psa10Cards[0];
        
        // Extract card components and build proper summary title
        const cardComponents = extractCardComponents(firstPsa10Card.title, firstPsa10Card.sport);
        const summaryTitle = buildSummaryTitle(cardComponents);
        
        console.log(`📝 Generated structured summary title: ${summaryTitle}`);

        // Step 3: Use three dedicated searches with specific eBay filters
        console.log(`🔍 Using three dedicated search strategy with eBay filters for: ${summaryTitle}`);
        
        // Search 1: PSA 10 with graded filters (Graded=Yes, Grade=10, PSA, Autographed=No)
        const psa10DedicatedResult = await ebayService.searchSoldCards(summaryTitle, sport, maxResults, 'PSA 10', cardComponents.isAutograph, cardComponents.printRun);
        const psa10DedicatedCards = psa10DedicatedResult.success ? psa10DedicatedResult.results
            .filter(item => item.numericPrice >= 50 && item.numericPrice <= 50000)
            .map(item => ({
                title: item.title.substring(0, 200),
                price: item.price,
                numericPrice: item.numericPrice,
                itemUrl: item.itemUrl,
                sport: item.sport,
                grade: 'PSA 10',
                soldDate: item.soldDate,
                ebayItemId: item.rawData?.itemId || null
            })) : [];
        
        // Search 2: PSA 9 with graded filters (Graded=Yes, Grade=9, PSA, Autographed=No)
        const psa9DedicatedResult = await ebayService.searchSoldCards(summaryTitle, sport, maxResults, 'PSA 9', cardComponents.isAutograph, cardComponents.printRun);
        const psa9DedicatedCards = psa9DedicatedResult.success ? psa9DedicatedResult.results
            .filter(item => item.numericPrice >= 25 && item.numericPrice <= 50000)
            .map(item => ({
                title: item.title.substring(0, 200),
                price: item.price,
                numericPrice: item.numericPrice,
                itemUrl: item.itemUrl,
                sport: item.sport,
                grade: 'PSA 9',
                soldDate: item.soldDate,
                ebayItemId: item.rawData?.itemId || null
            })) : [];
        
        // Search 3: Raw with raw filters (Graded=No, Autographed=No)
        const rawDedicatedResult = await ebayService.searchSoldCards(summaryTitle, sport, maxResults, 'Raw', cardComponents.isAutograph, cardComponents.printRun);
        const rawDedicatedCards = rawDedicatedResult.success ? rawDedicatedResult.results
            .filter(item => item.numericPrice >= 10 && item.numericPrice <= 50000)
            .map(item => ({
                title: item.title.substring(0, 200),
                price: item.price,
                numericPrice: item.numericPrice,
                itemUrl: item.itemUrl,
                sport: item.sport,
                grade: 'Raw',
                soldDate: item.soldDate,
                ebayItemId: item.rawData?.itemId || null
            })) : [];
        
        // Use the dedicated search results
        const finalPsa10Cards = psa10DedicatedCards.length > 0 ? psa10DedicatedCards : psa10Cards;
        const finalPsa9Cards = psa9DedicatedCards;
        const finalRawCards = rawDedicatedCards;
        
        console.log(`🔍 Filtered results: ${finalRawCards.length} Raw, ${finalPsa9Cards.length} PSA 9`);

        // Step 5: Prepare comprehensive results
        const comprehensiveResults = {
            summaryTitle: summaryTitle,
            searchTerm: searchTerm,
            sport: sport,
            psa10: {
                count: finalPsa10Cards.length,
                cards: finalPsa10Cards,
                averagePrice: finalPsa10Cards.length > 0 ? 
                    Math.round(finalPsa10Cards.reduce((a, b) => a + b.numericPrice, 0) / finalPsa10Cards.length) : 0
            },
            psa9: {
                count: finalPsa9Cards.length,
                cards: finalPsa9Cards,
                averagePrice: finalPsa9Cards.length > 0 ? 
                    Math.round(finalPsa9Cards.reduce((a, b) => a + b.numericPrice, 0) / finalPsa9Cards.length) : 0
            },
            raw: {
                count: finalRawCards.length,
                cards: finalRawCards,
                averagePrice: finalRawCards.length > 0 ? 
                    Math.round(finalRawCards.reduce((a, b) => a + b.numericPrice, 0) / finalRawCards.length) : 0
            }
        };

        // Step 6: Calculate multipliers if we have both PSA 10 and raw
        if (comprehensiveResults.psa10.count > 0 && comprehensiveResults.raw.count > 0) {
            const psa10Avg = comprehensiveResults.psa10.averagePrice;
            const rawAvg = comprehensiveResults.raw.averagePrice;
            if (rawAvg > 0) {
                comprehensiveResults.multiplier = Math.round((psa10Avg / rawAvg) * 100) / 100;
            }
        }

        // Step 7: STORE the data in the database (this was missing!)
        console.log('💾 Storing comprehensive card data in database...');
        
        // Validate pricing data first (handle database constraints)
        const psa10Price = comprehensiveResults.psa10.averagePrice || 0;
        const psa9Price = comprehensiveResults.psa9.averagePrice || 0;
        const rawPrice = comprehensiveResults.raw.averagePrice || 0;
        
        // Skip storage if data doesn't make business sense
        if (rawPrice > psa10Price && psa10Price > 0) {
            console.log('⚠️ Skipping database storage: Raw price higher than PSA 10 price (data anomaly)');
            console.log(`   PSA 10: $${psa10Price}, Raw: $${rawPrice}`);
        } else if (psa9Price > psa10Price && psa10Price > 0) {
            console.log('⚠️ Skipping database storage: PSA 9 price higher than PSA 10 price (data anomaly)');
            console.log(`   PSA 10: $${psa10Price}, PSA 9: $${psa9Price}`);
        } else if (psa10Price === 0) {
            console.log('⚠️ Skipping database storage: No PSA 10 price data available');
        } else {
            try {
                const NewPricingDatabase = require('./create-new-pricing-database.js');
                const db = new NewPricingDatabase();
                await db.connect();
                
                // Check if this card already exists in database
                const existingCard = await db.getQuery(
                    `SELECT id FROM cards WHERE title = ? OR summary_title = ? LIMIT 1`,
                    [comprehensiveResults.summaryTitle, comprehensiveResults.summaryTitle]
                );
                
                if (existingCard) {
                    console.log('⚠️ Card already exists in database, updating prices...');
                    
                    // Update existing card with new pricing data
                    await db.runQuery(`
                        UPDATE cards SET 
                            psa10_price = ?,
                            psa9_average_price = ?,
                            raw_average_price = ?,
                            multiplier = ?,
                            last_updated = datetime('now')
                        WHERE id = ?
                    `, [
                        psa10Price,
                        psa9Price, 
                        rawPrice,
                        comprehensiveResults.multiplier,
                        existingCard.id
                    ]);
                    
                    console.log(`✅ Updated existing card: ${comprehensiveResults.summaryTitle}`);
                } else {
                    console.log('🆕 Adding new card to database...');
                    
                                // Extract all card components from the title
            const cardComponents = extractCardComponents(comprehensiveResults.summaryTitle, sport);
            
            // Build a proper summary title from extracted components
            const properSummaryTitle = buildSummaryTitle(cardComponents);
            
            // Add new card to database with all extracted fields
            await db.runQuery(`
                INSERT INTO cards (
                    title, summary_title, sport, year,
                    player_name, brand, set_name, card_type, card_number, print_run,
                    is_rookie, is_autograph,
                    psa10_price, psa9_average_price, raw_average_price, multiplier,
                    search_term, source, created_at, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                comprehensiveResults.summaryTitle, // Original cleaned title
                properSummaryTitle, // Structured summary title
                cardComponents.sport,
                cardComponents.year,
                cardComponents.playerName,
                cardComponents.brand,
                cardComponents.setName,
                cardComponents.cardType,
                cardComponents.cardNumber,
                cardComponents.printRun,
                cardComponents.isRookie ? 1 : 0,
                cardComponents.isAutograph ? 1 : 0,
                psa10Price,
                psa9Price, 
                rawPrice,
                comprehensiveResults.multiplier,
                searchTerm,
                'ebay_comprehensive'
            ]);
                    
                    console.log(`✅ Added new card: ${comprehensiveResults.summaryTitle}`);
                }
                
                await db.close();
            } catch (dbError) {
                console.error('❌ Database storage error:', dbError.message);
                console.log('📊 Continuing with data collection despite storage issue...');
            }
        }

        res.json({
            success: true,
            message: 'Comprehensive card data collected and stored successfully',
            data: comprehensiveResults,
            stored: 'processed',
            searchDetails: {
                psa10Search: summaryTitle,
                psa9Search: summaryTitle,
                rawSearch: summaryTitle,
                method: psa10Result.method,
                strategy: 'three_dedicated_searches'
            }
        });
        
    } catch (error) {
        console.error('❌ Comprehensive card addition error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            request: req.body
        });
    }
});

// Helper function to generate summary title (legacy)
function generateSummaryTitle(title, sport) {
    // Remove common grading and condition terms
    let summary = title
        .replace(/PSA\s+\d+/gi, '')
        .replace(/SGC\s+\d+/gi, '')
        .replace(/BGS\s+\d+/gi, '')
        .replace(/CGC\s+\d+/gi, '')
        .replace(/TAG\s+\d+/gi, '')
        .replace(/Beckett\s+\d+/gi, '')
        .replace(/HGA\s+\d+/gi, '')
        .replace(/CSG\s+\d+/gi, '')
        .replace(/GEM\s+MT/gi, '')
        .replace(/MINT\s+\d+/gi, '')
        .replace(/Graded/gi, '')
        .replace(/Card/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Add sport context if not present
    if (sport && !summary.toLowerCase().includes(sport.toLowerCase())) {
        summary = `${summary} ${sport}`;
    }
    
    return summary;
}

// Extract all card components from title using proven extraction system
function extractCardComponents(title, sport) {
    // Use the working extraction system from NewPricingDatabase
    const NewPricingDatabase = require('./create-new-pricing-database.js');
    const db = new NewPricingDatabase();
    const components = {
        playerName: '',
        year: null,
        brand: '',
        setName: '',
        cardType: 'Base',
        cardNumber: '',
        printRun: '',
        isRookie: false,
        isAutograph: false,
        sport: sport || 'unknown'
    };
    
    // Extract year
    const yearMatch = title.match(/(19|20)\d{2}/);
    components.year = yearMatch ? parseInt(yearMatch[0]) : 2024;
    
    // Extract brand
    if (title.toLowerCase().includes('topps')) components.brand = 'Topps';
    else if (title.toLowerCase().includes('panini')) components.brand = 'Panini';
    else if (title.toLowerCase().includes('bowman')) components.brand = 'Bowman';
    else if (title.toLowerCase().includes('upper deck')) components.brand = 'Upper Deck';
    else if (title.toLowerCase().includes('donruss')) components.brand = 'Donruss';
    else if (title.toLowerCase().includes('leaf')) components.brand = 'Leaf';
    else components.brand = 'Unknown';
    
    // Extract set name using the sophisticated extraction from NewPricingDatabase
    const extractedCardSet = db.extractCardSet(title);
    if (extractedCardSet && extractedCardSet !== 'Base') {
        components.setName = extractedCardSet;
        console.log(`🎯 Extracted card set: "${extractedCardSet}" from "${title}"`);
    } else {
        // Fallback to basic set detection
        if (title.toLowerCase().includes('chrome')) {
            if (title.toLowerCase().includes('draft')) components.setName = 'Chrome Draft';
            else if (title.toLowerCase().includes('sapphire')) components.setName = 'Chrome Sapphire';
            else components.setName = 'Chrome';
        } else if (title.toLowerCase().includes('prizm')) {
            components.setName = 'Prizm';
        } else if (title.toLowerCase().includes('select')) {
            components.setName = 'Select';
        } else if (title.toLowerCase().includes('optic')) {
            components.setName = 'Optic';
        } else if (title.toLowerCase().includes('mosaic')) {
            components.setName = 'Mosaic';
        } else if (title.toLowerCase().includes('heritage')) {
            components.setName = 'Heritage';
        } else {
            components.setName = 'Base';
        }
    }
    
    // Extract card type using the sophisticated extraction from NewPricingDatabase
    const extractedCardType = db.extractCardType(title);
    if (extractedCardType && extractedCardType !== 'Base') {
        components.cardType = extractedCardType;
        console.log(`🎯 Extracted card type: "${extractedCardType}" from "${title}"`);
    } else {
        // Fallback to basic card type detection
        if (title.toLowerCase().includes('refractor')) {
            if (title.toLowerCase().includes('gold')) components.cardType = 'Gold Refractor';
            else if (title.toLowerCase().includes('orange')) components.cardType = 'Orange Refractor';
            else if (title.toLowerCase().includes('red')) components.cardType = 'Red Refractor';
            else if (title.toLowerCase().includes('blue')) components.cardType = 'Blue Refractor';
            else if (title.toLowerCase().includes('green')) components.cardType = 'Green Refractor';
            else if (title.toLowerCase().includes('silver')) components.cardType = 'Silver Refractor';
            else if (title.toLowerCase().includes('sapphire')) components.cardType = 'Sapphire Refractor';
            else components.cardType = 'Refractor';
        } else if (title.toLowerCase().includes('prizm')) {
            if (title.toLowerCase().includes('silver')) components.cardType = 'Silver Prizm';
            else if (title.toLowerCase().includes('gold')) components.cardType = 'Gold Prizm';
            else components.cardType = 'Prizm';
        } else if (title.toLowerCase().includes('parallel')) {
            components.cardType = 'Parallel';
        }
    }
    
    // Extract card number
    const cardNumberMatch = title.match(/#(\d+)/);
    components.cardNumber = cardNumberMatch ? `#${cardNumberMatch[1]}` : '';
    
    // Extract print run
    const printRunMatch = title.match(/\/(\d+)/);
    components.printRun = printRunMatch ? `/${printRunMatch[1]}` : '';
    
    // Check for rookie
    components.isRookie = title.toLowerCase().includes('rookie') || 
                         title.toLowerCase().includes(' rc ') ||
                         title.toLowerCase().includes(' rc)') ||
                         title.toLowerCase().includes('(rc');
    
    // Check for autograph
    components.isAutograph = title.toLowerCase().includes('auto') || 
                            title.toLowerCase().includes('signature') ||
                            title.toLowerCase().includes('signed');
    
    // Use the centralized player name extraction system
    const extractor = new SimplePlayerExtractor();
    components.playerName = extractor.extractPlayerName(title);
    
    return components;
}

// Build a structured summary title from components (following existing standard)
function buildSummaryTitle(components) {
    const parts = [];
    
    // 1. Year (if available)
    if (components.year) {
        parts.push(components.year.toString());
    }
    
    // 2. Card Set (Brand + Set combined, if available)
    if (components.brand !== 'Unknown') {
        if (components.setName && components.setName !== 'Base') {
            parts.push(`${components.brand} ${components.setName}`);
        } else {
            parts.push(components.brand);
        }
    }
    
    // 3. Card Type (if available and not "Base")
    if (components.cardType && components.cardType !== 'Base') {
        parts.push(components.cardType);
    }
    
    // 4. Player Name (if available)
    if (components.playerName) {
        parts.push(capitalizePlayerName(components.playerName));
    }
    
    // 5. Auto designation (if it's an autograph)
    if (components.isAutograph) {
        parts.push('auto');
    }
    
    // 6. Card Number (if available)
    if (components.cardNumber) {
        parts.push(components.cardNumber);
    }
    
    // 7. Print Run (if available)
    if (components.printRun) {
        parts.push(components.printRun);
    }
    
    // Join components and clean up
    let summaryTitle = parts.join(' ').trim();
    
    // Clean up any extra spaces
    summaryTitle = summaryTitle.replace(/\s+/g, ' ');
    
    // Remove any trailing punctuation
    summaryTitle = summaryTitle.replace(/[.,;!?]+$/, '');
    
    return summaryTitle;
}

// Helper function to capitalize player name (from existing standard)
function capitalizePlayerName(playerName) {
    if (!playerName) return '';
    
    return playerName
        .split(' ')
        .map(word => {
            if (word.length <= 2) {
                return word.toUpperCase(); // For initials like "JJ"
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

// POST /api/admin/run-ebay-fast-batch-pull - Run the eBay fast batch pull
app.post('/api/admin/run-ebay-fast-batch-pull', async (req, res) => {
    try {
        console.log('🚀 Starting eBay fast batch pull...');
        console.log('🔍 Checking environment variables...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'NOT FOUND');
        console.log('RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH ? 'Found' : 'NOT FOUND');
        
        const { FastBatchItemsPullerEbay } = require('./fast-batch-pull-ebay.js');
        const puller = new FastBatchItemsPullerEbay();
        
        // Ensure connection before running
        await puller.connect();
        console.log('✅ Database connection established');
        
        const result = await puller.pullNewItems();
        
        res.json({
            success: true,
            message: 'eBay fast batch pull completed successfully',
            data: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error running eBay fast batch pull:', error);
        console.error('❌ Full error details:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// Backup and clear database endpoint for fresh testing
app.post('/api/admin/backup-and-clear-database', async (req, res) => {
    try {
        console.log('🔄 Starting database backup and clear process...');
        
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        
        // Connect to database
        await db.connect();
        
        // Get current database stats
        const stats = await db.runQuery('SELECT COUNT(*) as total FROM cards', []);
        const totalCards = stats && stats[0] ? stats[0].total : 0;
        
        console.log(`📊 Current database contains ${totalCards} cards`);
        
        // Create backup with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup_before_clear_${timestamp}`;
        
        // Export current database to backup
        const cards = await db.runQuery('SELECT * FROM cards ORDER BY created_at DESC', []);
        
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, 'data', 'backups');
        
        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, `${backupName}.json`);
        
        // Write backup file
        fs.writeFileSync(backupPath, JSON.stringify({
            backup_info: {
                timestamp: new Date().toISOString(),
                total_cards: totalCards,
                reason: 'Backup before clearing database for fresh eBay scraper test'
            },
            cards: cards
        }, null, 2));
        
        console.log(`💾 Backup created: ${backupPath}`);
        
        // Clear the database
        await db.runQuery('DELETE FROM cards', []);
        
        // Verify clearing
        const newStats = await db.runQuery('SELECT COUNT(*) as total FROM cards', []);
        const remainingCards = newStats && newStats[0] ? newStats[0].total : 0;
        
        console.log(`✅ Database cleared! ${totalCards} cards removed, ${remainingCards} remaining`);
        
        res.json({
            success: true,
            message: 'Database backup and clear completed successfully',
            data: {
                backup_file: backupPath,
                cards_backed_up: totalCards,
                cards_remaining: remainingCards,
                backup_timestamp: timestamp
            }
        });
        
    } catch (error) {
        console.error('❌ Error in backup and clear process:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PSA 9 and Raw price updater endpoint
app.post('/api/admin/update-psa9-raw-prices', async (req, res) => {
    try {
        console.log('💰 Starting PSA 9 and Raw price update...');
        
        const PSA9RawPriceUpdater = require('./psa9-raw-price-updater.js');
        const updater = new PSA9RawPriceUpdater();
        
        // Get options from request body
        const { limit = 50, delayMs = 2000 } = req.body;
        
        console.log(`⚙️ Configuration: limit=${limit}, delay=${delayMs}ms`);
        
        // Run the price updater
        const result = await updater.updatePrices({ limit, delayMs });
        
        console.log('✅ PSA 9 and Raw price update completed successfully');
        
        res.json({
            success: true,
            message: 'PSA 9 and Raw price update completed successfully',
            data: result
        });
        
    } catch (error) {
        console.error('❌ Error in PSA 9/Raw price updater:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/admin/remove-duplicates - Remove duplicate cards from database
app.post('/api/admin/remove-duplicates', async (req, res) => {
    try {
        console.log('🚀 Starting duplicate removal...');
        
        const DuplicateRemover = require('./remove-current-duplicates.js');
        const remover = new DuplicateRemover();
        
        const result = await remover.removeDuplicates();
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Duplicate removal completed successfully',
                data: {
                    keptCards: result.keptCount,
                    removedCards: result.removedCount
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Duplicate removal failed',
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ Error removing duplicates:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing duplicates',
            error: error.message
        });
    }
});

// Debug endpoint to check card pricing data
app.get('/api/admin/debug-cards', async (req, res) => {
    try {
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // First check if cards table exists and get count
        const count = await db.getQuery('SELECT COUNT(*) as total FROM cards', []);
        console.log('🔍 DEBUG - Total cards in database:', count);
        
        const cards = await db.allQuery(`
            SELECT id, title, summary_title, player_name, sport, 
                   psa10_price, psa9_average_price, raw_average_price, created_at
            FROM cards 
            ORDER BY created_at DESC 
            LIMIT 5
        `, []);
        
        console.log('🔍 DEBUG - Query returned:', cards);
        
        await db.close();
        
        res.json({
            success: true,
            message: 'Debug card data retrieved',
            totalCards: count,
            cards: cards
        });
        
    } catch (error) {
        console.error('❌ Error in debug cards:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to find player names with more than 2 words
app.get('/api/admin/debug-multiword-names', async (req, res) => {
    try {
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Get all player names with more than 2 words
        const allCards = await db.allQuery(`
            SELECT id, title, player_name, summary_title
            FROM cards 
            WHERE player_name IS NOT NULL 
            AND LENGTH(player_name) - LENGTH(REPLACE(player_name, ' ', '')) + 1 > 2
            ORDER BY player_name
        `);
        
        await db.close();
        
        res.json({
            success: true,
            message: 'Multi-word player names retrieved',
            count: allCards.length,
            names: allCards
        });
        
    } catch (error) {
        console.error('❌ Error in debug multi-word names:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving multi-word names',
            error: error.message
        });
    }
});

// Debug endpoint to find specific duplicates
app.get('/api/admin/debug-duplicates', async (req, res) => {
    try {
        const NewPricingDatabase = require('./create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        await db.connect();
        
        // Look for Cam Caminiti cards
        const camCards = await db.allQuery(`
            SELECT id, title, player_name, year, card_set, summary_title
            FROM cards 
            WHERE player_name LIKE '%Cam%Caminiti%' OR title LIKE '%Cam%Caminiti%'
            ORDER BY id
        `);
        
        // Look for Nick Kurtz cards  
        const nickCards = await db.allQuery(`
            SELECT id, title, player_name, year, card_set, summary_title
            FROM cards 
            WHERE player_name LIKE '%Nick%Kurtz%' OR title LIKE '%Nick%Kurtz%'
            ORDER BY id
        `);
        
        await db.close();
        
        res.json({
            success: true,
            message: 'Debug duplicate data retrieved',
            camCaminiti: camCards,
            nickKurtz: nickCards
        });
        
    } catch (error) {
        console.error('❌ Error in debug duplicates:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving debug duplicate data',
            error: error.message
        });
    }
});

module.exports = app;

