const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven');
const { detectSport, getPSAGrade, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

async function debugBryceYoungIssue() {
    console.log('🔍 Debugging Bryce Young Player Extraction Issue...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    const testCard = "2023 Panini National Treasures Treasured Rookies Bryce Young #TRC-BYG /99 PSA 10";
    
    console.log(`🔍 Testing: ${testCard}`);
    
    // Test sport detection
    const sport = detectSport(testCard);
    console.log(`  Sport detected: ${sport}`);
    
    // Test player extraction
    const player = generator.extractPlayer(testCard);
    console.log(`  Player extracted: "${player}"`);
    
    // Test product extraction
    const product = generator.extractProduct(testCard);
    console.log(`  Product extracted: "${product}"`);
    
    // Test color/numbering extraction
    const colorNumbering = generator.extractColorNumbering(testCard, player);
    console.log(`  Color/Numbering extracted: "${colorNumbering}"`);
    
    // Test full title generation
    const standardizedTitle = generator.generateStandardizedTitle(testCard);
    console.log(`  Standardized title: "${standardizedTitle}"`);
    
    console.log('\n✅ Expected: "2023 National Treasures Bryce Young Treasured Rookies #TRC-BYG /99"');
}

debugBryceYoungIssue().catch(console.error);
