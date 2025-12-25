const express = require('express');
const router = express.Router();

// Health check endpoint to verify route is loaded
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'Releases API is working' });
});

const releaseDatabaseService = require('../services/releaseDatabaseService');
const releaseInfoService = require('../services/releaseInfoService');
const bleacherSeatsScraper = require('../services/bleacherSeatsScraperService');
const releaseScheduledJobs = require('../services/releaseScheduledJobs');

// Middleware to check if user is authenticated admin (placeholder - implement based on your auth system)
const isAdmin = (req, res, next) => {
    // TODO: Implement actual admin check based on your authentication system
    // For now, allow if there's a user in the session
    if (req.user && req.user.email) {
        // You can add admin email check here
        return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
};

// GET /api/releases - Get all releases with optional filters
router.get('/', async (req, res) => {
    try {
        // If tables don't exist yet, return empty array instead of error
        try {
            const filters = {};
            
            if (req.query.sport) filters.sport = req.query.sport;
            if (req.query.year) filters.year = req.query.year;
            if (req.query.status) filters.status = req.query.status;
            if (req.query.startDate) filters.startDate = req.query.startDate;
            if (req.query.endDate) filters.endDate = req.query.endDate;

            const releases = await releaseDatabaseService.getAllReleases(filters);
            
            res.json({
                success: true,
                count: releases.length,
                releases
            });
        } catch (dbError) {
            // If it's a "relation does not exist" error, tables haven't been created yet
            if (dbError.message && dbError.message.includes('does not exist')) {
                return res.json({
                    success: true,
                    count: 0,
                    releases: [],
                    message: 'Database tables not initialized yet. Call POST /api/releases/init first.'
                });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('❌ Error getting releases:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch releases',
            message: error.message
        });
    }
});

// GET /api/releases/:id - Get single release by ID
router.get('/:id', async (req, res) => {
    try {
        const release = await releaseDatabaseService.getReleaseById(parseInt(req.params.id));
        
        if (!release) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }

        res.json({
            success: true,
            release
        });
    } catch (error) {
        console.error('❌ Error getting release:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch release',
            message: error.message
        });
    }
});

// POST /api/releases - Add new release (requires authentication)
router.post('/', isAdmin, async (req, res) => {
    try {
        const { title, brand, sport, releaseDate, year, description, retailPrice, hobbyPrice, status } = req.body;

        if (!title || !releaseDate) {
            return res.status(400).json({
                success: false,
                error: 'Title and releaseDate are required'
            });
        }

        const release = await releaseDatabaseService.addRelease({
            title,
            brand,
            sport,
            releaseDate,
            year,
            description,
            retailPrice: retailPrice || 'TBD',
            hobbyPrice: hobbyPrice || 'TBD',
            source: 'Manual',
            status: status || 'Announced',
            createdBy: req.user?.email || req.user?.name || 'API'
        });

        if (!release) {
            return res.status(409).json({
                success: false,
                error: 'Release already exists'
            });
        }

        // Clear cache
        await releaseInfoService.clearCache();

        res.status(201).json({
            success: true,
            release
        });
    } catch (error) {
        console.error('❌ Error adding release:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add release',
            message: error.message
        });
    }
});

// PUT /api/releases/:id - Update existing release (requires authentication)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const release = await releaseDatabaseService.updateRelease(parseInt(req.params.id), req.body);

        if (!release) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }

        // Clear cache
        await releaseInfoService.clearCache();

        res.json({
            success: true,
            release
        });
    } catch (error) {
        console.error('❌ Error updating release:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update release',
            message: error.message
        });
    }
});

// DELETE /api/releases/:id - Soft delete release (requires authentication)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const deleted = await releaseDatabaseService.deleteRelease(parseInt(req.params.id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }

        // Clear cache
        await releaseInfoService.clearCache();

        res.json({
            success: true,
            message: 'Release deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting release:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to delete release',
            message: error.message
        });
    }
});

