const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven');
const { detectSport, getPSAGrade, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

async function debugLeoDeVriesFix() {
    console.log('🔍 Debugging Leo DE VRIES Player Extraction...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    const testCard = "LEO DE VRIES 2024 Bowman's Best Prospect #TP-18 Silver Wave Refractor PSA 10 GEM";
    
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
    
    console.log('\n✅ Expected: "2024 Leo DE VRIES Bowman\'s Best Silver Wave Refractor #TP-18"');
}

debugLeoDeVriesFix().catch(console.error);
