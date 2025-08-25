const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const RailwayParallelsDatabase = require('./railway-parallels-db');

class NewPricingToParallelsMigration {
    constructor() {
        // Direct connection to new-scorecard database
        this.pricingDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.pricingDb = null;
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async migrateData() {
        try {
            console.log('🚀 Starting migration from new-scorecard database to parallels database...');
            
            // Step 1: Connect to both databases
            await this.connectToPricingDb();
            await this.parallelsDb.connectDatabase();
            
            // Step 2: Extract unique card sets from new-scorecard database
            const cardSets = await this.extractCardSetsFromPricingDb();
            console.log(`📊 Found ${cardSets.length} unique card sets in new-scorecard database`);
            
            // Step 3: Add to parallels database
            await this.addToParallelsDatabase(cardSets);
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            // Close connections
            if (this.pricingDb) {
                this.pricingDb.close();
                console.log('✅ Pricing database connection closed');
            }
            if (this.parallelsDb) {
                await this.parallelsDb.closeDatabase();
            }
        }
    }

    async connectToPricingDb() {
        return new Promise((resolve, reject) => {
            this.pricingDb = new sqlite3.Database(this.pricingDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('❌ Error connecting to new-scorecard database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to new-scorecard database');
                    resolve();
                }
            });
        });
    }

    async extractCardSetsFromPricingDb() {
        return new Promise((resolve, reject) => {
            // Query to get unique card sets with year and brand information
            const query = `
                SELECT DISTINCT 
                    set_name as setName,
                    year,
                    brand,
                    sport
                FROM cards 
                WHERE set_name IS NOT NULL 
                AND set_name != ''
                AND year IS NOT NULL
                AND year != ''
                ORDER BY set_name, year
            `;
            
            this.pricingDb.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Process and enhance the data
                const processedSets = rows.map(row => {
                    const setName = row.setName || '';
                    const year = row.year || '';
                    const brand = row.brand || '';
                    const sport = row.sport || this.detectSport(setName, brand);
                    
                    return {
                        name: this.generateSetName(setName, year, brand),
                        sport: sport,
                        year: year,
                        brand: brand,
                        setName: setName,
                        source: 'newpricing_migration'
                    };
                });
                
                // Remove duplicates based on name
                const uniqueSets = this.removeDuplicates(processedSets);
                resolve(uniqueSets);
            });
        });
    }

    detectSport(setName, brand) {
        const name = (setName + ' ' + brand).toLowerCase();
        
        if (name.includes('football') || name.includes('nfl')) return 'Football';
        if (name.includes('basketball') || name.includes('nba')) return 'Basketball';
        if (name.includes('baseball') || name.includes('mlb')) return 'Baseball';
        if (name.includes('hockey') || name.includes('nhl')) return 'Hockey';
        if (name.includes('soccer') || name.includes('fifa')) return 'Soccer';
        if (name.includes('pokemon')) return 'Pokemon';
        if (name.includes('magic') || name.includes('mtg')) return 'Magic: The Gathering';
        if (name.includes('yugioh') || name.includes('yu-gi-oh')) return 'Yu-Gi-Oh!';
        
        return null;
    }

    generateSetName(setName, year, brand) {
        if (!setName) return '';
        
        let name = setName.trim();
        if (year && !name.includes(year)) {
            name = `${year} ${name}`;
        }
        if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
            name = `${brand} ${name}`;
        }
        
        return name;
    }

    removeDuplicates(sets) {
        const seen = new Set();
        return sets.filter(set => {
            const key = set.name.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async addToParallelsDatabase(cardSets) {
        console.log('🔄 Adding card sets to parallels database...');
        
        let addedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        // Get existing sets to avoid duplicates
        const existingSets = await this.parallelsDb.getAllCardSets();
        const existingSetNames = new Set(existingSets.map(set => set.set_name.toLowerCase()));
        
        for (const set of cardSets) {
            try {
                // Only add sets that have sport, year, and brand info
                if (set.sport && set.year && set.brand) {
                    // Check if set already exists
                    if (existingSetNames.has(set.name.toLowerCase())) {
                        skippedCount++;
                    } else {
                        await this.parallelsDb.addCardSet(
                            set.name,
                            set.sport,
                            set.year,
                            set.brand
                        );
                        addedCount++;
                        
                        if (addedCount % 50 === 0) {
                            console.log(`📊 Progress: ${addedCount} sets added, ${skippedCount} skipped`);
                        }
                    }
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Error adding set "${set.name}":`, error.message);
                errorCount++;
            }
        }
        
        console.log(`✅ Migration Summary:`);
        console.log(`   📈 Added: ${addedCount} new card sets`);
        console.log(`   ⏭️  Skipped: ${skippedCount} existing/invalid sets`);
        console.log(`   ❌ Errors: ${errorCount} failed additions`);
    }

    async getMigrationStats() {
        try {
            // Get new-scorecard database stats
            const pricingStats = await this.getPricingStats();
            
            // Get parallels database stats
            const parallelsSets = await this.parallelsDb.getAllCardSets();
            
            return {
                pricing: pricingStats,
                parallels: {
                    sets: parallelsSets.length,
                    totalParallels: parallelsSets.reduce((sum, set) => sum + parseInt(set.parallel_count || 0), 0)
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting migration stats:', error);
            return null;
        }
    }

    async getPricingStats() {
        return new Promise((resolve, reject) => {
            this.pricingDb.get("SELECT COUNT(*) as count FROM cards", [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.pricingDb.get(
                    "SELECT COUNT(DISTINCT set_name) as count FROM cards WHERE set_name IS NOT NULL AND set_name != '' AND year IS NOT NULL AND year != ''", 
                    [], 
                    (err, setsRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            totalCards: row.count,
                            setsWithData: setsRow.count
                        });
                    }
                );
            });
        });
    }
}

// Main execution
async function main() {
    const migration = new NewPricingToParallelsMigration();
    
    try {
        await migration.migrateData();
        
        // Get and display stats
        const stats = await migration.getMigrationStats();
        if (stats) {
            console.log('\n📊 Migration Statistics:');
            console.log(`New-scorecard Database: ${stats.pricing.totalCards} total cards, ${stats.pricing.setsWithData} sets with data`);
            console.log(`Parallels Database: ${stats.parallels.sets} sets, ${stats.parallels.totalParallels} total parallels`);
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { NewPricingToParallelsMigration };
