const express = require('express');
const jwt = require('jsonwebtoken');
const { isAdminEmail } = require('../config/adminEmails');
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

// The frontend signs in with a Bearer JWT (routes/auth.js); a passport session user also counts.
const requireAdminEmail = (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        try {
            const decoded = jwt.verify(auth.substring(7), process.env.JWT_SECRET || 'dev_secret');
            if (isAdminEmail(decoded.email)) {
                req.user = decoded;
                return next();
            }
        } catch (error) {
            // Fall through to 401
        }
    } else if (req.user && isAdminEmail(req.user.email)) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
};

const RELEASE_FIELDS = ['title', 'brand', 'sport', 'releaseDate', 'year', 'description', 'retailPrice', 'hobbyPrice', 'source'];

function isValidDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

// Status is never taken from the request; the service derives it from releaseDate.
function pickReleaseFields(body, { partial }) {
    const data = {};
    for (const field of RELEASE_FIELDS) {
        if (body[field] === undefined) continue;
        const value = body[field];
        data[field] = typeof value === 'string' ? value.trim() : value;
    }
    const errors = [];
    if (!partial || data.title !== undefined) {
        if (!data.title) errors.push('title is required');
    }
    if (!partial || data.releaseDate !== undefined) {
        if (!isValidDateOnly(data.releaseDate)) errors.push('releaseDate must be a valid YYYY-MM-DD date');
    }
    if (data.year && !/^\d{4}$/.test(String(data.year))) errors.push('year must be 4 digits');
    for (const [field, max] of [['title', 500], ['brand', 100], ['sport', 50], ['retailPrice', 50], ['hobbyPrice', 50], ['source', 100]]) {
        if (data[field] && String(data[field]).length > max) errors.push(`${field} must be ${max} characters or fewer`);
    }
    for (const field of ['brand', 'sport', 'year', 'description', 'retailPrice', 'hobbyPrice', 'source']) {
        if (data[field] === '') data[field] = null;
    }
    return { data, errors };
}

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

// POST /api/releases - Add new release (requires authentication)
router.post('/', requireAdminEmail, async (req, res) => {
    try {
        const { data, errors } = pickReleaseFields(req.body || {}, { partial: false });
        if (errors.length) {
            return res.status(400).json({ success: false, error: errors.join('; ') });
        }

        const release = await loadServices().releaseDatabaseService.addRelease({
            ...data,
            createdBy: req.user.email
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

// PUT /api/releases/:id - Update existing release (requires authentication)
router.put('/:id', requireAdminEmail, async (req, res) => {
    try {
        const { data, errors } = pickReleaseFields(req.body || {}, { partial: true });
        if (errors.length) {
            return res.status(400).json({ success: false, error: errors.join('; ') });
        }
        const id = parseInt(req.params.id, 10);
        const release = Number.isInteger(id)
            ? await loadServices().releaseDatabaseService.updateRelease(id, data)
            : null;

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
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'A release with this title and date already exists' });
        }
        console.error('❌ Error updating release:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update release',
            message: error.message
        });
    }
});

// DELETE /api/releases/:id - Soft delete release (requires authentication)
router.delete('/:id', requireAdminEmail, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const deleted = Number.isInteger(id)
            ? await loadServices().releaseDatabaseService.deleteRelease(id)
            : false;

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


