const RailwayMaintenanceJob = require('./railway-maintenance-job.js');

async function main() {
    console.log('🤖 Railway Maintenance Job Runner\n');
    console.log('🔄 This will run the maintenance job directly on Railway:\n');
    console.log('   1. Health check (analyze database)');
    console.log('   2. Auto fix (fix any issues found)');
    console.log('   3. Price updates (for items older than 10 days)\n');
    
    const maintenanceJob = new RailwayMaintenanceJob();
    
    try {
        const result = await maintenanceJob.runMaintenanceJob();
        
        if (result.success) {
            console.log('\n🎉 SUCCESS! Railway maintenance job completed successfully!');
        } else {
            console.log('\n⚠️  WARNING! Railway maintenance job completed with some issues');
            if (result.error) {
                console.log(`Error: ${result.error}`);
            }
        }
        
        console.log('\n✨ Process completed!');
        
    } catch (error) {
        console.error('\n❌ FAILED! Railway maintenance job failed:', error);
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
