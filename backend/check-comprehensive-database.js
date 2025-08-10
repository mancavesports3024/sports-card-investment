const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ComprehensiveDatabaseChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to comprehensive database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to comprehensive database');
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                } else {
                    console.log('✅ Database connection closed');
                }
                resolve();
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async checkDatabase() {
        try {
            console.log('🔍 Checking comprehensive database contents...\n');

            // Check if database file exists
            const fs = require('fs');
            if (!fs.existsSync(this.dbPath)) {
                console.log('❌ Comprehensive database file not found!');
                console.log(`Expected path: ${this.dbPath}`);
                return;
            }

            const stats = fs.statSync(this.dbPath);
            console.log(`📁 Database file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

            await this.connect();

            // Check tables
            const tables = await this.runQuery("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('📋 Tables found:');
            tables.forEach(table => console.log(`   - ${table.name}`));
            console.log('');

            // Check the sets table structure
            const setColumns = await this.runQuery("PRAGMA table_info(sets)");
            console.log('📋 Sets table columns:');
            setColumns.forEach(col => console.log(`   - ${col.name} (${col.type})`));
            console.log('');

            // Check total sets
            const setCount = await this.runQuery("SELECT COUNT(*) as count FROM sets");
            console.log(`📦 Total sets: ${setCount[0].count}`);

            // Check sports from sets
            const sports = await this.runQuery("SELECT DISTINCT sport FROM sets WHERE sport IS NOT NULL ORDER BY sport");
            console.log('🏈 Sports available:');
            sports.forEach(sport => console.log(`   - ${sport.sport}`));
            console.log('');

            // Check brands from sets
            const brands = await this.runQuery("SELECT DISTINCT brand FROM sets WHERE brand IS NOT NULL ORDER BY brand");
            console.log('🏷️ Brands available:');
            brands.forEach(brand => console.log(`   - ${brand.brand}`));
            console.log('');

            // Check years from sets
            const years = await this.runQuery("SELECT DISTINCT year FROM sets WHERE year IS NOT NULL ORDER BY year DESC LIMIT 10");
            console.log('📅 Recent years available:');
            years.forEach(year => console.log(`   - ${year.year}`));
            console.log('');

            // Sample sets
            const sampleSets = await this.runQuery("SELECT name, sport, brand, year, searchText FROM sets ORDER BY RANDOM() LIMIT 10");
            console.log('📦 Sample sets:');
            sampleSets.forEach(set => {
                console.log(`   - ${set.year} ${set.brand} ${set.name} (${set.sport})`);
                console.log(`     Search: "${set.searchText}"`);
            });
            console.log('');

            // Test sport detection using sets table
            console.log('🧪 Testing sport detection:');
            const testTitles = [
                "2023 Topps Chrome Julio Rodriguez RC",
                "2020 Panini Prizm Anthony Edwards RC",
                "2022 Bowman Chrome Spencer Strider RC",
                "2019 Pokemon Charizard GX",
                "2021 Upper Deck Connor McDavid"
            ];

            for (const title of testTitles) {
                // Extract key terms from title
                const terms = title.toLowerCase().split(' ');
                const year = terms[0];
                const brand = terms[1];
                const set = terms[2];
                
                console.log(`\n   Testing: "${title}"`);
                console.log(`     Year: ${year}, Brand: ${brand}, Set: ${set}`);
                
                // Try different search strategies
                const strategies = [
                    `%${brand}%`,
                    `%${set}%`,
                    `%${year}%`,
                    `%${brand} ${set}%`
                ];
                
                let found = false;
                for (const strategy of strategies) {
                    const result = await this.runQuery(`
                        SELECT sport, name, searchText FROM sets 
                        WHERE LOWER(name) LIKE ? OR LOWER(searchText) LIKE ?
                        LIMIT 1
                    `, [strategy, strategy]);
                    
                    if (result.length > 0) {
                        console.log(`     ✅ Match: ${result[0].sport} - "${result[0].name}"`);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.log(`     ❌ No match found`);
                }
            }

            // Show some actual searchText examples
            console.log('\n📝 Sample searchText entries:');
            const sampleSearchText = await this.runQuery("SELECT searchText, sport, name FROM sets WHERE searchText IS NOT NULL ORDER BY RANDOM() LIMIT 5");
            sampleSearchText.forEach(item => {
                console.log(`   "${item.searchText}" -> ${item.sport} (${item.name})`);
            });

            await this.close();

        } catch (error) {
            console.error('❌ Error checking comprehensive database:', error);
            if (this.db) {
                await this.close();
            }
        }
    }
}

// Main execution
async function main() {
    const checker = new ComprehensiveDatabaseChecker();
    await checker.checkDatabase();
}

if (require.main === module) {
    main();
}

module.exports = { ComprehensiveDatabaseChecker };
