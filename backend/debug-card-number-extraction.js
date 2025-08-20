// Debug script to test card number extraction
const testTitles = [
    "Tom Brady 2015 Topps Chrome #50 Graded PSA 10 GEM MINT New England Football Card",
    "1990 Fleer Basketball #26 Michael Jordan Chicago Bulls PSA 10 GEM MINT",
    "2019 Donruss Optic Kobe Bryant Rainmakers PSA 10 GEM MINT #19 Lakers",
    "2024 Panini Prizm Draft Picks #SJMC Jared McCain Signature PSA 10 GEM MINT 76ers"
];

const cardNumberPatterns = [
    // Standard card numbers like #123
    /#(\d+)/g,
    // Card numbers with letters like #BDC-168, #CDA-LK
    /#([A-Za-z]+[-\dA-Za-z]+)/g,
    // Card numbers with letters like #17hh
    /#(\d+[A-Za-z]+)/g,
    // Bowman Draft card numbers (BDP, BDC, CDA, etc.)
    /\b(BD[A-Z]?\d+)\b/g,
    // Card numbers with letters followed by numbers (like DT36, DT1, etc.)
    /\b([A-Z]{2,}\d+)\b/g,
    // Bomb Squad card numbers (BS3, BS5, etc.)
    /\b(BS\d+)\b/g,
    // Card numbers without # symbol (but be more careful about filtering)
    /\b(\d{1,3})\b/g
];

console.log("=== DEBUGGING CARD NUMBER EXTRACTION ===");

testTitles.forEach((title, index) => {
    console.log(`\nTest ${index + 1}: "${title}"`);
    
    cardNumberPatterns.forEach((pattern, patternIndex) => {
        console.log(`  Pattern ${patternIndex + 1}: ${pattern.source}`);
        
        let match;
        const matches = [];
        while ((match = pattern.exec(title)) !== null) {
            matches.push({
                fullMatch: match[0],
                captured: match[1] || match[0]
            });
        }
        
        if (matches.length > 0) {
            console.log(`    Matches:`, matches);
        } else {
            console.log(`    No matches`);
        }
    });
});
