const cron = require('node-cron');
const releaseScheduledJobs = require('./releaseScheduledJobs');

class ReleaseCalendarScheduler {
    constructor() {
        this.jobs = [];
        this.isRunning = false;
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Release calendar scheduler is already running');
            return;
        }

        console.log('🚀 Starting release calendar scheduled jobs...');

        // Daily status update - runs at midnight (00:00) every day
        const dailyStatusJob = cron.schedule('0 0 * * *', async () => {
            console.log('⏰ [Cron] Running daily status update job...');
            try {
                await releaseScheduledJobs.updateReleaseStatuses();
            } catch (error) {
                console.error('❌ [Cron] Error in daily status update:', error.message);
            }
        }, {
            scheduled: true,
            timezone: 'America/Chicago' // Central Time
        });

        this.jobs.push({ name: 'dailyStatusUpdate', job: dailyStatusJob });
        console.log('✅ Scheduled: Daily status update (midnight CT)');

        // Weekly scraper sync - runs every Sunday at 2:00 AM
        const weeklySyncJob = cron.schedule('0 2 * * 0', async () => {
            console.log('⏰ [Cron] Running weekly scraper sync job...');
            try {
                await releaseScheduledJobs.syncScrapedReleases();
            } catch (error) {
                console.error('❌ [Cron] Error in weekly scraper sync:', error.message);
            }
        }, {
            scheduled: true,
            timezone: 'America/Chicago' // Central Time
        });

        this.jobs.push({ name: 'weeklyScraperSync', job: weeklySyncJob });
        console.log('✅ Scheduled: Weekly scraper sync (Sunday 2:00 AM CT)');

        // Optional: Monthly cleanup - runs on the 1st of every month at 3:00 AM
        const monthlyCleanupJob = cron.schedule('0 3 1 * *', async () => {
            console.log('⏰ [Cron] Running monthly cleanup job...');
            try {
                await releaseScheduledJobs.cleanupOldReleases();
            } catch (error) {
                console.error('❌ [Cron] Error in monthly cleanup:', error.message);
            }
        }, {
            scheduled: true,
            timezone: 'America/Chicago' // Central Time
        });

        this.jobs.push({ name: 'monthlyCleanup', job: monthlyCleanupJob });
        console.log('✅ Scheduled: Monthly cleanup (1st of month, 3:00 AM CT)');

        this.isRunning = true;
        console.log('✅ All release calendar scheduled jobs are running');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Release calendar scheduler is not running');
            return;
        }

        console.log('🛑 Stopping release calendar scheduled jobs...');
        this.jobs.forEach(({ name, job }) => {
            job.stop();
            console.log(`✅ Stopped: ${name}`);
        });

        this.jobs = [];
        this.isRunning = false;
        console.log('✅ All release calendar scheduled jobs stopped');
    }

    /**
     * Get status of all scheduled jobs
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            jobs: this.jobs.map(({ name, job }) => ({
                name,
                running: job.running || false
            }))
        };
    }
}

module.exports = new ReleaseCalendarScheduler();

