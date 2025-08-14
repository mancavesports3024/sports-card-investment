require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Function to analyze debug logs and extract rejection patterns
function analyzeFilterRejections(logContent) {
    console.log('🔍 ANALYZING FILTER REJECTIONS');
    console.log('================================');

    const lines = logContent.split('\n');
    const rejections = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find rejection entries with the new format: "❌ REJECTED: reason card_title"
        if (line.includes('❌ REJECTED: Has expensive parallel but not base parallel')) {
            // Extract the card title from the rejection line
            const cardTitle = line.replace('❌ REJECTED: Has expensive parallel but not base parallel', '').trim();

            if (cardTitle) {
                rejections.push({
                    title: cardTitle,
                    reason: 'Has expensive parallel but not base parallel'
                });
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
        // Determine sport from card title
        let sport = 'unknown';
        const title = card.title.toLowerCase();

        if (title.includes('football') || title.includes('nfl') ||
            title.includes('brady') || title.includes('mahomes') ||
            title.includes('allen') || title.includes('burrow') ||
            title.includes('mccarthy') || title.includes('harrison') ||
            title.includes('lamb') || title.includes('nacua') ||
            title.includes('koepka') || title.includes('golf')) {
            sport = 'football';
        } else if (title.includes('basketball') || title.includes('nba') ||
                   title.includes('rose') || title.includes('bulls')) {
            sport = 'basketball';
        } else if (title.includes('baseball') || title.includes('mlb') ||
                   title.includes('robinson') || title.includes('dodgers')) {
            sport = 'baseball';
        }

        if (!bySport[sport]) {
            bySport[sport] = [];
        }
        bySport[sport].push(card);
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
                    !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'will', 'were', 'rc', 'rookie'].includes(word)) {
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
