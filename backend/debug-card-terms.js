const NewPricingDatabase = require('./create-new-pricing-database.js');

function debugCardTerms() {
    console.log('🔍 DEBUGGING: Card Terms Filtering Issues\n');

    const db = new NewPricingDatabase();
    
    // Test the problematic title
    const testTitle = "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans";
    console.log(`Testing: "${testTitle}"`);
    
    // Enable debug mode
    db.debugOn = true;
    const result = db.extractPlayerName(testTitle);
    const debugSteps = db.getLastExtractionDebug();
    
    console.log(`\nResult: "${result}"`);
    console.log('\nDebug steps:');
    debugSteps.forEach((step, index) => {
        console.log(`${index + 1}. ${step.step}: "${step.cleanTitle || step.result || 'N/A'}"`);
    });
    
    // Let's look at the cardTerms array to see what might be causing issues
    console.log('\n🔧 Checking cardTerms array:');
    const cardTerms = [
        'panini', 'prizm', 'orange', 'lazer', 'psa', 'gem', 'mint', 'rc', 'rookie', 'texans',
        'bowman', 'chrome', 'draft', 'auto', 'blue', 'refractor', 'mariners',
        'donruss', 'optic', 'preview', 'red', 'wave', 'purple', 'shock', 'raiders',
        'select', 'starcade', 'silver', 'prizm', 'case', 'hit', 'ssp',
        'topps', 'stadium', 'club', 'finest', 'checkerboard',
        'obsidian', 'black', 'color', 'blast', 'international', 'pulsar',
        'mosaic', 'camo', 'pink', 'notoriety', 'green',
        'rated', 'retro', 'gold', 'ice', 'football', 'card',
        'graded', 'gold', 'ice', 'smith', 'njigba',
        'uefa', 'soccer', 'yamal', 'mojo', 'chrome',
        'el', 'he13', 'dominguez', 'ref', 'rookie',
        'select', 'tie', 'dye', 'prizm',
        'ud', 'north', 'carolina', 'basketball', 'autographs',
        'score', 'big', 'man', 'campus'
    ];
    
    // Check which terms are in our test title
    const titleLower = testTitle.toLowerCase();
    const matchingTerms = cardTerms.filter(term => titleLower.includes(term));
    console.log('Matching card terms:', matchingTerms);
    
    // Simulate the filtering process
    let simulatedTitle = testTitle;
    matchingTerms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        simulatedTitle = simulatedTitle.replace(regex, ' ');
    });
    console.log(`After filtering: "${simulatedTitle}"`);
    
    // Clean up multiple spaces
    simulatedTitle = simulatedTitle.replace(/\s+/g, ' ').trim();
    console.log(`After cleanup: "${simulatedTitle}"`);
}

debugCardTerms();