// GET /api/releases/test-db - Test database connection
router.get('/test-db', async (req, res) => {
    try {
        const hasDbUrl = !!process.env.DATABASE_URL;
        let connectionTest = false;
        let errorMessage = null;

        if (hasDbUrl) {
            try {
                await releaseDatabaseService.connectDatabase();
                connectionTest = true;
            } catch (dbError) {
                errorMessage = dbError.message;
            }
        }

        res.json({
            success: true,
            hasDatabaseUrl: hasDbUrl,
            connectionTest: connectionTest,
            error: errorMessage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/releases/init - Initialize database tables (one-time setup, no auth required for convenience)
router.post('/init', async (req, res) => {
    try {
        console.log('🔄 Initializing release database tables...');
        console.log('🔍 DATABASE_URL check:', process.env.DATABASE_URL ? 'Found' : 'NOT FOUND');
        
        // Check if DATABASE_URL is set
        if (!process.env.DATABASE_URL) {
            return res.status(500).json({
                success: false,
                error: 'DATABASE_URL environment variable not set',
                message: 'Please configure DATABASE_URL in Railway environment variables'
            });
        }
        
        await releaseDatabaseService.createTables();
        
        res.json({
            success: true,
            message: 'Database tables initialized successfully'
        });
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        // Ensure we always return JSON, even if there's an error
        try {
            res.status(500).json({
                success: false,
                error: 'Failed to initialize database',
                message: error.message,
                code: error.code,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } catch (sendError) {
            // If we can't send JSON, at least log it
            console.error('❌ Failed to send error response:', sendError.message);
        }
    }
});

// POST /api/releases/migrate - One-time migration endpoint (temporarily no auth for initial setup)
router.post('/migrate', async (req, res) => {
    try {
        const { migrateReleases } = require('../scripts/migrate-releases-to-database');
        await migrateReleases();

        // Clear cache
        await releaseInfoService.clearCache();

        res.json({
            success: true,
            message: 'Migration completed successfully'
        });
    } catch (error) {
        console.error('❌ Error running migration:', error.message);
        res.status(500).json({
            success: false,
            error: 'Migration failed',
            message: error.message
        });
    }
});

// POST /api/releases/sync - Manually trigger sync with Bleacher Seats scraper (requires authentication)
router.post('/sync', isAdmin, async (req, res) => {
    try {
        console.log('🔄 Manual sync triggered...');
        
        // Get scraped releases
        const scrapedReleases = await bleacherSeatsScraper.getLatestReleases();
        console.log(`✅ Scraped ${scrapedReleases.length} releases from Bleacher Seats`);

        // Sync to database
        const result = await releaseDatabaseService.syncScrapedReleases(scrapedReleases);

        // Update statuses
        await releaseDatabaseService.updateStatuses();

        // Clear cache
        await releaseInfoService.clearCache();

        res.json({
            success: true,
            message: 'Sync completed successfully',
            added: result.added,
            skipped: result.skipped
        });
    } catch (error) {
        console.error('❌ Error syncing releases:', error.message);
        res.status(500).json({
            success: false,
            error: 'Sync failed',
            message: error.message
        });
    }
});

// GET /api/releases/upcoming - Get upcoming releases (next 30 days)
router.get('/upcoming', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const releases = await releaseDatabaseService.getUpcomingReleases(days);

        res.json({
            success: true,
            count: releases.length,
            days,
            releases
        });
    } catch (error) {
        console.error('❌ Error getting upcoming releases:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch upcoming releases',
            message: error.message
        });
    }
});

// GET /api/releases/recent - Get recently released items (last 30 days)
router.get('/recent', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const releases = await releaseDatabaseService.getRecentReleases(days);

        res.json({
            success: true,
            count: releases.length,
            days,
            releases
        });
    } catch (error) {
        console.error('❌ Error getting recent releases:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent releases',
            message: error.message
        });
    }
});

// POST /api/releases/jobs/update-statuses - Manually trigger status update job (requires authentication)
router.post('/jobs/update-statuses', isAdmin, async (req, res) => {
    try {
        const result = await releaseScheduledJobs.updateReleaseStatuses();
        res.json({
            success: result.success,
            message: result.success ? 'Status update job completed' : 'Status update job failed',
            result
        });
    } catch (error) {
        console.error('❌ Error running status update job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Status update job failed',
            message: error.message
        });
    }
});

// POST /api/releases/jobs/sync - Manually trigger sync job (requires authentication)
router.post('/jobs/sync', isAdmin, async (req, res) => {
    try {
        const result = await releaseScheduledJobs.syncScrapedReleases();
        res.json({
            success: result.success,
            message: result.success ? 'Sync job completed' : 'Sync job failed',
            result
        });
    } catch (error) {
        console.error('❌ Error running sync job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Sync job failed',
            message: error.message
        });
    }
});

// POST /api/releases/jobs/cleanup - Manually trigger cleanup job (requires authentication)
router.post('/jobs/cleanup', isAdmin, async (req, res) => {
    try {
        const result = await releaseScheduledJobs.cleanupOldReleases();
        res.json({
            success: result.success,
            message: result.success ? 'Cleanup job completed' : 'Cleanup job failed',
            result
        });
    } catch (error) {
        console.error('❌ Error running cleanup job:', error.message);
        res.status(500).json({
            success: false,
            error: 'Cleanup job failed',
            message: error.message
        });
    }
});

// POST /api/releases/jobs/run-all - Run all scheduled jobs (requires authentication)
router.post('/jobs/run-all', isAdmin, async (req, res) => {
    try {
        const results = await releaseScheduledJobs.runAllJobs();
        res.json({
            success: true,
            message: 'All scheduled jobs completed',
            results
        });
    } catch (error) {
        console.error('❌ Error running all jobs:', error.message);
        res.status(500).json({
            success: false,
            error: 'Jobs failed',
            message: error.message
        });
    }
});

module.exports = router;

