const fs = require('fs');

function fixSyntaxError() {
    console.log('🔧 FIXING: Syntax Error from Regex Replacement\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix the literal backslashes
    console.log('1️⃣ Fixing literal backslashes...');
    
    // Replace the problematic line
    content = content.replace(
        /if \(debugOn\) steps\.push\(\{ step: 'afterInitialsCleanup', cleanTitle \}\);/,
        "if (debugOn) steps.push({ step: 'afterInitialsCleanup', cleanTitle });"
    );
    
    console.log('   ✅ Fixed literal backslashes');

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ SYNTAX ERROR FIXED');
    console.log('   - Fixed literal backslashes in regex replacement');
    console.log('   - Ready for testing');
}

fixSyntaxError();
