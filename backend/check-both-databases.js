const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkBothDatabases() {
    console.log('🔍 Checking Both Database Locations...\n');
    
    const dbPath1 = path.join(__dirname, 'new-scorecard.db');
    const dbPath2 = path.join(__dirname, 'data', 'new-scorecard.db');
    
    console.log('Database 1 (root):', dbPath1);
    console.log('Database 2 (data):', dbPath2);
    
    // Check database 1 (root)
    console.log('\n📊 Checking Database 1 (root)...');
    const db1 = new sqlite3.Database(dbPath1, (err) => {
        if (err) {
            console.log('❌ Database 1 connection failed:', err.message);
        } else {
            console.log('✅ Database 1 connected');
            db1.get('SELECT COUNT(*) as count FROM cards', (err, result) => {
                if (err) {
                    console.log('❌ Database 1 query failed:', err.message);
                } else {
                    console.log(`📈 Database 1 cards: ${result.count}`);
                }
                db1.close();
                
                // Check database 2 (data)
                console.log('\n📊 Checking Database 2 (data)...');
                const db2 = new sqlite3.Database(dbPath2, (err) => {
                    if (err) {
                        console.log('❌ Database 2 connection failed:', err.message);
                    } else {
                        console.log('✅ Database 2 connected');
                        db2.get('SELECT COUNT(*) as count FROM cards', (err, result) => {
                            if (err) {
                                console.log('❌ Database 2 query failed:', err.message);
                            } else {
                                console.log(`📈 Database 2 cards: ${result.count}`);
                            }
                            db2.close();
                            
                            console.log('\n🎯 Summary:');
                            console.log('   - Database 1 (root): Checked');
                            console.log('   - Database 2 (data): Checked');
                            console.log('\n💡 The maintenance job should use the database with more cards.');
                        });
                    }
                });
            });
        }
    });
}

checkBothDatabases().catch(error => {
    console.error('❌ Script failed:', error);
});

