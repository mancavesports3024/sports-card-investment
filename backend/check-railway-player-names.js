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

async function checkRailwayPlayerNames() {
    console.log('🔍 Checking player names in Railway database...\n');
    
    try {
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards\n`);
        
        // Check for problematic player names
        const problems = [];
        
        cards.forEach((card, index) => {
            const playerName = card.playerName || '';
            const title = card.title || '';
            
            // Check for ALL CAPS player names
            if (playerName && playerName === playerName.toUpperCase() && playerName.length > 3) {
                problems.push({
                    cardNumber: index + 1,
                    id: card.id,
                    issue: 'ALL CAPS player name',
                    playerName: playerName,
                    title: title
                });
            }
            
            // Check for empty player names
            if (!playerName || playerName.trim() === '') {
                problems.push({
                    cardNumber: index + 1,
                    id: card.id,
                    issue: 'Empty player name',
                    playerName: playerName,
                    title: title
                });
            }
            
            // Check for very short player names
            if (playerName && playerName.length <= 2) {
                problems.push({
                    cardNumber: index + 1,
                    id: card.id,
                    issue: 'Very short player name',
                    playerName: playerName,
                    title: title
                });
            }
            
            // Check for player names with obvious errors
            if (playerName && (
                playerName.includes("'S BEST") ||
                playerName.includes("BRYCE HARPER &") ||
                playerName.includes("' COLLECTION") ||
                playerName.includes("STARCADE ,") ||
                playerName.includes("Velocity,")
            )) {
                problems.push({
                    cardNumber: index + 1,
                    id: card.id,
                    issue: 'Obvious player name error',
                    playerName: playerName,
                    title: title
                });
            }
        });
        
        if (problems.length === 0) {
            console.log('✅ All player names look correct!');
        } else {
            console.log(`❌ Found ${problems.length} problematic player names:\n`);
            
            problems.forEach(problem => {
                console.log(`${problem.cardNumber}. ID: ${problem.id}`);
                console.log(`   Issue: ${problem.issue}`);
                console.log(`   Player Name: "${problem.playerName}"`);
                console.log(`   Title: "${problem.title}"`);
                console.log('');
            });
        }
        
        // Show summary
        const allCapsCount = problems.filter(p => p.issue === 'ALL CAPS player name').length;
        const emptyCount = problems.filter(p => p.issue === 'Empty player name').length;
        const shortCount = problems.filter(p => p.issue === 'Very short player name').length;
        const errorCount = problems.filter(p => p.issue === 'Obvious player name error').length;
        
        console.log('📊 SUMMARY:');
        console.log(`- Total cards: ${cards.length}`);
        console.log(`- Cards with ALL CAPS player names: ${allCapsCount}`);
        console.log(`- Cards with empty player names: ${emptyCount}`);
        console.log(`- Cards with very short player names: ${shortCount}`);
        console.log(`- Cards with obvious errors: ${errorCount}`);
        console.log(`- Total problems: ${problems.length}`);
        
    } catch (error) {
        console.error('❌ Check failed:', error);
    }
}

// Run the check
checkRailwayPlayerNames();
