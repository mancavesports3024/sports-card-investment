const fs = require('fs');

function fixFinalSyntax() {
    console.log('🔧 FIXING: Final Syntax Error\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix the literal backslashes
    console.log('1️⃣ Fixing literal backslashes...');
    
    // Replace the problematic line
    content = content.replace(
        /if \(debugOn\) steps\.push\(\{ step: 'start', title \}\);/,
        "if (debugOn) steps.push({ step: 'start', title });"
    );
    
    console.log('   ✅ Fixed literal backslashes');

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ FINAL SYNTAX ERROR FIXED');
    console.log('   - Fixed literal backslashes in regex replacement');
    console.log('   - Ready for testing');
}

fixFinalSyntax();
