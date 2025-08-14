require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Function to analyze debug logs and extract rejection patterns
function analyzeFilterRejections(logContent) {
    console.log('🔍 ANALYZING FILTER REJECTIONS');
    console.log('================================');
    
    const lines = logContent.split('\n');
    const rejections = [];
    const currentCard = {};
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Find debug filter entries
        if (line.includes('🔍 DEBUG FILTER:')) {
            const match = line.match(/🔍 DEBUG FILTER: "([^"]+)" \((\w+)\)/);
            if (match) {
                currentCard.title = match[1];
                currentCard.type = match[2];
                currentCard.rejected = false;
                currentCard.reason = '';
                currentCard.sport = '';
                currentCard.hasExpensiveParallel = false;
                currentCard.isBaseParallel = false;
            }
        }
        
        // Extract sport
        if (line.includes('Sport:')) {
            const match = line.match(/Sport: (\w+)/);
            if (match) {
                currentCard.sport = match[1];
            }
        }
        
        // Extract expensive parallel status
        if (line.includes('Has Expensive Parallel:')) {
            const match = line.match(/Has Expensive Parallel: (\w+)/);
            if (match) {
                currentCard.hasExpensiveParallel = match[1] === 'true';
            }
        }
        
        // Extract base parallel status
        if (line.includes('Is Base Parallel:')) {
            const match = line.match(/Is Base Parallel: (\w+)/);
            if (match) {
                currentCard.isBaseParallel = match[1] === 'true';
            }
        }
        
        // Find rejections
        if (line.includes('❌ REJECTED:')) {
            currentCard.rejected = true;
            currentCard.reason = line.replace('❌ REJECTED:', '').trim();
            
            // Only track cards that were rejected due to expensive parallel but not base parallel
            if (currentCard.reason.includes('Has expensive parallel but not base parallel')) {
                rejections.push({...currentCard});
            }
        }
    }
    
    // Analyze rejections
    console.log(`📊 Found ${rejections.length} cards rejected due to expensive parallel filtering\n`);
    
    if (rejections.length === 0) {
        console.log('✅ No cards were rejected due to expensive parallel filtering!');
        return;
    }
    
    // Group by sport
    const bySport = {};
    rejections.forEach(card => {
        if (!bySport[card.sport]) {
            bySport[card.sport] = [];
        }
        bySport[card.sport].push(card);
    });
    
    // Analyze each sport
    Object.keys(bySport).forEach(sport => {
        console.log(`\n🏈 ${sport.toUpperCase()} (${bySport[sport].length} rejections):`);
        console.log('='.repeat(50));
        
        // Extract potential parallel terms from titles
        const parallelTerms = new Set();
        
        bySport[sport].forEach(card => {
            const title = card.title.toLowerCase();
            
            // Look for potential parallel terms (words that might be card types)
            const words = title.split(' ');
            words.forEach(word => {
                // Skip common words, numbers, and PSA grades
                if (word.length > 3 && 
                    !word.match(/^\d+$/) && 
                    !word.includes('psa') && 
                    !word.includes('graded') &&
                    !word.includes('case') &&
                    !word.includes('hit') &&
                    !word.includes('ssp') &&
                    !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'will', 'were'].includes(word)) {
                    parallelTerms.add(word);
                }
            });
        });
        
        // Show sample rejected cards
        console.log('\n📋 Sample rejected cards:');
        bySport[sport].slice(0, 5).forEach(card => {
            console.log(`   • ${card.title}`);
        });
        
        if (bySport[sport].length > 5) {
            console.log(`   ... and ${bySport[sport].length - 5} more`);
        }
        
        // Show potential parallel terms
        console.log('\n🔍 Potential parallel terms to add:');
        const sortedTerms = Array.from(parallelTerms).sort();
        sortedTerms.forEach(term => {
            console.log(`   '${term}',`);
        });
        
        // Generate code suggestions
        console.log('\n💻 Suggested code fix:');
        console.log(`// Add to ULTIMATE_SPORT_FILTERS.sportBase.${sport}:`);
        sortedTerms.forEach(term => {
            console.log(`'${term}',`);
        });
    });
    
    // Summary
    console.log('\n📈 SUMMARY:');
    console.log('===========');
    console.log(`Total rejections: ${rejections.length}`);
    Object.keys(bySport).forEach(sport => {
        console.log(`${sport}: ${bySport[sport].length} cards`);
    });
    console.log('\n💡 Next steps:');
    console.log('1. Review the suggested parallel terms above');
    console.log('2. Add legitimate base parallels to the sportBase arrays');
    console.log('3. Test the price update again');
}

// Main execution
if (require.main === module) {
    console.log('🔍 Filter Rejection Analyzer');
    console.log('============================\n');
    
    // Check if log file exists
    const logPath = path.join(__dirname, 'filter-debug.log');
    
    if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf8');
        analyzeFilterRejections(logContent);
    } else {
        console.log('❌ No log file found at filter-debug.log');
        console.log('\n📝 To use this script:');
        console.log('1. Copy the debug output from your price update job');
        console.log('2. Save it to backend/filter-debug.log');
        console.log('3. Run: node analyze-filter-rejections.js');
        console.log('\nOr pipe the output directly:');
        console.log('your-price-update-command | node analyze-filter-rejections.js');
    }
}

module.exports = { analyzeFilterRejections };
