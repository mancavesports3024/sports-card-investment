const NewPricingDatabase = require('./create-new-pricing-database.js');

function debugKnownPlayers() {
    console.log('🔍 DEBUGGING: KnownPlayers Mappings Not Working\n');

    const db = new NewPricingDatabase();
    
    // Test a simple case
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
    
    // Check if knownPlayers is being hit
    const knownPlayersHit = debugSteps.find(step => step.step === 'knownPlayersHit');
    if (knownPlayersHit) {
        console.log(`\n✅ KnownPlayers hit: "${knownPlayersHit.lowerPlayerName}" -> "${knownPlayersHit.result}"`);
    } else {
        console.log('\n❌ KnownPlayers not hit');
    }
    
    // Test the knownPlayers object directly
    console.log('\n🔧 Testing knownPlayers object directly:');
    const testNames = [
        'cj.s.troud',
        'cj.k.ayfus',
        'cc.l.amine',
        'dp.j.axon',
        'el.j.asson',
        'jr.t.ie',
        'ud.n.orth',
        'ii.b.ig',
        'daniels',
        'bowers',
        'worthy',
        'ohtani',
        'bryan'
    ];
    
    testNames.forEach(name => {
        const mapping = db.knownPlayers ? db.knownPlayers[name] : null;
        console.log(`"${name}": ${mapping ? `"${mapping}"` : 'NOT FOUND'}`);
    });
}

debugKnownPlayers();
