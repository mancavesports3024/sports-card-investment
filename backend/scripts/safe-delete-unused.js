/**
 * Safe deletion script for unused code
 * Only deletes files that are clearly test/debug/fix scripts
 * 
 * Usage:
 *   node safe-delete-unused.js --dry-run  (preview only)
 *   node safe-delete-unused.js            (actual deletion)
 */

const fs = require('fs');
const path = require('path');

// Patterns for files that are safe to delete
const SAFE_TO_DELETE_PATTERNS = [
  /^test-.*\.js$/,
  /^debug-.*\.js$/,
  /^check-.*\.js$/,
  /^analyze-.*\.js$/,
  /^fix-.*\.js$/,
  /^update-.*\.js$/,
  /^add-.*\.js$/,
  /^remove-.*\.js$/,
  /^migrate-.*\.js$/,
  /^run-.*\.js$/,
  /^quick-.*\.js$/,
  /^simple-.*\.js$/,
  /^manual-.*\.js$/,
  /^comprehensive-.*\.js$/,
  /^extract-.*\.js$/,
  /^find-.*\.js$/,
  /^clear-.*\.js$/,
  /^export-.*\.js$/,
  /^view-.*\.js$/,
  /^show-.*\.js$/,
  /^validate-.*\.js$/,
  /^monitor-.*\.js$/,
  /^performance-.*\.js$/,
  /^regression-.*\.js$/,
  /^trigger-.*\.js$/,
  /^upload-.*\.js$/,
  /^copy-.*\.js$/,
  /^recreate-.*\.js$/,
  /^create-database-.*\.js$/,
  /^database-monitor\.js$/,
  /^sqlite-status\.js$/,
  /^health-check-only\.js$/,
  /^generate-sitemap\.js$/,
  /^get-railway-ip\.js$/,
  /^psa10-recent-database-builder\.js$/,
  /^pull-new-items\.js$/,
  /^railway-title-cleanup\.js$/,
  /^railway-summary-title-fix\.js$/,
  /^railway-migrate-searches\.js$/,
  /^migrate-saved-searches\.js$/,
  /^cleanup-.*\.js$/,
  /^detailed-summary-analysis\.js$/,
  /^direct-railway-analysis\.js$/,
  /^improved-api-good-buy-finder\.js$/,
  /^auto-parallel-lookup\.js$/,
  /^beckett-integration\.js$/,
  /^parallels-integration\.js$/,
  /^railway-parallels-database\.js$/,
  /^add-parallels-to-railway\.js$/,
  /^reset-parallels-database\.js$/,
  /^comprehensive-cleanup\.js$/,
  /^cleanup-unknown-brands\.js$/,
  /^migrate-newpricing-to-parallels\.js$/,
  /^fix-card-set-names\.js$/,
  /^extract-card-sets-from-newpricing\.js$/,
  /^check-databases\.js$/,
  /^check-scorecard-data\.js$/,
  /^migrate-scorecard-to-databases\.js$/,
  /^migrate-comprehensive-to-parallels\.js$/,
];

// Files to NEVER delete (even if they match patterns)
const NEVER_DELETE = [
  'index.js',
  'create-new-pricing-database.js',
  'ebay-price-updater.js',
  'simple-player-extraction.js',
  'summary-title-generator.js',
  'generate-standardized-summary-titles-database-driven.js',
  'generate-standardized-summary-titles-final.js',
  'railway-maintenance-job.js',
  'railway-maintenance-job-direct.js',
  'automated-maintenance-job.js',
  'fast-batch-pull-new-items.js',
  'fast-batch-pull-ebay.js',
  'new-pull-new-items.js',
  'improve-price-updating.js',
  'enhance-comprehensive-database.js',
  'recreate-comprehensive-on-railway.js',
  'fix-railway-database-schema.js',
  'remove-duplicate-card.js',
  'update-railway-comprehensive-db.js',
  'update-sport-detection.js',
  'fix-incorrect-unknown-sports.js',
  'fix-specific-summary-issues.js',
  'analyze-database-quality.js',
  'fix-price-anomalies.js',
  'fix-duplicates.js',
  'add-performance-indexes.js',
  'database-optimization-analysis.js',
  'railway-debug-cleanup.js',
  'check-railway-database.js',
  'check-railway-files.js',
  'manual-update-test.js',
  'call-centralized-player-update.js',
  'analyze-player-names-simple.js',
  'automated-title-fixer.js',
  'add-multiplier-field.js',
];

// Directories to skip
const SKIP_DIRECTORIES = [
  'node_modules',
  '.git',
  'routes',
  'middleware',
  'config',
];

function shouldDelete(filePath) {
  const fileName = path.basename(filePath);
  
  // Never delete protected files
  if (NEVER_DELETE.includes(fileName)) {
    return false;
  }
  
  // Skip if in protected directory
  const parts = filePath.split(path.sep);
  if (parts.some(part => SKIP_DIRECTORIES.includes(part))) {
    return false;
  }
  
  // Check if matches safe-to-delete patterns
  return SAFE_TO_DELETE_PATTERNS.some(pattern => pattern.test(fileName));
}

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!SKIP_DIRECTORIES.includes(file) && !file.startsWith('.')) {
        getAllJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const backendDir = path.join(__dirname, '..');
  const allFiles = getAllJsFiles(backendDir);
  
  const filesToDelete = allFiles.filter(shouldDelete);
  
  console.log(`📊 Found ${allFiles.length} JavaScript files`);
  console.log(`🗑️  Identified ${filesToDelete.length} files safe to delete\n`);
  
  if (filesToDelete.length === 0) {
    console.log('✅ No files to delete');
    return;
  }
  
  if (isDryRun) {
    console.log('🔍 DRY RUN - Files that would be deleted:\n');
    filesToDelete.forEach(file => {
      const relative = path.relative(backendDir, file);
      console.log(`  ❌ ${relative}`);
    });
    console.log(`\n💡 Run without --dry-run to actually delete these files`);
  } else {
    console.log('🗑️  Deleting files...\n');
    let deleted = 0;
    let errors = 0;
    
    filesToDelete.forEach(file => {
      try {
        const relative = path.relative(backendDir, file);
        fs.unlinkSync(file);
        console.log(`  ✅ Deleted: ${relative}`);
        deleted++;
      } catch (error) {
        console.error(`  ❌ Error deleting ${file}: ${error.message}`);
        errors++;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`  Deleted: ${deleted}`);
    console.log(`  Errors: ${errors}`);
    console.log(`\n✅ Cleanup complete!`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { shouldDelete, getAllJsFiles };

