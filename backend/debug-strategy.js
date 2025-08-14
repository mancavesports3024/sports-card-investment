function debugStrategy() {
    console.log('🔍 Debugging Strategy Generation...\n');

    const summaryTitle = "2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18";
    console.log(`Original: "${summaryTitle}"`);
    
    let simpleSearch = summaryTitle;
    
    // Convert "Leo DE VRIES" to "Leo DE" (specific case)
    if (simpleSearch.includes('Leo DE VRIES')) {
        simpleSearch = simpleSearch.replace('Leo DE VRIES', 'Leo DE');
        console.log(`After Leo DE VRIES replacement: "${simpleSearch}"`);
    }
    
    // General pattern: convert "FirstName LASTNAME LASTNAME" to "FirstName LASTNAME"
    simpleSearch = simpleSearch.replace(/\b([A-Z][a-z]+)\s+([A-Z]+)\s+([A-Z]+)\b/g, '$1 $2');
    console.log(`After regex replacement: "${simpleSearch}"`);
    
    simpleSearch = simpleSearch.replace(/\s+/g, ' ').trim();
    console.log(`After space normalization: "${simpleSearch}"`);
    
    console.log(`\nComparison:`);
    console.log(`  Original: "${summaryTitle}"`);
    console.log(`  Simple:   "${simpleSearch}"`);
    console.log(`  Are different: ${simpleSearch !== summaryTitle}`);
    console.log(`  Length > 10: ${simpleSearch.length > 10}`);
    console.log(`  Should add: ${simpleSearch !== summaryTitle && simpleSearch.length > 10}`);
}

debugStrategy();
