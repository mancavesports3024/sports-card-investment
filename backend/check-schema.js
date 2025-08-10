const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkSchema() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);

    console.log('🔍 Checking database schema...');

    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(cards)", (err, rows) => {
            if (err) {
                console.error('❌ Error checking schema:', err.message);
                reject(err);
            } else {
                console.log('📋 Cards table columns:');
                rows.forEach(row => {
                    console.log(`   ${row.name} (${row.type})`);
                });
                resolve(rows);
            }
            db.close();
        });
    });
}

checkSchema().then(() => {
    console.log('✅ Schema check complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Schema check failed:', error);
    process.exit(1);
});
