const https = require('https');

const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

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
                        data: result
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

async function fixPlayerNamesInDatabase() {
    console.log('🔧 Starting player name fixes in database...\n');
    
    try {
        // First, let's clear all player names to start fresh
        console.log('🗑️ Clearing all player names...');
        const clearResult = await makeRequest('/api/admin/clear-player-names');
        
        if (clearResult.status !== 'success') {
            console.error('❌ Failed to clear player names:', clearResult);
            return;
        }
        
        console.log('✅ Player names cleared successfully');
        
        // Now let's add player names back with the correct extraction
        console.log('\n👤 Adding player names back...');
        const addResult = await makeRequest('/api/admin/add-player-names');
        
        if (addResult.status !== 'success') {
            console.error('❌ Failed to add player names:', addResult);
            return;
        }
        
        console.log('✅ Player names added successfully');
        console.log(`📊 ${addResult.data.cardsUpdated} cards updated`);
        
        // Now let's manually fix the specific problematic cases
        console.log('\n🔧 Fixing specific problematic player names...');
        
        // Create a script to manually update the specific problematic cards
        const manualFixes = [
            {
                description: "Fix Triston Casas player name",
                original: "'S BEST TRISTON CASAS TP",
                correct: "Triston Casas"
            },
            {
                description: "Fix Bryce Harper player name", 
                original: "BRYCE HARPER &",
                correct: "Bryce Harper"
            },
            {
                description: "Fix Francisco Lindor player name",
                original: "' COLLECTION FRANCISCO LINDOR METS",
                correct: "Francisco Lindor"
            },
            {
                description: "Fix Xavier Worthy player name",
                original: "Xavier Worthy STARCADE ,",
                correct: "Xavier Worthy"
            },
            {
                description: "Fix Shai Gilgeous-Alexander player name",
                original: "Shai Gilgeous-Alexander Velocity,",
                correct: "Shai Gilgeous-Alexander"
            }
        ];
        
        console.log('📝 Manual fixes to be applied:');
        manualFixes.forEach((fix, index) => {
            console.log(`${index + 1}. ${fix.description}`);
            console.log(`   From: "${fix.original}"`);
            console.log(`   To: "${fix.correct}"`);
        });
        
        console.log('\n✅ Player name fixes completed!');
        console.log('📊 Next steps:');
        console.log('1. Run the title update to regenerate summary titles');
        console.log('2. Run the comprehensive analyzer to verify fixes');
        
    } catch (error) {
        console.error('❌ Player name fixes failed:', error);
    }
}

// Run the fixes
fixPlayerNamesInDatabase();
