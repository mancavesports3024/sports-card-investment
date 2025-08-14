const { ultimateMultiSportFilter, detectSport, getPSAGrade, isBaseParallel } = require('./ultimate-multi-sport-filtering-system');

function testComprehensiveFixes() {
    console.log('🧪 Testing Comprehensive Fixes...\n');
    
    const testCards = [
        // Sport detection tests
        { title: '2023 Jim Duggan Chronicles WWE Optic Blue /49 Auto PSA 10', expected: 'wrestling' },
        { title: '2024 Leo DE Bowman Wave Silver Refractor #TP-18 PSA 10', expected: 'baseball' },
        { title: '1991-92 Karl Malone Dream USA Basketball Skybox #535 PSA 10', expected: 'basketball' },
        
        // Parallel detection tests
        { title: '2022 Joe Burrow Electricity Donruss Optic /65 PSA 10', expected: 'football' },
        { title: '1994-95 Shaquille O\'Neal Flair PSA 10', expected: 'basketball' },
        { title: '2023 National Treasures Rookies #TRC-BYG /99 PSA 10', expected: 'football' },
        { title: '2024 Ceedee Lamb Panini Select Silver Prizm PSA 10', expected: 'football' },
        { title: '2020 Michael Vick Panini Mosaic Genesis PSA 10', expected: 'football' },
        { title: '2024 Cameron Brink Millionaire Prizm Monopoly WNBA Pink /5 PSA 10', expected: 'basketball' },
        
        // Player name tests
        { title: '2007 Derek Jeter Topps Finest Blue Refractor /399 PSA 10', expected: 'baseball' },
        { title: '2024 Julio Rodriguez Selections Chrome Sapphire PSA 10', expected: 'baseball' },
        { title: '2018-19 Shai Gilgeous-Alexander Chronicles Green PSA 10', expected: 'basketball' },
        { title: '2015 Carlos Correa Topps Heritage Purple Refractor PSA 10', expected: 'baseball' },
        { title: '2020-21 Deni Avdija Panini Prizm Silver Auto PSA 10', expected: 'basketball' },
        { title: '2000 Johan Santana Fleer Update PSA 10', expected: 'baseball' },
        { title: '2016 Kyle Schwarber Bowman Orange Refractor /50 Auto PSA 10', expected: 'baseball' },
        { title: '2002-03 Topps Finest LeBron James RC PSA 10', expected: 'basketball' },
        { title: '2024 Jasson Dominguez Topps Heritage Silver Refractor PSA 10', expected: 'baseball' }
    ];
    
    for (const card of testCards) {
        console.log(`🔍 Testing: ${card.title}`);
        
        const sport = detectSport(card.title);
        const psaGrade = getPSAGrade(card.title);
        const isBase = isBaseParallel(card.title);
        
        console.log(`  Sport detected: ${sport} (expected: ${card.expected})`);
        console.log(`  PSA Grade: ${psaGrade}`);
        console.log(`  Is base parallel: ${isBase}`);
        
        // Test filtering
        const passesFilter = ultimateMultiSportFilter({ title: card.title, price: { value: '100.00' } }, 'psa10');
        console.log(`  PSA 10 Filter: ${passesFilter ? '✅ PASS' : '❌ FAIL'}`);
        
        console.log('');
    }
}

testComprehensiveFixes();
