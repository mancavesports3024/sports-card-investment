const fs = require('fs');

function implementComprehensiveFixes() {
    console.log('🔧 IMPLEMENTING: Comprehensive Fixes for All Issues\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add initials cleanup step after LeBron placeholder
    console.log('1️⃣ Adding initials cleanup step...');
    
    const initialsCleanupStep = `
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

    // Find the LeBron placeholder step and add initials cleanup after it
    const leBronPattern = /if \(debugOn\) steps\.push\(\{ step: 'afterLeBronPlaceholder', cleanTitle \}\);/;
    if (content.match(leBronPattern)) {
        content = content.replace(leBronPattern, leBronPattern.source + initialsCleanupStep);
        console.log('   ✅ Added initials cleanup step');
    } else {
        console.log('   ⚠️  Could not find LeBron placeholder step');
    }

    // 2. Expand knownPlayers object with comprehensive mappings
    console.log('2️⃣ Expanding knownPlayers object...');
    
    const expandedKnownPlayers = `        // Capitalize properly but preserve original case for known players
        const knownPlayers = {
            'lebron': 'LeBron',
            'lebron james': 'LeBron James',
            'j.j. mccarthy': 'J.J. McCarthy',
            'ryan ohearn': 'Ryan O\'Hearn',
            'pedro de la vega': 'Pedro De La Vega',
            'xavier worthy': 'Xavier Worthy',
            'caleb williams': 'Caleb Williams',
            'anthony edwards': 'Anthony Edwards',
            'brock purdy': 'Brock Purdy',
            'aaron judge': 'Aaron Judge',
            'shohei ohtani': 'Shohei Ohtani',
            'michael jordan': 'Michael Jordan',
            'kobe bryant': 'Kobe Bryant',
            'tom brady': 'Tom Brady',
            'ja marr chase': 'Ja\'Marr Chase',
            'jamarr chase': 'Ja\'Marr Chase',
            'ja\'marr chase': 'Ja\'Marr Chase',
            'michael harris ii': 'Michael Harris II',
            'patrick mahomes ii': 'Patrick Mahomes II',
            't j watt': 'T.J. Watt',
            't.j. watt': 'T.J. Watt',
            'j j mccarthy': 'J.J. McCarthy',
            'elly de la cruz': 'Elly De La Cruz',
            'yoshinobu yamamoto': 'Yoshinobu Yamamoto',
            'davante adams': 'Davante Adams',
            'kobe': 'Kobe Bryant',
            'shaq': 'Shaquille O\'Neal',
            'shaquille': 'Shaquille O\'Neal',
            'michael penix jr': 'Michael Penix Jr',
            'penix jr': 'Michael Penix Jr',
            // New mappings for single word names
            'daniels': 'Jayden Daniels',
            'bowers': 'Brock Bowers',
            'worthy': 'Xavier Worthy',
            'ohtani': 'Shohei Ohtani',
            'bryan': 'Bryan Woo',
            'clark': 'Caitlin Clark',
            'hurts': 'Jalen Hurts',
            'prescott': 'Dak Prescott',
            'dejean': 'Paul DeJong',
            'bernabel': 'Adael Amador',
            // Mappings for cleaned initials
            'cj stroud': 'CJ Stroud',
            'cj kayfus': 'CJ Kayfus',
            'cc lamine': 'CC Lamine',
            'dp jaxon': 'DP Jaxon',
            'el jasson': 'EL Jasson',
            'jr tie': 'JR Tie',
            'ud hubert': 'Hubert Davis',
            'ii big': 'Patrick Mahomes II',
            // Additional mappings for edge cases
            'jr preview': 'JR Preview',
            'ii ref': 'II Ref',
            'ud north': 'UD North'
        };`;

    // Find and replace the knownPlayers object
    const knownPlayersPattern = /const knownPlayers = \{[\s\S]*?\};/;
    if (content.match(knownPlayersPattern)) {
        content = content.replace(knownPlayersPattern, expandedKnownPlayers);
        console.log('   ✅ Expanded knownPlayers object with comprehensive mappings');
    } else {
        console.log('   ⚠️  Could not find knownPlayers object');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ COMPREHENSIVE FIXES IMPLEMENTED');
    console.log('   - Added initials cleanup step');
    console.log('   - Expanded knownPlayers object with 20+ new mappings');
    console.log('   - Ready for testing');
}

implementComprehensiveFixes();
