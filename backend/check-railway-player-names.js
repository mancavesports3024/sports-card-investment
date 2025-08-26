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
                    resolve(body);
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

async function checkChaseCards() {
    console.log('🔍 Checking Railway database for Chase cards...\n');

    try {
        // Get all cards with "Chase" in the title, player_name, or summary_title
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.success && response.cards) {
            // Filter for cards with "Chase" in any field
            const chaseCards = response.cards.filter(card => {
                const title = card.title || '';
                const playerName = card.player_name || '';
                const summaryTitle = card.summary_title || '';
                return title.includes('Chase') || playerName.includes('Chase') || summaryTitle.includes('Chase');
            });

            console.log(`📊 Found ${chaseCards.length} cards with "Chase" in title, player_name, or summary_title:\n`);

            chaseCards.forEach((card, index) => {
                console.log(`${index + 1}. ID: ${card.id}`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Player Name: "${card.player_name || 'NULL'}"`);
                console.log(`   Summary Title: ${card.summary_title || 'NULL'}`);
                console.log(`   Sport: ${card.sport || 'NULL'}`);
                console.log('');
            });

            // Check specifically for "Ja Marr Chase" variations in player_name
            const jaMarrChaseCards = chaseCards.filter(card => {
                const playerName = card.player_name || '';
                return playerName.includes('Ja') && playerName.includes('Marr') && playerName.includes('Chase');
            });

            console.log(`🔍 Found ${jaMarrChaseCards.length} cards with "Ja Marr Chase" variations in player_name:\n`);

            jaMarrChaseCards.forEach((card, index) => {
                console.log(`${index + 1}. ID: ${card.id}`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Player Name: "${card.player_name}"`);
                console.log(`   Summary Title: ${card.summary_title || 'NULL'}`);
                console.log('');
            });

            if (jaMarrChaseCards.length === 0) {
                console.log('❌ No cards found with "Ja Marr Chase" variations in player_name field.');
                console.log('This might explain why the fix-player-names script reported 0 changes.');
            }

        } else {
            console.log('❌ Failed to get cards from Railway API');
            console.log('Response:', response);
        }

    } catch (error) {
        console.error('❌ Error checking Railway database:', error);
    }
}

checkChaseCards();
