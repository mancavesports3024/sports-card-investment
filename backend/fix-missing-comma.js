const fs = require('fs');

function fixMissingComma() {
    console.log('🔧 FIXING: Missing Comma in KnownPlayers Object\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix the missing comma
    console.log('1️⃣ Fixing missing comma...');
    
    // Replace the line that's missing a comma
    content = content.replace(
        /'ud north': 'UD North'\s*\n\s*\/\/ Mappings for actual extracted patterns/,
        "'ud north': 'UD North',\n            // Mappings for actual extracted patterns"
    );
    
    console.log('   ✅ Fixed missing comma');

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ MISSING COMMA FIXED');
    console.log('   - Fixed missing comma in knownPlayers object');
    console.log('   - Ready for testing');
}

fixMissingComma();
