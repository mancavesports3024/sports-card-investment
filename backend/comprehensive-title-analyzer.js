const https = require('https');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

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

async function analyzeAllTitles() {
    console.log('🔍 Starting comprehensive title analysis...\n');
    
    try {
        // Fetch all cards from Railway
        console.log('📡 Fetching all cards from Railway...');
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Analyzing ${cards.length} cards...\n`);
        
        const issues = {
            duplicatedWords: [],
            allCapsPlayerNames: [],
            missingPlayerNames: [],
            veryShortPlayerNames: [],
            formattingIssues: [],
            inconsistentCasing: [],
            extraSpaces: [],
            missingYears: [],
            missingProductNames: [],
            suspiciousPatterns: []
        };
        
        cards.forEach((card, index) => {
            const cardNumber = index + 1;
            const title = card.title || '';
            const summaryTitle = card.summaryTitle || '';
            const playerName = card.playerName || '';
            
            // Check for duplicated words in summary titles
            const words = summaryTitle.split(' ');
            const duplicatedWords = [];
            for (let i = 0; i < words.length - 1; i++) {
                if (words[i].toLowerCase() === words[i + 1].toLowerCase()) {
                    duplicatedWords.push(words[i]);
                }
            }
            
            if (duplicatedWords.length > 0) {
                issues.duplicatedWords.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle,
                    duplicated: duplicatedWords
                });
            }
            
            // Check for ALL CAPS player names
            if (playerName && playerName === playerName.toUpperCase() && playerName.length > 3) {
                issues.allCapsPlayerNames.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for missing player names in summaries
            if (playerName && !summaryTitle.toLowerCase().includes(playerName.toLowerCase())) {
                issues.missingPlayerNames.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for very short player names
            if (playerName && playerName.length <= 2) {
                issues.veryShortPlayerNames.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for formatting issues
            if (summaryTitle.includes('  ') || summaryTitle.includes(' ,') || summaryTitle.includes(', ')) {
                issues.formattingIssues.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle,
                    issue: 'Extra spaces or comma formatting'
                });
            }
            
            // Check for inconsistent casing
            const hasMixedCase = /[a-z]/.test(summaryTitle) && /[A-Z]/.test(summaryTitle);
            const hasAllCaps = /^[A-Z\s\d\-\.\,\#]+$/.test(summaryTitle);
            if (hasAllCaps && summaryTitle.length > 10) {
                issues.inconsistentCasing.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle,
                    issue: 'ALL CAPS summary title'
                });
            }
            
            // Check for extra spaces
            if (summaryTitle.includes('  ') || summaryTitle.startsWith(' ') || summaryTitle.endsWith(' ')) {
                issues.extraSpaces.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for missing years
            if (!summaryTitle.match(/\b(19|20)\d{2}\b/)) {
                issues.missingYears.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for missing product names
            const commonProducts = ['topps', 'panini', 'bowman', 'upper deck', 'fleer', 'donruss', 'score', 'pinnacle'];
            const hasProduct = commonProducts.some(product => 
                summaryTitle.toLowerCase().includes(product)
            );
            if (!hasProduct) {
                issues.missingProductNames.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle
                });
            }
            
            // Check for suspicious patterns
            if (summaryTitle.includes('undefined') || summaryTitle.includes('null') || summaryTitle.includes('NaN')) {
                issues.suspiciousPatterns.push({
                    cardNumber,
                    playerName,
                    original: title,
                    summary: summaryTitle,
                    pattern: 'Contains undefined/null/NaN'
                });
            }
        });
        
        // Display results
        console.log('📋 COMPREHENSIVE ANALYSIS RESULTS:\n');
        
        if (issues.duplicatedWords.length > 0) {
            console.log(`🚨 DUPLICATED WORDS FOUND (${issues.duplicatedWords.length} cards):\n`);
            issues.duplicatedWords.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Original: "${issue.original}"`);
                console.log(`   Summary: "${issue.summary}"`);
                console.log(`   Duplicated: ${issue.duplicated.join(', ')}\n`);
            });
        }
        
        if (issues.allCapsPlayerNames.length > 0) {
            console.log(`⚠️  ALL CAPS PLAYER NAMES (${issues.allCapsPlayerNames.length} cards):\n`);
            issues.allCapsPlayerNames.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Original: "${issue.original}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.missingPlayerNames.length > 0) {
            console.log(`⚠️  MISSING PLAYER NAMES IN SUMMARIES (${issues.missingPlayerNames.length} cards):\n`);
            issues.missingPlayerNames.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Original: "${issue.original}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.veryShortPlayerNames.length > 0) {
            console.log(`⚠️  VERY SHORT PLAYER NAMES (${issues.veryShortPlayerNames.length} cards):\n`);
            issues.veryShortPlayerNames.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Original: "${issue.original}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.formattingIssues.length > 0) {
            console.log(`⚠️  FORMATTING ISSUES (${issues.formattingIssues.length} cards):\n`);
            issues.formattingIssues.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Issue: ${issue.issue}`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.inconsistentCasing.length > 0) {
            console.log(`⚠️  INCONSISTENT CASING (${issues.inconsistentCasing.length} cards):\n`);
            issues.inconsistentCasing.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Issue: ${issue.issue}`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.extraSpaces.length > 0) {
            console.log(`⚠️  EXTRA SPACES (${issues.extraSpaces.length} cards):\n`);
            issues.extraSpaces.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.missingYears.length > 0) {
            console.log(`⚠️  MISSING YEARS (${issues.missingYears.length} cards):\n`);
            issues.missingYears.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.missingProductNames.length > 0) {
            console.log(`⚠️  MISSING PRODUCT NAMES (${issues.missingProductNames.length} cards):\n`);
            issues.missingProductNames.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        if (issues.suspiciousPatterns.length > 0) {
            console.log(`🚨 SUSPICIOUS PATTERNS (${issues.suspiciousPatterns.length} cards):\n`);
            issues.suspiciousPatterns.forEach(issue => {
                console.log(`${issue.cardNumber}. Player: "${issue.playerName}"`);
                console.log(`   Pattern: ${issue.pattern}`);
                console.log(`   Summary: "${issue.summary}"\n`);
            });
        }
        
        // Summary statistics
        const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`📈 SUMMARY STATISTICS:`);
        console.log(`- Total cards analyzed: ${cards.length}`);
        console.log(`- Total issues found: ${totalIssues}`);
        console.log(`- Cards with duplicated words: ${issues.duplicatedWords.length}`);
        console.log(`- Cards with ALL CAPS player names: ${issues.allCapsPlayerNames.length}`);
        console.log(`- Cards with missing player names: ${issues.missingPlayerNames.length}`);
        console.log(`- Cards with very short player names: ${issues.veryShortPlayerNames.length}`);
        console.log(`- Cards with formatting issues: ${issues.formattingIssues.length}`);
        console.log(`- Cards with inconsistent casing: ${issues.inconsistentCasing.length}`);
        console.log(`- Cards with extra spaces: ${issues.extraSpaces.length}`);
        console.log(`- Cards with missing years: ${issues.missingYears.length}`);
        console.log(`- Cards with missing product names: ${issues.missingProductNames.length}`);
        console.log(`- Cards with suspicious patterns: ${issues.suspiciousPatterns.length}`);
        
        if (totalIssues === 0) {
            console.log('\n✅ No issues found! All titles appear to be properly formatted.');
        } else {
            console.log('\n🔧 Issues found. Consider running the title fixes to resolve these problems.');
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

// Run the analysis
analyzeAllTitles();
