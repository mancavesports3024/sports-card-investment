const SummaryTitleFixer = require('./fix-summary-titles.js');

async function main() {
    console.log('🔧 Railway Summary Title Fix\n');
    console.log('🔄 This will fix all summary title issues in the Railway database:\n');
    console.log('   - Remove duplicate player names');
    console.log('   - Fix brand name positioning');
    console.log('   - Clean up formatting');
    console.log('   - Standardize structure\n');
    
    const fixer = new SummaryTitleFixer();
    
    try {
        const result = await fixer.fixAllSummaryTitles();
        
        if (result.success) {
            console.log('\n🎉 SUCCESS! Summary title fix completed successfully!');
            console.log(`📊 Fixed ${result.totalFixed} out of ${result.totalProcessed} cards`);
        } else {
            console.log('\n⚠️  WARNING! Summary title fix completed with issues');
            console.log(`Error: ${result.error}`);
        }
        
        console.log('\n✨ Process completed!');
        
    } catch (error) {
        console.error('\n❌ FAILED! Summary title fix failed:', error);
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
