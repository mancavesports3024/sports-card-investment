const NewPricingDatabase = require('./create-new-pricing-database.js');

async function debugKnownPlayersFinal() {
    const db = new NewPricingDatabase();
    
    console.log('🔍 DEBUGGING: KnownPlayers Check (Final)');
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
        
        // Find the knownPlayers step
        const knownPlayersStep = debug.find(step => step.step === 'knownPlayersHit');
        if (knownPlayersStep) {
            console.log(`   ✅ KnownPlayers HIT: "${knownPlayersStep.lowerPlayerName}" -> "${knownPlayersStep.result}"`);
        } else {
            console.log(`   ❌ KnownPlayers NOT HIT`);
        }
        
        // Show all steps for debugging
        debug.forEach((step, index) => {
            if (step.step === 'knownPlayersHit') {
                console.log(`   Step ${index}: ${step.step} - "${step.lowerPlayerName}" -> "${step.result}"`);
            } else if (step.step === 'final' || step.step === 'candidateSelected') {
                console.log(`   Step ${index}: ${step.step} - "${step.result || step.bestCandidate}"`);
            }
        });
        
        console.log('');
    }
}

debugKnownPlayersFinal();
