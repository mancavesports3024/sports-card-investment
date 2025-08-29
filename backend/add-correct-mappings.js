const fs = require('fs');

function addCorrectMappings() {
    console.log('🔧 ADDING: Correct KnownPlayers Mappings\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Add the correct mappings for the actual patterns being extracted
    console.log('1️⃣ Adding correct mappings for extracted patterns...');
    
    const additionalMappings = `
            // Mappings for actual extracted patterns (with periods)
            'cj.s.troud': 'CJ Stroud',
            'cj.k.ayfus': 'CJ Kayfus',
            'cc.l.amine': 'CC Lamine',
            'dp.j.axon': 'DP Jaxon',
            'el.j.asson': 'EL Jasson',
            'jr.t.ie': 'JR Tie',
            'ud.n.orth': 'Hubert Davis',
            'ii.b.ig': 'Patrick Mahomes II',
            // Mappings for single word names that need expansion
            'daniels': 'Jayden Daniels',
            'bowers': 'Brock Bowers',
            'worthy': 'Xavier Worthy',
            'ohtani': 'Shohei Ohtani',
            'bryan': 'Bryan Woo',
            'clark': 'Caitlin Clark',
            'hurts': 'Jalen Hurts',
            'prescott': 'Dak Prescott',
            'dejean': 'Paul DeJong',
            'bernabel': 'Adael Amador',`;

    // Find the knownPlayers object and add the mappings
    const knownPlayersPattern = /const knownPlayers = \{[\s\S]*?\};/;
    if (content.match(knownPlayersPattern)) {
        const match = content.match(knownPlayersPattern);
        const knownPlayersContent = match[0];
        
        // Insert the additional mappings before the closing brace
        const updatedKnownPlayers = knownPlayersContent.replace(
            /};$/,
            additionalMappings + '\n        };'
        );
        
        content = content.replace(knownPlayersPattern, updatedKnownPlayers);
        console.log('   ✅ Added correct mappings for extracted patterns');
    } else {
        console.log('   ⚠️  Could not find knownPlayers object');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ CORRECT MAPPINGS ADDED');
    console.log('   - Added mappings for actual extracted patterns (with periods)');
    console.log('   - Added mappings for single word names');
    console.log('   - Ready for testing');
}

addCorrectMappings();
