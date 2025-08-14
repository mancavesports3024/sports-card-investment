const fs = require('fs');
const path = require('path');

// Files to remove (safe to delete)
const filesToRemove = [
    // Recent debug files
    'debug-parallel-detection.js',
    'debug-filter-detailed.js',
    'debug-psa-grade.js',
    'debug-mcconkey-search.js',
    'debug-mcconkey-price.js',
    
    // Older debug files
    'debug-player-extraction-detailed.js',
    'debug-player-extraction.js',
    'debug-helmet-heroes.js',
    'debug-railway-field-names.js',
    'debug-railway-multiplier.js',
    'debug-multiplier.js',
    'debug-espn-api.js',
    'debug-cleanup-job.js',
    'debug-railway-cleanup.js',
    
    // Test files
    'test-paula-pattern.js',
    'test-title-cleaning.js',
    'test-player-pattern.js',
    'test-bowman-chrome-prospect.js',
    'test-helmet-heroes.js',
    'test-year-fragment-issue.js',
    'test-bowman-sapphire.js',
    'test-year-extraction.js',
    'test-card-number-extraction.js',
    'test-troubleshoot-cards.js',
    'test-sundo-card-types.js',
    'test-new-card-types.js',
    'test-green-pulsar.js',
    'test-cooper-flagg-v2.js',
    'test-cooper-flagg.js',
    'test-cleanup-debug.js',
    'test-filtering.js',
    
    // API test files
    'test-espn-v2-api.js',
    'test-espn-working-endpoint.js',
    'test-espn-player-id.js',
    'test-espn-famous-players.js',
    'test-espn-api-simple.js',
    'test-espn-api-single.js',
    'test-espn-api.js',
    
    // Database test files
    'check-shaq-multiplier.js',
    'check-learned-card-types.js',
    'check-railway-multiplier.js',
    'check-multiplier.js',
    'check-railway-total-count.js',
    'check-railway-full-database.js',
    'check-railway-sample.js',
    'check-railway-data-sample.js',
    'check-railway-database.js',
    'check-railway-files.js',
    
    // Analysis files
    'analyze-railway-complete.js',
    'analyze-railway-full.js',
    'analyze-railway-correct.js',
    'analyze-railway-data.js',
    'railway-database-analysis.js',
    'database-optimization-analysis.js',
    'add-performance-indexes.js',
    'data-validation-system.js',
    'fix-duplicates.js',
    'fix-price-anomalies.js',
    'manual-update-test.js',
    
    // Old/deprecated files
    'generate-standardized-summary-titles-final.js',
    'generate-standardized-summary-titles-v2.js',
    'generate-standardized-summary-titles.js',
    'espn-sport-detector-working.js',
    'espn-sport-detector-v2.js',
    'espn-sport-detector.js',
    'new-pull-new-items.js',
    'update-railway-comprehensive-db.js',
    'update-comprehensive-database.js',
    'enhanced-sport-detector.js',
    
    // Empty database files
    'scorecard.db',
    'new-scorecard.db',
    
    // Old database file
    'scorecard_with_data.db'
];

// Large data files to consider removing (optional)
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

function cleanupFiles() {
    console.log('🧹 Starting deployment file cleanup...\n');
    
    let totalSizeRemoved = 0;
    let filesRemoved = 0;
    let filesNotFound = 0;
    
    // Remove main files
    for (const file of filesToRemove) {
        const filePath = path.join(__dirname, file);
        
        if (fs.existsSync(filePath)) {
            try {
                const stats = fs.statSync(filePath);
                const sizeInKB = stats.size / 1024;
                
                fs.unlinkSync(filePath);
                console.log(`✅ Removed: ${file} (${sizeInKB.toFixed(1)}KB)`);
                
                totalSizeRemoved += sizeInKB;
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
    console.log(`  Total size removed: ${totalSizeRemoved.toFixed(1)}KB`);
    
    // Check large data files
    console.log(`\n📁 Large data files to consider removing:`);
    let largeFilesSize = 0;
    let largeFilesFound = 0;
    
    for (const file of largeDataFiles) {
        const filePath = path.join(__dirname, file);
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const sizeInMB = stats.size / (1024 * 1024);
            largeFilesSize += sizeInMB;
            largeFilesFound++;
            
            console.log(`  ${file} (${sizeInMB.toFixed(1)}MB)`);
        }
    }
    
    if (largeFilesFound > 0) {
        console.log(`\n💾 Large files total: ${largeFilesSize.toFixed(1)}MB`);
        console.log(`   To remove these, run: node cleanup-large-data-files.js`);
    }
    
    console.log(`\n🎉 Cleanup complete! Deployment should be faster now.`);
}

// Run cleanup
cleanupFiles();
