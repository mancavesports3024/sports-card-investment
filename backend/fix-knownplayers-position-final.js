const fs = require('fs');

function fixKnownPlayersPositionFinal() {
    console.log('🔧 FIXING: KnownPlayers Check Position (Final)\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the early knownPlayers check that's causing the error
    console.log('1️⃣ Removing early knownPlayers check...');
    
    const earlyKnownPlayersPattern = /\/\/ Step 2: Check knownPlayers mapping early[\s\S]*?return result;\s*\}/;
    if (content.match(earlyKnownPlayersPattern)) {
        content = content.replace(earlyKnownPlayersPattern, '');
        console.log('   ✅ Removed early knownPlayers check');
    } else {
        console.log('   ⚠️  Could not find early knownPlayers check');
    }

    // Add knownPlayers check right before the final processing
    console.log('2️⃣ Adding knownPlayers check before final processing...');
    
    const lateKnownPlayersCheck = `
        // Step 9.5: Check knownPlayers mapping before final processing
        const lowerPlayerName = playerName.toLowerCase();
        if (knownPlayers[lowerPlayerName]) {
            const result = knownPlayers[lowerPlayerName];
            if (debugOn) this._lastDebug = steps.concat([{ step: 'knownPlayersHit', lowerPlayerName, result }]);
            return result;
        }`;

    // Find the final processing step and add knownPlayers check before it
    const finalProcessingPattern = /\/\/ Step 10: Final processing and return/;
    if (content.match(finalProcessingPattern)) {
        content = content.replace(finalProcessingPattern, lateKnownPlayersCheck + '\n        ' + finalProcessingPattern.source);
        console.log('   ✅ Added knownPlayers check before final processing');
    } else {
        console.log('   ⚠️  Could not find final processing step');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ KNOWNPLAYERS CHECK POSITION FIXED');
    console.log('   - Removed early knownPlayers check that was causing error');
    console.log('   - Added knownPlayers check before final processing');
    console.log('   - Ready for testing');
}

fixKnownPlayersPositionFinal();
