const https = require('https');

async function checkSalFrelickCard() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: '/api/admin/cards?search=Sal%20Frelick',
            method: 'GET',
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
                    resolve(result.cards || []);
                } catch (error) {
                    resolve([]);
                }
            });
        });

        req.on('error', (error) => {
            resolve([]);
        });

        req.end();
    });
}

async function main() {
    console.log('🔍 Checking Sal Frelick card summary title...\n');
    
    const cards = await checkSalFrelickCard();
    
    if (cards.length === 0) {
        console.log('❌ No Sal Frelick cards found');
        return;
    }
    
    console.log(`📊 Found ${cards.length} Sal Frelick card(s):\n`);
    
    cards.forEach((card, index) => {
        console.log(`${index + 1}. Card ID: ${card.id}`);
        console.log(`   Player Name: "${card.playerName}"`);
        console.log(`   Summary Title: "${card.summaryTitle}"`);
        console.log(`   Original Title: "${card.title}"`);
        console.log('');
    });
    
    // Check if the summary title follows the correct format
    const salFrelickCard = cards.find(card => card.id === 549);
    if (salFrelickCard) {
        console.log('📋 FORMAT ANALYSIS:');
        console.log(`Expected format: Year, Product, Player, Card Type, Number, Print Run`);
        console.log(`Current summary: "${salFrelickCard.summaryTitle}"`);
        
        if (salFrelickCard.summaryTitle.includes('Sal Frelick')) {
            console.log('✅ Player name "Sal Frelick" is included in summary title');
        } else {
            console.log('❌ Player name "Sal Frelick" is missing from summary title');
        }
        
        if (salFrelickCard.summaryTitle.startsWith('2024')) {
            console.log('✅ Summary title starts with year "2024"');
        } else {
            console.log('❌ Summary title does not start with year');
        }
    }
}

main();
