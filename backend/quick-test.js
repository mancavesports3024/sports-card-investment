const { extractPlayerName } = require('./simple-player-extraction.js');

// Test the key improvements
const keyTests = [
    "2024 J.J. McCarthy Panini Prizm Blue Ice #19 /99 PSA 10", // Should preserve initials
    "2024 Ryan O'Hearn Panini Prizm #123 PSA 10", // Should preserve apostrophe
    "2024 Pedro De La Vega Panini Prizm #456 PSA 10", // Should preserve multi-word name
    "2024 LeBron James LA Lakers Panini Prizm #789 PSA 10", // Should preserve LeBron case
    "2024 Anthony Edwards Panini Prizm Bulls #123 PSA 10", // Should filter team name
    "2024 Montana/Rice Panini Prizm #456 PSA 10", // Should preserve dual player
];

console.log('🔧 Testing Key Improvements:\n');

keyTests.forEach((title, index) => {
    console.log(`Test ${index + 1}:`);
    console.log(`Input:  ${title}`);
    const result = extractPlayerName(title);
    console.log(`Output: ${result || 'null'}`);
    console.log('---');
});

console.log('✅ Quick test complete!');
