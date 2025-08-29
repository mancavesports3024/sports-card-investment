const NewPricingDatabase = require('./create-new-pricing-database.js');

function debugInitialsAgain() {
    console.log('🔍 DEBUGGING: Initials Cleanup Issues (Again)\n');

    const db = new NewPricingDatabase();
    
    // Test the problematic cases
    const testCases = [
        "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans",
        "2023 Bowman Chrome Draft 1st CJ Kayfus Auto PSA 10",
        "2023-24 Topps UEFA CC Soccer Lamine Yamal #MJ9 RC Mojo Chrome PSA 10"
    ];
    
    testCases.forEach((testTitle, index) => {
        console.log(`\n--- Test Case ${index + 1} ---`);
        console.log(`Title: "${testTitle}"`);
        
        // Enable debug mode
        db.debugOn = true;
        const result = db.extractPlayerName(testTitle);
        const debugSteps = db.getLastExtractionDebug();
        
        console.log(`Result: "${result}"`);
        console.log('Debug steps:');
        debugSteps.forEach((step, stepIndex) => {
            console.log(`${stepIndex + 1}. ${step.step}: "${step.cleanTitle || step.result || 'N/A'}"`);
        });
    });
    
    // Test the regex patterns directly
    console.log('\n🔧 Testing regex patterns directly:');
    
    const testStrings = [
        "Cj.s.troud",
        "Cj.k.ayfus", 
        "Cc.l.amine",
        "Dp.j.axon",
        "El.j.asson",
        "Jr.t.ie",
        "Ud.h.ubert",
        "Ii.b.ig"
    ];
    
    testStrings.forEach(testString => {
        console.log(`\nOriginal: "${testString}"`);
        
        let result = testString;
        result = result.replace(/([A-Z])\.([A-Z])\.([A-Z])/g, '$1$2 $3');
        console.log(`After first pattern: "${result}"`);
        
        result = result.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3');
        console.log(`After second pattern: "${result}"`);
    });
}

debugInitialsAgain();
