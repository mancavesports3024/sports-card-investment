const fs = require('fs');

// Read the current file
const filePath = './simple-player-extraction.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the line with the existing card set terms and add the missing ones
const missingTerms = [
    'throwback thursday', 'greetings winter', 'synergy', 'tint', '30th', 'dye', 'prodigies', 'year one', 'vmax', 'star'
];

// Find the line that ends with the existing terms
const searchPattern = /'o pee chee', 'brilliant full art', 'etopps classic', 'slania stamps', 'helmet heroes', 'world champion boxers', 'east west', 'duos', 'artist proof', 'anniversary', 'bomb squad rapture', 'big man on campus', 'young dolph', 'it up', 'ultra violet', 'bo knows', 'x meta', 'p p', 'hh', 'mega', 'pro'/;

if (searchPattern.test(content)) {
    // Add the missing terms
    const replacement = `'o pee chee', 'brilliant full art', 'etopps classic', 'slania stamps', 'helmet heroes', 'world champion boxers', 'east west', 'duos', 'artist proof', 'anniversary', 'bomb squad rapture', 'big man on campus', 'young dolph', 'it up', 'ultra violet', 'bo knows', 'x meta', 'p p', 'hh', 'mega', 'pro',
            
            // Additional Card Set Terms from Remaining 4+ Word Analysis
            '${missingTerms.join("', '")}'`;
    
    content = content.replace(searchPattern, replacement);
    
    // Write the updated content back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully added missing terms to simple-player-extraction.js');
} else {
    console.log('❌ Could not find the target line to add terms');
}
