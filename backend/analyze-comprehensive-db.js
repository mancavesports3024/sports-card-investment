const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function analyzeComprehensiveDB() {
    const dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    const db = new sqlite3.Database(dbPath);

    console.log('🔍 Analyzing comprehensive database...\n');

    try {
        // Check what tables exist
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('📋 Tables found:');
        tables.forEach(table => console.log(`   - ${table.name}`));
        console.log('');

        // Check sets table structure and data
        if (tables.some(t => t.name === 'sets')) {
            const setCount = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as count FROM sets", (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });
            
            console.log(`📊 Sets table: ${setCount} records`);

            // Check sport distribution
            const sportStats = await new Promise((resolve, reject) => {
                db.all("SELECT sport, COUNT(*) as count FROM sets GROUP BY sport ORDER BY count DESC", (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log('\n🏈 Sport distribution in sets:');
            sportStats.forEach(stat => {
                console.log(`   ${stat.sport}: ${stat.count} sets`);
            });

            // Show some sample sets for each sport
            console.log('\n📋 Sample sets by sport:');
            for (const stat of sportStats.slice(0, 5)) { // Top 5 sports
                const samples = await new Promise((resolve, reject) => {
                    db.all("SELECT name, displayName, searchText FROM sets WHERE sport = ? LIMIT 3", [stat.sport], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
                console.log(`\n   ${stat.sport}:`);
                samples.forEach(sample => {
                    console.log(`     - ${sample.name || sample.displayName || sample.searchText}`);
                });
            }
        }

        // Check if there are other relevant tables
        if (tables.some(t => t.name === 'cards')) {
            const cardCount = await new Promise((resolve, reject) => {
                db.get("SELECT COUNT(*) as count FROM cards", (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });
            
            console.log(`\n🃏 Cards table: ${cardCount} records`);
        }

    } catch (error) {
        console.error('❌ Error analyzing database:', error);
    } finally {
        db.close();
    }
}

analyzeComprehensiveDB().then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
});
