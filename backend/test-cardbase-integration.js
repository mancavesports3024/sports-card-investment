const { CardBaseService } = require('./services/cardbaseService.js');

class CardBaseIntegrationTester {
    constructor() {
        this.cardbaseService = new CardBaseService();
    }

    async runAllTests() {
        console.log('🧪 Starting CardBase API Integration Tests\n');

        const testCases = [
            {
                name: 'Basic Baseball Card',
                query: '2021 Bowman Chrome Mike Trout Refractor',
                expected: { year: '2021', brand: 'Bowman', player: 'Mike Trout' }
            },
            {
                name: 'Football Card',
                query: '2022 Panini Select Red Prizm Ja\'Marr Chase',
                expected: { year: '2022', brand: 'Panini', player: 'Ja\'Marr Chase' }
            },
            {
                name: 'Basketball Card',
                query: '2023 Topps Chrome Junior Caminero Orange Wave Refractor',
                expected: { year: '2023', brand: 'Topps', player: 'Junior Caminero' }
            },
            {
                name: 'Autograph Card',
                query: '2020 Panini Prizm Justin Herbert Rookie Auto',
                expected: { year: '2020', brand: 'Panini', autograph: true }
            },
            {
                name: 'Simple Player Search',
                query: 'Mike Trout',
                expected: { player: 'Mike Trout' }
            }
        ];

        let passedTests = 0;
        let totalTests = testCases.length;

        for (const testCase of testCases) {
            console.log(`📋 Testing: ${testCase.name}`);
            console.log(`   Query: "${testCase.query}"`);
            
            try {
                const result = await this.cardbaseService.searchCard(testCase.query);
                const cardInfo = this.cardbaseService.extractCardInfo(result);
                const improvedTitle = this.cardbaseService.generateImprovedTitle(cardInfo, testCase.query);
                
                console.log(`   ✅ API Response: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                console.log(`   📊 Results Found: ${result.data?.items?.length || 0}`);
                
                if (cardInfo) {
                    console.log(`   📝 Extracted Info:`);
                    console.log(`      - Title: ${cardInfo.title}`);
                    console.log(`      - Year: ${cardInfo.year}`);
                    console.log(`      - Brand: ${cardInfo.brand}`);
                    console.log(`      - Set: ${cardInfo.set}`);
                    console.log(`      - Player: ${cardInfo.player}`);
                    console.log(`      - Card #: ${cardInfo.cardNumber}`);
                    console.log(`      - Autograph: ${cardInfo.autograph}`);
                    console.log(`      - Rookie: ${cardInfo.rookie}`);
                    console.log(`      - Rarity: ${cardInfo.rarityNumber}`);
                    
                    console.log(`   🔄 Title Improvement:`);
                    console.log(`      Original: ${testCase.query}`);
                    console.log(`      Improved: ${improvedTitle}`);
                    
                    // Test expectations
                    const testPassed = this.validateExpectations(cardInfo, testCase.expected);
                    if (testPassed) {
                        passedTests++;
                        console.log(`   ✅ Test PASSED`);
                    } else {
                        console.log(`   ❌ Test FAILED - Expectations not met`);
                    }
                } else {
                    console.log(`   ❌ No card info extracted`);
                }
                
            } catch (error) {
                console.log(`   ❌ Test ERROR: ${error.message}`);
            }
            
            console.log(''); // Empty line for readability
            
            // Add delay between tests to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! CardBase integration is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Review the output above for details.');
        }
    }

    validateExpectations(cardInfo, expected) {
        for (const [key, value] of Object.entries(expected)) {
            if (cardInfo[key] !== value) {
                console.log(`      ❌ Expected ${key}: "${value}", got: "${cardInfo[key]}"`);
                return false;
            }
        }
        return true;
    }

    async testSpecificCard(cardTitle) {
        console.log(`🔍 Testing specific card: "${cardTitle}"`);
        
        const result = await this.cardbaseService.searchCard(cardTitle);
        const cardInfo = this.cardbaseService.extractCardInfo(result);
        const improvedTitle = this.cardbaseService.generateImprovedTitle(cardInfo, cardTitle);
        
        console.log('📊 Results:');
        console.log(JSON.stringify({
            originalQuery: cardTitle,
            apiSuccess: result.success,
            resultsFound: result.data?.items?.length || 0,
            extractedInfo: cardInfo,
            improvedTitle: improvedTitle
        }, null, 2));
        
        return { result, cardInfo, improvedTitle };
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new CardBaseIntegrationTester();
    
    // Check if a specific card was provided as command line argument
    const specificCard = process.argv[2];
    
    if (specificCard) {
        tester.testSpecificCard(specificCard)
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Test failed:', error);
                process.exit(1);
            });
    } else {
        tester.runAllTests()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Tests failed:', error);
                process.exit(1);
            });
    }
}

module.exports = { CardBaseIntegrationTester };
