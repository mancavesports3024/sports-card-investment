const RailwayParallelsDatabase = require('./railway-parallels-db');

class ParallelsDatabaseReset {
    constructor() {
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing parallels database reset...');
            await this.parallelsDb.connectDatabase();
            console.log('✅ Connected to parallels database');
        } catch (error) {
            console.error('❌ Error initializing:', error);
            throw error;
        }
    }

    async resetDatabase() {
        try {
            console.log('🗑️  Starting complete database reset...');
            
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            const client = await pool.connect();
            
            // Start a transaction
            await client.query('BEGIN');
            
            try {
                console.log('🗑️  Dropping all tables...');
                
                // Drop tables in correct order (parallels first due to foreign key)
                await client.query('DROP TABLE IF EXISTS parallels CASCADE');
                console.log('   ✅ Dropped parallels table');
                
                await client.query('DROP TABLE IF EXISTS card_sets CASCADE');
                console.log('   ✅ Dropped card_sets table');
                
                // Commit the transaction
                await client.query('COMMIT');
                console.log('✅ Database tables dropped successfully');
                
                // Now recreate the tables
                console.log('🔨 Recreating tables...');
                await this.parallelsDb.createTables();
                console.log('✅ Tables recreated successfully');
                
            } catch (error) {
                // Rollback on error
                await client.query('ROLLBACK');
                throw error;
            }
            
            client.release();
            await pool.end();

            console.log('✅ Database reset completed successfully!');
            console.log('📊 Database is now clean and ready for fresh data');

        } catch (error) {
            console.error('❌ Error during database reset:', error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.parallelsDb) {
                await this.parallelsDb.closeDatabase();
                console.log('✅ Database connection closed');
            }
        } catch (error) {
            console.error('❌ Error closing:', error);
        }
    }
}

// Main execution
async function main() {
    const reset = new ParallelsDatabaseReset();
    
    try {
        await reset.initialize();
        await reset.resetDatabase();
        
    } catch (error) {
        console.error('❌ Database reset failed:', error);
        process.exit(1);
    } finally {
        await reset.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { ParallelsDatabaseReset };
