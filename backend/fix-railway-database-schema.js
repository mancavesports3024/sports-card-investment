const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class RailwayDatabaseFixer {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    async addMissingColumn() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Adding missing psa10_average_price column to Railway database...');
            
            // Check if column exists first
            this.db.all("PRAGMA table_info(cards)", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const hasColumn = rows.some(row => row.name === 'psa10_average_price');
                
                if (hasColumn) {
                    console.log('✅ Column psa10_average_price already exists');
                    resolve(true);
                    return;
                }
                
                // Add the missing column
                this.db.run("ALTER TABLE cards ADD COLUMN psa10_average_price DECIMAL(10,2)", (err) => {
                    if (err) {
                        console.error('❌ Error adding column:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Successfully added psa10_average_price column');
                        resolve(true);
                    }
                });
            });
        });
    }

    async close() {
        this.db.close();
    }
}

async function main() {
    const fixer = new RailwayDatabaseFixer();
    
    try {
        await fixer.addMissingColumn();
        console.log('✅ Railway database schema fix complete');
    } catch (error) {
        console.error('❌ Error fixing Railway database:', error);
        process.exit(1);
    } finally {
        await fixer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { RailwayDatabaseFixer };
