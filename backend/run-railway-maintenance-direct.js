#!/usr/bin/env node

/**
 * Railway Maintenance Job - Direct Runner
 * 
 * This script can be run directly on Railway to execute the maintenance job.
 * It bypasses HTTP timeouts by working directly with the database.
 * 
 * Usage on Railway:
 * node backend/run-railway-maintenance-direct.js
 */

const RailwayMaintenanceJob = require('./railway-maintenance-job.js');

async function main() {
    console.log('🤖 Railway Maintenance Job - Direct Runner\n');
    console.log('🔄 Starting maintenance job directly on Railway...\n');
    console.log('📋 This job will:');
    console.log('   1. Check database health');
    console.log('   2. Auto-fix any issues found (player names, summary titles)');
    console.log('   3. Update prices for items older than 10 days\n');
    
    const startTime = Date.now();
    
    try {
        // Create and run the maintenance job
        const maintenanceJob = new RailwayMaintenanceJob();
        const result = await maintenanceJob.runMaintenanceJob();
        
        const endTime = Date.now();
        const totalDuration = Math.round((endTime - startTime) / 1000);
        
        console.log('\n🎯 MAINTENANCE JOB COMPLETED\n');
        console.log('=' .repeat(60));
        
        if (result.success) {
            console.log('✅ SUCCESS: All maintenance tasks completed successfully!');
        } else {
            console.log('⚠️  WARNING: Some maintenance tasks had issues');
            if (result.error) {
                console.log(`Error: ${result.error}`);
            }
        }
        
        console.log(`\n⏱️  Total Execution Time: ${totalDuration} seconds`);
        console.log('📅 Completed at:', new Date().toISOString());
        
        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ CRITICAL ERROR: Maintenance job failed completely');
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        
        const endTime = Date.now();
        const totalDuration = Math.round((endTime - startTime) / 1000);
        console.log(`\n⏱️  Total Execution Time: ${totalDuration} seconds`);
        console.log('📅 Failed at:', new Date().toISOString());
        
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Run the main function
main();
