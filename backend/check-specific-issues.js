const https = require('https');

async function checkSpecificIssues() {
    console.log('🔍 Checking Specific Issues in Database...\n');
    
    const baseUrl = 'web-production-9efa.up.railway.app';
    
    async function makeRequest(endpoint, method = 'GET') {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: baseUrl,
                port: 443,
                path: endpoint,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        resolve({
                            status: 'success',
                            data: result,
                            statusCode: res.statusCode
                        });
                    } catch (error) {
                        resolve({
                            status: 'error',
                            code: res.statusCode,
                            message: 'Invalid JSON response',
                            data: responseData
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
    
    try {
        // Get all cards
        console.log('📊 Fetching all cards...');
        const response = await makeRequest('/api/admin/cards?limit=1000', 'GET');
        
        if (response.status === 'success') {
            const cards = response.data.cards || [];
            console.log(`✅ Found ${cards.length} cards\n`);
            
            // Check for player name issues
            console.log('🔍 Checking Player Name Issues:');
            const playerNameIssues = cards.filter(card => {
                const playerName = card.playerName || '';
                return !playerName || playerName.length <= 2 || playerName === playerName.toUpperCase();
            });
            
            console.log(`📊 Found ${playerNameIssues.length} player name issues:`);
            playerNameIssues.forEach((card, index) => {
                console.log(`   ${index + 1}. Card ID ${card.id}: "${card.playerName}" - "${card.title}"`);
            });
            
            // Check for summary title issues
            console.log('\n🔍 Checking Summary Title Issues:');
            const summaryTitleIssues = cards.filter(card => {
                const summaryTitle = card.summaryTitle || '';
                const playerName = card.playerName || '';
                return !summaryTitle || !summaryTitle.includes(playerName) || 
                       !summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman)\b/i);
            });
            
            console.log(`📊 Found ${summaryTitleIssues.length} summary title issues:`);
            summaryTitleIssues.forEach((card, index) => {
                console.log(`   ${index + 1}. Card ID ${card.id}: "${card.summaryTitle}" - Player: "${card.playerName}"`);
            });
            
            console.log('\n📊 SUMMARY:');
            console.log(`   - Total Cards: ${cards.length}`);
            console.log(`   - Player Name Issues: ${playerNameIssues.length}`);
            console.log(`   - Summary Title Issues: ${summaryTitleIssues.length}`);
            console.log(`   - Total Issues: ${playerNameIssues.length + summaryTitleIssues.length}`);
            
        } else {
            console.log('❌ Failed to fetch cards:', response.message);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
checkSpecificIssues();
