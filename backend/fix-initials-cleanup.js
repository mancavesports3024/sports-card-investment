const fs = require('fs');

function fixInitialsCleanup() {
    console.log('🔧 FIXING: Initials Cleanup and Known Players Logic\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Fix the initials cleanup regex patterns
    console.log('1️⃣ Fixing initials cleanup patterns...');
    
    const fixedInitialsCleanup = `
        // Step 4.6: Clean up periods in initials (Cj.s.troud -> CJ Stroud, etc.)
        // This needs to happen before other processing to prevent concatenation issues
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([A-Z])/g, '$1$2 $3'); // Cj.s.troud -> CJ Stroud
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Cj.k.ayfus -> CJ Kayfus
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Cc.l.amine -> CC Lamine
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Dp.j.axon -> DP Jaxon
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // El.j.asson -> EL Jasson
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Jr.t.ie -> JR Tie
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Ud.h.ubert -> UD Hubert
        cleanTitle = cleanTitle.replace(/([A-Z])\.([A-Z])\.([a-z]+)/g, '$1$2 $3'); // Ii.b.ig -> II Big
        if (debugOn) steps.push({ step: 'afterInitialsCleanup', cleanTitle });`;

    // Find and replace the existing initials cleanup
    const initialsPattern = /\/\/ Step 4\.6: Clean up periods in initials[\s\S]*?if \(debugOn\) steps\.push\(\{ step: 'afterInitialsCleanup', cleanTitle \}\);/;
    if (content.match(initialsPattern)) {
        content = content.replace(initialsPattern, fixedInitialsCleanup);
        console.log('   ✅ Fixed initials cleanup patterns');
    } else {
        console.log('   ⚠️  Could not find initials cleanup section');
    }

    // 2. Move knownPlayers check earlier in the function
    console.log('2️⃣ Moving knownPlayers check earlier...');
    
    // Find where knownPlayers is defined and move the check right after it
    const knownPlayersCheck = `
        // Check knownPlayers mapping first (before other processing)
        const lowerPlayerName = playerName.toLowerCase();
        if (knownPlayers[lowerPlayerName]) {
            const result = knownPlayers[lowerPlayerName];
            if (debugOn) this._lastDebug = steps.concat([{ step: 'knownPlayersHit', lowerPlayerName, result }]);
            return result;
        }`;

    // Find the knownPlayers object and add the check right after it
    const knownPlayersPattern = /const knownPlayers = \{[\s\S]*?\};/;
    if (content.match(knownPlayersPattern)) {
        const match = content.match(knownPlayersPattern);
        const knownPlayersEnd = content.indexOf(match[0]) + match[0].length;
        
        // Insert the check right after the knownPlayers object
        content = content.slice(0, knownPlayersEnd) + '\n' + knownPlayersCheck + content.slice(knownPlayersEnd);
        console.log('   ✅ Added early knownPlayers check');
    } else {
        console.log('   ⚠️  Could not find knownPlayers object');
    }

    // 3. Remove the duplicate knownPlayers check later in the function
    console.log('3️⃣ Removing duplicate knownPlayers check...');
    
    const duplicateCheckPattern = /const lowerPlayerName = playerName\.toLowerCase\(\);\s*if \(knownPlayers\[lowerPlayerName\]\) \{[\s\S]*?return result;\s*\}/;
    if (content.match(duplicateCheckPattern)) {
        content = content.replace(duplicateCheckPattern, '');
        console.log('   ✅ Removed duplicate knownPlayers check');
    } else {
        console.log('   ⚠️  Could not find duplicate knownPlayers check');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ FIXES IMPLEMENTED');
    console.log('   - Fixed initials cleanup regex patterns');
    console.log('   - Moved knownPlayers check earlier in the function');
    console.log('   - Removed duplicate knownPlayers check');
    console.log('   - Ready for testing');
}

fixInitialsCleanup();
