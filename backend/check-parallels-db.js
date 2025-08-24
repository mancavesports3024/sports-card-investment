const ParallelsDatabase = require('./create-parallels-database.js');

async function checkDatabase() {
    const parallelsDb = new ParallelsDatabase();
    
    try {
        await parallelsDb.connectDatabase();
        
        console.log('📊 Checking parallels database...\n');
        
        // Get all card sets
        const cardSets = await parallelsDb.getAllCardSets();
        console.log('Card sets in database:');
        cardSets.forEach(set => {
            console.log(`  - ${set.set_name}: ${set.parallel_count} parallels`);
        });
        
        // Get parallels for Heritage
        const heritageParallels = await parallelsDb.getParallelsForSet('2023 Topps Heritage Baseball');
        console.log('\nHeritage parallels:');
        heritageParallels.forEach(parallel => {
            console.log(`  - ${parallel.parallel_name} (${parallel.parallel_type})`);
        });
        
        // Generate patterns
        const patterns = await parallelsDb.generateExtractionPatterns('2023 Topps Heritage Baseball');
        console.log('\nGenerated patterns:');
        console.log(patterns);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await parallelsDb.closeDatabase();
    }
}

checkDatabase();
