const RailwayParallelsDatabase = require('./railway-parallels-db.js');
const express = require('express');
const router = express.Router();

// Initialize the parallels database on Railway
router.post('/initialize', async (req, res) => {
    try {
        console.log('🚀 Initializing Railway parallels database...');
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.initializeDatabase();
        
        res.json({
            success: true,
            message: 'Railway parallels database initialized successfully'
        });
    } catch (error) {
        console.error('❌ Error initializing Railway parallels database:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all card sets with parallel counts
router.get('/card-sets', async (req, res) => {
    try {
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        const cardSets = await parallelsDb.getAllCardSets();
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: cardSets
        });
    } catch (error) {
        console.error('❌ Error getting card sets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get parallels for a specific card set
router.get('/parallels/:setName', async (req, res) => {
    try {
        const { setName } = req.params;
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        const parallels = await parallelsDb.getParallelsForSet(setName);
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: parallels
        });
    } catch (error) {
        console.error('❌ Error getting parallels:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add a new card set
router.post('/card-sets', async (req, res) => {
    try {
        const { setName, sport, year, brand } = req.body;
        
        if (!setName) {
            return res.status(400).json({
                success: false,
                error: 'setName is required'
            });
        }
        
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        const setId = await parallelsDb.addCardSet(setName, sport, year, brand);
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: { id: setId, setName, sport, year, brand }
        });
    } catch (error) {
        console.error('❌ Error adding card set:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add a new parallel to a card set
router.post('/parallels', async (req, res) => {
    try {
        const { setName, parallelName, parallelType, rarity, printRun } = req.body;
        
        if (!setName || !parallelName) {
            return res.status(400).json({
                success: false,
                error: 'setName and parallelName are required'
            });
        }
        
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        const parallelId = await parallelsDb.addParallel(setName, parallelName, parallelType, rarity, printRun);
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: { id: parallelId, setName, parallelName, parallelType, rarity, printRun }
        });
    } catch (error) {
        console.error('❌ Error adding parallel:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search parallels
router.get('/search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        const results = await parallelsDb.searchParallels(searchTerm);
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('❌ Error searching parallels:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test database connection
router.get('/test-connection', async (req, res) => {
    try {
        const { testRailwayConnection } = require('./test-railway-db-connection.js');
        await testRailwayConnection();
        
        res.json({
            success: true,
            message: 'Database connection test completed'
        });
    } catch (error) {
        console.error('❌ Error testing database connection:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to test getAllCardSets directly
router.get('/debug-card-sets', async (req, res) => {
    try {
        const parallelsDb = new RailwayParallelsDatabase();
        await parallelsDb.connectDatabase();
        
        console.log('🔍 Testing getAllCardSets method...');
        const cardSets = await parallelsDb.getAllCardSets();
        console.log('✅ getAllCardSets result:', cardSets);
        
        await parallelsDb.closeDatabase();
        
        res.json({
            success: true,
            data: cardSets,
            count: cardSets.length
        });
    } catch (error) {
        console.error('❌ Error in debug-card-sets:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Simple test endpoint to check database connection directly
router.get('/simple-test', async (req, res) => {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        console.log('🔍 Simple test - DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'NOT FOUND');
        
        const client = await pool.connect();
        console.log('✅ Simple test - Connected to database');
        
        const result = await client.query('SELECT COUNT(*) as count FROM card_sets');
        console.log('✅ Simple test - Query result:', result.rows[0]);
        
        client.release();
        await pool.end();
        
        res.json({
            success: true,
            message: 'Simple test completed',
            cardSetsCount: result.rows[0].count
        });
    } catch (error) {
        console.error('❌ Error in simple-test:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Debug environment variables
router.get('/debug-env', async (req, res) => {
    try {
        require('./debug-env.js');
        
        res.json({
            success: true,
            message: 'Environment variables debug completed - check logs'
        });
    } catch (error) {
        console.error('❌ Error in debug-env:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add migration endpoint
router.post('/migrate-from-newpricing', async (req, res) => {
    try {
        console.log('🚀 Starting migration from NewPricingDatabase to parallels database...');
        
        const { NewPricingToParallelsMigration } = require('./migrate-newpricing-to-parallels');
        const migration = new NewPricingToParallelsMigration();
        
        await migration.migrateData();
        
        // Get final stats
        const stats = await migration.getMigrationStats();
        
        res.json({
            success: true,
            message: 'Migration completed successfully',
            stats: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add Beckett scraping endpoint
router.post('/scrape-beckett-parallels', async (req, res) => {
    try {
        console.log('🚀 Starting Beckett parallels scraping...');
        
        const { BeckettParallelsScraper } = require('./beckett-parallels-scraper');
        const scraper = new BeckettParallelsScraper();
        
        await scraper.initialize();
        await scraper.scrapeAllCardSets();
        await scraper.close();
        
        res.json({
            success: true,
            message: 'Beckett parallels scraping completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Beckett scraping failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add card set name fixing endpoint
router.post('/fix-card-set-names', async (req, res) => {
    try {
        console.log('🚀 Starting card set name fixing...');
        
        const { CardSetNameFixer } = require('./fix-card-set-names');
        const fixer = new CardSetNameFixer();
        
        await fixer.initialize();
        await fixer.fixAllCardSetNames();
        await fixer.close();
        
        res.json({
            success: true,
            message: 'Card set names fixed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Card set name fixing failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add unknown brand cleanup endpoint
router.post('/cleanup-unknown-brands', async (req, res) => {
    try {
        console.log('🚀 Starting unknown brand cleanup...');
        
        const { UnknownBrandCleanup } = require('./cleanup-unknown-brands');
        const cleanup = new UnknownBrandCleanup();
        
        await cleanup.initialize();
        await cleanup.cleanupUnknownBrands();
        await cleanup.close();
        
        res.json({
            success: true,
            message: 'Unknown brand cleanup completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Unknown brand cleanup failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Add comprehensive cleanup endpoint
router.post('/comprehensive-cleanup', async (req, res) => {
    try {
        console.log('🚀 Starting comprehensive cleanup...');
        
        const { ComprehensiveCleanup } = require('./comprehensive-cleanup');
        const cleanup = new ComprehensiveCleanup();
        
        await cleanup.initialize();
        await cleanup.comprehensiveCleanup();
        await cleanup.close();
        
        res.json({
            success: true,
            message: 'Comprehensive cleanup completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Comprehensive cleanup failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
