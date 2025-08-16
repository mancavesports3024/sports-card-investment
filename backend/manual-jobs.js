#!/usr/bin/env node

/**
 * Manual Job Runner
 * 
 * This script allows you to run maintenance jobs manually.
 * Usage: node backend/manual-jobs.js [job-type]
 * 
 * Job types:
 * - health-check: Run health check only
 * - auto-fix: Run auto fix only
 * - price-updates: Run price updates only
 * - full-maintenance: Run complete maintenance job
 * - fast-batch-pull: Run fast batch pull for new items
 */

const RailwayMaintenanceJob = require('./railway-maintenance-job.js');

async function runJob(jobType) {
    console.log(`🤖 Running Manual Job: ${jobType.toUpperCase()}\n`);
    console.log('📅 Started at:', new Date().toISOString());
    
    const maintenanceJob = new RailwayMaintenanceJob();
    
    try {
        switch (jobType) {
            case 'health-check':
                console.log('🏥 Running Health Check...\n');
                await maintenanceJob.runHealthCheck();
                break;
                
            case 'auto-fix':
                console.log('🔧 Running Auto Fix...\n');
                await maintenanceJob.runHealthCheck();
                if (maintenanceJob.results.healthCheck.totalIssues > 0) {
                    await maintenanceJob.runAutoFix();
                } else {
                    console.log('✅ No issues to fix!');
                }
                break;
                
            case 'price-updates':
                console.log('💰 Running Price Updates...\n');
                await maintenanceJob.runPriceUpdates();
                break;
                
            case 'full-maintenance':
                console.log('🔄 Running Full Maintenance Job...\n');
                await maintenanceJob.runMaintenanceJob();
                break;
                
            case 'fast-batch-pull':
                console.log('🚀 Running Fast Batch Pull...\n');
                // This would integrate with your existing fast batch pull
                console.log('⚠️  Fast batch pull integration needed');
                break;
                
            default:
                console.log('❌ Unknown job type. Available options:');
                console.log('   - health-check');
                console.log('   - auto-fix');
                console.log('   - price-updates');
                console.log('   - full-maintenance');
                console.log('   - fast-batch-pull');
                process.exit(1);
        }
        
        // Display results
        console.log('\n📊 JOB RESULTS:');
        console.log('=' .repeat(40));
        
        if (maintenanceJob.results.healthCheck.success) {
            const health = maintenanceJob.results.healthCheck;
            console.log(`🏥 Health Check: ${health.healthScore}% (${health.totalIssues} issues)`);
        }
        
        if (maintenanceJob.results.autoFix.success) {
            const autoFix = maintenanceJob.results.autoFix;
            console.log(`🔧 Auto Fix: ${autoFix.fixesApplied} fixes applied`);
        }
        
        if (maintenanceJob.results.priceUpdates.success) {
            const priceUpdates = maintenanceJob.results.priceUpdates;
            console.log(`💰 Price Updates: ${priceUpdates.updated} prices updated`);
        }
        
        console.log('\n📅 Completed at:', new Date().toISOString());
        console.log('✅ Job completed successfully!');
        
    } catch (error) {
        console.error('❌ Job failed:', error);
        console.log('📅 Failed at:', new Date().toISOString());
        process.exit(1);
    }
}

// Get job type from command line arguments
const jobType = process.argv[2];

if (!jobType) {
    console.log('🤖 Manual Job Runner\n');
    console.log('Usage: node backend/manual-jobs.js [job-type]\n');
    console.log('Available job types:');
    console.log('  health-check     - Run health check only');
    console.log('  auto-fix         - Run auto fix only');
    console.log('  price-updates    - Run price updates only');
    console.log('  full-maintenance - Run complete maintenance job');
    console.log('  fast-batch-pull  - Run fast batch pull for new items\n');
    console.log('Examples:');
    console.log('  node backend/manual-jobs.js health-check');
    console.log('  node backend/manual-jobs.js full-maintenance');
    process.exit(1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the specified job
runJob(jobType);
