const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ParallelsDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'parallels-database.db');
        this.db = null;
    }

    async connectDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to parallels database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to parallels database');
                    resolve();
                }
            });
        });
    }

    async closeDatabase() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createSetsTable = `
                CREATE TABLE IF NOT EXISTS card_sets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    set_name TEXT UNIQUE NOT NULL,
                    sport TEXT,
                    year TEXT,
                    brand TEXT,
                    source TEXT DEFAULT 'manual',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createParallelsTable = `
                CREATE TABLE IF NOT EXISTS parallels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    set_id INTEGER NOT NULL,
                    parallel_name TEXT NOT NULL,
                    parallel_type TEXT,
                    rarity TEXT,
                    print_run TEXT,
                    source TEXT DEFAULT 'beckett',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (set_id) REFERENCES card_sets (id),
                    UNIQUE(set_id, parallel_name)
                )
            `;

            this.db.serialize(() => {
                this.db.run(createSetsTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating card_sets table:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Created card_sets table');
                    }
                });

                this.db.run(createParallelsTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating parallels table:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Created parallels table');
                        resolve();
                    }
                });
            });
        });
    }

    async addCardSet(setName, sport = null, year = null, brand = null) {
        return new Promise((resolve, reject) => {
            // First try to find existing card set
            const findQuery = `SELECT id FROM card_sets WHERE set_name = ?`;
            
            this.db.get(findQuery, [setName], (err, row) => {
                if (err) {
                    console.error('❌ Error finding card set:', err.message);
                    reject(err);
                } else if (row) {
                    // Card set exists, return its ID
                    console.log(`✅ Found existing card set: ${setName} (ID: ${row.id})`);
                    resolve(row.id);
                } else {
                    // Card set doesn't exist, create it
                    const insertQuery = `
                        INSERT INTO card_sets (set_name, sport, year, brand, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `;

                    this.db.run(insertQuery, [setName, sport, year, brand], function(err) {
                        if (err) {
                            console.error('❌ Error adding card set:', err.message);
                            reject(err);
                        } else {
                            console.log(`✅ Created new card set: ${setName} (ID: ${this.lastID})`);
                            resolve(this.lastID);
                        }
                    });
                }
            });
        });
    }

    async addParallel(setName, parallelName, parallelType = null, rarity = null, printRun = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // First, get or create the card set
                const setId = await this.addCardSet(setName);
                
                const query = `
                    INSERT OR REPLACE INTO parallels (set_id, parallel_name, parallel_type, rarity, print_run)
                    VALUES (?, ?, ?, ?, ?)
                `;

                this.db.run(query, [setId, parallelName, parallelType, rarity, printRun], function(err) {
                    if (err) {
                        console.error('❌ Error adding parallel:', err.message);
                        reject(err);
                    } else {
                        console.log(`✅ Added parallel: ${parallelName} to ${setName} (set_id: ${setId})`);
                        resolve(this.lastID);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async getParallelsForSet(setName) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT p.parallel_name, p.parallel_type, p.rarity, p.print_run
                FROM parallels p
                JOIN card_sets cs ON p.set_id = cs.id
                WHERE cs.set_name = ?
                ORDER BY p.parallel_name
            `;

            this.db.all(query, [setName], (err, rows) => {
                if (err) {
                    console.error('❌ Error getting parallels:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getAllCardSets() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT cs.set_name, cs.sport, cs.year, cs.brand, COUNT(p.id) as parallel_count
                FROM card_sets cs
                LEFT JOIN parallels p ON cs.id = p.set_id
                GROUP BY cs.id
                ORDER BY cs.set_name
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('❌ Error getting card sets:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async searchParallels(searchTerm) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT cs.set_name, p.parallel_name, p.parallel_type, p.rarity
                FROM parallels p
                JOIN card_sets cs ON p.set_id = cs.id
                WHERE p.parallel_name LIKE ? OR cs.set_name LIKE ?
                ORDER BY cs.set_name, p.parallel_name
            `;

            const searchPattern = `%${searchTerm}%`;
            this.db.all(query, [searchPattern, searchPattern], (err, rows) => {
                if (err) {
                    console.error('❌ Error searching parallels:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Add the 2023 Topps Heritage Baseball parallels from the Beckett article
    async addHeritageParallels() {
        console.log('📚 Adding 2023 Topps Heritage Baseball parallels...');
        
        const heritageParallels = [
            { name: 'Black Bordered', type: 'Parallel', rarity: 'Limited', printRun: '50 copies each' },
            { name: 'Flip Stock', type: 'Parallel', rarity: 'Limited', printRun: '5 copies each' },
            { name: 'Chrome', type: 'Parallel', rarity: 'Standard' },
            { name: 'Chrome Refractor', type: 'Parallel', rarity: 'Standard' },
            { name: 'Chrome Black Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Purple Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Green Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Blue Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Red Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Gold Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Superfractor', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Mini', type: 'Parallel', rarity: 'Standard' },
            { name: 'Mini Black', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Red', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Blue', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Green', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Purple', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Gold', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mini Superfractor', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Clubhouse Collection', type: 'Insert', rarity: 'Standard' },
            { name: 'Clubhouse Collection Relic', type: 'Insert', rarity: 'Limited' },
            { name: 'Clubhouse Collection Autograph', type: 'Insert', rarity: 'Limited' },
            { name: 'Real One Autograph', type: 'Insert', rarity: 'Limited' },
            { name: 'Real One Triple Autograph', type: 'Insert', rarity: 'Limited', printRun: '/5' },
            { name: 'Black and White Image Variation', type: 'Variation', rarity: 'Limited' },
            { name: 'Name-Position Swap Variation', type: 'Variation', rarity: 'Limited' }
        ];

        for (const parallel of heritageParallels) {
            await this.addParallel(
                '2023 Topps Heritage Baseball',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${heritageParallels.length} parallels for 2023 Topps Heritage Baseball`);
    }

    // Generate extraction patterns for a card set
    async generateExtractionPatterns(setName) {
        const parallels = await this.getParallelsForSet(setName);
        
        if (parallels.length === 0) {
            return `// No parallels found for ${setName}`;
        }

        let code = `// ${setName} Parallels\n`;
        
        parallels.forEach(parallel => {
            const cleanName = parallel.parallel_name.replace(/[^\w\s\-&]/g, '').trim();
            const patternName = cleanName.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
            
            if (cleanName && patternName) {
                // Escape special regex characters
                const escapedPattern = cleanName.toLowerCase()
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                
                code += `{ pattern: /\\b(${escapedPattern})\\b/gi, name: '${patternName}' },\n`;
            }
        });

        return code;
    }

    async initializeDatabase() {
        try {
            await this.connectDatabase();
            await this.createTables();
            await this.addHeritageParallels();
            
            console.log('\n📊 Database Summary:');
            const cardSets = await this.getAllCardSets();
            console.log(`Total card sets: ${cardSets.length}`);
            
            cardSets.forEach(set => {
                console.log(`  - ${set.set_name}: ${set.parallel_count} parallels`);
            });
            
        } catch (error) {
            console.error('❌ Error initializing database:', error.message);
        } finally {
            await this.closeDatabase();
        }
    }
}

// Example usage
async function main() {
    const parallelsDb = new ParallelsDatabase();
    await parallelsDb.initializeDatabase();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ParallelsDatabase;
