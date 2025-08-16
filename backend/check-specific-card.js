const https = require('https');

async function checkSpecificCard() {
    console.log('🔍 Checking Specific Card Fixes...\n');
    
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
        // Check specific cards that were supposed to be fixed
        const cardIds = [700, 699, 696, 691, 690, 686, 685, 677, 676, 674, 673, 669, 667, 653];
        
        console.log('🔍 Checking cards that were supposed to be fixed:\n');
        
        for (const cardId of cardIds) {
            const response = await makeRequest(`/api/admin/cards?id=${cardId}`, 'GET');
            
            if (response.status === 'success') {
                const cards = response.data.cards || [];
                if (cards.length > 0) {
                    const card = cards[0];
                    console.log(`Card ID ${card.id}:`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Player Name: "${card.playerName}"`);
                    console.log(`   Summary Title: "${card.summaryTitle}"`);
                    
                    // Check if player name is still ALL CAPS
                    const isAllCaps = card.playerName && card.playerName === card.playerName.toUpperCase();
                    console.log(`   Is ALL CAPS: ${isAllCaps ? 'YES (NEEDS FIX)' : 'NO (FIXED)'}`);
                    console.log('');
                } else {
                    console.log(`Card ID ${cardId}: Not found`);
                }
            } else {
                console.log(`Card ID ${cardId}: Error - ${response.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
checkSpecificCard();
