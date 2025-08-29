const fs = require('fs');

function fixKnownPlayersPosition() {
    console.log('🔧 FIXING: KnownPlayers Check Position\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Add knownPlayers check at the beginning, right after the initial setup
    console.log('1️⃣ Adding knownPlayers check at beginning...');
    
    const earlyKnownPlayersCheck = `
        // Step 2: Check knownPlayers mapping early (before any other processing)
        const lowerPlayerName = playerName.toLowerCase();
        if (knownPlayers[lowerPlayerName]) {
            const result = knownPlayers[lowerPlayerName];
            if (debugOn) this._lastDebug = steps.concat([{ step: 'knownPlayersHit', lowerPlayerName, result }]);
            return result;
        }`;

    // Find the initial setup and add knownPlayers check right after it
    const initialSetupPattern = /if \(debugOn\) steps\.push\(\{ step: 'start', title \}\);/;
    if (content.match(initialSetupPattern)) {
        content = content.replace(initialSetupPattern, initialSetupPattern.source + earlyKnownPlayersCheck);
        console.log('   ✅ Added knownPlayers check at beginning');
    } else {
        console.log('   ⚠️  Could not find initial setup');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ KNOWNPLAYERS CHECK POSITION FIXED');
    console.log('   - Added knownPlayers check at beginning of function');
    console.log('   - Ready for testing');
}

fixKnownPlayersPosition();
