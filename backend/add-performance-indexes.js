const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PerformanceIndexer {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
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

    async runUpdate(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    async getCurrentIndexes() {
        console.log('📋 Current indexes on cards table:\n');
        
        const indexes = await this.runQuery("PRAGMA index_list(cards)");
        
        indexes.forEach(index => {
            console.log(`   - ${index.name} (${index.unique ? 'UNIQUE' : 'NON-UNIQUE'})`);
        });
        
        console.log('');
        return indexes;
    }

    async addPerformanceIndexes() {
        console.log('⚡ Adding performance indexes...\n');
        
        const indexesToAdd = [
            {
                name: 'idx_sport_year',
                query: 'CREATE INDEX IF NOT EXISTS idx_sport_year ON cards(sport, year)',
                description: 'Composite index for sport + year queries'
            },
            {
                name: 'idx_brand_set',
                query: 'CREATE INDEX IF NOT EXISTS idx_brand_set ON cards(brand, set_name)',
                description: 'Composite index for brand + set queries'
            },
            {
                name: 'idx_price_range',
                query: 'CREATE INDEX IF NOT EXISTS idx_price_range ON cards(raw_average_price, psa10_price)',
                description: 'Composite index for price range queries'
            },
            {
                name: 'idx_created_sport',
                query: 'CREATE INDEX IF NOT EXISTS idx_created_sport ON cards(created_at, sport)',
                description: 'Composite index for recent cards by sport'
            },
            {
                name: 'idx_multiplier_range',
                query: 'CREATE INDEX IF NOT EXISTS idx_multiplier_range ON cards(multiplier)',
                description: 'Index for multiplier-based queries'
            },
            {
                name: 'idx_psa10_price_range',
                query: 'CREATE INDEX IF NOT EXISTS idx_psa10_price_range ON cards(psa10_price)',
                description: 'Index for PSA 10 price range queries'
            },
            {
                name: 'idx_raw_price_range',
                query: 'CREATE INDEX IF NOT EXISTS idx_raw_price_range ON cards(raw_average_price)',
                description: 'Index for raw price range queries'
            }
        ];
        
        let addedCount = 0;
        
        for (const index of indexesToAdd) {
            try {
                await this.runUpdate(index.query);
                console.log(`✅ Added ${index.name}: ${index.description}`);
                addedCount++;
            } catch (error) {
                console.log(`⚠️ Failed to add ${index.name}: ${error.message}`);
            }
        }
        
        console.log(`\n📊 Added ${addedCount} new indexes`);
        return addedCount;
    }

    async analyzeQueryPerformance() {
        console.log('🔍 Analyzing query performance...\n');
        
        // Test common query patterns
        const testQueries = [
            {
                name: 'Sport + Year filter',
                query: 'SELECT COUNT(*) FROM cards WHERE sport = ? AND year = ?',
                params: ['Basketball', 2023]
            },
            {
                name: 'Price range filter',
                query: 'SELECT COUNT(*) FROM cards WHERE raw_average_price BETWEEN ? AND ?',
                params: [10, 100]
            },
            {
                name: 'PSA 10 price filter',
                query: 'SELECT COUNT(*) FROM cards WHERE psa10_price > ?',
                params: [50]
            },
            {
                name: 'Recent cards by sport',
                query: 'SELECT COUNT(*) FROM cards WHERE created_at > ? AND sport = ?',
                params: ['2025-01-01', 'Football']
            },
            {
                name: 'Multiplier filter',
                query: 'SELECT COUNT(*) FROM cards WHERE multiplier BETWEEN ? AND ?',
                params: [1, 10]
            }
        ];
        
        console.log('Query performance test results:');
        console.log('================================');
        
        for (const test of testQueries) {
            const startTime = Date.now();
            
            try {
                await this.runQuery(test.query, test.params);
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log(`${test.name}: ${duration}ms`);
            } catch (error) {
                console.log(`${test.name}: ERROR - ${error.message}`);
            }
        }
        
        console.log('');
    }

    async getIndexUsageStats() {
        console.log('📊 Index usage statistics:\n');
        
        try {
            // Get index sizes
            const indexSizes = await this.runQuery(`
                SELECT 
                    name,
                    sql
                FROM sqlite_master 
                WHERE type = 'index' 
                  AND tbl_name = 'cards'
                ORDER BY name
            `);
            
            console.log('Index details:');
            indexSizes.forEach(index => {
                console.log(`   - ${index.name}`);
            });
            
        } catch (error) {
            console.log('⚠️ Could not retrieve index usage stats:', error.message);
        }
        
        console.log('');
    }

    async optimizeDatabase() {
        console.log('🔧 Running database optimization...\n');
        
        try {
            // Analyze tables for better query planning
            await this.runUpdate('ANALYZE cards');
            console.log('✅ Analyzed cards table for query optimization');
            
            // Vacuum to reclaim space and optimize storage
            await this.runUpdate('VACUUM');
            console.log('✅ Vacuumed database to optimize storage');
            
        } catch (error) {
            console.log('⚠️ Database optimization failed:', error.message);
        }
        
        console.log('');
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const indexer = new PerformanceIndexer();
    try {
        await indexer.connect();
        
        // Step 1: Show current indexes
        await indexer.getCurrentIndexes();
        
        // Step 2: Add performance indexes
        const addedCount = await indexer.addPerformanceIndexes();
        
        // Step 3: Show updated indexes
        console.log('📋 Updated indexes:');
        await indexer.getCurrentIndexes();
        
        // Step 4: Analyze query performance
        await indexer.analyzeQueryPerformance();
        
        // Step 5: Get index usage stats
        await indexer.getIndexUsageStats();
        
        // Step 6: Optimize database
        await indexer.optimizeDatabase();
        
        console.log('🎉 Performance optimization complete!');
        
    } catch (error) {
        console.error('❌ Error optimizing performance:', error);
    } finally {
        await indexer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = PerformanceIndexer;
