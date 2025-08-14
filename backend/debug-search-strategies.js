const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater');

async function debugSearchStrategies() {
    console.log('🔍 Debugging Search Strategies...\n');

    const updater = new FastSQLitePriceUpdater();
    
    const testCards = [
        {
            title: '2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18 PSA 10 GEM',
            summaryTitle: '2024 Leo DE VRIES Bowman Wave Silver Refractor #TP-18'
        },
        {
            title: '1994-95 Shaquille O\'Neal Flair Rejectors PSA 10',
            summaryTitle: '1994-95 Shaquille O\'Neal Flair Rejectors'
        },
        {
            title: '2022 Joe Burrow Electricity Donruss Optic /65 PSA 10',
            summaryTitle: '2022 Joe Burrow Electricity Donruss Optic /65'
        },
        {
            title: '2023 Bryce Young National Treasures Rookies #TRC-BYG /99 PSA 10',
            summaryTitle: '2023 Bryce Young National Treasures Rookies #TRC-BYG /99'
        }
    ];

    for (const card of testCards) {
        console.log(`🔍 Testing: ${card.summaryTitle}`);
        
        const { identifier, strategies } = updater.extractCardIdentifier(card);
        console.log(`  Identifier: ${identifier}`);
        console.log(`  Strategies: ${strategies.join(', ')}`);
        
        // Test each strategy
        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            console.log(`  Strategy ${i + 1}: "${strategy}"`);
            
            // Test PSA 10 search
            const psa10Query = `${strategy} PSA 10`;
            console.log(`    PSA 10 Query: "${psa10Query}"`);
        }
        
        console.log('');
    }
}

debugSearchStrategies().catch(console.error);
