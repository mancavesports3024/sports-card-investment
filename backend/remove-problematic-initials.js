const fs = require('fs');

function removeProblematicInitials() {
    console.log('🔧 REMOVING: Problematic Initials Cleanup\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the problematic initials cleanup step
    console.log('1️⃣ Removing problematic initials cleanup...');
    
    const initialsCleanupPattern = /\/\/ Step 4\.6: Clean up periods in initials[\s\S]*?if \(debugOn\) steps\.push\(\{ step: 'afterInitialsCleanup', cleanTitle \}\);/;
    if (content.match(initialsCleanupPattern)) {
        content = content.replace(initialsCleanupPattern, '');
        console.log('   ✅ Removed problematic initials cleanup');
    } else {
        console.log('   ⚠️  Could not find initials cleanup section');
    }

    // Remove the early detection steps that were added
    console.log('2️⃣ Removing early detection steps...');
    
    const earlyDetectionPattern = /\/\/ Step 4\.7: Early detection for specific problematic cases[\s\S]*?return 'Patrick Mahomes II';\s*\}/;
    if (content.match(earlyDetectionPattern)) {
        content = content.replace(earlyDetectionPattern, '');
        console.log('   ✅ Removed early detection steps');
    } else {
        console.log('   ⚠️  Could not find early detection section');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ PROBLEMATIC CODE REMOVED');
    console.log('   - Removed initials cleanup that was affecting correct names');
    console.log('   - Removed early detection steps');
    console.log('   - Ready for testing with knownPlayers mappings only');
}

removeProblematicInitials();
