#!/usr/bin/env node

/**
 * Health Check Only - Cron Job Script
 * 
 * This script runs a health check and logs the results.
 * Runs every 6 hours via cron job.
 */

const RailwayMaintenanceJob = require('./railway-maintenance-job.js');

async function runHealthCheckOnly() {
    console.log('🏥 Health Check Only - Cron Job\n');
    console.log('📅 Started at:', new Date().toISOString());
    
    try {
        const maintenanceJob = new RailwayMaintenanceJob();
        const healthResult = await maintenanceJob.runHealthCheck();
        
        if (healthResult) {
            const health = maintenanceJob.results.healthCheck;
            console.log('\n📊 Health Check Results:');
            console.log(`   - Health Score: ${health.healthScore}%`);
            console.log(`   - Total Cards: ${health.totalCards}`);
            console.log(`   - Player Name Issues: ${health.playerNameIssues}`);
            console.log(`   - Summary Title Issues: ${health.summaryTitleIssues}`);
            console.log(`   - Total Issues: ${health.totalIssues}`);
            
            // If there are issues, trigger auto fix
            if (health.totalIssues > 0) {
                console.log('\n🔧 Issues detected! Triggering auto fix...');
                const autoFixResult = await maintenanceJob.runAutoFix();
                
                if (autoFixResult) {
                    const autoFix = maintenanceJob.results.autoFix;
                    console.log(`✅ Auto fix completed: ${autoFix.fixesApplied} fixes applied`);
                } else {
                    console.log('❌ Auto fix failed');
                }
            } else {
                console.log('\n✅ No issues found - database is healthy!');
            }
        } else {
            console.log('❌ Health check failed');
        }
        
        console.log('\n📅 Completed at:', new Date().toISOString());
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Health check cron job failed:', error);
        console.log('📅 Failed at:', new Date().toISOString());
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the health check
runHealthCheckOnly();
