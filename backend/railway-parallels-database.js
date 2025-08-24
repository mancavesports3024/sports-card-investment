const { Pool } = require('pg');

class RailwayParallelsDatabase {
    constructor() {
        // Use Railway's DATABASE_URL environment variable
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async connectDatabase() {
        try {
            const client = await this.pool.connect();
            console.log('✅ Connected to Railway PostgreSQL parallels database');
            client.release();
        } catch (error) {
            console.error('❌ Error connecting to Railway database:', error.message);
            throw error;
        }
    }

    async closeDatabase() {
        try {
            await this.pool.end();
            console.log('✅ Railway database connection closed');
        } catch (error) {
            console.error('❌ Error closing Railway database:', error.message);
        }
    }

    async createTables() {
        const client = await this.pool.connect();
        
        try {
            // Create card_sets table
            const createSetsTable = `
                CREATE TABLE IF NOT EXISTS card_sets (
                    id SERIAL PRIMARY KEY,
                    set_name VARCHAR(255) UNIQUE NOT NULL,
                    sport VARCHAR(100),
                    year VARCHAR(50),
                    brand VARCHAR(100),
                    source VARCHAR(100) DEFAULT 'manual',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create parallels table
            const createParallelsTable = `
                CREATE TABLE IF NOT EXISTS parallels (
                    id SERIAL PRIMARY KEY,
                    set_id INTEGER NOT NULL,
                    parallel_name VARCHAR(255) NOT NULL,
                    parallel_type VARCHAR(100),
                    rarity VARCHAR(100),
                    print_run VARCHAR(100),
                    source VARCHAR(100) DEFAULT 'beckett',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (set_id) REFERENCES card_sets (id),
                    UNIQUE(set_id, parallel_name)
                )
            `;

            await client.query(createSetsTable);
            console.log('✅ Created card_sets table on Railway');
            
            await client.query(createParallelsTable);
            console.log('✅ Created parallels table on Railway');
            
        } catch (error) {
            console.error('❌ Error creating tables:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async addCardSet(setName, sport = null, year = null, brand = null) {
        const client = await this.pool.connect();
        
        try {
            // First try to find existing card set
            const findQuery = `SELECT id FROM card_sets WHERE set_name = $1`;
            const findResult = await client.query(findQuery, [setName]);
            
            if (findResult.rows.length > 0) {
                // Card set exists, return its ID
                console.log(`✅ Found existing card set: ${setName} (ID: ${findResult.rows[0].id})`);
                return findResult.rows[0].id;
            } else {
                // Card set doesn't exist, create it
                const insertQuery = `
                    INSERT INTO card_sets (set_name, sport, year, brand, updated_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    RETURNING id
                `;

                const insertResult = await client.query(insertQuery, [setName, sport, year, brand]);
                console.log(`✅ Created new card set: ${setName} (ID: ${insertResult.rows[0].id})`);
                return insertResult.rows[0].id;
            }
        } catch (error) {
            console.error('❌ Error adding card set:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async addParallel(setName, parallelName, parallelType = null, rarity = null, printRun = null) {
        const client = await this.pool.connect();
        
        try {
            // First, get or create the card set
            const setId = await this.addCardSet(setName);
            
            const query = `
                INSERT INTO parallels (set_id, parallel_name, parallel_type, rarity, print_run)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (set_id, parallel_name) DO UPDATE SET
                    parallel_type = EXCLUDED.parallel_type,
                    rarity = EXCLUDED.rarity,
                    print_run = EXCLUDED.print_run
                RETURNING id
            `;

            const result = await client.query(query, [setId, parallelName, parallelType, rarity, printRun]);
            console.log(`✅ Added parallel: ${parallelName} to ${setName} (set_id: ${setId})`);
            return result.rows[0].id;
            
        } catch (error) {
            console.error('❌ Error adding parallel:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getParallelsForSet(setName) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                SELECT p.parallel_name, p.parallel_type, p.rarity, p.print_run
                FROM parallels p
                JOIN card_sets cs ON p.set_id = cs.id
                WHERE cs.set_name = $1
                ORDER BY p.parallel_name
            `;

            const result = await client.query(query, [setName]);
            return result.rows;
        } catch (error) {
            console.error('❌ Error getting parallels:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async getAllCardSets() {
        const client = await this.pool.connect();
        
        try {
            const query = `
                SELECT cs.set_name, cs.sport, cs.year, cs.brand, COUNT(p.id) as parallel_count
                FROM card_sets cs
                LEFT JOIN parallels p ON cs.id = p.set_id
                GROUP BY cs.id, cs.set_name, cs.sport, cs.year, cs.brand
                ORDER BY cs.set_name
            `;

            const result = await client.query(query);
            return result.rows;
        } catch (error) {
            console.error('❌ Error getting card sets:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async searchParallels(searchTerm) {
        const client = await this.pool.connect();
        
        try {
            const query = `
                SELECT cs.set_name, p.parallel_name, p.parallel_type, p.rarity
                FROM parallels p
                JOIN card_sets cs ON p.set_id = cs.id
                WHERE p.parallel_name ILIKE $1 OR cs.set_name ILIKE $1
                ORDER BY cs.set_name, p.parallel_name
            `;

            const searchPattern = `%${searchTerm}%`;
            const result = await client.query(query, [searchPattern]);
            return result.rows;
        } catch (error) {
            console.error('❌ Error searching parallels:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // Add the 2023 Panini Prizm Football parallels
    async addPrizmFootballParallels() {
        console.log('📚 Adding 2023 Panini Prizm Football parallels...');
        
        const prizmParallels = [
            { name: 'Black and Red Checker Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Black and White Checker Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Blue Prizms', type: 'Parallel', rarity: 'Standard' },
            { name: 'Disco Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Green Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Green Ice Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Lazer Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Neon Green Pulsar Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'No Huddle Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Orange Ice Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Pink Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Press Proof Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Purple Pulsar Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Red Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Red Sparkle Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Red, White and Blue Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Silver Prizms', type: 'Parallel', rarity: 'Standard' },
            { name: 'Snakeskin Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Wave Green Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'White Sparkle Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Pandora Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/400' },
            { name: 'Orange Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/249' },
            { name: 'Purple Ice Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/225' },
            { name: 'Blue Wave Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/199' },
            { name: 'Hyper Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/175' },
            { name: 'Wave Red Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/149' },
            { name: 'Purple Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/125' },
            { name: 'Blue Ice Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/99' },
            { name: 'Wave Purple Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/99' },
            { name: 'Blue Sparkle Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/96' },
            { name: 'No Huddle Blue Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/95' },
            { name: 'Green Scope Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/75' },
            { name: 'No Huddle Red Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/70' },
            { name: 'Wave Orange Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/60' },
            { name: 'Purple Power Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/49' },
            { name: 'Red and Yellow Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/44' },
            { name: 'No Huddle Purple Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/35' },
            { name: 'Red Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/35' },
            { name: 'Blue Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/25' },
            { name: 'Navy Camo Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/25' },
            { name: 'Gold Sparkle Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/24' },
            { name: 'Forest Camo Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/15' },
            { name: 'No Huddle Pink Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/15' },
            { name: 'Gold Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Gold Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Wave Gold Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Green Sparkle Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/8' },
            { name: 'Gold Vinyl Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/5' },
            { name: 'Green Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/5' },
            { name: 'No Huddle Neon Green Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/5' },
            { name: 'White Knight Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/3' },
            { name: 'Black Finite Prizms', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Black Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Stars Black Prizms', type: 'Parallel', rarity: 'Limited', printRun: '1/1' }
        ];

        for (const parallel of prizmParallels) {
            await this.addParallel(
                '2023 Panini Prizm Football',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${prizmParallels.length} parallels for 2023 Panini Prizm Football`);
    }

    // Add the 2023 Topps Heritage Baseball parallels
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
            await this.addPrizmFootballParallels();
            
            console.log('\n📊 Railway Database Summary:');
            const cardSets = await this.getAllCardSets();
            console.log(`Total card sets: ${cardSets.length}`);
            
            cardSets.forEach(set => {
                console.log(`  - ${set.set_name}: ${set.parallel_count} parallels`);
            });
            
        } catch (error) {
            console.error('❌ Error initializing Railway database:', error.message);
        } finally {
            await this.closeDatabase();
        }
    }
}

// Example usage
async function main() {
    const parallelsDb = new RailwayParallelsDatabase();
    await parallelsDb.initializeDatabase();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = RailwayParallelsDatabase;
