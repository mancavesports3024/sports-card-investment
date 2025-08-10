const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function clearDatabase() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);
    
    console.log('🗑️ Clearing new-scorecard.db database...');
    
    try {
        // Delete all cards
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM cards', (err) => {
                if (err) {
                    console.error('❌ Error clearing cards:', err.message);
                    reject(err);
                } else {
                    console.log('✅ All cards deleted from database');
                    resolve();
                }
            });
        });
        
        // Reset auto-increment counter
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sqlite_sequence WHERE name="cards"', (err) => {
                if (err) {
                    console.error('❌ Error resetting sequence:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Auto-increment counter reset');
                    resolve();
                }
            });
        });
        
        console.log('✅ Database cleared successfully!');
        
    } catch (error) {
        console.error('❌ Error clearing database:', error);
    } finally {
        db.close();
        console.log('✅ Database connection closed');
    }
}

clearDatabase().then(() => {
    console.log('✅ Database clearing complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Database clearing failed:', error);
    process.exit(1);
});
