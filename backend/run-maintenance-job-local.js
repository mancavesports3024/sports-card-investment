const AutomatedMaintenanceJob = require('./automated-maintenance-job.js');

async function runMaintenanceJobLocal() {
    console.log('🤖 Running Automated Maintenance Job (Local Version)...\n');
    console.log('🔄 This job will:');
    console.log('   1. Run fast batch pull to find new cards');
    console.log('   2. Check database health');
    console.log('   3. Auto-fix any issues found');
    console.log('   4. Update prices for items older than 10 days\n');
    
    const maintenanceJob = new AutomatedMaintenanceJob();
    
    try {
        const result = await maintenanceJob.runMaintenanceJob();
        
        if (result.success) {
            console.log('\n🎉 SUCCESS! Maintenance job completed successfully!');
        } else {
            console.log('\n⚠️  WARNING! Maintenance job completed with some issues');
            if (result.error) {
                console.log(`Error: ${result.error}`);
            }
        }
        
        console.log('\n✨ Process completed!');
        
    } catch (error) {
        console.error('\n❌ FAILED! Maintenance job failed:', error);
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the main function
runMaintenanceJobLocal().catch(error => {
    console.error('❌ Main error:', error);
    process.exit(1);
});
