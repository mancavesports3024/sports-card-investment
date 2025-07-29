const fs = require('fs');
const path = require('path');

function cleanComprehensiveDatabase() {
    console.log('🧹 CLEANING COMPREHENSIVE CARD DATABASE\n');
    console.log('='.repeat(60));

    const inputFile = path.join(__dirname, '..', 'data', 'comprehensiveCardDatabase.json');
    const outputFile = path.join(__dirname, '..', 'data', 'comprehensiveCardDatabase.json');
    const summaryFile = path.join(__dirname, '..', 'data', 'comprehensiveCardSummary.json');

    try {
        // Read the current database
        console.log('📖 Reading comprehensive card database...');
        const rawData = fs.readFileSync(inputFile, 'utf8');
        const data = JSON.parse(rawData);

        console.log(`📊 Original database stats:`);
        console.log(`  Total sets: ${data.sets.length}`);
        
        // Count unknowns before cleaning
        const unknownStats = {
            sport: 0,
            year: 0,
            brand: 0,
            totalWithUnknowns: 0
        };

        data.sets.forEach(set => {
            if (set.sport === 'Unknown') unknownStats.sport++;
            if (set.year === 'Unknown') unknownStats.year++;
            if (set.brand === 'Unknown') unknownStats.brand++;
            if (set.sport === 'Unknown' || set.year === 'Unknown' || set.brand === 'Unknown') {
                unknownStats.totalWithUnknowns++;
            }
        });

        console.log(`  Sets with Unknown sport: ${unknownStats.sport}`);
        console.log(`  Sets with Unknown year: ${unknownStats.year}`);
        console.log(`  Sets with Unknown brand: ${unknownStats.brand}`);
        console.log(`  Total sets with any Unknown: ${unknownStats.totalWithUnknowns}`);

        // Enhanced sealed product patterns to catch more variations
        const sealedProductPatterns = [
            /\bhobby\s+box\b/i,
            /\bhobby\s+case\b/i,
            /\bjumbo\s+hobby\s+case\b/i,
            /\bjumbo\s+box\b/i,
            /\bjumbo\s+pack\b/i,
            /\bjumbo\b/i,  // Standalone JUMBO
            /\bfactory\s+sealed\b/i,
            /\bsealed\s+box\b/i,
            /\bsealed\s+pack\b/i,
            /\bsealed\s+case\b/i,
            /\bbooster\s+box\b/i,
            /\bbooster\s+pack\b/i,
            /\bblaster\s+box\b/i,
            /\bblaster\s+pack\b/i,
            /\bfat\s+pack\b/i,
            /\bjumbo\s+pack\b/i,
            /\bretail\s+box\b/i,
            /\bretail\s+pack\b/i,
            /\bhanger\s+box\b/i,
            /\bhanger\s+pack\b/i,
            /\bvalue\s+pack\b/i,
            /\bvalue\s+box\b/i,
            /\bcomplete\s+set\b/i,
            /\bfactory\s+set\b/i,
            /\bsealed\s+product\b/i,
            /\bunopened\b/i,
            /\bsealed\s+item\b/i,
            /\bsealed\s+lot\b/i,
            /\bsuperbox\b/i,
            /\bmega\s+box\b/i,
            /\bcelebration\s+mega\s+box\b/i,
            /\bcase\s+of\b/i,
            /\bbreak\s+case\b/i,
            /\bcase\s+break\b/i,
            /\bwax\s+box\b/i,
            /\bcellos?\b/i,
            /\bwrappers?\b/i
        ];

        // Filter out sets with Unknown values and sealed products
        console.log('\n🧹 Cleaning database...');
        const cleanedSets = data.sets.filter(set => {
            // First check for Unknown values
            if (set.sport === 'Unknown' || set.year === 'Unknown' || set.brand === 'Unknown') {
                return false;
            }

            // Then check for sealed products
            const setName = (set.name || '').toLowerCase();
            const setDescription = (set.description || '').toLowerCase();
            
            // Check if name or description matches any sealed product pattern
            const isSealedProduct = sealedProductPatterns.some(pattern => 
                pattern.test(setName) || pattern.test(setDescription)
            );

            // Check for quantity indicators that suggest sealed products
            const hasQuantityIndicators = /\d+\s*(hobby\s+box|booster\s+box|blaster\s+box|retail\s+box|sealed\s+box|sealed\s+pack|sealed\s+case|lot\s+of|lots\s+of|bundle|complete\s+set|factory\s+set|hobby\s+case|jumbo\s+hobby\s+case)/i.test(setName);

            // Additional specific checks for problematic items
            const hasSpecificSealedTerms = (
                setName.includes('jumbo hobby case') ||
                setName.includes('superbox') ||
                setName.includes('mega box') ||
                setName.includes('celebration mega box') ||
                (setName.includes('sealed') && (setName.includes('box') || setName.includes('case') || setName.includes('pack')))
            );

            const shouldFilter = isSealedProduct || hasQuantityIndicators || hasSpecificSealedTerms;

            if (shouldFilter) {
                console.log(`[DATABASE FILTERED] Sealed product removed: "${set.name}"`);
            }

            return !shouldFilter;
        });

        console.log(`✅ Cleaning completed:`);
        console.log(`  Sets removed: ${data.sets.length - cleanedSets.length}`);
        console.log(`  Sets remaining: ${cleanedSets.length}`);

        // Update the database
        const cleanedData = {
            ...data,
            sets: cleanedSets,
            metadata: {
                ...data.metadata,
                lastUpdated: new Date().toISOString(),
                source: 'comprehensive_cleaned',
                totalSets: cleanedSets.length,
                cleaningStats: {
                    originalCount: data.sets.length,
                    removedCount: data.sets.length - cleanedSets.length,
                    unknownStats: unknownStats
                }
            }
        };

        // Save the cleaned database
        console.log('\n💾 Saving cleaned database...');
        fs.writeFileSync(outputFile, JSON.stringify(cleanedData, null, 2));

        // Create updated summary
        console.log('📋 Creating updated summary...');
        const summary = {
            lastUpdated: cleanedData.metadata.lastUpdated,
            totalSets: cleanedData.metadata.totalSets,
            sources: cleanedData.metadata.sources,
            cleaningStats: cleanedData.metadata.cleaningStats,
            sports: [...new Set(cleanedSets.map(s => s.sport))].sort(),
            years: [...new Set(cleanedSets.map(s => s.year))].sort(),
            brands: [...new Set(cleanedSets.map(s => s.brand))].sort(),
            sportBreakdown: Object.entries(
                cleanedSets.reduce((acc, set) => {
                    acc[set.sport] = (acc[set.sport] || 0) + 1;
                    return acc;
                }, {})
            ).map(([sport, count]) => ({ sport, count })).sort((a, b) => b.count - a.count),
            yearBreakdown: Object.entries(
                cleanedSets.reduce((acc, set) => {
                    acc[set.year] = (acc[set.year] || 0) + 1;
                    return acc;
                }, {})
            ).map(([year, count]) => ({ year, count })).sort((a, b) => parseInt(a.year) - parseInt(b.year)),
            brandBreakdown: Object.entries(
                cleanedSets.reduce((acc, set) => {
                    acc[set.brand] = (acc[set.brand] || 0) + 1;
                    return acc;
                }, {})
            ).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count)
        };

        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

        // Display results
        console.log('\n📊 CLEANED DATABASE SUMMARY:');
        console.log('='.repeat(50));
        console.log(`Total Sets: ${cleanedSets.length}`);
        console.log(`Sets Removed: ${data.sets.length - cleanedSets.length}`);
        console.log(`Sports: ${summary.sports.length} (${summary.sports.join(', ')})`);
        console.log(`Years: ${summary.years.length} (${summary.years[0]} - ${summary.years[summary.years.length-1]})`);
        console.log(`Brands: ${summary.brands.length} (${summary.brands.join(', ')})`);

        console.log('\n📈 Top Sports:');
        summary.sportBreakdown.slice(0, 10).forEach(({ sport, count }) => {
            console.log(`  ${sport}: ${count} sets`);
        });

        console.log('\n📅 Recent Years:');
        summary.yearBreakdown.slice(-10).forEach(({ year, count }) => {
            console.log(`  ${year}: ${count} sets`);
        });

        console.log('\n🏷️ Top Brands:');
        summary.brandBreakdown.slice(0, 10).forEach(({ brand, count }) => {
            console.log(`  ${brand}: ${count} sets`);
        });

        console.log('\n✅ Database cleaning completed successfully!');
        console.log(`📁 Cleaned database saved to: ${outputFile}`);
        console.log(`📁 Updated summary saved to: ${summaryFile}`);

        return {
            originalCount: data.sets.length,
            cleanedCount: cleanedSets.length,
            removedCount: data.sets.length - cleanedSets.length,
            unknownStats: unknownStats
        };

    } catch (error) {
        console.error('❌ Error cleaning comprehensive card database:', error);
        throw error;
    }
}

if (require.main === module) {
    cleanComprehensiveDatabase();
}

module.exports = { cleanComprehensiveDatabase };