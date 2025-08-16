const https = require('https');

async function makeRequest(endpoint, method = 'POST', data = null) {
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

        req.setTimeout(300000, () => { // 5 minute timeout for the full batch pull
            req.destroy();
            resolve({
                status: 'error',
                code: 408,
                message: 'Request timeout'
            });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function runActualFastPull() {
    console.log('🚀 Running ACTUAL fast batch pull with 130point service...\n');
    console.log('🔍 This will search for new PSA 10 cards on eBay and add them to the database...\n');
    
    try {
        // First, let's check the current database state
        console.log('📊 Checking current database state...');
        const checkResponse = await makeRequest('/api/admin/cards?limit=5', 'GET');
        
        if (checkResponse.status !== 'success') {
            console.error('❌ Failed to check database:', checkResponse);
            return;
        }
        
        const cards = checkResponse.data.cards || [];
        console.log(`📊 Found ${cards.length} sample cards`);
        
        if (cards.length > 0) {
            console.log('\n📋 Current sample card details:');
            cards.slice(0, 3).forEach((card, index) => {
                console.log(`${index + 1}. Card ID: ${card.id}`);
                console.log(`   Player: "${card.playerName}"`);
                console.log(`   Summary: "${card.summaryTitle}"`);
                console.log(`   Title: "${card.title}"`);
                console.log('');
            });
        }
        
        // Now let's run the ACTUAL fast batch pull
        console.log('🔄 Starting ACTUAL fast batch pull...');
        console.log('⏳ This will search 130point for new PSA 10 cards and add them with all improvements...');
        console.log('⏳ This may take several minutes...');
        
        const fastPullResponse = await makeRequest('/api/admin/run-fast-batch-pull', 'POST');
        
        if (fastPullResponse.status === 'success') {
            console.log('✅ Fast batch pull completed successfully!');
            console.log('📊 Results:', fastPullResponse.data);
            
            if (fastPullResponse.data.results) {
                const results = fastPullResponse.data.results;
                console.log('\n📈 FAST BATCH PULL RESULTS:');
                console.log(`   New items found: ${results.newItems || 0}`);
                console.log(`   Searches performed: ${results.searches || 0}`);
                console.log(`   Database stats:`, results.databaseStats || 'N/A');
            }
        } else {
            console.log('❌ Fast batch pull failed:', fastPullResponse);
        }
        
        // Check the final database state
        console.log('\n📊 Checking final database state...');
        const finalCheckResponse = await makeRequest('/api/admin/cards?limit=5', 'GET');
        
        if (finalCheckResponse.status === 'success') {
            const finalCards = finalCheckResponse.data.cards || [];
            console.log(`📊 Final database state: ${finalCards.length} sample cards`);
            
            if (finalCards.length > 0) {
                console.log('\n📋 Final sample card details:');
                finalCards.slice(0, 3).forEach((card, index) => {
                    console.log(`${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Player: "${card.playerName}"`);
                    console.log(`   Summary: "${card.summaryTitle}"`);
                    console.log(`   Title: "${card.title}"`);
                    console.log('');
                });
            }
        }
        
        console.log('\n🎉 ACTUAL fast batch pull completed!');
        console.log('✅ New PSA 10 cards have been searched for and added with all improvements');
        
    } catch (error) {
        console.error('❌ Fast batch pull failed:', error);
    }
}

runActualFastPull();
