const AutomatedMaintenanceJob = require('./automated-maintenance-job.js');

async function main() {
    console.log('🤖 Automated Maintenance Job Runner\n');
    console.log('🔄 This will run the complete maintenance job:\n');
    console.log('   1. Fast batch pull (find new cards)');
    console.log('   2. Health check (analyze database)');
    console.log('   3. Auto fix (fix any issues found)');
    console.log('   4. Price updates (for items older than 10 days)\n');
    
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
main().catch(error => {
    console.error('❌ Main error:', error);
    process.exit(1);
});
