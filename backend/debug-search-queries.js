const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater');

async function debugSearchQueries() {
    console.log('🔍 Debugging Search Query Generation\n');

    const updater = new FastSQLitePriceUpdater();
    await updater.connect();

    const testCards = [
        "2024 JJ Mccarthy Panini Prizm Emergent Blue Ice #19 /99",
        "2023 Stetson Bennett Iv Panini Select Red Prizm #456",
        "2024-25 Panini Red #35 /299",
        "2022 Aidan Hutchinson Panini Mosaic Red #287",
        "2024 Spencer Rattler Donruss Red Wave Prizm #359"
    ];

    for (const cardTitle of testCards) {
        console.log(`\n📋 Testing: "${cardTitle}"`);
        
        try {
            const result = await updater.extractCardIdentifier({ summaryTitle: cardTitle });
            console.log(`   Identifier: "${result.identifier}"`);
            console.log(`   Strategies: ${result.strategies.map(s => `"${s}"`).join(', ')}`);
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
    }

    if (updater.db) {
        updater.db.close();
    }
}

debugSearchQueries().catch(console.error);
