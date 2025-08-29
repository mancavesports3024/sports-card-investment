const fs = require('fs');

function moveKnownPlayersEarly() {
    console.log('🔧 MOVING: KnownPlayers Check to Beginning of Function\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the knownPlayers check from the end
    console.log('1️⃣ Removing knownPlayers check from end...');
    
    const endKnownPlayersPattern = /\/\/ Check knownPlayers mapping first \(before other processing\)[\s\S]*?return finalResult;\s*\}/;
    if (content.match(endKnownPlayersPattern)) {
        content = content.replace(endKnownPlayersPattern, '');
        console.log('   ✅ Removed knownPlayers check from end');
    } else {
        console.log('   ⚠️  Could not find end knownPlayers check');
    }

    // Add knownPlayers check at the beginning, right after the initial setup
    console.log('2️⃣ Adding knownPlayers check at beginning...');
    
    const earlyKnownPlayersCheck = `
        // Step 2: Check knownPlayers mapping early (before any other processing)
        const lowerPlayerName = playerName.toLowerCase();
        if (knownPlayers[lowerPlayerName]) {
            const result = knownPlayers[lowerPlayerName];
            if (debugOn) this._lastDebug = steps.concat([{ step: 'knownPlayersHit', lowerPlayerName, result }]);
            return result;
        }`;

    // Find the initial setup and add knownPlayers check right after it
    const initialSetupPattern = /if \(debugOn\) steps\.push\(\{ step: 'start', cleanTitle \}\);/;
    if (content.match(initialSetupPattern)) {
        content = content.replace(initialSetupPattern, initialSetupPattern.source + earlyKnownPlayersCheck);
        console.log('   ✅ Added knownPlayers check at beginning');
    } else {
        console.log('   ⚠️  Could not find initial setup');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ KNOWNPLAYERS CHECK MOVED');
    console.log('   - Moved knownPlayers check to beginning of function');
    console.log('   - Removed knownPlayers check from end');
    console.log('   - Ready for testing');
}

moveKnownPlayersEarly();
