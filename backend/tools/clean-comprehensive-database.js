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

        // Filter out sets with Unknown values
        console.log('\n🧹 Cleaning database...');
        const cleanedSets = data.sets.filter(set => {
            return set.sport !== 'Unknown' && 
                   set.year !== 'Unknown' && 
                   set.brand !== 'Unknown';
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