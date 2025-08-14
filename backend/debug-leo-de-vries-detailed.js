const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven');

async function debugLeoDeVriesDetailed() {
    console.log('🔍 Detailed Debugging Leo DE VRIES Player Extraction...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    const testCard = "LEO DE VRIES 2024 Bowman's Best Prospect #TP-18 Silver Wave Refractor PSA 10 GEM";
    
    console.log(`🔍 Testing: ${testCard}`);
    
    // Test the cleaning process step by step
    let cleanTitle = testCard;
    const removeTerms = [
        'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'GEM MT', 'MT 10', 'MT10',
        'RC', 'Rookie', 'ROOKIE', 'rookie', 'SP', 'sp',
        'AUTO', 'auto', 'Autograph', 'autograph',
        'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
        'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
        'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population',
        'Hit', 'hit', 'HIT', 'Case', 'case', 'CASE'
    ];

    // Add card type terms
    const cardTypeTerms = [
        'chrome', 'refractor', 'draft', 'helmet', 'heroes', 'sapphire', 'optic', 'hit', 'basketball', 'one and one', 'downtown', 'road to uefa euro', 'usa basketball', 'downtown', 'skybox', 'light it up', 'disco', 'orange', 'prizm', 'mosaic', 'prospect', 'prospects', 'starcade', 'rejectors', 'treasured'
    ];
    
    removeTerms.push(...cardTypeTerms);
    
    console.log('\n🔍 Before cleaning:', cleanTitle);
    
    removeTerms.forEach(term => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
        const before = cleanTitle;
        cleanTitle = cleanTitle.replace(regex, '');
        if (before !== cleanTitle) {
            console.log(`  Removed "${term}": "${before}" -> "${cleanTitle}"`);
        }
    });
    
    console.log('\n🔍 After cleaning:', cleanTitle);
    
    // Test regex patterns
    const patterns = [
        /\b([A-Z]+)\s+([A-Z]+)\s+([A-Z]+)\b/g,  // Three-part all-caps
        /\b([A-Z]+)\s+([A-Z]+)\b/g,              // Two-part all-caps
    ];
    
    console.log('\n🔍 Testing regex patterns:');
    patterns.forEach((pattern, index) => {
        const matches = [...cleanTitle.matchAll(pattern)];
        console.log(`  Pattern ${index + 1}: ${pattern}`);
        matches.forEach(match => {
            console.log(`    Match: "${match[0]}" (groups: ${match.slice(1).join(', ')})`);
        });
    });
    
    // Test the actual extraction
    const player = generator.extractPlayer(testCard);
    console.log(`\n🔍 Final player extraction: "${player}"`);
}

debugLeoDeVriesDetailed().catch(console.error);
