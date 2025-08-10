const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class ComprehensiveDatabaseRecreator {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.jsonPath = path.join(__dirname, 'data', 'comprehensiveCardDatabase.json');
    }

    async recreateDatabase() {
        console.log('🔄 Recreating comprehensive card database...');
        
        // Read JSON data
        console.log('📖 Reading JSON data...');
        const jsonData = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
        const sets = jsonData.sets || jsonData; // Handle both structures
        console.log(`📊 Found ${sets.length} sets in JSON data`);

        // Create new database
        console.log('🗄️ Creating new SQLite database...');
        const db = new sqlite3.Database(this.dbPath);

        // Create tables
        await this.createTables(db);

        // Insert data
        console.log('💾 Inserting data into database...');
        await this.insertData(db, sets);

        // Close database
        db.close();
        console.log('✅ Comprehensive database recreated successfully!');
        console.log(`📁 Database saved to: ${this.dbPath}`);
    }

    createTables(db) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Create sets table
                db.run(`
                    CREATE TABLE IF NOT EXISTS sets (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        sport TEXT NOT NULL,
                        year TEXT NOT NULL,
                        brand TEXT NOT NULL,
                        setName TEXT NOT NULL,
                        source TEXT NOT NULL,
                        searchText TEXT NOT NULL,
                        displayName TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Error creating sets table:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Sets table created');
                    resolve();
                });
            });
        });
    }

    insertData(db, data) {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO sets 
                (id, name, sport, year, brand, setName, source, searchText, displayName)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            let inserted = 0;
            const total = data.length;

            data.forEach((set, index) => {
                stmt.run([
                    set.id,
                    set.name,
                    set.sport,
                    set.year,
                    set.brand,
                    set.setName,
                    set.source,
                    set.searchText,
                    set.displayName
                ], (err) => {
                    if (err) {
                        console.error('❌ Error inserting set:', set.id, err);
                    } else {
                        inserted++;
                        if (inserted % 1000 === 0) {
                            console.log(`📈 Inserted ${inserted}/${total} sets...`);
                        }
                    }

                    if (inserted === total) {
                        stmt.finalize((err) => {
                            if (err) {
                                console.error('❌ Error finalizing statement:', err);
                                reject(err);
                            } else {
                                console.log(`✅ Successfully inserted ${inserted} sets`);
                                resolve();
                            }
                        });
                    }
                });
            });
        });
    }

    async getDatabaseStats() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            db.get('SELECT COUNT(*) as count FROM sets', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.close();
                resolve({
                    totalSets: row.count,
                    databasePath: this.dbPath,
                    databaseSize: fs.statSync(this.dbPath).size
                });
            });
        });
    }
}

// Run the recreation
async function main() {
    try {
        const recreator = new ComprehensiveDatabaseRecreator();
        await recreator.recreateDatabase();
        
        const stats = await recreator.getDatabaseStats();
        console.log('\n📊 Database Statistics:');
        console.log(`Total sets: ${stats.totalSets}`);
        console.log(`Database size: ${(stats.databaseSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Database path: ${stats.databasePath}`);
        
    } catch (error) {
        console.error('❌ Error recreating database:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ComprehensiveDatabaseRecreator;
