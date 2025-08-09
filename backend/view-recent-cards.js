// Simple script to view recently added cards locally
const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');

async function viewRecentCards(limit = 20) {
    console.log(`🔍 Viewing ${limit} most recently added cards...\n`);
    
    const updater = new FastSQLitePriceUpdater();
    await updater.connect();
    
    try {
        const recentCards = await new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summaryTitle, sport, psa10Price, lastUpdated, filterInfo
                FROM cards 
                WHERE lastUpdated IS NOT NULL
                ORDER BY datetime(lastUpdated) DESC 
                LIMIT ?
            `;
            
            updater.db.all(query, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (recentCards.length === 0) {
            console.log('❌ No recent cards found');
            return;
        }
        
        console.log(`📊 Found ${recentCards.length} recent cards:\n`);
        
        recentCards.forEach((card, index) => {
            let source = 'unknown';
            let searchTerm = 'unknown';
            
            try {
                if (card.filterInfo) {
                    const parsed = JSON.parse(card.filterInfo);
                    source = parsed.source || 'unknown';
                    searchTerm = parsed.searchTerm || 'unknown';
                }
            } catch (e) {
                // Keep defaults
            }
            
            console.log(`${index + 1}. 💎 ${card.title}`);
            console.log(`   💰 Price: $${card.psa10Price || 'N/A'}`);
            console.log(`   🏷️  Sport: ${card.sport || 'Unknown'}`);
            console.log(`   🔍 Search Term: "${searchTerm}"`);
            console.log(`   📅 Added: ${card.lastUpdated}`);
            console.log(`   🆔 ID: ${card.id}`);
            console.log('');
        });
        
    } finally {
        updater.db.close();
    }
}

// Run if called directly
if (require.main === module) {
    const limit = process.argv[2] ? parseInt(process.argv[2]) : 20;
    viewRecentCards(limit).catch(console.error);
}

module.exports = { viewRecentCards };
