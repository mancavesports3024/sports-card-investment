const fs = require('fs');

function fixCardTerms() {
    console.log('🔧 Fixing cardTerms array - removing "woo" and "red"...\n');
    
    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the cardTerms array line and remove "woo" and "red"
    const cardTermsPattern = /'woo', 'draft', 'red\/white\/blue'/;
    const replacement = "'draft', 'red/white/blue'";
    
    if (content.includes("'woo', 'draft', 'red/white/blue'")) {
        content = content.replace(cardTermsPattern, replacement);
        console.log('✅ Removed "woo" from cardTerms array');
    } else {
        console.log('⚠️  Could not find "woo" pattern');
    }
    
    // Also remove standalone "red" from the color list
    const redPattern = /'yellow', 'green', 'blue', 'red', 'black'/;
    const redReplacement = "'yellow', 'green', 'blue', 'black'";
    
    if (content.includes("'yellow', 'green', 'blue', 'red', 'black'")) {
        content = content.replace(redPattern, redReplacement);
        console.log('✅ Removed "red" from cardTerms array');
    } else {
        console.log('⚠️  Could not find "red" pattern');
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\n✅ Updated create-new-pricing-database.js');
}

fixCardTerms();
