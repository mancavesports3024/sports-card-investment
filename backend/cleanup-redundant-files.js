const fs = require('fs');
const path = require('path');

// Files to remove (redundant, temporary, or obsolete)
const filesToRemove = [
    // Redundant duplicate scripts
    'find-duplicates.js',
    'find-low-price-items.js',
    'check-database-structure.js',
    'test-summary-titles.js',
    'fix-database-json.js',
    'test-good-buy-finder.js',
    'create-test-dataset.js',
    
    // Old test files
    'test-ebay-scraper-working.js',
    'test-ebay-detailed.js',
    'test-ebay-scraping-status.js',
    'test-ebay-browse-command.js',
    'test-search-items.js',
    'test-specific-item.js',
    'test-ebay-api.js',
    'test-ebay-bidding.js',
    'test-bleacher-scraping.js',
    'test-filtering.js',
    'test-charizard.js',
    'test-api.js',
    'test-ebay-direct.js',
    'test-simple-ebay.js',
    'test-live-listings.js',
    'test-charizard-cgc.js',
    'test-broader-search.js',
    'test-tag-graded.js',
    'test-condition-debug.js',
    'test-hfa-card.js',
    'test-bobby-witt.js',
    'test-token-exchange.js',
    'test-credentials.js',
    
    // Temporary and debug files
    'bleacher-seats-debug.html',
    'script type=textjavascript.txt',
    'debug-bleacher-html.js',
    'debug-ebay-browse.js',
    'debug-categorization.js',
    'debug-oauth.js',
    'debug-ebay.js',
    
    // Old good-buy-finder variants (keep only the latest)
    'simple-good-buy-finder.js',
    'demo-good-buy-finder.js',
    'efficient-good-buy-finder.js',
    'smart-good-buy-finder.js',
    'precise-good-buy-finder.js',
    'improved-good-buy-finder.js',
    'quick-good-buy-test.js',
    
    // Old database scripts
    'add-price-comparisons.js',
    'add-price-comparisons-recent.js',
    'export-to-spreadsheet.js',
    
    // Old sitemap scripts
    'generate-sitemap.js',
    'generate-sitemap-advanced.js',
    'auto-update-sitemap.js',
    
    // Old OAuth and setup files
    'get-refresh-token.js',
    'setup-oauth.js',
    'public-redirect-setup.js',
    'manual-token-setup.js',
    'redirect-handler.js',
    
    // Old eBay API test files
    'ebay-browse-api-commands.txt',
    'ebay-browse-command-example.js',
    'direct-scraping-test.js',
    
    // Old database files (keep only the final versions)
    'psa10_recent_90_days_database_cleaned.json',
    'psa10_recent_90_days_database_filtered.json',
    'duplicate_analysis_report.json',
    'duplicate_removal_details.json',
    'low_price_analysis.json',
    'low_price_removal_details.json'
];

// Directories to clean
const directoriesToClean = [
    'screenshots',
    'logs'
];

