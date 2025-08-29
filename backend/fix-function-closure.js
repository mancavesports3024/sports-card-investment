const fs = require('fs');

function fixFunctionClosure() {
    console.log('🔧 FIXING: ExtractPlayerName Function Closure\n');

    const filePath = './create-new-pricing-database.js';
    let content = fs.readFileSync(filePath, 'utf8');

    // Add the missing closing logic for extractPlayerName function
    console.log('1️⃣ Adding missing closing logic...');
    
    const closingLogic = `
        // Step 10: Final processing and return
        // Clean up multiple spaces and trim
        cleanTitle = cleanTitle.replace(/\\s+/g, ' ').trim();
        
        // Split into tokens and find the best candidate
        const tokens = cleanTitle.split(' ').filter(token => token.length > 0);
        if (debugOn) steps.push({ step: 'tokens', tokens });
        
        // Find the longest token as the primary candidate
        let candidate = tokens.reduce((longest, current) => 
            current.length > longest.length ? current : longest, '');
        
        if (debugOn) steps.push({ step: 'candidateSelected', candidate });
        
        // If we have a good candidate, return it
        if (candidate && candidate.length >= 2) {
            // Apply proper capitalization
            const finalResult = candidate.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            if (debugOn) this._lastDebug = steps.concat([{ step: 'final', finalResult }]);
            return finalResult;
        }
        
        // Fallback: return the first non-empty token
        const fallback = tokens.find(token => token.length > 0);
        if (debugOn) steps.push({ step: 'afterFallback', fallback });
        
        if (fallback) {
            const finalResult = fallback.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            if (debugOn) this._lastDebug = steps.concat([{ step: 'final', finalResult }]);
            return finalResult;
        }
        
        // Last resort: return null
        if (debugOn) this._lastDebug = steps.concat([{ step: 'final', result: null }]);
        return null;
    }`;

    // Find where the function should end (after the knownPlayers object)
    const knownPlayersEndPattern = /'bernabel': 'Adael Amador',\s*\};/;
    if (content.match(knownPlayersEndPattern)) {
        content = content.replace(knownPlayersEndPattern, knownPlayersEndPattern.source + closingLogic);
        console.log('   ✅ Added missing closing logic');
    } else {
        console.log('   ⚠️  Could not find knownPlayers end');
    }

    // Write the updated content back to the file
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('\n✅ FUNCTION CLOSURE FIXED');
    console.log('   - Added missing closing logic for extractPlayerName function');
    console.log('   - Ready for testing');
}

fixFunctionClosure();
