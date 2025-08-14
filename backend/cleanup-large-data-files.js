const fs = require('fs');
const path = require('path');

// Large data files to remove (optional - can be regenerated)
const largeDataFiles = [
    'data/sportYearSetCombinations.json',
    'data/psa10_recent_90_days_database_original_backup.json',
    'data/psa10_recent_90_days_database_filtered.json',
    'data/psa10_recent_90_days_database_cleaned.json',
    'data/psa10_recent_90_days_database_backup.json',
    'data/psa10_recent_90_days_database.json',
    'data/improved_api_good_buy_cache.json',
    'data/comprehensiveCardDatabase.json',
    'data/PSA10_Database_With_Price_Comparisons.csv',
    'data/PSA10_Database_Final_Complete_Improved.csv',
    'data/actual_low_price_analysis.json',
    'data/low_price_analysis.json',
    'data/improved_api_good_buy_opportunities.json',
    'data/efficient_good_buy_opportunities.json'
];

function cleanupLargeDataFiles() {
    console.log('🗑️  Starting large data file cleanup...\n');
    console.log('⚠️  WARNING: These files can be regenerated but may take time to recreate.\n');
    
    let totalSizeRemoved = 0;
    let filesRemoved = 0;
    let filesNotFound = 0;
    
    for (const file of largeDataFiles) {
        const filePath = path.join(__dirname, file);
        
        if (fs.existsSync(filePath)) {
            try {
                const stats = fs.statSync(filePath);
                const sizeInMB = stats.size / (1024 * 1024);
                
                fs.unlinkSync(filePath);
                console.log(`✅ Removed: ${file} (${sizeInMB.toFixed(1)}MB)`);
                
                totalSizeRemoved += sizeInMB;
                filesRemoved++;
            } catch (error) {
                console.log(`❌ Error removing ${file}: ${error.message}`);
            }
        } else {
            console.log(`⚠️  Not found: ${file}`);
            filesNotFound++;
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Files removed: ${filesRemoved}`);
    console.log(`  Files not found: ${filesNotFound}`);
    console.log(`  Total size removed: ${totalSizeRemoved.toFixed(1)}MB`);
    
    if (totalSizeRemoved > 0) {
        console.log(`\n🚀 Deployment speed improvement: ~${totalSizeRemoved.toFixed(1)}MB faster!`);
    }
    
    console.log(`\n🎉 Large data cleanup complete!`);
}

// Run cleanup
cleanupLargeDataFiles();
