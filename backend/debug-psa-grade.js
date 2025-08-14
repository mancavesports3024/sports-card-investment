const { getPSAGrade } = require('./ultimate-multi-sport-filtering-system');

function testPSAGrade() {
    console.log('🔍 Testing PSA Grade Detection...\n');
    
    const testTitles = [
        '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10',
        '2024 Ladd McConkey Topps Chrome Pink Refractor PSA 10',
        'Ladd McConkey PSA 10',
        'PSA 10 Ladd McConkey',
        'Ladd McConkey Gem Mint',
        'Ladd McConkey PSA Mint 10'
    ];
    
    for (const title of testTitles) {
        const grade = getPSAGrade(title);
        console.log(`Title: "${title}"`);
        console.log(`  PSA Grade: ${grade}`);
        console.log(`  Is PSA 10: ${grade === 10 ? 'YES' : 'NO'}`);
        console.log('');
    }
}

testPSAGrade();
