const { Pool } = require('pg');

class RailwayParallelsDatabase {
    constructor() {
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
            const findQuery = `SELECT id FROM card_sets WHERE set_name = $1`;
            const findResult = await client.query(findQuery, [setName]);
            
            if (findResult.rows.length > 0) {
                console.log(`✅ Found existing card set: ${setName} (ID: ${findResult.rows[0].id})`);
                return findResult.rows[0].id;
            } else {
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

    async addPrizmFootballParallels() {
        console.log('📚 Adding 2023 Panini Prizm Football parallels...');
        
        const prizmParallels = [
            { name: 'Blue Prizms', type: 'Parallel', rarity: 'Standard' },
            { name: 'Silver Prizms', type: 'Parallel', rarity: 'Standard' },
            { name: 'Red Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Green Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Purple Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/125' },
            { name: 'Orange Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/249' },
            { name: 'Blue Ice Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/99' },
            { name: 'Gold Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Disco Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'No Huddle Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Snakeskin Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Pink Prizms', type: 'Parallel', rarity: 'Limited' },
            { name: 'Chrome Superfractor', type: 'Parallel', rarity: 'Limited', printRun: '1/1' }
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

    async initializeDatabase() {
        try {
            await this.connectDatabase();
            await this.createTables();
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

if (require.main === module) {
    const parallelsDb = new RailwayParallelsDatabase();
    parallelsDb.initializeDatabase().catch(console.error);
}

module.exports = RailwayParallelsDatabase;
