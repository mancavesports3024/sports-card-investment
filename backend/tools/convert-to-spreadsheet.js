const fs = require('fs');
const path = require('path');

// Function to convert JSON to CSV
function jsonToCSV(data) {
    if (!data.sets || !Array.isArray(data.sets) || data.sets.length === 0) {
        console.log('No sets data found or invalid format');
        return null;
    }

    // Get headers from the first object
    const headers = Object.keys(data.sets[0]);
    
    // Create CSV header row
    let csv = headers.join(',') + '\n';
    
    // Add data rows
    data.sets.forEach(set => {
        const row = headers.map(header => {
            let value = set[header];
            
            // Handle different data types and escape commas/quotes
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string') {
                // Escape quotes and wrap in quotes if contains comma or quote
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            
            return value;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Function to convert sport year set combinations to CSV
function combinationsToCSV(combinationsData) {
    const rows = [];
    
    Object.entries(combinationsData.combinations).forEach(([sport, years]) => {
        Object.entries(years).forEach(([year, yearData]) => {
            if (yearData.sets && yearData.sets.length > 0) {
                yearData.sets.forEach(set => {
                    rows.push({
                        Sport: sport,
                        Year: year,
                        YearID: yearData.yearId,
                        SetID: set.id,
                        SetName: set.name,
                        SetCount: yearData.setCount
                    });
                });
            } else {
                // Include empty years for completeness
                rows.push({
                    Sport: sport,
                    Year: year,
                    YearID: yearData.yearId,
                    SetID: '',
                    SetName: '',
                    SetCount: 0
                });
            }
        });
    });
    
    if (rows.length === 0) {
        return null;
    }
    
    const headers = Object.keys(rows[0]);
    let csv = headers.join(',') + '\n';
    
    rows.forEach(row => {
        const csvRow = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            return value;
        });
        csv += csvRow.join(',') + '\n';
    });
    
    return csv;
}

// Function to create Excel-like spreadsheet with multiple sheets
function createMultiSheetSpreadsheet(data, combinationsData) {
    const workbook = {
        sheets: {}
    };
    
    // Main sets sheet
    if (data.sets && Array.isArray(data.sets)) {
        workbook.sheets['Card Sets'] = {
            headers: ['ID', 'Name', 'Sport', 'Year', 'Brand', 'Set Name', 'Source', 'Search Text', 'Display Name'],
            data: data.sets.map(set => [
                set.id,
                set.name,
                set.sport,
                set.year,
                set.brand,
                set.setName,
                set.source,
                set.searchText,
                set.displayName
            ])
        };
    }
    
    // Sport Year Combinations sheet
    if (combinationsData && combinationsData.combinations) {
        const combinationRows = [];
        Object.entries(combinationsData.combinations).forEach(([sport, years]) => {
            Object.entries(years).forEach(([year, yearData]) => {
                if (yearData.sets && yearData.sets.length > 0) {
                    yearData.sets.forEach(set => {
                        combinationRows.push([
                            sport,
                            year,
                            yearData.yearId,
                            set.id,
                            set.name,
                            yearData.setCount
                        ]);
                    });
                } else {
                    combinationRows.push([
                        sport,
                        year,
                        yearData.yearId,
                        '',
                        '',
                        0
                    ]);
                }
            });
        });
        
        workbook.sheets['Sport Year Combinations'] = {
            headers: ['Sport', 'Year', 'Year ID', 'Set ID', 'Set Name', 'Set Count'],
            data: combinationRows
        };
    }
    
    // Summary statistics sheet
    const stats = {
        totalSets: data.sets ? data.sets.length : 0,
        sports: {},
        years: {},
        brands: {},
        sources: {}
    };
    
    if (data.sets) {
        data.sets.forEach(set => {
            // Count sports
            if (set.sport) {
                stats.sports[set.sport] = (stats.sports[set.sport] || 0) + 1;
            }
            
            // Count years
            if (set.year) {
                stats.years[set.year] = (stats.years[set.year] || 0) + 1;
            }
            
            // Count brands
            if (set.brand) {
                stats.brands[set.brand] = (stats.brands[set.brand] || 0) + 1;
            }
            
            // Count sources
            if (set.source) {
                stats.sources[set.source] = (stats.sources[set.source] || 0) + 1;
            }
        });
    }
    
    workbook.sheets['Statistics'] = {
        headers: ['Category', 'Value', 'Count'],
        data: [
            ['Total Sets', '', stats.totalSets],
            ['', '', ''],
            ['Sports', '', ''],
            ...Object.entries(stats.sports).map(([sport, count]) => ['', sport, count]),
            ['', '', ''],
            ['Years', '', ''],
            ...Object.entries(stats.years).map(([year, count]) => ['', year, count]),
            ['', '', ''],
            ['Brands', '', ''],
            ...Object.entries(stats.brands).map(([brand, count]) => ['', brand, count]),
            ['', '', ''],
            ['Sources', '', ''],
            ...Object.entries(stats.sources).map(([source, count]) => ['', source, count])
        ]
    };
    
    return workbook;
}

// Function to convert workbook to CSV format (multiple files)
function workbookToCSV(workbook, outputDir) {
    const files = [];
    
    Object.entries(workbook.sheets).forEach(([sheetName, sheet]) => {
        const filename = `${sheetName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        const filepath = path.join(outputDir, filename);
        
        let csv = sheet.headers.join(',') + '\n';
        sheet.data.forEach(row => {
            const escapedRow = row.map(cell => {
                if (cell === null || cell === undefined) {
                    return '';
                }
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            });
            csv += escapedRow.join(',') + '\n';
        });
        
        fs.writeFileSync(filepath, csv);
        files.push(filepath);
    });
    
    return files;
}

// Main execution
function main() {
    const inputFile = path.join(__dirname, '..', 'data', 'comprehensiveCardDatabase.json');
    const combinationsFile = path.join(__dirname, '..', 'data', 'sportYearSetCombinations.json');
    const outputDir = path.join(__dirname, '..', 'data', 'spreadsheets');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        console.log('Reading comprehensive card database...');
        const rawData = fs.readFileSync(inputFile, 'utf8');
        const data = JSON.parse(rawData);
        
        console.log('Reading sport year set combinations...');
        const combinationsData = JSON.parse(fs.readFileSync(combinationsFile, 'utf8'));
        
        console.log(`Found ${data.sets ? data.sets.length : 0} card sets`);
        console.log(`Found ${combinationsData.metadata ? combinationsData.metadata.totalCombinations : 0} sport-year combinations`);
        
        // Create simple CSV for card sets
        console.log('Creating CSV spreadsheet for card sets...');
        const csv = jsonToCSV(data);
        if (csv) {
            const csvFile = path.join(outputDir, 'master_card_database.csv');
            fs.writeFileSync(csvFile, csv);
            console.log(`CSV file created: ${csvFile}`);
        }
        
        // Create CSV for sport year combinations
        console.log('Creating CSV spreadsheet for sport year combinations...');
        const combinationsCsv = combinationsToCSV(combinationsData);
        if (combinationsCsv) {
            const combinationsCsvFile = path.join(outputDir, 'sport_year_combinations.csv');
            fs.writeFileSync(combinationsCsvFile, combinationsCsv);
            console.log(`Combinations CSV file created: ${combinationsCsvFile}`);
        }
        
        // Create multi-sheet workbook
        console.log('Creating multi-sheet spreadsheet...');
        const workbook = createMultiSheetSpreadsheet(data, combinationsData);
        const files = workbookToCSV(workbook, outputDir);
        
        console.log('Spreadsheet files created:');
        files.forEach(file => {
            console.log(`  - ${file}`);
        });
        
        // Create a summary report
        const summary = {
            totalSets: data.sets ? data.sets.length : 0,
            totalCombinations: combinationsData.metadata ? combinationsData.metadata.totalCombinations : 0,
            totalSetsInCombinations: combinationsData.metadata ? combinationsData.metadata.totalSets : 0,
            sports: Object.keys(workbook.sheets['Statistics'].data.filter(row => row[0] === '' && row[1] && row[2] && row[1] !== 'Sports' && row[1] !== 'Years' && row[1] !== 'Brands' && row[1] !== 'Sources').slice(0, 10)),
            years: Object.keys(workbook.sheets['Statistics'].data.filter(row => row[0] === '' && row[1] && row[2] && row[1] !== 'Sports' && row[1] !== 'Years' && row[1] !== 'Brands' && row[1] !== 'Sources').slice(10, 20)),
            brands: Object.keys(workbook.sheets['Statistics'].data.filter(row => row[0] === '' && row[1] && row[2] && row[1] !== 'Sports' && row[1] !== 'Years' && row[1] !== 'Brands' && row[1] !== 'Sources').slice(20, 30)),
            filesCreated: files,
            generatedAt: new Date().toISOString()
        };
        
        const summaryFile = path.join(outputDir, 'spreadsheet_summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        console.log(`Summary file created: ${summaryFile}`);
        
        console.log('\nSpreadsheet creation completed successfully!');
        console.log(`Total sets processed: ${summary.totalSets}`);
        console.log(`Total sport-year combinations: ${summary.totalCombinations}`);
        console.log(`Files created in: ${outputDir}`);
        
    } catch (error) {
        console.error('Error creating spreadsheet:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { jsonToCSV, combinationsToCSV, createMultiSheetSpreadsheet, workbookToCSV };