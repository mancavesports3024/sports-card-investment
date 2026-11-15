const express = require('express');
const jwt = require('jsonwebtoken');
const { isAdminEmail } = require('../config/adminEmails');
const { deriveStatus } = require('../utils/releaseCalendar');
const router = express.Router();

// Health check endpoint to verify route is loaded
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'Releases API is working' });
});

// Test service loading
router.get('/test-load', (req, res) => {
    try {
        const result = {
            success: true,
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            services: {}
        };
        
        try {
            const services = loadServices();
            result.services.releaseDatabaseService = !!services.releaseDatabaseService;
            result.services.releaseInfoService = !!services.releaseInfoService;
            result.services.bleacherSeatsScraper = !!services.bleacherSeatsScraper;
            result.services.releaseScheduledJobs = !!services.releaseScheduledJobs;
        } catch (loadErr) {
            result.loadError = {
                message: loadErr.message,
                code: loadErr.code
            };
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Lazy load services to avoid module loading errors
let releaseDatabaseService, releaseInfoService, bleacherSeatsScraper, releaseScheduledJobs;

function loadServices() {
    if (!releaseDatabaseService) {
        try {
            console.log('🔄 Loading release services...');
            releaseDatabaseService = require('../services/releaseDatabaseService');
            console.log('✅ releaseDatabaseService loaded');
            releaseInfoService = require('../services/releaseInfoService');
            console.log('✅ releaseInfoService loaded');
            bleacherSeatsScraper = require('../services/bleacherSeatsScraperService');
            console.log('✅ bleacherSeatsScraper loaded');
            releaseScheduledJobs = require('../services/releaseScheduledJobs');
            console.log('✅ releaseScheduledJobs loaded');
        } catch (error) {
            console.error('❌ Error loading release services:', error.message);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }
    return { releaseDatabaseService, releaseInfoService, bleacherSeatsScraper, releaseScheduledJobs };
}

// Attach req.user from passport session or Authorization: Bearer JWT (frontend auth).
const attachUserFromAuth = (req) => {
    if (req.user && req.user.email) return req.user;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'dev_secret');
        if (decoded && decoded.email) {
            req.user = decoded;
            return decoded;
        }
    } catch (_) {
        return null;
    }
    return null;
};

const requireAdminEmail = (req, res, next) => {
    const user = attachUserFromAuth(req);
    if (user && isAdminEmail(user.email)) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
};

// Mutating release endpoints require a signed-in admin email.
const isAdmin = requireAdminEmail;

// Scraped imports bypass the reviewed dry-run process (RELEASE_CALENDAR_MAINTENANCE.md).
const scrapedSyncDisabled = (req, res) => {
    res.status(410).json({
        success: false,
        error: 'Scraped release sync is disabled',
        message: 'Release changes must go through the reviewed dry run in scripts/release-calendar-fix.'
    });
};

// GET /api/releases - Get all releases with optional filters
router.get('/', async (req, res) => {
    try {
        const { releaseDatabaseService } = loadServices();
        // If tables don't exist yet, return empty array instead of error
        try {
            const filters = {};
            
            if (req.query.sport) filters.sport = req.query.sport;
            if (req.query.year) filters.year = req.query.year;
            if (req.query.status) filters.status = req.query.status;
            if (req.query.startDate) filters.startDate = req.query.startDate;
            if (req.query.endDate) filters.endDate = req.query.endDate;

            const releases = await loadServices().releaseDatabaseService.getAllReleases(filters);
            
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
        const release = await loadServices().releaseDatabaseService.getReleaseById(parseInt(req.params.id));
        
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

// POST /api/releases - Add new release (requires admin authentication)
router.post('/', isAdmin, async (req, res) => {
    try {
        const {
            title,
            brand,
            sport,
            releaseDate,
            year,
            description,
            retailPrice,
            hobbyPrice,
            source
        } = req.body;

        if (!title || !releaseDate) {
            return res.status(400).json({
                success: false,
                error: 'Title and releaseDate are required'
            });
        }

        // Status is date-derived in the service; prices stay free-text (null when blank).
        const release = await loadServices().releaseDatabaseService.addRelease({
            title,
            brand,
            sport,
            releaseDate,
            year,
            description,
            retailPrice: retailPrice == null || retailPrice === '' ? null : retailPrice,
            hobbyPrice: hobbyPrice == null || hobbyPrice === '' ? null : hobbyPrice,
            source: source || 'Manual',
            // UI sends the signed-in email; scripts may pass createdBy explicitly.
            createdBy: (typeof req.body.createdBy === 'string' && req.body.createdBy.trim())
                ? req.body.createdBy.trim()
                : (req.user?.email || 'API')
        });

        if (!release) {
            return res.status(409).json({
                success: false,
                error: 'Release already exists'
            });
        }

        // Clear cache
        await loadServices().releaseInfoService.clearCache();

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

// PUT /api/releases/:id - Update existing release (requires admin authentication)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        const body = { ...req.body };
        // Keep stored status aligned with the date-based convention when date changes.
        if (body.releaseDate !== undefined && body.status === undefined) {
            body.status = deriveStatus(body.releaseDate);
        }
        if (body.retailPrice === '') body.retailPrice = null;
        if (body.hobbyPrice === '') body.hobbyPrice = null;

        const release = await loadServices().releaseDatabaseService.updateRelease(parseInt(req.params.id), body);

        if (!release) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }

        // Clear cache
        await loadServices().releaseInfoService.clearCache();

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
        const deleted = await loadServices().releaseDatabaseService.deleteRelease(parseInt(req.params.id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Release not found'
            });
        }

        // Clear cache
        await loadServices().releaseInfoService.clearCache();

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
        console.log('🔍 Testing database connection...');
        console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
        
        let loadError = null;
        let services = null;
        
        try {
            services = loadServices();
            console.log('✅ Services loaded successfully');
        } catch (err) {
            console.error('❌ Failed to load services:', err.message);
            console.error('❌ Stack:', err.stack);
            loadError = {
                message: err.message,
                code: err.code,
                stack: err.stack
            };
        }
        
        if (loadError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to load services',
                loadError: loadError
            });
        }
        
        const { releaseDatabaseService } = services;
        const hasDbUrl = !!process.env.DATABASE_URL;
        let connectionTest = false;
        let errorMessage = null;

        if (hasDbUrl) {
            try {
                console.log('🔄 Attempting database connection...');
                await releaseDatabaseService.connectDatabase();
                connectionTest = true;
                console.log('✅ Database connection successful');
            } catch (dbError) {
                console.error('❌ Database connection failed:', dbError.message);
                errorMessage = dbError.message;
            }
        } else {
            console.log('⚠️ DATABASE_URL not set');
        }

        res.json({
            success: true,
            hasDatabaseUrl: hasDbUrl,
            connectionTest: connectionTest,
            error: errorMessage
        });
    } catch (error) {
        console.error('❌ Unexpected error in test-db:', error.message);
        console.error('❌ Stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// POST /api/releases/init - Initialize database tables (one-time setup, no auth required for convenience)
router.post('/init', async (req, res) => {
    try {
        const { releaseDatabaseService } = loadServices();
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
        
        await loadServices().releaseDatabaseService.createTables();
        
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
        await loadServices().releaseInfoService.clearCache();

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

// POST /api/releases/sync - Disabled (scraped imports bypass review)
router.post('/sync', requireAdminEmail, scrapedSyncDisabled);

// GET /api/releases/upcoming - Get upcoming releases (next 30 days)
router.get('/upcoming', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const releases = await loadServices().releaseDatabaseService.getUpcomingReleases(days);

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
        const releases = await loadServices().releaseDatabaseService.getRecentReleases(days);

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

// POST /api/releases/jobs/update-statuses - Manually trigger status update job (temporarily no auth for convenience)
router.post('/jobs/update-statuses', async (req, res) => {
    try {
        const result = await loadServices().releaseScheduledJobs.updateReleaseStatuses();
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

// POST /api/releases/jobs/sync - Disabled (scraped imports bypass review)
router.post('/jobs/sync', requireAdminEmail, scrapedSyncDisabled);

// POST /api/releases/jobs/cleanup - Manually trigger cleanup job (requires authentication)
router.post('/jobs/cleanup', isAdmin, async (req, res) => {
    try {
        const result = await loadServices().releaseScheduledJobs.cleanupOldReleases();
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

// GET /api/releases/jobs/status - Get status of scheduled jobs
router.get('/jobs/status', (req, res) => {
    try {
        const releaseCalendarScheduler = require('../services/releaseCalendarScheduler');
        const status = releaseCalendarScheduler.getStatus();
        
        res.json({
            success: true,
            scheduler: {
                isRunning: status.isRunning,
                jobs: status.jobs,
                schedules: {
                    dailyStatusUpdate: 'Every day at midnight (00:00) Central Time',
                    weeklyScraperSync: 'Disabled (manual reviewed process)',
                    monthlyCleanup: '1st of every month at 3:00 AM Central Time'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduler status',
            message: error.message
        });
    }
});

// POST /api/releases/jobs/run-all - Run all scheduled jobs (requires authentication)
router.post('/jobs/run-all', isAdmin, async (req, res) => {
    try {
        const results = await loadServices().releaseScheduledJobs.runAllJobs();
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


