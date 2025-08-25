const RailwayParallelsDatabase = require('./railway-parallels-db');

class UnknownBrandCleanup {
    constructor() {
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing unknown brand cleanup...');
            await this.parallelsDb.connectDatabase();
            console.log('✅ Connected to parallels database');
        } catch (error) {
            console.error('❌ Error initializing:', error);
            throw error;
        }
    }

    async cleanupUnknownBrands() {
        try {
            console.log('🔍 Getting all card sets...');
            const cardSets = await this.parallelsDb.getAllCardSets();
            console.log(`📊 Found ${cardSets.length} total card sets`);

            // Filter card sets with "Unknown" brand
            const unknownBrandSets = cardSets.filter(set => 
                set.brand === 'Unknown' || set.brand === 'unknown'
            );

            console.log(`📊 Found ${unknownBrandSets.length} card sets with "Unknown" brand`);

            if (unknownBrandSets.length === 0) {
                console.log('✅ No card sets with "Unknown" brand found. Database is clean!');
                return;
            }

            let deletedCount = 0;
            let errorCount = 0;

            for (const cardSet of unknownBrandSets) {
                try {
                    console.log(`🗑️  Deleting: "${cardSet.set_name}" (Brand: ${cardSet.brand})`);
                    
                    // Delete the card set and all its parallels
                    await this.deleteCardSetAndParallels(cardSet.id);
                    deletedCount++;
                    
                } catch (error) {
                    console.error(`❌ Error deleting card set ${cardSet.set_name}:`, error);
                    errorCount++;
                }
            }

            console.log(`\n✅ Unknown brand cleanup completed!`);
            console.log(`🗑️  Deleted: ${deletedCount} card sets with "Unknown" brand`);
            console.log(`❌ Errors: ${errorCount} failed deletions`);

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            throw error;
        }
    }

    async deleteCardSetAndParallels(cardSetId) {
        try {
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            const client = await pool.connect();
            
            // Start a transaction
            await client.query('BEGIN');
            
            try {
                // First delete all parallels for this card set
                const deleteParallelsQuery = 'DELETE FROM parallels WHERE card_set_id = $1';
                const parallelsResult = await client.query(deleteParallelsQuery, [cardSetId]);
                console.log(`   📊 Deleted ${parallelsResult.rowCount} parallels`);
                
                // Then delete the card set
                const deleteCardSetQuery = 'DELETE FROM card_sets WHERE id = $1';
                const cardSetResult = await client.query(deleteCardSetQuery, [cardSetId]);
                console.log(`   📊 Deleted ${cardSetResult.rowCount} card set`);
                
                // Commit the transaction
                await client.query('COMMIT');
                
            } catch (error) {
                // Rollback on error
                await client.query('ROLLBACK');
                throw error;
            }
            
            client.release();
            await pool.end();

        } catch (error) {
            console.error(`❌ Error deleting card set and parallels:`, error);
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
    const cleanup = new UnknownBrandCleanup();
    
    try {
        await cleanup.initialize();
        await cleanup.cleanupUnknownBrands();
        
    } catch (error) {
        console.error('❌ Unknown brand cleanup failed:', error);
        process.exit(1);
    } finally {
        await cleanup.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { UnknownBrandCleanup };
