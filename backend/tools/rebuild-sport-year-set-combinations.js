const fs = require('fs');
const path = require('path');

// Function to get all available years for each sport
function getAllSportYears(sportYearsData) {
    const sportYears = {};
    
    Object.entries(sportYearsData.sports).forEach(([sportName, sportData]) => {
        sportYears[sportName] = sportData.years.map(year => ({
            year: year.name,
            yearId: year.id,
            sportId: year.sportId
        }));
    });
    
    return sportYears;
}

// Function to get sets for a specific sport and year
function getSetsForSportYear(setsData, sport, year) {
    if (!setsData.sets || !Array.isArray(setsData.sets)) {
        return [];
    }
    
    return setsData.sets.filter(set => 
        set.sport === sport && set.year === year
    ).map(set => ({
        id: set.id,
        name: set.name,
        sport: set.sport,
        year: set.year,
        sportId: set.sportId || null,
        yearId: set.yearId || null
    }));
}

// Function to rebuild sport year set combinations
function rebuildSportYearSetCombinations(sportYearsData, setsData) {
    const combinations = {};
    const allSportYears = getAllSportYears(sportYearsData);
    
    // Process each sport
    Object.entries(allSportYears).forEach(([sportName, years]) => {
        combinations[sportName] = {};
        
        // Process each year for this sport
        years.forEach(yearData => {
            const year = yearData.year;
            const sets = getSetsForSportYear(setsData, sportName, year);
            
            combinations[sportName][year] = {
                year: year,
                yearId: yearData.yearId,
                sets: sets,
                setCount: sets.length
            };
        });
    });
    
    return {
        combinations: combinations,
        metadata: {
            lastUpdated: new Date().toISOString(),
            source: "sport_years_database + comprehensive_card_database",
            totalCombinations: Object.values(combinations).reduce((total, sport) => 
                total + Object.keys(sport).length, 0),
            totalSets: Object.values(combinations).reduce((total, sport) => 
                total + Object.values(sport).reduce((sportTotal, year) => 
                    sportTotal + year.setCount, 0), 0)
        }
    };
}

// Function to create a summary report
function createSummaryReport(combinationsData) {
    const summary = {
        sports: {},
        totalCombinations: 0,
        totalSets: 0,
        yearRange: { min: null, max: null }
    };
    
    Object.entries(combinationsData.combinations).forEach(([sport, years]) => {
        const sportYears = Object.keys(years);
        const sportSets = Object.values(years).reduce((total, year) => total + year.setCount, 0);
        
        summary.sports[sport] = {
            yearCount: sportYears.length,
            setCount: sportSets,
            years: sportYears.sort()
        };
        
        summary.totalCombinations += sportYears.length;
        summary.totalSets += sportSets;
        
        // Update year range
        const numericYears = sportYears.map(y => parseInt(y)).filter(y => !isNaN(y));
        if (numericYears.length > 0) {
            const minYear = Math.min(...numericYears);
            const maxYear = Math.max(...numericYears);
            
            if (summary.yearRange.min === null || minYear < summary.yearRange.min) {
                summary.yearRange.min = minYear;
            }
            if (summary.yearRange.max === null || maxYear > summary.yearRange.max) {
                summary.yearRange.max = maxYear;
            }
        }
    });
    
    return summary;
}

// Main execution
function main() {
    const sportYearsFile = path.join(__dirname, '..', 'data', 'sportYearsDatabase.json');
    const setsFile = path.join(__dirname, '..', 'data', 'comprehensiveCardDatabase.json');
    const outputFile = path.join(__dirname, '..', 'data', 'sportYearSetCombinations.json');
    const summaryFile = path.join(__dirname, '..', 'data', 'sportYearSetCombinationsSummary.json');
    
    try {
        console.log('Reading sport years database...');
        const sportYearsData = JSON.parse(fs.readFileSync(sportYearsFile, 'utf8'));
        
        console.log('Reading comprehensive card database...');
        const setsData = JSON.parse(fs.readFileSync(setsFile, 'utf8'));
        
        console.log('Rebuilding sport year set combinations...');
        const combinationsData = rebuildSportYearSetCombinations(sportYearsData, setsData);
        
        console.log('Creating summary report...');
        const summary = createSummaryReport(combinationsData);
        
        // Write the rebuilt combinations file
        console.log('Writing rebuilt combinations file...');
        fs.writeFileSync(outputFile, JSON.stringify(combinationsData, null, 2));
        
        // Write the summary file
        console.log('Writing summary file...');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        
        console.log('\nRebuild completed successfully!');
        console.log(`Total sport-year combinations: ${summary.totalCombinations}`);
        console.log(`Total sets across all combinations: ${summary.totalSets}`);
        console.log(`Year range: ${summary.yearRange.min} - ${summary.yearRange.max}`);
        
        console.log('\nSports processed:');
        Object.entries(summary.sports).forEach(([sport, data]) => {
            console.log(`  ${sport}: ${data.yearCount} years, ${data.setCount} sets`);
        });
        
        console.log(`\nFiles created/updated:`);
        console.log(`  - ${outputFile}`);
        console.log(`  - ${summaryFile}`);
        
    } catch (error) {
        console.error('Error rebuilding sport year set combinations:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { 
    rebuildSportYearSetCombinations, 
    getAllSportYears, 
    getSetsForSportYear,
    createSummaryReport 
};