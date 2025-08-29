const NewPricingDatabase = require('./create-new-pricing-database.js');

async function debugPlayerExtraction() {
    const db = new NewPricingDatabase();
    
    console.log('🔍 DEBUGGING: Player Name Extraction');
    console.log('');
    
    const testCases = [
        "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans",
        "2024 Donruss Jayden Daniels Optic Preview Red Wave 389 PSA 10",
        "2024 Donruss Optic Brock Bowers Purple Shock PSA 10 RC Raiders"
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const title = testCases[i];
        console.log(`${i + 1}. Testing: "${title}"`);
        
        // Enable debug mode
        db.debugOn = true;
        
        const result = db.extractPlayerName(title);
        const debug = db.getLastExtractionDebug();
        
        console.log(`   Result: "${result}"`);
        console.log(`   Debug steps:`);
        
        // Show all steps to understand the flow
        debug.forEach((step, index) => {
            if (step.step === 'candidateSelected' || step.step === 'expandedSingleToken' || 
                step.step === 'knownPlayersHit' || step.step === 'final') {
                console.log(`   Step ${index}: ${step.step} - "${step.playerName || step.result || step.bestCandidate || 'undefined'}"`);
            }
        });
        
        console.log('');
    }
}

debugPlayerExtraction();
