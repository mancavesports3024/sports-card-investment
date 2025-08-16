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

async function manualPlayerNameFixes() {
    console.log('🔧 Starting manual player name fixes...\n');
    
    try {
        // First, let's get all cards to find the problematic ones
        console.log('📡 Fetching all cards...');
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards\n`);
        
        // Define the fixes we need to apply
        const fixes = [
            {
                originalTitle: "2018 Bowman's Best Baseball Triston Casas #TP-29 Red Refractor /10 PSA 10",
                wrongPlayerName: "'S BEST TRISTON CASAS TP",
                correctPlayerName: "Triston Casas"
            },
            {
                originalTitle: "Bryce Harper (RC) 2012 Allen & Ginter #12 PSA 10 Washington Nationals MLB Rookie",
                wrongPlayerName: "BRYCE HARPER &",
                correctPlayerName: "Bryce Harper"
            },
            {
                originalTitle: "2015 TOPPS HERITAGE '51 COLLECTION #75 FRANCISCO LINDOR ROOKIE RC METS PSA 10",
                wrongPlayerName: "' COLLECTION FRANCISCO LINDOR METS",
                correctPlayerName: "Francisco Lindor"
            },
            {
                originalTitle: "2024 Panini Select Xavier Worthy 17 STARCADE Silver Prizm, Case Hit SSP PSA 10",
                wrongPlayerName: "Xavier Worthy STARCADE ,",
                correctPlayerName: "Xavier Worthy"
            },
            {
                originalTitle: "Shai Gilgeous Alexander 2018 Donruss Optic #162 Blue Velocity, PSA 10",
                wrongPlayerName: "Shai Gilgeous-Alexander Velocity,",
                correctPlayerName: "Shai Gilgeous-Alexander"
            }
        ];
        
        console.log('🔍 Looking for cards to fix...\n');
        
        let fixedCount = 0;
        
        for (const fix of fixes) {
            const card = cards.find(c => c.title === fix.originalTitle);
            
            if (card) {
                console.log(`✅ Found card to fix:`);
                console.log(`   ID: ${card.id}`);
                console.log(`   Title: "${card.title}"`);
                console.log(`   Current Player: "${card.playerName}"`);
                console.log(`   Should be: "${fix.correctPlayerName}"`);
                
                // Here we would normally update the database
                // For now, let's just log what needs to be fixed
                fixedCount++;
            } else {
                console.log(`❌ Could not find card with title: "${fix.originalTitle}"`);
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`- Cards found to fix: ${fixedCount}`);
        console.log(`- Total fixes needed: ${fixes.length}`);
        
        if (fixedCount > 0) {
            console.log('\n🔧 To complete the fixes, we need to:');
            console.log('1. Add an API endpoint to update specific player names');
            console.log('2. Or run the player name extraction with improved logic');
            console.log('3. Then regenerate summary titles');
        }
        
    } catch (error) {
        console.error('❌ Manual fixes failed:', error);
    }
}

// Run the manual fixes
manualPlayerNameFixes();
