const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const RailwayParallelsDatabase = require('./railway-parallels-db');

class ComprehensiveToParallelsMigration {
    constructor() {
        this.comprehensiveDbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async migrateData() {
        try {
            console.log('🚀 Starting migration from comprehensive database to parallels database...');
            
            // Step 1: Read card sets from comprehensive database
            const cardSets = await this.extractCardSetsFromComprehensive();
            console.log(`📊 Found ${cardSets.length} card sets in comprehensive database`);
            
            // Step 2: Add to parallels database
            await this.addToParallelsDatabase(cardSets);
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async extractCardSetsFromComprehensive() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.comprehensiveDbPath);
            
            // Query to get card sets with sport, year, and brand information
            const query = `
                SELECT DISTINCT 
                    name,
                    sport,
                    year,
                    brand,
                    setName,
                    source
                FROM sets 
                WHERE sport IS NOT NULL 
                AND year IS NOT NULL 
                AND brand IS NOT NULL
                AND sport != ''
                AND year != ''
                AND brand != ''
                ORDER BY name
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                db.close();
                
                // Process and enhance the data
                const processedSets = rows.map(row => {
                    return {
                        name: row.name || '',
                        sport: row.sport || '',
                        year: row.year || '',
                        brand: row.brand || '',
                        setName: row.setName || '',
                        source: row.source || 'comprehensive_migration'
                    };
                });
                
                // Remove duplicates based on name
                const uniqueSets = this.removeDuplicates(processedSets);
                resolve(uniqueSets);
            });
        });
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
        
        try {
            // Connect to Railway database
            await this.parallelsDb.connectDatabase();
            
            let addedCount = 0;
            let skippedCount = 0;
            
            for (const set of cardSets) {
                try {
                    // Check if set already exists
                    const existingSets = await this.parallelsDb.getAllCardSets();
                    const exists = existingSets.some(existing => 
                        existing.set_name.toLowerCase() === set.name.toLowerCase()
                    );
                    
                    if (!exists) {
                        await this.parallelsDb.addCardSet(
                            set.name,
                            set.sport,
                            set.year,
                            set.brand
                        );
                        addedCount++;
                        
                        if (addedCount % 100 === 0) {
                            console.log(`📊 Progress: ${addedCount} sets added`);
                        }
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error adding set "${set.name}":`, error.message);
                }
            }
            
            console.log(`✅ Added ${addedCount} new card sets to parallels database`);
            console.log(`⏭️  Skipped ${skippedCount} existing card sets`);
            
        } catch (error) {
            console.error('❌ Error connecting to parallels database:', error.message);
            console.log('⚠️  Skipping parallels database update');
        } finally {
            await this.parallelsDb.closeDatabase();
        }
    }

    async getMigrationStats() {
        try {
            // Get comprehensive database stats
            const comprehensiveStats = await this.getComprehensiveStats();
            
            // Get parallels database stats
            await this.parallelsDb.connectDatabase();
            const parallelsSets = await this.parallelsDb.getAllCardSets();
            await this.parallelsDb.closeDatabase();
            
            return {
                comprehensive: comprehensiveStats,
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

    async getComprehensiveStats() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.comprehensiveDbPath);
            
            db.get("SELECT COUNT(*) as count FROM sets", [], (err, row) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                db.close();
                resolve({ sets: row.count });
            });
        });
    }
}

// Main execution
async function main() {
    const migration = new ComprehensiveToParallelsMigration();
    
    try {
        await migration.migrateData();
        
        // Get and display stats
        const stats = await migration.getMigrationStats();
        if (stats) {
            console.log('\n📊 Migration Statistics:');
            console.log(`Comprehensive Database: ${stats.comprehensive.sets} sets`);
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

module.exports = { ComprehensiveToParallelsMigration };
