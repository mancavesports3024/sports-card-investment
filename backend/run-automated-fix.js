const AutomatedTitleFixer = require('./automated-title-fixer.js');

async function main() {
    const fixer = new AutomatedTitleFixer();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'fix';
    
    console.log('🤖 Automated Title Fixer\n');
    
    switch (command.toLowerCase()) {
        case 'health':
        case 'check':
            console.log('🏥 Running health check...\n');
            await fixer.healthCheck();
            break;
            
        case 'analyze':
        case 'scan':
            console.log('🔍 Running analysis only...\n');
            const issues = await fixer.analyzeCards();
            console.log(`📊 Analysis complete:`);
            console.log(`- Player name issues: ${issues.playerNameIssues.length}`);
            console.log(`- Summary title issues: ${issues.summaryTitleIssues.length}`);
            console.log(`- Total cards needing fixes: ${issues.cardsNeedingFixes.length}`);
            break;
            
        case 'fix':
        case 'auto':
        default:
            console.log('🔧 Running full automated fix...\n');
            const result = await fixer.runAutomatedFix();
            
            if (result.success) {
                console.log('\n🎉 SUCCESS!');
                console.log(`📊 Results: ${result.message}`);
                console.log(`📈 Improvement: ${result.improvement}%`);
                console.log(`🔧 Remaining issues: ${result.remainingIssues}`);
            } else {
                console.log('\n❌ FAILED!');
                console.log(`Error: ${result.error}`);
            }
            break;
    }
    
    console.log('\n✨ Process completed!');
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
