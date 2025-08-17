const https = require('https');

async function makeRequest(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({
                        status: 'success',
                        data: result
                    });
                } catch (error) {
                    resolve({
                        status: 'error',
                        code: res.statusCode,
                        message: 'Invalid JSON response',
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                status: 'error',
                code: 500,
                message: error.message
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({
                status: 'error',
                code: 408,
                message: 'Request timeout'
            });
        });

        req.end();
    });
}

async function analyzeSummaryTitles() {
    console.log('🔍 Analyzing all summary titles in the database...\n');
    
    try {
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards to analyze\n`);
        
        // Categories of issues
        const issues = {
            missingProduct: [],
            missingYear: [],
            missingPlayer: [],
            teamNamesInTitle: [],
            gradingTermsAsNumbers: [],
            unnecessaryWords: [],
            parsingErrors: [],
            capitalizationIssues: [],
            tooShort: [],
            tooLong: [],
            formattingIssues: [],
            suspiciousPatterns: [],
            allCaps: [],
            extraSpaces: [],
            trailingCommas: [],
            missingInfo: []
        };
        
        cards.forEach((card, index) => {
            const summaryTitle = card.summaryTitle || '';
            const playerName = card.playerName || '';
            const title = card.title || '';
            const cardId = card.id;
            
            // Check for missing product names (summary doesn't contain common product indicators)
            const hasProduct = summaryTitle.includes('Topps') || 
                             summaryTitle.includes('Panini') || 
                             summaryTitle.includes('Upper Deck') ||
                             summaryTitle.includes('Donruss') ||
                             summaryTitle.includes('Fleer') ||
                             summaryTitle.includes('Bowman') ||
                             summaryTitle.includes('Finest') ||
                             summaryTitle.includes('Mosaic') ||
                             summaryTitle.includes('Select') ||
                             summaryTitle.includes('Contenders') ||
                             summaryTitle.includes('Hoops') ||
                             summaryTitle.includes('Pokemon') ||
                             summaryTitle.includes('O-Pee-Chee') ||
                             summaryTitle.includes('Score') ||
                             summaryTitle.includes('Phoenix') ||
                             summaryTitle.includes('Chronicles') ||
                             summaryTitle.includes('Stadium Club') ||
                             summaryTitle.includes('Gallery') ||
                             summaryTitle.includes('Chrome Update') ||
                             summaryTitle.includes('Diamond Kings') ||
                             summaryTitle.includes('National Treasures') ||
                             summaryTitle.includes('Flawless') ||
                             summaryTitle.includes('Spectra') ||
                             summaryTitle.includes('Zenith') ||
                             summaryTitle.includes('One and One') ||
                             summaryTitle.includes('Slania Stamps') ||
                             summaryTitle.includes('Kellogg') ||
                             summaryTitle.includes('Skybox') ||
                             summaryTitle.includes('USA Basketball') ||
                             summaryTitle.includes('Fleer Metal') ||
                             summaryTitle.includes('Fleer Tradition') ||
                             summaryTitle.includes('Panini Absolute') ||
                             summaryTitle.includes('Panini Origins') ||
                             summaryTitle.includes('Panini Instant') ||
                             summaryTitle.includes('Panini Crown Royale') ||
                             summaryTitle.includes('Panini Limited') ||
                             summaryTitle.includes('Panini Threads') ||
                             summaryTitle.includes('Panini Certified') ||
                             summaryTitle.includes('Panini Triple Threads') ||
                             summaryTitle.includes('Panini Tribute') ||
                             summaryTitle.includes('Panini Rookies & Stars') ||
                             summaryTitle.includes('Panini Elite') ||
                             summaryTitle.includes('Panini Prestige') ||
                             summaryTitle.includes('Upper Deck Young Guns') ||
                             summaryTitle.includes('Upper Deck Synergy') ||
                             summaryTitle.includes('Panini Prizm DP') ||
                             summaryTitle.includes('Panini Prizm WNBA') ||
                             summaryTitle.includes('Panini Prizm Monopoly WNBA') ||
                             summaryTitle.includes('Topps Heritage') ||
                             summaryTitle.includes('Topps Archives') ||
                             summaryTitle.includes('Topps Update') ||
                             summaryTitle.includes('Topps Allen & Ginter') ||
                             summaryTitle.includes('Topps Gypsy Queen') ||
                             summaryTitle.includes('Bowman Chrome') ||
                             summaryTitle.includes('Panini Mosaic') ||
                             summaryTitle.includes('Panini Absolute') ||
                             summaryTitle.includes('Panini Zenith') ||
                             summaryTitle.includes('Panini Diamond Kings') ||
                             summaryTitle.includes('Panini Origins') ||
                             summaryTitle.includes('Panini One and One') ||
                             summaryTitle.includes('Panini Instant') ||
                             summaryTitle.includes('Panini Contenders') ||
                             summaryTitle.includes('Panini Immaculate') ||
                             summaryTitle.includes('Panini National Treasures') ||
                             summaryTitle.includes('Panini Spectra') ||
                             summaryTitle.includes('Panini Crown Royale') ||
                             summaryTitle.includes('Panini Limited') ||
                             summaryTitle.includes('Panini Threads') ||
                             summaryTitle.includes('Panini Certified') ||
                             summaryTitle.includes('Panini Triple Threads') ||
                             summaryTitle.includes('Panini Tribute') ||
                             summaryTitle.includes('Panini Rookies & Stars') ||
                             summaryTitle.includes('Panini Elite') ||
                             summaryTitle.includes('Panini Prestige') ||
                             summaryTitle.includes('Upper Deck Young Guns') ||
                             summaryTitle.includes('Upper Deck Synergy') ||
                             summaryTitle.includes('Slania Stamps') ||
                             summaryTitle.includes('Kellogg') ||
                             summaryTitle.includes('O-Pee-Chee') ||
                             summaryTitle.includes('Fleer Metal') ||
                             summaryTitle.includes('Fleer Tradition') ||
                             summaryTitle.includes('Fleer') ||
                             summaryTitle.includes('Prizm') ||
                             summaryTitle.includes('Chrome') ||
                             summaryTitle.includes('Road To UEFA') ||
                             summaryTitle.includes('Monopoly') ||
                             summaryTitle.includes('Downtown') ||
                             summaryTitle.includes('Helmet Heroes') ||
                             summaryTitle.includes('Color Blast') ||
                             summaryTitle.includes('Emergent') ||
                             summaryTitle.includes('Reactive') ||
                             summaryTitle.includes('Wave') ||
                             summaryTitle.includes('Shimmer') ||
                             summaryTitle.includes('Disco') ||
                             summaryTitle.includes('Optic') ||
                             summaryTitle.includes('Refractor') ||
                             summaryTitle.includes('X-Fractor') ||
                             summaryTitle.includes('Green Refractor') ||
                             summaryTitle.includes('Pink Refractor') ||
                             summaryTitle.includes('Blue Refractor') ||
                             summaryTitle.includes('Silver') ||
                             summaryTitle.includes('Gold') ||
                             summaryTitle.includes('Black') ||
                             summaryTitle.includes('Purple') ||
                             summaryTitle.includes('Orange') ||
                             summaryTitle.includes('Red') ||
                             summaryTitle.includes('Blue') ||
                             summaryTitle.includes('Green') ||
                             summaryTitle.includes('Prizm Black') ||
                             summaryTitle.includes('Prizm Silver') ||
                             summaryTitle.includes('Prizm Gold') ||
                             summaryTitle.includes('Prizm Orange') ||
                             summaryTitle.includes('Prizm Purple') ||
                             summaryTitle.includes('Prizm Green') ||
                             summaryTitle.includes('Prizm Blue') ||
                             summaryTitle.includes('Prizm Red');
            
            if (!hasProduct && summaryTitle.length > 10) {
                issues.missingProduct.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for missing year
            const hasYear = /^\d{4}/.test(summaryTitle);
            if (!hasYear) {
                issues.missingYear.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for missing player name
            if (playerName && !summaryTitle.includes(playerName)) {
                issues.missingPlayer.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for too short summary titles
            if (summaryTitle.length < 15) {
                issues.tooShort.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for too long summary titles
            if (summaryTitle.length > 150) {
                issues.tooLong.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for ALL CAPS
            if (summaryTitle === summaryTitle.toUpperCase() && summaryTitle.length > 10) {
                issues.allCaps.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for extra spaces
            if (summaryTitle.includes('  ') || summaryTitle.startsWith(' ') || summaryTitle.endsWith(' ')) {
                issues.extraSpaces.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for trailing commas
            if (summaryTitle.endsWith(',') || summaryTitle.includes(',,')) {
                issues.trailingCommas.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
            
            // Check for suspicious patterns
            if (summaryTitle.includes('undefined') || 
                summaryTitle.includes('null') || 
                summaryTitle.includes('NaN') ||
                summaryTitle.includes('  ') ||
                summaryTitle.includes('|') ||
                summaryTitle.includes('\\n') ||
                summaryTitle.includes('\\t')) {
                issues.suspiciousPatterns.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title
                });
            }
        });
        
        // Display results
        console.log('📋 SUMMARY TITLE ANALYSIS RESULTS:\n');
        
        let totalIssues = 0;
        
        Object.keys(issues).forEach(category => {
            const categoryIssues = issues[category];
            if (categoryIssues.length > 0) {
                console.log(`⚠️  ${category.toUpperCase().replace(/([A-Z])/g, ' $1').trim()} (${categoryIssues.length} cards):`);
                
                categoryIssues.forEach(issue => {
                    console.log(`   ${issue.cardNumber}. ID: ${issue.id}`);
                    console.log(`      Player: "${issue.playerName}"`);
                    console.log(`      Summary: "${issue.summaryTitle}"`);
                    console.log(`      Original: "${issue.originalTitle}"`);
                    console.log('');
                });
                
                totalIssues += categoryIssues.length;
            }
        });
        
        // Show summary statistics
        console.log('📊 SUMMARY STATISTICS:');
        console.log(`- Total cards analyzed: ${cards.length}`);
        console.log(`- Cards with missing product names: ${issues.missingProduct.length}`);
        console.log(`- Cards with missing years: ${issues.missingYear.length}`);
        console.log(`- Cards with missing player names: ${issues.missingPlayer.length}`);
        console.log(`- Cards that are too short: ${issues.tooShort.length}`);
        console.log(`- Cards that are too long: ${issues.tooLong.length}`);
        console.log(`- Cards with ALL CAPS: ${issues.allCaps.length}`);
        console.log(`- Cards with extra spaces: ${issues.extraSpaces.length}`);
        console.log(`- Cards with trailing commas: ${issues.trailingCommas.length}`);
        console.log(`- Cards with suspicious patterns: ${issues.suspiciousPatterns.length}`);
        console.log(`- Total issues found: ${totalIssues}`);
        
        // Show some good examples
        const goodExamples = cards.filter(card => {
            const summary = card.summaryTitle || '';
            return summary.length >= 20 && 
                   summary.length <= 120 && 
                   /^\d{4}/.test(summary) &&
                   !summary.includes('  ') &&
                   !summary.endsWith(',') &&
                   summary !== summary.toUpperCase();
        }).slice(0, 5);
        
        if (goodExamples.length > 0) {
            console.log('\n✅ GOOD SUMMARY TITLE EXAMPLES:');
            goodExamples.forEach((card, index) => {
                console.log(`${index + 1}. ID: ${card.id}`);
                console.log(`   Player: "${card.playerName}"`);
                console.log(`   Summary: "${card.summaryTitle}"`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

// Run the analysis
analyzeSummaryTitles();
