const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');

async function checkDatabaseCards() {
    console.log('🔍 Checking All Cards in Database...\n');
    
    const updater = new FastSQLitePriceUpdater();
    
    try {
        await updater.connect();
        
        // Get all cards from the database
        const cards = await new Promise((resolve, reject) => {
            updater.db.all(`
                SELECT id, title, summary_title, psa10_price, raw_average_price, psa9_average_price, multiplier, sport
                FROM cards 
                ORDER BY id DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Total cards in database: ${cards.length}\n`);
        
        // Show the most recent cards
        console.log('📋 Most Recent Cards:');
        cards.slice(0, 10).forEach((card, index) => {
            console.log(`\n${index + 1}. ID: ${card.id}`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Summary: ${card.summary_title}`);
            console.log(`   Sport: ${card.sport}`);
            console.log(`   PSA 10: ${card.psa10_price || 'N/A'}`);
            console.log(`   Raw: ${card.raw_average_price || 'N/A'}`);
            console.log(`   PSA 9: ${card.psa9_average_price || 'N/A'}`);
            console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
            console.log(`   ID: ${card.id}`);
        });
        
        // Check for specific cards mentioned
        console.log('\n🔍 Looking for specific cards mentioned:');
        
        const searchTerms = [
            'Ladd McConkey',
            'Jaxson Dart',
            'Xavier Worthy Starcade',
            'Pink Refractor',
            'Blue /149'
        ];
        
        for (const term of searchTerms) {
            console.log(`\n📝 Searching for: "${term}"`);
            const matchingCards = cards.filter(card => 
                card.title.toLowerCase().includes(term.toLowerCase()) || 
                card.summary_title.toLowerCase().includes(term.toLowerCase())
            );
            
            if (matchingCards.length > 0) {
                matchingCards.forEach((card, index) => {
                    console.log(`  ${index + 1}. ID: ${card.id}`);
                    console.log(`     Title: ${card.title}`);
                    console.log(`     Summary: ${card.summary_title}`);
                    console.log(`     PSA 10: ${card.psa10_price || 'N/A'}`);
                });
            } else {
                console.log(`  ❌ No cards found containing "${term}"`);
            }
        }
        
    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        if (updater.db) {
            updater.db.close();
        }
    }
}

checkDatabaseCards().catch(console.error);
