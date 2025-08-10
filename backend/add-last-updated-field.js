const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function addLastUpdatedField() {
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    const db = new sqlite3.Database(dbPath);

    console.log('🔧 Checking and adding last_updated field to database...');

    try {
        // Check if last_updated column exists
        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(cards)", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const hasLastUpdated = columns.some(col => col.name === 'last_updated');
        
        if (!hasLastUpdated) {
            console.log('📝 Adding last_updated column to cards table...');
            
            await new Promise((resolve, reject) => {
                db.run(`
                    ALTER TABLE cards 
                    ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update existing records to have a last_updated timestamp
            console.log('🔄 Updating existing records with last_updated timestamps...');
            
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE cards 
                    SET last_updated = created_at 
                    WHERE last_updated IS NULL
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log('✅ last_updated field added and existing records updated');
        } else {
            console.log('✅ last_updated field already exists');
        }

        // Create index if it doesn't exist
        console.log('📋 Creating index for last_updated field...');
        
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_last_updated 
                ON cards(last_updated)
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('✅ Index created successfully');

    } catch (error) {
        console.error('❌ Error adding last_updated field:', error);
        throw error;
    } finally {
        db.close();
        console.log('✅ Database connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    addLastUpdatedField()
        .then(() => {
            console.log('✅ Database schema update complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Database schema update failed:', error);
            process.exit(1);
        });
}

module.exports = { addLastUpdatedField };
