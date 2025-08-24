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

module.exports = router;
