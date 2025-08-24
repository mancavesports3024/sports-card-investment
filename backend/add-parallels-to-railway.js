const RailwayParallelsDatabase = require('./railway-parallels-db.js');

class ParallelsLoader {
    constructor() {
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async initialize() {
        await this.parallelsDb.connectDatabase();
        await this.parallelsDb.createTables();
    }

    async close() {
        await this.parallelsDb.closeDatabase();
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
            { name: 'Chrome Superfractor', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Black Finite Prizms', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Gold Shimmer Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Wave Gold Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/10' },
            { name: 'Green Sparkle Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/8' },
            { name: 'Gold Vinyl Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/5' },
            { name: 'White Knight Prizms', type: 'Parallel', rarity: 'Limited', printRun: '/3' }
        ];

        for (const parallel of prizmParallels) {
            await this.parallelsDb.addParallel(
                '2023 Panini Prizm Football',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${prizmParallels.length} parallels for 2023 Panini Prizm Football`);
    }

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
            await this.parallelsDb.addParallel(
                '2023 Topps Heritage Baseball',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${heritageParallels.length} parallels for 2023 Topps Heritage Baseball`);
    }

    async addChromeParallels() {
        console.log('📚 Adding 2023 Topps Chrome Baseball parallels...');
        
        const chromeParallels = [
            { name: 'Refractor', type: 'Parallel', rarity: 'Standard' },
            { name: 'X-Fractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Purple Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Blue Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Green Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Orange Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Red Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Gold Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Superfractor', type: 'Parallel', rarity: 'Limited', printRun: '1/1' },
            { name: 'Aqua Geometric', type: 'Parallel', rarity: 'Limited' },
            { name: 'Radiation Rookies', type: 'Parallel', rarity: 'Limited' },
            { name: 'Orange Lazer', type: 'Parallel', rarity: 'Limited' },
            { name: 'Rainbow Foil', type: 'Parallel', rarity: 'Limited' }
        ];

        for (const parallel of chromeParallels) {
            await this.parallelsDb.addParallel(
                '2023 Topps Chrome Baseball',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${chromeParallels.length} parallels for 2023 Topps Chrome Baseball`);
    }

    async addSelectParallels() {
        console.log('📚 Adding 2023 Panini Select Football parallels...');
        
        const selectParallels = [
            { name: 'Concourses', type: 'Parallel', rarity: 'Limited' },
            { name: 'Concourse', type: 'Parallel', rarity: 'Limited' },
            { name: 'Sublime', type: 'Parallel', rarity: 'Limited' },
            { name: 'Zone Busters Refractor', type: 'Parallel', rarity: 'Limited' },
            { name: 'Sapphire Edition', type: 'Parallel', rarity: 'Limited' },
            { name: 'King Snake', type: 'Parallel', rarity: 'Limited' },
            { name: 'Prospect Profiles Mini', type: 'Parallel', rarity: 'Limited' },
            { name: 'Invicta', type: 'Parallel', rarity: 'Limited' },
            { name: 'Essentials', type: 'Parallel', rarity: 'Limited' },
            { name: 'Supernatural', type: 'Parallel', rarity: 'Limited' },
            { name: 'Border', type: 'Parallel', rarity: 'Limited' },
            { name: 'Intimidators', type: 'Parallel', rarity: 'Limited' },
            { name: 'Kellogg', type: 'Parallel', rarity: 'Limited' },
            { name: 'Mist', type: 'Parallel', rarity: 'Limited' },
            { name: 'USA Basketball', type: 'Parallel', rarity: 'Limited' },
            { name: 'XR', type: 'Parallel', rarity: 'Limited' },
            { name: 'Logofractor', type: 'Parallel', rarity: 'Limited' }
        ];

        for (const parallel of selectParallels) {
            await this.parallelsDb.addParallel(
                '2023 Panini Select Football',
                parallel.name,
                parallel.type,
                parallel.rarity,
                parallel.printRun
            );
        }

        console.log(`✅ Added ${selectParallels.length} parallels for 2023 Panini Select Football`);
    }

    async loadAllParallels() {
        try {
            console.log('🚀 Starting to load all parallels to Railway database...\n');
            
            await this.initialize();
            
            await this.addPrizmFootballParallels();
            await this.addHeritageParallels();
            await this.addChromeParallels();
            await this.addSelectParallels();
            
            console.log('\n📊 Railway Database Summary:');
            const cardSets = await this.parallelsDb.getAllCardSets();
            console.log(`Total card sets: ${cardSets.length}`);
            
            cardSets.forEach(set => {
                console.log(`  - ${set.set_name}: ${set.parallel_count} parallels`);
            });
            
            console.log('\n✅ All parallels loaded successfully to Railway database!');
            
        } catch (error) {
            console.error('❌ Error loading parallels:', error.message);
        } finally {
            await this.close();
        }
    }
}

// Run the loader if this script is executed directly
if (require.main === module) {
    const loader = new ParallelsLoader();
    loader.loadAllParallels().catch(console.error);
}

module.exports = ParallelsLoader;
