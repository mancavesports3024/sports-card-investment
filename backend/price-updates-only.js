#!/usr/bin/env node

/**
 * Price Updates Only - Cron Job Script
 * 
 * This script runs price updates for items older than 10 days.
 * Runs daily at 4 AM via cron job.
 */

const RailwayMaintenanceJob = require('./railway-maintenance-job.js');

async function runPriceUpdatesOnly() {
    console.log('💰 Price Updates Only - Cron Job\n');
    console.log('📅 Started at:', new Date().toISOString());
    
    try {
        const maintenanceJob = new RailwayMaintenanceJob();
        const priceUpdateResult = await maintenanceJob.runPriceUpdates();
        
        if (priceUpdateResult) {
            const priceUpdates = maintenanceJob.results.priceUpdates;
            console.log('\n📊 Price Update Results:');
            console.log(`   - Cards Needing Updates: ${priceUpdates.totalChecked}`);
            console.log(`   - Successfully Updated: ${priceUpdates.updated}`);
            console.log(`   - Errors: ${priceUpdates.errors}`);
            
            if (priceUpdates.updated > 0) {
                console.log(`✅ Successfully updated ${priceUpdates.updated} card prices`);
            } else {
                console.log('✅ No cards needed price updates');
            }
        } else {
            console.log('❌ Price updates failed');
        }
        
        console.log('\n📅 Completed at:', new Date().toISOString());
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Price updates cron job failed:', error);
        console.log('📅 Failed at:', new Date().toISOString());
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the price updates
runPriceUpdatesOnly();
