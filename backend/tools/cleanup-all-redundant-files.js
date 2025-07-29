const fs = require('fs');
const path = require('path');

function cleanupAllRedundantFiles() {
    console.log('🧹 COMPREHENSIVE CLEANUP OF REDUNDANT FILES\n');
    console.log('='.repeat(60));

    const dataDir = path.join(__dirname, '..', 'data');
    const spreadsheetsDir = path.join(dataDir, 'spreadsheets');
    const toolsDir = path.join(__dirname);

    // Files to keep (our final, clean versions)
    const keepFiles = {
        data: [
            'comprehensiveCardDatabase.json',        // Our final clean database
            'comprehensiveCardSummary.json',         // Summary of clean database
            'sportYearSetCombinations.json',         // Final combinations
            'sportYearSetCombinationsSummary.json',  // Summary of combinations
            'sportYearsDatabase.json',               // Source of all years
            'sportYearsSummary.json',                // Summary of years
            'featured_ebay_items.json',              // App data
            'search_history.json'                    // App data
        ],
        spreadsheets: [
            'master_card_database_cleaned.csv',      // Final clean spreadsheet
            'sport_year_combinations_cleaned.csv',   // Final clean combinations
            'Card_Sets_cleaned.csv',                 // Final clean formatted sets
            'Statistics_cleaned.csv',                // Final clean statistics
            'spreadsheet_summary_cleaned.json'       // Final clean summary
        ],
        tools: [
            'clean-comprehensive-database.js',       // Final cleaning script
            'convert-to-spreadsheet-cleaned.js',     // Final spreadsheet converter
            'rebuild-sport-year-set-combinations.js', // Final combinations builder
            'cleanup-redundant-files.js',            // This cleanup script
            'cleanup-all-redundant-files.js'         // This comprehensive cleanup script
        ]
    };

    // Files to remove (redundant/outdated/test files)
    const removeFiles = {
        data: [
            // Old database versions
            'enhancedSetDatabase.json',
            'enhancedSetSummary.json', 
            'enhancedSetFlatList.json',
            'workingSetDatabase.json',
            'workingSetSummary.json',
            'cardSetsDatabase.json',
            'cardSets.json',
            'sportYearSetDatabase.json',
            'sportYearSetSummary.json',
            'sportYearSetFlatList.json',
            'sportIDsDatabase.json',
            'sportIDsSummary.json',
            'sportYearsFlatList.json',
            'databaseStats.json',
            'sportYearSetCombinationsFlatList.json'  // Redundant flat list
        ],
        spreadsheets: [
            // Old spreadsheet versions
            'master_card_database_complete.csv',
            'sport_year_combinations_complete.csv',
            'Card_Sets_complete.csv',
            'Statistics_complete.csv',
            'spreadsheet_summary_complete.json',
            'master_card_database.csv',
            'sport_year_combinations.csv',
            'Card_Sets.csv',
            'Statistics.csv',
            'spreadsheet_summary.json'
        ],
        tools: [
            // Old/duplicate scripts
            'build-comprehensive-card-database.js',
            'build-comprehensive-card-database-complete.js',
            'convert-to-spreadsheet.js',
            'convert-to-spreadsheet-complete.js',
            'build-enhanced-set-database.js',
            'build-working-set-database.js',
            'build-sport-year-set-database.js',
            'build-sport-ids-database.js',
            'build-getcardbase-id-database.js',
            'build-sport-years-database.js',
            'build-sport-year-set-combinations.js',
            
            // Test files
            'test-sport-ids-with-working-url.js',
            'test-set-parameter-combinations.js',
            'test-sport-year-filtering.js',
            'check-baseball-years.js',
            'test-enhanced-database.js',
            'test-getcardbase-comprehensive.js',
            'test-exact-working-request.js',
            'test-simple-getcardbase.js',
            'test-working-token.js',
            'test-getcardbase-no-cache.js',
            'simple-getcardbase-test.js',
            'quick-getcardbase-test.js',
            'test-updated-getcardbase.js',
            'test-getcardbase-cards.js',
            'test-getcardbase-website-structure.js',
            'test-getcardbase-raw-endpoints.js',
            'test-getcardbase-patterns.js',
            'analyze-getcardbase-structure.js',
            'debug-getcardbase-raw.js',
            'interactive-getcardbase.js',
            'test-getcardbase-service.js',
            'test-api.html',
            'test-api-results.js',
            'test-card-set-api.js'
        ]
    };

    let totalRemoved = 0;
    let totalSizeRemoved = 0;

    // Remove data files
    console.log('🗑️ Removing redundant data files...');
    removeFiles.data.forEach(filename => {
        const filepath = path.join(dataDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            fs.unlinkSync(filepath);
            totalRemoved++;
            totalSizeRemoved += stats.size;
            console.log(`  ✅ Removed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    });

    // Remove spreadsheet files
    console.log('\n🗑️ Removing redundant spreadsheet files...');
    removeFiles.spreadsheets.forEach(filename => {
        const filepath = path.join(spreadsheetsDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            fs.unlinkSync(filepath);
            totalRemoved++;
            totalSizeRemoved += stats.size;
            console.log(`  ✅ Removed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    });

    // Remove tool files
    console.log('\n🗑️ Removing redundant tool files...');
    removeFiles.tools.forEach(filename => {
        const filepath = path.join(toolsDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            fs.unlinkSync(filepath);
            totalRemoved++;
            totalSizeRemoved += stats.size;
            console.log(`  ✅ Removed: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
        }
    });

    // Show final summary
    console.log('\n📊 COMPREHENSIVE CLEANUP SUMMARY:');
    console.log('='.repeat(40));
    console.log(`Files removed: ${totalRemoved}`);
    console.log(`Space saved: ${(totalSizeRemoved / 1024 / 1024).toFixed(2)} MB`);
    
    // Show what we kept
    console.log('\n📁 FILES KEPT (Final Clean Versions):');
    console.log('='.repeat(45));
    
    console.log('\n📊 Data Files:');
    keepFiles.data.forEach(filename => {
        const filepath = path.join(dataDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            const size = stats.size > 1024 * 1024 ? 
                `${(stats.size / 1024 / 1024).toFixed(2)} MB` : 
                `${(stats.size / 1024).toFixed(2)} KB`;
            console.log(`  ✅ ${filename} (${size})`);
        }
    });

    console.log('\n📈 Spreadsheet Files:');
    keepFiles.spreadsheets.forEach(filename => {
        const filepath = path.join(spreadsheetsDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            const size = stats.size > 1024 * 1024 ? 
                `${(stats.size / 1024 / 1024).toFixed(2)} MB` : 
                `${(stats.size / 1024).toFixed(2)} KB`;
            console.log(`  ✅ ${filename} (${size})`);
        }
    });

    console.log('\n🔧 Tool Files:');
    keepFiles.tools.forEach(filename => {
        const filepath = path.join(toolsDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            console.log(`  ✅ ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
        }
    });

    console.log('\n✅ Comprehensive cleanup completed successfully!');
    console.log(`💾 Space saved: ${(totalSizeRemoved / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📁 Files removed: ${totalRemoved}`);
    console.log(`🎯 Kept only the essential, final versions of our database and tools.`);
    console.log(`📝 Note: README.md in tools directory was preserved for documentation.`);

    return {
        filesRemoved: totalRemoved,
        spaceSaved: totalSizeRemoved,
        keptFiles: {
            data: keepFiles.data.filter(f => fs.existsSync(path.join(dataDir, f))),
            spreadsheets: keepFiles.spreadsheets.filter(f => fs.existsSync(path.join(spreadsheetsDir, f))),
            tools: keepFiles.tools.filter(f => fs.existsSync(path.join(toolsDir, f)))
        }
    };
}

if (require.main === module) {
    cleanupAllRedundantFiles();
}

module.exports = { cleanupAllRedundantFiles };