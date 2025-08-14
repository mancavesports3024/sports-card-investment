const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
const DatabaseDrivenStandardizedTitleGenerator = require('./generate-standardized-summary-titles-database-driven.js');

async function addMissingCards() {
    console.log('🔍 Adding Missing Cards to Database...\n');
    
    const updater = new FastSQLitePriceUpdater();
    const titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
    
    try {
        await updater.connect();
        
        // Cards that need to be added
        const missingCards = [
            {
                title: '2024 Ladd Mcconkey Topps Chrome Pink Refractor',
                summaryTitle: '2024 Topps Chrome - 1974 Topps Football Ladd McConkey Pink Refractor (RC) PSA 10',
                sport: 'Football',
                rawPrice: 3.62,
                multiplier: 37.95
            },
            {
                title: '2024 Picks Football Panini Prizm Draft Blue /149 Auto',
                summaryTitle: '2024 Panini Prizm Draft Picks Football - Auto - Jaxson Dart Blue /149 PSA 10',
                sport: 'Football',
                rawPrice: 3.72
            },
            {
                title: '2024 Xavier Worthy Panini Select Silver Prizm #17',
                summaryTitle: '2024 Panini Select Xavier Worthy 17 STARCADE Silver Prizm, Case Hit SSP PSA 10',
                sport: 'Football',
                rawPrice: 74.99
            }
        ];
        
        for (const card of missingCards) {
            console.log(`\n📝 Adding: ${card.title}`);
            
            // Generate standardized title
            const standardizedTitle = titleGenerator.generateStandardizedTitle(card.title);
            console.log(`  Standardized: ${standardizedTitle}`);
            
            // Add to database
            await new Promise((resolve, reject) => {
                updater.db.run(`
                    INSERT INTO cards (title, summary_title, sport, raw_average_price, multiplier)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    card.title,
                    standardizedTitle,
                    card.sport,
                    card.rawPrice,
                    card.multiplier || null
                ], function(err) {
                    if (err) reject(err);
                    else {
                        console.log(`  ✅ Added with ID: ${this.lastID}`);
                        resolve();
                    }
                });
            });
        }
        
        console.log('\n🎉 All missing cards added successfully!');
        
    } catch (error) {
        console.error('❌ Add failed:', error);
    } finally {
        if (updater.db) {
            updater.db.close();
        }
    }
}

addMissingCards().catch(console.error);
