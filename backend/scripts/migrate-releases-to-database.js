const releaseDatabaseService = require('../services/releaseDatabaseService');
const releaseInfoService = require('../services/releaseInfoService');

async function migrateReleases() {
    console.log('🚀 Starting release calendar migration...');
    
    try {
        // Connect to database
        await releaseDatabaseService.connectDatabase();
        console.log('✅ Connected to database');

        // Create tables
        await releaseDatabaseService.createTables();
        console.log('✅ Database tables created/verified');

        // Get all existing releases from hardcoded data
        console.log('📋 Loading existing releases from hardcoded data...');
        const existingReleases = releaseInfoService.getComprehensiveReleases();
        console.log(`📊 Found ${existingReleases.length} releases to migrate`);

        // Import releases into database
        let added = 0;
        let skipped = 0;
        let errors = 0;

        for (const release of existingReleases) {
            try {
                const result = await releaseDatabaseService.addRelease({
                    title: release.title,
                    brand: release.brand,
                    sport: release.sport,
                    releaseDate: release.releaseDate,
                    year: release.year,
                    description: release.description,
                    retailPrice: release.retailPrice || 'TBD',
                    hobbyPrice: release.hobbyPrice || 'TBD',
                    source: 'Migration',
                    status: release.status || 'Announced',
                    createdBy: 'Migration Script'
                });

                if (result) {
                    added++;
                    if (added % 10 === 0) {
                        console.log(`   Progress: ${added} releases added...`);
                    }
                } else {
                    skipped++;
                }
            } catch (error) {
                if (error.code === '23505') { // Unique constraint violation (duplicate)
                    skipped++;
                } else {
                    console.error(`❌ Error migrating release "${release.title}":`, error.message);
                    errors++;
                }
            }
        }

        // Update statuses automatically
        console.log('🔄 Updating release statuses...');
        await releaseDatabaseService.updateStatuses();

        // Summary
        console.log('\n✅ Migration completed!');
        console.log(`   📊 Total releases processed: ${existingReleases.length}`);
        console.log(`   ✅ Successfully added: ${added}`);
        console.log(`   ⏭️  Skipped (duplicates): ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);

        // Verify migration
        const dbReleases = await releaseDatabaseService.getAllReleases();
        console.log(`\n🔍 Verification: ${dbReleases.length} releases now in database`);

        // Close database connection
        await releaseDatabaseService.closeDatabase();
        console.log('✅ Migration script completed successfully');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateReleases()
        .then(() => {
            console.log('✅ Migration script finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateReleases };

