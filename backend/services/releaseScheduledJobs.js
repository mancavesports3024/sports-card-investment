const releaseDatabaseService = require('./releaseDatabaseService');
const bleacherSeatsScraper = require('./bleacherSeatsScraperService');
const releaseInfoService = require('./releaseInfoService');

class ReleaseScheduledJobs {
    /**
     * Daily job to update release statuses automatically
     * Should run at midnight daily
     */
    async updateReleaseStatuses() {
        try {
            console.log('🔄 [Scheduled Job] Updating release statuses...');
            const { releaseDatabaseService, releaseInfoService } = this.loadServices();
            
            await releaseDatabaseService.updateStatuses();
            
            // Clear cache to reflect new statuses
            await releaseInfoService.clearCache();
            
            console.log('✅ [Scheduled Job] Release statuses updated successfully');
            return { success: true, job: 'updateReleaseStatuses' };
        } catch (error) {
            console.error('❌ [Scheduled Job] Error updating release statuses:', error.message);
            console.error('❌ Error stack:', error.stack);
            return { success: false, job: 'updateReleaseStatuses', error: error.message };
        }
    }

    /**
     * Weekly job to sync with Bleacher Seats scraper
     * Should run weekly (e.g., Sunday at 2 AM)
     */
    async syncScrapedReleases() {
        try {
            console.log('🔄 [Scheduled Job] Syncing scraped releases from Bleacher Seats...');
            const { releaseDatabaseService, bleacherSeatsScraper, releaseInfoService } = this.loadServices();
            
            // Get scraped releases
            const scrapedReleases = await bleacherSeatsScraper.getLatestReleases();
            console.log(`✅ [Scheduled Job] Scraped ${scrapedReleases.length} releases from Bleacher Seats`);

            // Sync to database
            const result = await releaseDatabaseService.syncScrapedReleases(scrapedReleases);

            // Update statuses after syncing
            await releaseDatabaseService.updateStatuses();

            // Clear cache
            await releaseInfoService.clearCache();

            console.log(`✅ [Scheduled Job] Sync completed: ${result.added} added, ${result.skipped} skipped`);
            return { 
                success: true, 
                job: 'syncScrapedReleases',
                added: result.added,
                skipped: result.skipped
            };
        } catch (error) {
            console.error('❌ [Scheduled Job] Error syncing scraped releases:', error.message);
            return { success: false, job: 'syncScrapedReleases', error: error.message };
        }
    }

    /**
     * Monthly cleanup job (optional)
     * Archives old releases or marks them as inactive
     */
    async cleanupOldReleases() {
        try {
            console.log('🔄 [Scheduled Job] Cleaning up old releases...');
            const { releaseDatabaseService } = this.loadServices();
            
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const cutoffDate = oneYearAgo.toISOString().split('T')[0];

            // Get old releases
            const oldReleases = await releaseDatabaseService.getAllReleases({
                endDate: cutoffDate
            });

            // For now, we'll just log them. You can implement archiving later
            console.log(`📊 [Scheduled Job] Found ${oldReleases.length} releases older than 1 year`);
            
            // Optionally mark as inactive (uncomment if desired)
            // for (const release of oldReleases) {
            //     await releaseDatabaseService.deleteRelease(release.id);
            // }

            console.log('✅ [Scheduled Job] Cleanup completed');
            return { 
                success: true, 
                job: 'cleanupOldReleases',
                oldReleasesCount: oldReleases.length
            };
        } catch (error) {
            console.error('❌ [Scheduled Job] Error cleaning up old releases:', error.message);
            return { success: false, job: 'cleanupOldReleases', error: error.message };
        }
    }

    /**
     * Run all scheduled jobs (for testing or manual triggers)
     */
    async runAllJobs() {
        console.log('🚀 [Scheduled Jobs] Running all release calendar jobs...');
        
        const results = {
            statusUpdate: await this.updateReleaseStatuses(),
            sync: await this.syncScrapedReleases(),
            cleanup: await this.cleanupOldReleases()
        };

        console.log('✅ [Scheduled Jobs] All jobs completed');
        return results;
    }
}

module.exports = new ReleaseScheduledJobs();

