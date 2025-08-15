const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function runRegressionTests() {
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    console.log('🧪 Running Comprehensive Regression Tests...\n');
    
    const testCases = [
        // Original working cases (should still work)
        {
            title: "2023 Bowman Chrome Draft 1st CJ Kayfus Auto PSA 10",
            expected: {
                year: "2023",
                product: "Bowman Chrome Draft 1st",
                player: "CJ Kayfus",
                hasAuto: true,
                shouldContain: ["CJ Kayfus", "Auto"]
            }
        },
        {
            title: "2024 Bowman U Chrome Cooper Flagg #16 auto PSA 10",
            expected: {
                year: "2024",
                product: "Bowman University Chrome",
                player: "Cooper Flagg",
                hasAuto: true,
                shouldContain: ["Cooper Flagg", "Auto"]
            }
        },
        {
            title: "2023 Chronicles WWE \"Hacksaw\" Jim Duggan Optic Blue Auto PSA 10",
            expected: {
                year: "2023",
                product: "Chronicles WWE",
                player: "\"Hacksaw\" Jim Duggan",
                hasAuto: true,
                shouldContain: ["\"Hacksaw\" Jim Duggan", "Auto"]
            }
        },
        {
            title: "2023 Bowman Draft Luke Keaschall Draft Chrome #CDA-LK PSA 10",
            expected: {
                year: "2023",
                product: "Bowman Chrome Draft",
                player: "Luke Keaschall",
                hasAuto: false,
                shouldContain: ["Luke Keaschall", "#CDA-LK"]
            }
        },
        {
            title: "2008 Bowman Chrome Draft BDP26 Clayton Kershaw PSA 10",
            expected: {
                year: "2008",
                product: "Bowman Chrome Draft",
                player: "Clayton Kershaw",
                hasAuto: false,
                shouldContain: ["Clayton Kershaw", "BDP26"]
            }
        },
        {
            title: "2021 Topps Stadium Club Chrome 32 Babe Ruth Refractor PSA 10",
            expected: {
                year: "2021",
                product: "Topps Stadium Club Chrome",
                player: "Babe Ruth",
                hasAuto: false,
                shouldContain: ["Babe Ruth", "#32"]
            }
        },
        {
            title: "2024 Roman Anthony Bowman Sapphire Chrome Prospects PSA 10",
            expected: {
                year: "2024",
                product: "Bowman Sapphire Chrome Prospects",
                player: "Roman Anthony",
                hasAuto: false,
                shouldContain: ["Roman Anthony"]
            }
        },
        {
            title: "1996-97 KOBE BRYANT Metal #181 #97 Lakers PSA 10",
            expected: {
                year: "1996-97",
                product: "Metal",
                player: "Kobe Bryant",
                hasAuto: false,
                shouldContain: ["Kobe Bryant", "#181"]
            }
        },
        {
            title: "1998 Randy Moss Skybox E-X2001 Helmet Heroes #17hh Vikings PSA 10",
            expected: {
                year: "1998",
                product: "Skybox E-X2001",
                player: "Randy Moss",
                hasAuto: false,
                shouldContain: ["Randy Moss", "#17hh"]
            }
        },
        {
            title: "2023 Josue De Paula 1st Bowman Chrome Prospect Auto PSA 10",
            expected: {
                year: "2023",
                product: "Bowman Chrome Prospects",
                player: "Josue De Paula",
                hasAuto: true,
                shouldContain: ["Josue De Paula", "Auto"]
            }
        },
        {
            title: "2023 NSCC UEFA Topps Chrome Red #12 /5 #5 auto",
            expected: {
                year: "2023",
                product: "NSCC UEFA Topps Chrome",
                player: null, // This should be extracted as a player
                hasAuto: true,
                shouldContain: ["/5", "Auto"]
            }
        },
        {
            title: "2022 Chrome Jackson Holliday Bowman Chrome Draft #168",
            expected: {
                year: "2022",
                product: "Bowman Chrome Draft",
                player: "Jackson Holliday",
                hasAuto: false,
                shouldContain: ["Jackson Holliday", "#168"]
            }
        },
        {
            title: "2023 Chrome Refractor Luke Keaschall Draft Chrome Refractor #BDC-53",
            expected: {
                year: "2023",
                product: "Bowman Chrome Draft",
                player: "Luke Keaschall",
                hasAuto: false,
                shouldContain: ["Luke Keaschall", "#BDC-53"]
            }
        },
        {
            title: "2024 Keon Coleman Panini Donruss Optic Blue Prizm #263 /199",
            expected: {
                year: "2024",
                product: "Panini Donruss Optic",
                player: "Keon Coleman",
                hasAuto: false,
                shouldContain: ["Keon Coleman", "/199"]
            }
        },
        {
            title: "2013 KEENAN ALLEN Panini Prizm BLUE PRIZM ALLEN PULSAR #252",
            expected: {
                year: "2013",
                product: "Panini Prizm",
                player: "Keenan Allen",
                hasAuto: false,
                shouldContain: ["Keenan Allen", "Blue Pulsar"]
            }
        },
        // New test cases from recent fixes
        {
            title: "2024 Panini Prizm Football JJ McCarthy Orange Disco Prizm RC #400 PSA 10",
            expected: {
                year: "2024",
                product: "Panini Prizm",
                player: "JJ McCarthy",
                hasAuto: false,
                shouldContain: ["JJ McCarthy", "Disco Orange"]
            }
        },
        {
            title: "2023 Prizm DP Jaxon Smith-Njigba #135 Gold Ice RC Football Card PSA 10",
            expected: {
                year: "2023",
                product: "Prizm DP",
                player: "Jaxon Smith-Njigba",
                hasAuto: false,
                shouldContain: ["Jaxon Smith-Njigba", "Gold Ice"]
            }
        },
        {
            title: "Jayden Daniels 2024 Panini Optic Football #8 Light It Up Rookie RC - PSA 10 Gem",
            expected: {
                year: "2024",
                product: "Panini Optic",
                player: "Jayden Daniels",
                hasAuto: false,
                shouldContain: ["Jayden Daniels", "Light It Up"]
            }
        },
        // Edge cases and potential issues
        {
            title: "2023 De'Von Achane Panini Prizm Blue Pulsar #123 Auto PSA 10",
            expected: {
                year: "2023",
                product: "Panini Prizm",
                player: "De'Von Achane",
                hasAuto: true,
                shouldContain: ["De'Von Achane", "Auto"]
            }
        },
        {
            title: "2024 LeBron James One and One Downtown #25 PSA 10",
            expected: {
                year: "2024",
                product: "One and One",
                player: "LeBron James",
                hasAuto: false,
                shouldContain: ["LeBron James", "Downtown"]
            }
        },
        {
            title: "2023 Arda Guler Road To UEFA Euro #15 PSA 10",
            expected: {
                year: "2023",
                product: "Road To UEFA Euro",
                player: "Arda Guler",
                hasAuto: false,
                shouldContain: ["Arda Guler"]
            }
        },
        // NEW TEST CASES FOR THE 24 FIXED ISSUES
        {
            title: "2024 NOTORIETY GREEN Panini Mosaic #19 Jayden Daniels Rookie RC PSA 10",
            expected: {
                year: "2024",
                product: "Panini Mosaic",
                player: "Jayden Daniels",
                hasAuto: false,
                shouldContain: ["Jayden Daniels", "NOTORIETY GREEN"]
            }
        },
        {
            title: "2018 Shai Gilgeous- Panini Donruss Basketball Rated Rookie PSA 10",
            expected: {
                year: "2018",
                product: "Panini Donruss",
                player: "Shai Gilgeous-Alexander",
                hasAuto: false,
                shouldContain: ["Shai Gilgeous-Alexander"]
            }
        },
        {
            title: "2024 Panini Prizm #7 J.J. McCarthy Portals Rookie Card PSA 10",
            expected: {
                year: "2024",
                product: "Panini Prizm",
                player: "J.J. McCarthy",
                hasAuto: false,
                shouldContain: ["J.J. McCarthy", "Portals"]
            }
        },
        {
            title: "2024 Bowman Chrome 1st Vladi Guerrero Speckle Auto /299 PSA 10",
            expected: {
                year: "2024",
                product: "Bowman Chrome 1st",
                player: "Vladimir Guerrero",
                hasAuto: true,
                shouldContain: ["Vladimir Guerrero", "Auto", "/299"]
            }
        },
        {
            title: "2024 Panini Donruss Optic Pink #303 J.J. McCarthy - Optic Preview Pink RC PSA 10",
            expected: {
                year: "2024",
                product: "Panini Donruss Optic",
                player: "J.J. McCarthy",
                hasAuto: false,
                shouldContain: ["J.J. McCarthy", "Pink"]
            }
        },
        {
            title: "2024 Leo Leo DE VRIES Bowman's Best Prospect Silver Wave Refractor #TP-18 PSA 10",
            expected: {
                year: "2024",
                product: "Bowman's Best Prospect",
                player: "Leo DE VRIES",
                hasAuto: false,
                shouldContain: ["Leo DE VRIES", "Silver Wave Refractor", "#TP-18"]
            }
        },
        {
            title: "2023 Von Achane Panini Prizm Green Ice De'Von Achane Rookie PSA 10",
            expected: {
                year: "2023",
                product: "Panini Prizm",
                player: "De'Von Achane",
                hasAuto: false,
                shouldContain: ["De'Von Achane", "Green Ice"]
            }
        },
        {
            title: "2024 Ladd Mc Topps Chrome Pink Refractor 2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10",
            expected: {
                year: "2024",
                product: "Topps Chrome",
                player: "Ladd McConkey",
                hasAuto: false,
                shouldContain: ["Ladd McConkey", "Pink Refractor"]
            }
        },
        {
            title: "2024 Uptown John Donruss Optic #23 John Elway PSA 10 Graded Card Denver Broncos",
            expected: {
                year: "2024",
                product: "Panini Donruss Optic",
                player: "John Elway",
                hasAuto: false,
                shouldContain: ["John Elway", "Uptown"]
            }
        },
        {
            title: "2020-21 Penmanship Silver Panini Prizm #21 Auto Deni Avdija Rookie Penmanship Auto Silver PSA 10",
            expected: {
                year: "2020-21",
                product: "Panini Prizm",
                player: "Deni Avdija",
                hasAuto: true,
                shouldContain: ["Deni Avdija", "Auto", "Silver"]
            }
        },
        {
            title: "2024 Panini Prizm Emergent Blue Ice #19 /99 JJ McCarthy Blue Ice Prizm /99 PSA 10 RC",
            expected: {
                year: "2024",
                product: "Panini Prizm Emergent",
                player: "JJ McCarthy",
                hasAuto: false,
                shouldContain: ["JJ McCarthy", "Blue Ice", "/99"]
            }
        },
        {
            title: "2024 Liv Golf Panini Prizm Color Blast #3 Brooks Koepka Color Blast PSA 10",
            expected: {
                year: "2024",
                product: "Panini Prizm Liv Golf",
                player: "Brooks Koepka",
                hasAuto: false,
                shouldContain: ["Brooks Koepka", "Color Blast"]
            }
        },
        {
            title: "2024 All Etch Xfractor Topps Chrome Jayden Daniels All Etch Xfractor Rookie RC PSA 10",
            expected: {
                year: "2024",
                product: "Topps Chrome",
                player: "Jayden Daniels",
                hasAuto: false,
                shouldContain: ["Jayden Daniels", "All Etch Xfractor"]
            }
        },
        {
            title: "2022 Pro Debut Topps Chrome PSA 10 Elly De La Cruz Topps Chrome Pro Debut Reds Rookie Card RC",
            expected: {
                year: "2022",
                product: "Topps Chrome Pro Debut",
                player: "Elly De La Cruz",
                hasAuto: false,
                shouldContain: ["Elly De La Cruz"]
            }
        },
        {
            title: "2020 Nikola Jokic #1 Mosaic Basketball Overdrive #1 Nikola Jokic PSA 10",
            expected: {
                year: "2020",
                product: "Mosaic Basketball Overdrive",
                player: "Nikola Jokic",
                hasAuto: false,
                shouldContain: ["Nikola Jokic"]
            }
        },
        {
            title: "2024 Ladd Mc Spectra /30 Panini Spectra Football Ladd McConkey X Vision Meta /30 PSA 10",
            expected: {
                year: "2024",
                product: "Panini Spectra",
                player: "Ladd McConkey",
                hasAuto: false,
                shouldContain: ["Ladd McConkey", "X Vision Meta", "/30"]
            }
        },
        {
            title: "2024 Jared Mc Panini Prizm Draft #SJMC Auto Panini Prizm Draft Picks",
            expected: {
                year: "2024",
                product: "Panini Prizm Draft",
                player: "Jared McCarron",
                hasAuto: true,
                shouldContain: ["Jared McCarron", "Auto"]
            }
        },
        {
            title: "2016 - Concourse Tyreek Panini Select #65 Concourse Tyreek Hill #65 (RC) PSA 10",
            expected: {
                year: "2016",
                product: "Panini Select",
                player: "Tyreek Hill",
                hasAuto: false,
                shouldContain: ["Tyreek Hill", "Concourse"]
            }
        },
        {
            title: "2022 Edition Julio Rodriguez Topps Chrome Sapphire #67 Topps Chrome Sapphire Edition Julio Rodriguez #67 PSA 10",
            expected: {
                year: "2022",
                product: "Topps Chrome Sapphire",
                player: "Julio Rodriguez",
                hasAuto: false,
                shouldContain: ["Julio Rodriguez", "#67"]
            }
        },
        {
            title: "2024 Ladd Mc Topps Chrome Auto 2024 Topps Chrome Ladd McConkey Rookie Auto PSA 10",
            expected: {
                year: "2024",
                product: "Topps Chrome",
                player: "Ladd McConkey",
                hasAuto: true,
                shouldContain: ["Ladd McConkey", "Auto"]
            }
        },
        {
            title: "2024 - Debut Paul Chrome Update Refractor #USC27 Paul Skenes Chrome Update Refractor #USC27 PSA 10",
            expected: {
                year: "2024",
                product: "Topps Chrome Update",
                player: "Paul Skenes",
                hasAuto: false,
                shouldContain: ["Paul Skenes", "Refractor", "#USC27"]
            }
        },
        {
            title: "2024 Leo DE Bowman Wave Silver Refractor #TP-18 Leo DE VRIES Bowman Wave Silver Refractor #TP-18 PSA 10",
            expected: {
                year: "2024",
                product: "Bowman Wave",
                player: "Leo DE VRIES",
                hasAuto: false,
                shouldContain: ["Leo DE VRIES", "Silver Refractor", "#TP-18"]
            }
        },
        {
            title: "2024 Carthy Card Panini Prizm #7 J.J. McCarthy Portals Rookie Card PSA 10",
            expected: {
                year: "2024",
                product: "Panini Prizm",
                player: "J.J. McCarthy",
                hasAuto: false,
                shouldContain: ["J.J. McCarthy", "Portals"]
            }
        }
    ];
    
    let passedTests = 0;
    let failedTests = 0;
    let totalTests = testCases.length;
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`${i + 1}. Testing: "${testCase.title}"`);
        
        try {
            const year = generator.extractYear(testCase.title);
            const product = generator.extractProduct(testCase.title);
            const player = generator.extractPlayer(testCase.title);
            const colorNumbering = generator.extractColorNumbering(testCase.title);
            const hasAuto = generator.hasAutograph(testCase.title);
            const standardizedTitle = generator.generateStandardizedTitle(testCase.title);
            
            let testPassed = true;
            const issues = [];
            
            // Check year
            if (year !== testCase.expected.year) {
                testPassed = false;
                issues.push(`Year: expected "${testCase.expected.year}", got "${year}"`);
            }
            
            // Check product
            if (product !== testCase.expected.product) {
                testPassed = false;
                issues.push(`Product: expected "${testCase.expected.product}", got "${product}"`);
            }
            
            // Check player
            if (player !== testCase.expected.player) {
                testPassed = false;
                issues.push(`Player: expected "${testCase.expected.player}", got "${player}"`);
            }
            
            // Check autograph
            if (hasAuto !== testCase.expected.hasAuto) {
                testPassed = false;
                issues.push(`Auto: expected ${testCase.expected.hasAuto}, got ${hasAuto}`);
            }
            
            // Check required content
            for (const required of testCase.expected.shouldContain) {
                if (!standardizedTitle.includes(required)) {
                    testPassed = false;
                    issues.push(`Missing required content: "${required}"`);
                }
            }
            
            // Check for duplications
            const words = standardizedTitle.split(' ');
            const wordCount = {};
            words.forEach(word => {
                const cleanWord = word.toLowerCase();
                wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
            });
            
            const duplicates = Object.entries(wordCount).filter(([word, count]) => count > 1);
            if (duplicates.length > 0) {
                testPassed = false;
                issues.push(`Duplications found: ${duplicates.map(([word, count]) => `"${word}" (${count}x)`).join(', ')}`);
            }
            
            if (testPassed) {
                console.log(`   ✅ PASSED`);
                console.log(`   Standardized: ${standardizedTitle}`);
                passedTests++;
            } else {
                console.log(`   ❌ FAILED`);
                console.log(`   Issues: ${issues.join('; ')}`);
                console.log(`   Standardized: ${standardizedTitle}`);
                failedTests++;
            }
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            failedTests++;
        }
        
        console.log('');
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('📊 REGRESSION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests === 0) {
        console.log('\n🎉 ALL TESTS PASSED! No regressions detected.');
    } else {
        console.log('\n⚠️ Some tests failed. Please review the issues above.');
    }
    
    return { passedTests, failedTests, totalTests };
}

runRegressionTests().catch(console.error);
