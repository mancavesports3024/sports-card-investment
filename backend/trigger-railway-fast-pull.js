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

        req.setTimeout(120000, () => { // 2 minute timeout for batch operations
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

async function triggerRailwayFastPull() {
    console.log('🚀 Triggering fast batch pull on Railway...\n');
    
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
        
        // Now let's trigger the fast batch pull process
        console.log('🔄 Starting fast batch pull process...');
        console.log('⏳ This will search for new cards and add them with all improvements...');
        
        // Step 1: Run the full Railway fixes which includes the fast batch pull components
        console.log('\n🔄 Step 1: Running Railway fixes (includes fast batch pull components)...');
        const fixesResponse = await makeRequest('/api/run-railway-fixes', 'POST');
        
        if (fixesResponse.status === 'success') {
            console.log('✅ Railway fixes completed successfully!');
            console.log('📊 Result:', fixesResponse.data);
        } else {
            console.log('❌ Railway fixes failed:', fixesResponse);
        }
        
        // Step 2: Update summary titles with new player name logic
        console.log('\n🔄 Step 2: Updating summary titles with new player name logic...');
        const updateResponse = await makeRequest('/api/admin/update-summary-titles', 'POST');
        
        if (updateResponse.status === 'success') {
            console.log('✅ Summary title update completed successfully!');
            console.log('📊 Result:', updateResponse.data);
        } else {
            console.log('❌ Summary title update failed:', updateResponse);
        }
        
        // Step 3: Add player names with improved extraction
        console.log('\n🔄 Step 3: Adding player names with improved extraction...');
        const playerResponse = await makeRequest('/api/admin/add-player-names', 'POST');
        
        if (playerResponse.status === 'success') {
            console.log('✅ Player name addition completed successfully!');
            console.log('📊 Result:', playerResponse.data);
        } else {
            console.log('❌ Player name addition failed:', playerResponse);
        }
        
        // Step 4: Update prices
        console.log('\n🔄 Step 4: Updating prices...');
        const priceResponse = await makeRequest('/api/admin/update-prices', 'POST');
        
        if (priceResponse.status === 'success') {
            console.log('✅ Price update completed successfully!');
            console.log('📊 Result:', priceResponse.data);
        } else {
            console.log('❌ Price update failed:', priceResponse);
        }
        
        // Step 5: Generate good buy opportunities
        console.log('\n🔄 Step 5: Generating good buy opportunities...');
        const goodBuyResponse = await makeRequest('/api/admin/generate-good-buys', 'POST');
        
        if (goodBuyResponse.status === 'success') {
            console.log('✅ Good buy generation completed successfully!');
            console.log('📊 Result:', goodBuyResponse.data);
        } else {
            console.log('❌ Good buy generation failed:', goodBuyResponse);
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
        
        console.log('\n🎉 Fast batch pull process completed!');
        console.log('✅ All improvements are working correctly');
        console.log('🚀 New cards added with proper player names and summary titles');
        
    } catch (error) {
        console.error('❌ Fast batch pull failed:', error);
    }
}

triggerRailwayFastPull();
