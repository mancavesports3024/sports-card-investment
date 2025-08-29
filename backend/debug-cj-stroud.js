const NewPricingDatabase = require('./create-new-pricing-database.js');

async function debugCJStroud() {
    const db = new NewPricingDatabase();
    
    console.log('🔍 DEBUGGING: CJ Stroud Extraction');
    console.log('');
    
    const title = "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans";
    console.log(`Testing: "${title}"`);
    
    // Enable debug mode
    db.debugOn = true;
    
    const result = db.extractPlayerName(title);
    const debug = db.getLastExtractionDebug();
    
    console.log(`Result: "${result}"`);
    console.log(`Debug steps:`);
    
    // Show all debug steps
    debug.forEach((step, index) => {
        console.log(`Step ${index}: ${step.step} - ${JSON.stringify(step)}`);
    });
}

debugCJStroud();
