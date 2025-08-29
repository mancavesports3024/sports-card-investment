const NewPricingDatabase = require('./create-new-pricing-database.js');

function debugInitials() {
    console.log('🔍 DEBUGGING: Initials Cleanup Issues\n');

    const db = new NewPricingDatabase();
    
    // Test a simple case first
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
    
    // Test the regex directly
    console.log('\n🔧 Testing regex patterns directly:');
    let testString = "Cj.s.troud";
    console.log(`Original: "${testString}"`);
    
    testString = testString.replace(/([A-Z])\.([A-Z])\.([A-Z])/g, '$1$2 $3');
    console.log(`After first pattern: "${testString}"`);
    
    testString = testString.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3');
    console.log(`After second pattern: "${testString}"`);
    
    // Test with the actual title
    console.log('\n🔧 Testing with actual title:');
    let titleTest = "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans";
    console.log(`Original title: "${titleTest}"`);
    
    // Extract just the player name part
    const playerMatch = titleTest.match(/CJ Stroud/);
    if (playerMatch) {
        let playerPart = playerMatch[0];
        console.log(`Player part: "${playerPart}"`);
        
        // Test the regex on this part
        playerPart = playerPart.replace(/([A-Z])\.([A-Z])\.([A-Z])/g, '$1$2 $3');
        console.log(`After regex: "${playerPart}"`);
    }
}

debugInitials();
