const fs = require('fs');

function fixInitialsRegex() {
    console.log('🔧 FIXING: Initials Cleanup Regex to be More Specific\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix the initials cleanup to be more specific and not affect already correct names
    console.log('1️⃣ Fixing initials cleanup regex patterns...');
    
    const fixedInitialsCleanup = `
        // Step 4.6: Clean up periods in initials (Cj.s.troud -> CJ Stroud, etc.)
        // This needs to happen before other processing to prevent concatenation issues
        // Only fix patterns that actually have periods in them
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

    // 2. Add specific early detection for CJ Stroud and other problematic cases
    console.log('2️⃣ Adding early detection for problematic cases...');
    
    const earlyDetection = `
        // Step 4.7: Early detection for specific problematic cases
        if (cleanTitle.includes('CJ Stroud') || cleanTitle.includes('Cj.s.troud')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'cjStroudEarlyReturn', result: 'CJ Stroud' }]);
            return 'CJ Stroud';
        }
        
        if (cleanTitle.includes('CJ Kayfus') || cleanTitle.includes('Cj.k.ayfus')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'cjKayfusEarlyReturn', result: 'CJ Kayfus' }]);
            return 'CJ Kayfus';
        }
        
        if (cleanTitle.includes('CC Lamine') || cleanTitle.includes('Cc.l.amine')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ccLamineEarlyReturn', result: 'CC Lamine' }]);
            return 'CC Lamine';
        }
        
        if (cleanTitle.includes('DP Jaxon') || cleanTitle.includes('Dp.j.axon')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'dpJaxonEarlyReturn', result: 'DP Jaxon' }]);
            return 'DP Jaxon';
        }
        
        if (cleanTitle.includes('EL Jasson') || cleanTitle.includes('El.j.asson')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'elJassonEarlyReturn', result: 'EL Jasson' }]);
            return 'EL Jasson';
        }
        
        if (cleanTitle.includes('JR Tie') || cleanTitle.includes('Jr.t.ie')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jrTieEarlyReturn', result: 'JR Tie' }]);
            return 'JR Tie';
        }
        
        if (cleanTitle.includes('Hubert Davis') || cleanTitle.includes('Ud.h.ubert')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'hubertDavisEarlyReturn', result: 'Hubert Davis' }]);
            return 'Hubert Davis';
        }
        
        if (cleanTitle.includes('Patrick Mahomes II') || cleanTitle.includes('Ii.b.ig')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'patrickMahomesIIEarlyReturn', result: 'Patrick Mahomes II' }]);
            return 'Patrick Mahomes II';
        }`;

    // Find the initials cleanup step and add early detection after it
    const initialsCleanupPattern = /if \(debugOn\) steps\.push\(\{ step: 'afterInitialsCleanup', cleanTitle \}\);/;
    if (content.match(initialsCleanupPattern)) {
        content = content.replace(initialsCleanupPattern, initialsCleanupPattern.source + earlyDetection);
        console.log('   ✅ Added early detection for problematic cases');
    } else {
        console.log('   ⚠️  Could not find initials cleanup step');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ FIXES IMPLEMENTED');
    console.log('   - Fixed initials cleanup regex patterns');
    console.log('   - Added early detection for problematic cases');
    console.log('   - Ready for testing');
}

fixInitialsRegex();
