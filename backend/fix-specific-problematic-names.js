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

        req.setTimeout(30000, () => {
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

async function fixSpecificProblematicNames() {
    console.log('🔧 Fixing specific problematic player names...\n');
    
    try {
        // Define the specific fixes for the problematic cards
        const fixes = [
            {
                id: 309,
                correctPlayerName: "Triston Casas",
                description: "Fix Triston Casas - remove 'S BEST and TP"
            },
            {
                id: 341,
                correctPlayerName: "C.J. Kayfus",
                description: "Fix empty player name for CJ Kayfus card"
            },
            {
                id: 169,
                correctPlayerName: "Francisco Lindor",
                description: "Fix Francisco Lindor - remove leading apostrophe and extra terms"
            }
        ];
        
        console.log('📝 Applying specific fixes:');
        fixes.forEach(fix => {
            console.log(`   Card ID ${fix.id}: "${fix.description}"`);
        });
        console.log('');
        
        // Call the specific player name fix endpoint
        const response = await makeRequest('/api/admin/fix-specific-player-names', 'POST');
        
        if (response.status === 'success') {
            console.log('✅ Specific player name fixes completed successfully!');
            console.log('📊 Result:', response.data);
        } else {
            console.log('❌ Specific player name fixes failed:', response);
        }
        
        // Now let's also manually update the specific problematic cards
        console.log('\n🔧 Manually updating specific problematic cards...');
        
        for (const fix of fixes) {
            try {
                const updateResponse = await makeRequest('/api/admin/update-specific-player-name', 'POST', {
                    cardId: fix.id,
                    playerName: fix.correctPlayerName
                });
                
                if (updateResponse.status === 'success') {
                    console.log(`✅ Fixed card ${fix.id}: "${fix.correctPlayerName}"`);
                } else {
                    console.log(`❌ Failed to fix card ${fix.id}:`, updateResponse);
                }
            } catch (error) {
                console.log(`❌ Error fixing card ${fix.id}:`, error.message);
            }
        }
        
        console.log('\n🎉 Specific problematic name fixes completed!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

fixSpecificProblematicNames();
