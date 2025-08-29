/**
 * Cleanup Analysis Script
 * 
 * This script analyzes the codebase to identify files that can be cleaned up
 * after the new centralized player extraction system is tested and deployed.
 */

const fs = require('fs');
const path = require('path');

/**
 * Files to keep (core system)
 */
const KEEP_FILES = [
    // Core extraction system
    'simple-player-extraction.js',
    'test-simple-extraction.js',
    'card-filtering-terms.md',
    'README-Player-Extraction.md',
    'CENTRALIZED-SYSTEM-SUMMARY.md',
    'integration-example.js',
    
    // Production testing
    'test-production-extraction.js',
    'cleanup-analysis.js',
    
    // Essential project files
    'package.json',
    'package-lock.json',
    '.env',
    '.gitignore',
    'README.md',
    
    // Database and server files
    'server.js',
    'database.js',
    'create-new-pricing-database.js', // Keep this as it's the main database file
    
    // Any other essential files your app needs
];

/**
 * Files that can be cleaned up (old extraction logic)
 */
const CLEANUP_CANDIDATES = [
    // Old complex extraction files
    'extractPlayerName.js', // If this exists
    'player-extraction-old.js', // If this exists
    'complex-extraction.js', // If this exists
    
    // Temporary test files
    'test-old-extraction.js',
    'debug-extraction.js',
    'fix-extraction.js',
    
    // Old documentation
    'OLD-README.md',
    'extraction-notes.md',
    
    // Any other files with old extraction logic
];

/**
 * Analyze the current directory for cleanup opportunities
 */
function analyzeCleanup() {
    console.log('🧹 Analyzing Codebase for Cleanup Opportunities\n');
    
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    
    console.log('📁 Current directory files:\n');
    
    const keepFiles = [];
    const cleanupFiles = [];
    const otherFiles = [];
    
    files.forEach(file => {
        if (KEEP_FILES.includes(file)) {
            keepFiles.push(file);
        } else if (CLEANUP_CANDIDATES.includes(file)) {
            cleanupFiles.push(file);
        } else {
            otherFiles.push(file);
        }
    });
    
    console.log('✅ FILES TO KEEP (Core System):');
    keepFiles.forEach(file => {
        console.log(`   📄 ${file}`);
    });
    
    console.log('\n🗑️  FILES TO CLEAN UP (Old Logic):');
    if (cleanupFiles.length > 0) {
        cleanupFiles.forEach(file => {
            console.log(`   🗑️  ${file}`);
        });
    } else {
        console.log('   ✅ No cleanup candidates found');
    }
    
    console.log('\n❓ OTHER FILES (Review Needed):');
    if (otherFiles.length > 0) {
        otherFiles.forEach(file => {
            console.log(`   ❓ ${file}`);
        });
    } else {
        console.log('   ✅ No other files found');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files: ${files.length}`);
    console.log(`Files to keep: ${keepFiles.length}`);
    console.log(`Files to cleanup: ${cleanupFiles.length}`);
    console.log(`Files to review: ${otherFiles.length}`);
    
    return {
        keepFiles,
        cleanupFiles,
        otherFiles
    };
}

/**
 * Check for files that might contain old extraction logic
 */
function findOldExtractionLogic() {
    console.log('\n🔍 Searching for Old Extraction Logic\n');
    
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    
    const potentialOldLogic = [];
    
    files.forEach(file => {
        if (file.endsWith('.js') && !KEEP_FILES.includes(file)) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                
                // Look for signs of old extraction logic
                const oldLogicIndicators = [
                    'extractPlayerName',
                    'playerName',
                    'extraction',
                    'filtering',
                    'card terms',
                    'team terms',
                    'grading terms'
                ];
                
                let matchCount = 0;
                oldLogicIndicators.forEach(indicator => {
                    if (content.toLowerCase().includes(indicator.toLowerCase())) {
                        matchCount++;
                    }
                });
                
                if (matchCount >= 2) {
                    potentialOldLogic.push({
                        file,
                        matchCount,
                        indicators: oldLogicIndicators.filter(indicator => 
                            content.toLowerCase().includes(indicator.toLowerCase())
                        )
                    });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
    });
    
    if (potentialOldLogic.length > 0) {
        console.log('⚠️  POTENTIAL OLD EXTRACTION LOGIC FOUND:');
        potentialOldLogic.forEach(item => {
            console.log(`   📄 ${item.file} (${item.matchCount} indicators)`);
            console.log(`      Indicators: ${item.indicators.join(', ')}`);
        });
    } else {
        console.log('✅ No potential old extraction logic found');
    }
    
    return potentialOldLogic;
}

/**
 * Generate cleanup recommendations
 */
function generateCleanupRecommendations() {
    console.log('\n💡 CLEANUP RECOMMENDATIONS\n');
    
    console.log('1. 🧪 TEST FIRST:');
    console.log('   - Run test-production-extraction.js on Railway');
    console.log('   - Verify the new system works correctly');
    console.log('   - Ensure no regressions in player name extraction');
    
    console.log('\n2. 🔄 REPLACE OLD LOGIC:');
    console.log('   - Update your main database file to use the new system');
    console.log('   - Replace any calls to old extraction functions');
    console.log('   - Update API endpoints to use SimplePlayerExtractor');
    
    console.log('\n3. 🗑️  CLEANUP FILES:');
    console.log('   - Remove old extraction logic files');
    console.log('   - Clean up temporary test files');
    console.log('   - Remove outdated documentation');
    
    console.log('\n4. 📚 UPDATE DOCUMENTATION:');
    console.log('   - Update any references to old extraction methods');
    console.log('   - Ensure team knows to use the new centralized system');
    console.log('   - Update any deployment scripts if needed');
    
    console.log('\n5. 🚀 DEPLOY:');
    console.log('   - Deploy the updated code to Railway');
    console.log('   - Monitor for any issues');
    console.log('   - Run final validation tests');
}

/**
 * Create a cleanup script
 */
function createCleanupScript() {
    const cleanupScript = `#!/bin/bash
# Cleanup Script for Old Player Extraction Logic
# Run this AFTER testing the new system on production

echo "🧹 Starting cleanup of old extraction logic..."

# Remove old extraction files (uncomment after testing)
# rm -f extractPlayerName.js
# rm -f player-extraction-old.js
# rm -f complex-extraction.js

# Remove temporary test files
# rm -f test-old-extraction.js
# rm -f debug-extraction.js
# rm -f fix-extraction.js

# Remove old documentation
# rm -f OLD-README.md
# rm -f extraction-notes.md

echo "✅ Cleanup completed!"
echo "📝 Remember to update any references to old extraction methods"
`;

    fs.writeFileSync('cleanup.sh', cleanupScript);
    console.log('\n📝 Created cleanup.sh script (review before running)');
}

// Main execution
function main() {
    console.log('🚀 Starting Cleanup Analysis\n');
    
    const analysis = analyzeCleanup();
    const oldLogic = findOldExtractionLogic();
    generateCleanupRecommendations();
    createCleanupScript();
    
    console.log('\n✅ Cleanup analysis completed!');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Test the new system on Railway');
    console.log('2. Replace old extraction logic in your main files');
    console.log('3. Review cleanup.sh and run cleanup');
    console.log('4. Deploy the cleaned-up system');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    analyzeCleanup,
    findOldExtractionLogic,
    generateCleanupRecommendations
};
