const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Import the database classes
const { EnhancedComprehensiveDatabase } = require('./enhance-comprehensive-database');
const RailwayParallelsDatabase = require('./railway-parallels-db');

class ScorecardMigration {
    constructor() {
        this.scorecardDbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.comprehensiveDb = new EnhancedComprehensiveDatabase();
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async migrateData() {
        try {
            console.log('🚀 Starting migration from new-scorecard database...');
            
            // Step 1: Read unique card sets from new-scorecard database
            const cardSets = await this.extractCardSetsFromScorecard();
            console.log(`📊 Found ${cardSets.length} unique card sets in new-scorecard database`);
            
            // Step 2: Add to comprehensive database
            await this.addToComprehensiveDatabase(cardSets);
            
            // Step 3: Add to parallels database
            await this.addToParallelsDatabase(cardSets);
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async extractCardSetsFromScorecard() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.scorecardDbPath);
            
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
                ORDER BY set_name, year
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
                        searchText: this.generateSearchText(setName, year, brand),
                        displayName: this.generateDisplayName(setName, year, brand)
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

    generateSearchText(setName, year, brand) {
        const parts = [setName, year, brand].filter(Boolean);
        return parts.join(' ').toLowerCase();
    }

    generateDisplayName(setName, year, brand) {
        const parts = [brand, setName, year].filter(Boolean);
        return parts.join(' ');
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

    async addToComprehensiveDatabase(cardSets) {
        console.log('📚 Adding card sets to comprehensive database...');
        
        const db = new sqlite3.Database(this.comprehensiveDb.dbPath);
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO sets
                    (name, sport, year, brand, setName, source, searchText, displayName)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                const total = cardSets.length;

                cardSets.forEach((set, index) => {
                    stmt.run([
                        set.name,
                        set.sport,
                        set.year,
                        set.brand,
                        set.setName,
                        'scorecard_migration',
                        set.searchText,
                        set.displayName
                    ], (err) => {
                        if (err) console.error(`❌ Error inserting set ${index}:`, err);
                        
                        completed++;
                        if (completed % 50 === 0) {
                            console.log(`📊 Progress: ${completed}/${total} sets processed`);
                        }
                        
                        if (completed === total) {
                            stmt.finalize((err) => {
                                if (err) {
                                    db.close();
                                    reject(err);
                                } else {
                                    db.close((err) => {
                                        if (err) reject(err);
                                        else {
                                            console.log(`✅ Added ${total} card sets to comprehensive database`);
                                            resolve();
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    async addToParallelsDatabase(cardSets) {
        console.log('🔄 Adding card sets to parallels database...');
        
        try {
            // Connect to Railway database
            await this.parallelsDb.connectDatabase();
            
            let addedCount = 0;
            for (const set of cardSets) {
                try {
                    // Only add sets that have sport, year, and brand info
                    if (set.sport && set.year && set.brand) {
                        await this.parallelsDb.addCardSet(
                            set.name,
                            set.sport,
                            set.year,
                            set.brand
                        );
                        addedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error adding set "${set.name}":`, error.message);
                }
            }
            
            console.log(`✅ Added ${addedCount} card sets to parallels database`);
            
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
            const comprehensiveStats = await this.comprehensiveDb.getDatabaseStats();
            
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
}

// Main execution
async function main() {
    const migration = new ScorecardMigration();
    
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

module.exports = { ScorecardMigration };
