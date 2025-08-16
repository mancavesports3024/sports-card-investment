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
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    resolve({ success: false, error: 'Invalid JSON response', data: data });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

async function checkTitleDuplications() {
    console.log('🔍 Checking for title duplications and issues...\n');
    
    try {
        const result = await makeRequest('/api/admin/cards?limit=1000', 'GET');
        
        if (result.success && result.cards) {
            console.log(`📊 Analyzing ${result.cards.length} cards for issues...\n`);
            
            const issues = [];
            const duplicates = [];
            const allCapsIssues = [];
            const shortNames = [];
            
            result.cards.forEach((card, index) => {
                const playerName = card.playerName || card.player_name || 'NO NAME';
                const summaryTitle = card.summary_title || card.summaryTitle || 'NO SUMMARY';
                const originalTitle = card.title;
                
                // Check for duplicated words in summary titles
                const words = summaryTitle.split(' ');
                const wordCounts = {};
                words.forEach(word => {
                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                });
                
                const duplicatedWords = Object.entries(wordCounts)
                    .filter(([word, count]) => count > 1 && word.length > 2)
                    .map(([word, count]) => `${word}(${count})`);
                
                if (duplicatedWords.length > 0) {
                    duplicates.push({
                        index: index + 1,
                        original: originalTitle,
                        player: playerName,
                        summary: summaryTitle,
                        duplicated: duplicatedWords.join(', ')
                    });
                }
                
                // Check for ALL CAPS player names
                if (playerName === playerName.toUpperCase() && playerName !== 'NO NAME' && playerName.length > 3) {
                    allCapsIssues.push({
                        index: index + 1,
                        original: originalTitle,
                        player: playerName,
                        summary: summaryTitle
                    });
                }
                
                // Check for very short player names
                if (playerName.length < 3 && playerName !== 'NO NAME') {
                    shortNames.push({
                        index: index + 1,
                        original: originalTitle,
                        player: playerName,
                        summary: summaryTitle
                    });
                }
                
                // Check for missing player names in summary
                if (playerName !== 'NO NAME' && !summaryTitle.toLowerCase().includes(playerName.toLowerCase())) {
                    issues.push({
                        type: 'MISSING_PLAYER',
                        index: index + 1,
                        original: originalTitle,
                        player: playerName,
                        summary: summaryTitle
                    });
                }
            });
            
            // Report findings
            console.log(`📋 ANALYSIS RESULTS:\n`);
            
            if (duplicates.length > 0) {
                console.log(`🚨 DUPLICATED WORDS FOUND (${duplicates.length} cards):\n`);
                duplicates.forEach(item => {
                    console.log(`${item.index}. Player: "${item.player}"`);
                    console.log(`   Original: "${item.original}"`);
                    console.log(`   Summary: "${item.summary}"`);
                    console.log(`   Duplicated: ${item.duplicated}`);
                    console.log('');
                });
            }
            
            if (allCapsIssues.length > 0) {
                console.log(`⚠️  ALL CAPS PLAYER NAMES (${allCapsIssues.length} cards):\n`);
                allCapsIssues.slice(0, 10).forEach(item => {
                    console.log(`${item.index}. Player: "${item.player}"`);
                    console.log(`   Original: "${item.original}"`);
                    console.log(`   Summary: "${item.summary}"`);
                    console.log('');
                });
                if (allCapsIssues.length > 10) {
                    console.log(`   ... and ${allCapsIssues.length - 10} more`);
                }
            }
            
            if (shortNames.length > 0) {
                console.log(`⚠️  VERY SHORT PLAYER NAMES (${shortNames.length} cards):\n`);
                shortNames.forEach(item => {
                    console.log(`${item.index}. Player: "${item.player}"`);
                    console.log(`   Original: "${item.original}"`);
                    console.log(`   Summary: "${item.summary}"`);
                    console.log('');
                });
            }
            
            if (issues.length > 0) {
                console.log(`⚠️  MISSING PLAYER NAMES IN SUMMARIES (${issues.length} cards):\n`);
                issues.slice(0, 10).forEach(item => {
                    console.log(`${item.index}. Player: "${item.player}"`);
                    console.log(`   Original: "${item.original}"`);
                    console.log(`   Summary: "${item.summary}"`);
                    console.log('');
                });
                if (issues.length > 10) {
                    console.log(`   ... and ${issues.length - 10} more`);
                }
            }
            
            if (duplicates.length === 0 && allCapsIssues.length === 0 && shortNames.length === 0 && issues.length === 0) {
                console.log('✅ No obvious issues found!');
            }
            
            console.log(`\n📈 SUMMARY:`);
            console.log(`- Total cards analyzed: ${result.cards.length}`);
            console.log(`- Cards with duplicated words: ${duplicates.length}`);
            console.log(`- Cards with ALL CAPS player names: ${allCapsIssues.length}`);
            console.log(`- Cards with very short player names: ${shortNames.length}`);
            console.log(`- Cards with missing player names in summaries: ${issues.length}`);
            
        } else {
            console.log('❌ Failed to fetch cards:', result);
        }
        
    } catch (error) {
        console.error('❌ Error checking title duplications:', error);
    }
}

// Run the check
checkTitleDuplications();

