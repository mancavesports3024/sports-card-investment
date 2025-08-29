const NewPricingDatabase = require('./create-new-pricing-database.js');

async function debugPeriodPatterns() {
    const db = new NewPricingDatabase();
    
    console.log('🔍 DEBUGGING: Period-Separated Initials Patterns');
    console.log('');
    
    const testCases = [
        "2023 Panini Prizm CJ Stroud Orange Lazer PSA 10 Gem Mint #339 RC Rookie Texans",
        "2023 Bowman Chrome Draft 1st CJ Kayfus Auto PSA 10",
        "2023-24 Topps UEFA CC Soccer Lamine Yamal #MJ9 RC Mojo Chrome PSA 10"
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const title = testCases[i];
        console.log(`${i + 1}. Testing: "${title}"`);
        
        // Test the regex pattern directly
        const periodInitialPattern = /\b([A-Z]{2,}\.[A-Z]\.[a-z]+)\b/g;
        const matches = title.match(periodInitialPattern);
        
        console.log(`   Period pattern matches: ${matches ? matches.join(', ') : 'none'}`);
        
        // Test with cleaned title
        let cleanTitle = title;
        
        // Remove card set, card type, card number, grading terms, etc.
        cleanTitle = cleanTitle.replace(/\b(19|20)\d{2}\b/g, ' ');
        cleanTitle = cleanTitle.replace(/\d+\/\d+/g, ' ');
        cleanTitle = cleanTitle.replace(/\b\d+\b/g, ' ');
        cleanTitle = cleanTitle.replace(/[^\w\s\/]/g, ' ').replace(/\s+/g, ' ').trim();
        
        console.log(`   Cleaned title: "${cleanTitle}"`);
        
        const cleanedMatches = cleanTitle.match(periodInitialPattern);
        console.log(`   Cleaned period pattern matches: ${cleanedMatches ? cleanedMatches.join(', ') : 'none'}`);
        
        console.log('');
    }
}

debugPeriodPatterns();
