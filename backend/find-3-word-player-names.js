const https = require('https');
const RAILWAY_URL = 'https://web-production-9efa.up.railway.app';

async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (error) {
                    resolve({ success: false, error: 'Invalid JSON response', body: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function find3WordPlayerNames() {
    console.log('🔍 Finding player names with 3 words...\n');
    
    try {
        // Get all cards from Railway
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.success && response.cards) {
            const threeWordPlayers = [];
            
            response.cards.forEach(card => {
                const playerName = card.player_name || '';
                const words = playerName.trim().split(/\s+/).filter(word => word.length > 0);
                
                if (words.length === 3) {
                    threeWordPlayers.push({
                        id: card.id,
                        title: card.title,
                        player_name: playerName,
                        summary_title: card.summary_title || 'NULL'
                    });
                }
            });
            
            console.log(`📊 Found ${threeWordPlayers.length} player names with exactly 3 words:\n`);
            
            // Sort by player name for easier review
            threeWordPlayers.sort((a, b) => a.player_name.localeCompare(b.player_name));
            
            threeWordPlayers.forEach((card, index) => {
                console.log(`${index + 1}. ID: ${card.id}`);
                console.log(`   Player Name: "${card.player_name}"`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Summary Title: ${card.summary_title}`);
                console.log('');
            });
            
            // Also show some statistics
            const uniquePlayerNames = [...new Set(threeWordPlayers.map(card => card.player_name))];
            console.log(`📈 Statistics:`);
            console.log(`   Total cards with 3-word player names: ${threeWordPlayers.length}`);
            console.log(`   Unique 3-word player names: ${uniquePlayerNames.length}`);
            
            if (uniquePlayerNames.length > 0) {
                console.log(`\n📋 Unique 3-word player names:`);
                uniquePlayerNames.sort().forEach((name, index) => {
                    console.log(`   ${index + 1}. "${name}"`);
                });
            }
            
        } else {
            console.log('❌ Failed to get cards from Railway API');
            console.log('Response:', response);
        }
    } catch (error) {
        console.error('❌ Error finding 3-word player names:', error);
    }
}

find3WordPlayerNames();