// Files to keep (essential files)
const essentialFiles = [
    'index.js',
    'package.json',
    'package-lock.json',
    'Procfile',
    'railway.json',
    'env.example',
    '.gitignore',
    
    // Optimized search engine (keep)
    'optimized-search-engine.js',
    'routes/optimizedSearchCards.js',
    'test-optimized-search.js',
    'performance-comparison.js',
    
    // Essential routes
    'routes/searchCards.js',
    'routes/searchHistory.js',
    'routes/liveListings.js',
    'routes/news.js',
    'routes/ebayBidding.js',
    'routes/spreadsheetManager.js',
    'routes/auth.js',
    'routes/imageAnalysis.js',
    
    // Essential services
    'services/ebayService.js',
    'services/130pointService.js',
    'services/ebayScraperService.js',
    'services/searchHistoryService.js',
    'services/cacheService.js',
    'services/ebayBiddingService.js',
    'services/releaseInfoService.js',
    'services/bleacherSeatsScraperService.js',
    'services/getCardBaseService.js',
    'services/spreadsheetManagerService.js',
    'services/imageAnalysisService.js',
    'services/ebayApiService.js',
    
    // Essential data files
    'data/psa10_recent_90_days_database.json',
    'data/psa10_recent_90_days_database_original_backup.json',
    'data/search_history.json',
    'data/featured_ebay_items.json',
    'data/optimized_search_performance_report.json',
    'data/performance_comparison_report.json',
    
    // Essential tools
    'tools/cleanup-all-redundant-files.js',
    'tools/cleanup-redundant-files.js',
    'tools/convert-to-spreadsheet-cleaned.js',
    'tools/rebuild-sport-year-set-combinations.js',
    'tools/README.md',
    
    // Essential scripts
    'scripts/buildCardSetDatabase.js',
    'scripts/buildEnhancedDatabase.js',
    'scripts/runDatabaseBuilder.js',
    
    // Essential middleware
    'middleware/cacheMiddleware.js',
    
    // Essential documentation
    'README.md',
    'DATABASE_MANAGEMENT_GUIDE.md',
    'DEPLOYMENT.md',
    'LOCAL_SETUP.md',
    'GOOGLE_OAUTH_SETUP.md',
    'GOOGLE_ANALYTICS_SETUP.md',
    'GOOGLE_ADSENSE_SETUP.md',
    'AI_SETUP.md',
    'AUCTION_PRICING_GUIDE.md',
    'PERFORMANCE_OPTIMIZATION.md',
    'DATA_PERSISTENCE_SETUP.md',
    'GOOD_BUY_OPPORTUNITIES_GUIDE.md',
    'SPREADSHEET_MANAGEMENT_GUIDE.md',
    'EBAY_BIDDING_PRODUCTION_SETUP.md',
    'EBAY_BIDDING_TOOL_README.md',
    
    // Essential database scripts (keep only the latest versions)
    'comprehensive-duplicate-check.js',
    'find-actual-low-price-items.js',
    'remove-low-price-items.js',
    'remove-duplicates.js',
    'improved-api-good-buy-finder.js',
    'api-good-buy-finder.js',
    'good-buy-opportunities.js',
    'database-updater.js',
    'database-monitor.js',
    'scheduled-updater.js',
    'psa10-recent-database-builder.js',
    
    // Cleanup plan
    'cleanup-plan.md'
];

function cleanupFiles() {
    console.log('🧹 CLEANING UP REDUNDANT FILES\n');
    console.log('='.repeat(50));
    
    let totalRemoved = 0;
    let totalSizeRemoved = 0;
    const removedFiles = [];
    
    // Remove specified files
    filesToRemove.forEach(filename => {
        const filePath = path.join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            try {
                const stats = fs.statSync(filePath);
                fs.unlinkSync(filePath);
                totalRemoved++;
                totalSizeRemoved += stats.size;
                removedFiles.push(filename);
                console.log(`  ✅ Removed: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            } catch (error) {
                console.log(`  ❌ Failed to remove: ${filename} - ${error.message}`);
            }
        }
    });
    
    // Clean directories
    directoriesToClean.forEach(dirName => {
        const dirPath = path.join(__dirname, dirName);
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                files.forEach(file => {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isFile()) {
                        fs.unlinkSync(filePath);
                        totalRemoved++;
                        totalSizeRemoved += stats.size;
                        removedFiles.push(`${dirName}/${file}`);
                        console.log(`  ✅ Removed: ${dirName}/${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                    }
                });
                // Remove empty directory
                fs.rmdirSync(dirPath);
                console.log(`  ✅ Removed empty directory: ${dirName}`);
            } catch (error) {
                console.log(`  ❌ Failed to clean directory: ${dirName} - ${error.message}`);
            }
        }
    });
    
    // Summary
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log('='.repeat(30));
    console.log(`Files removed: ${totalRemoved}`);
    console.log(`Space saved: ${(totalSizeRemoved / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n📁 FILES KEPT (Essential Files):');
    console.log('='.repeat(40));
    essentialFiles.forEach(filename => {
        const filePath = path.join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const size = stats.size > 1024 * 1024 
                ? `${(stats.size / 1024 / 1024).toFixed(2)} MB`
                : `${(stats.size / 1024).toFixed(2)} KB`;
            console.log(`  ✅ ${filename} (${size})`);
        }
    });
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log(`💾 Space saved: ${(totalSizeRemoved / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📁 Files removed: ${totalRemoved}`);
    console.log(`🎯 Kept only essential files for production.`);
    
    return {
        filesRemoved: totalRemoved,
        spaceSaved: totalSizeRemoved,
        removedFiles: removedFiles
    };
}

// Run cleanup if this file is executed directly
if (require.main === module) {
    cleanupFiles();
}

module.exports = { cleanupFiles }; 