const https = require('https');

async function fixAllCapsPlayerNames() {
    console.log('🔧 Fixing ALL CAPS Player Names...\n');
    
    const baseUrl = 'web-production-9efa.up.railway.app';
    
    async function makeRequest(endpoint, method = 'POST', data = null) {
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

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }
    
    try {
        // The 14 card IDs with ALL CAPS player names
        const cardIds = [700, 699, 696, 691, 690, 686, 685, 677, 676, 674, 673, 669, 667, 653];
        
        console.log(`📊 Fixing ${cardIds.length} ALL CAPS player names...\n`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const cardId of cardIds) {
            console.log(`🔧 Fixing card ID ${cardId}...`);
            
            const response = await makeRequest('/api/admin/fix-specific-player-names', 'POST');
            
            if (response.status === 'success') {
                console.log(`✅ Card ID ${cardId} fixed successfully`);
                successCount++;
            } else {
                console.log(`❌ Card ID ${cardId} failed: ${response.message}`);
                errorCount++;
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n📊 FIX RESULTS:');
        console.log(`   - Total cards: ${cardIds.length}`);
        console.log(`   - Successfully fixed: ${successCount}`);
        console.log(`   - Errors: ${errorCount}`);
        
        if (successCount === cardIds.length) {
            console.log('   🎉 All ALL CAPS player names have been fixed!');
        } else {
            console.log(`   ⚠️  ${errorCount} cards still need fixing`);
        }
        
        // Verify the fixes
        console.log('\n🔍 Verifying fixes...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for updates to process
        
        const verifyResponse = await makeRequest('/api/admin/health-check', 'POST');
        
        if (verifyResponse.status === 'success') {
            const health = verifyResponse.data.health || {};
            console.log('✅ Health check completed');
            console.log(`📊 Current Status:`);
            console.log(`   - Health Score: ${health.healthScore}%`);
            console.log(`   - Player Name Issues: ${health.playerNameIssues}`);
            console.log(`   - Summary Title Issues: ${health.summaryTitleIssues}`);
            console.log(`   - Total Issues: ${health.totalIssues}`);
        } else {
            console.log('❌ Health check failed:', verifyResponse.message);
        }
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

// Run the fix
fixAllCapsPlayerNames();
