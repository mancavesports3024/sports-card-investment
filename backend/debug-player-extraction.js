const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function debugPlayerExtraction() {
    console.log('🔍 Debugging Player Extraction Issue...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    try {
        await generator.connect();
        await generator.learnFromDatabase();
        
        const title = '2023 bowman Josue De Paula 1st Bowman Chrome Prospect Auto PSA 10';
        
        console.log('Original title:', title);
        
        // Test the player extraction step by step
        let cleanTitle = title;
        const removeTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'GEM MT', 'MT 10', 'MT10',
            'RC', 'Rookie', 'ROOKIE', 'rookie', 'SP', 'sp',
            'AUTO', 'auto', 'Autograph', 'autograph',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population',
            'Hit', 'hit', 'HIT', 'Case', 'case', 'CASE'
        ];

        // Add learned card sets and types to removal list
        removeTerms.push(...Array.from(generator.cardSets));
        removeTerms.push(...Array.from(generator.cardTypes));
        removeTerms.push(...Array.from(generator.brands));

        console.log('\nRemove terms that might affect "Paula":');
        removeTerms.forEach(term => {
            if (term.toLowerCase().includes('paula') || term.toLowerCase().includes('prospect')) {
                console.log(`   • ${term}`);
            }
        });
        
        // Add specific product names that might interfere with player extraction
        const productTerms = [
            'bowman draft chrome 1st', 'bowman chrome draft 1st', 'bowman chrome sapphire', 'bowman university chrome', 'bowman u chrome', 'bowman chrome draft', 'bowman chrome', 'bowman draft', 'bowman sterling', 'bowman platinum', 'bowman university', 'bowman u',
            'panini donruss optic', 'panini donruss', 'panini prizm', 'panini select', 'panini contenders', 'panini optic',
            'topps chrome', 'topps finest', 'topps heritage', 'topps archives', 'topps update',
            'upper deck sp', 'upper deck spx', 'upper deck exquisite', 'upper deck',
            'stadium club', 'national treasures', 'flawless', 'immaculate', 'limited', 'certified', 'elite', 'absolute',
            'spectra', 'phoenix', 'playbook', 'momentum', 'totally certified', 'crown royale', 'threads', 'prestige',
            'rookies & stars', 'score', 'leaf', 'playoff', 'press pass', 'sage', 'pacific', 'skybox', 'metal',
            'gallery', 'heritage', 'gypsy queen', 'allen & ginter', 'archives', 'big league', 'fire', 'opening day',
            'series 1', 'series 2', 'chrome update', 'chrome refractor', 'chrome sapphire', 'chrome black',
            'bowman', 'topps', 'panini', 'fleer', 'donruss', 'flair', 'chronicles', 'chronicles wwe', 'rated rookie', 'rated rookies', 'optic', 'kings', 'rookie kings',
            'rookies', 'rookie'
        ];
        
        console.log('\nProduct terms that might affect "Paula":');
        productTerms.forEach(term => {
            if (term.toLowerCase().includes('paula') || term.toLowerCase().includes('prospect')) {
                console.log(`   • ${term}`);
            }
        });
        
        // Test the actual extraction
        const player = generator.extractPlayer(title);
        console.log('\nExtracted player:', player);
        
        // Test the full standardized title
        const standardized = generator.generateStandardizedTitle(title);
        console.log('\nFull standardized title:', standardized);
        
    } catch (error) {
        console.error('❌ Error during debugging:', error);
    } finally {
        if (generator.db) {
            generator.db.close();
        }
    }
}

debugPlayerExtraction()
    .then(() => {
        console.log('\n✅ Debug completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    });
