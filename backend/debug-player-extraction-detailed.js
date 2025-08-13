const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function debugPlayerExtractionDetailed() {
    console.log('🔍 Detailed Player Extraction Debug...\n');
    
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

        console.log('\nLearned card types that might affect "Paula":');
        Array.from(generator.cardTypes).forEach(term => {
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
        
        // Add card type terms that might interfere with player extraction
        const cardTypeTerms = [
            'sky blue', 'neon green', 'purple pattern', 'pink pattern', 'blue pattern', 'green pattern', 'yellow pattern', 'black pattern', 'red pattern', 'printing plate', 'fuchsia',
            'checkerboard', 'x-fractor', 'cracked ice', 'atomic', 'disco', 'fast break', 'no huddle', 'flash', 'shock', 'mojo', 'mega', 'scope', 'shimmer', 'wave', 'multi wave', 'carved in time', 'lenticular', 'synthesis', 'outburst', 'electric ice', 'ellipse', 'color wheel', 'color blast', 'die-cut', 'national landmarks', 'stained glass', 'lava lamp', 'dazzle',
            'blue velocity', 'hyper pink', 'red dragon', 'laser', 'liberty', 'diamond marvels', 'on fire', 'voltage', 'career stat line',
            'alligator crystal', 'alligator kaleidoscope', 'alligator mojo', 'alligator prismatic', 'butterfly crystal', 'butterfly kaleidoscope', 'butterfly mojo', 'butterfly prismatic', 'chameleon crystal', 'chameleon kaleidoscope', 'chameleon mojo', 'chameleon prismatic', 'clown fish crystal', 'clown fish kaleidoscope', 'clown fish mojo', 'clown fish prismatic', 'deer crystal', 'deer kaleidoscope', 'deer mojo', 'deer prismatic', 'dragon crystal', 'dragon kaleidoscope', 'dragon mojo', 'dragon prismatic', 'elephant crystal', 'elephant kaleidoscope', 'elephant mojo', 'elephant prismatic', 'giraffe crystal', 'giraffe kaleidoscope', 'giraffe mojo', 'giraffe prismatic', 'leopard crystal', 'leopard kaleidoscope', 'leopard mojo', 'leopard prismatic', 'parrot crystal', 'parrot kaleidoscope', 'parrot mojo', 'parrot prismatic', 'peacock crystal', 'peacock kaleidoscope', 'peacock mojo', 'peacock prismatic', 'snake crystal', 'snake kaleidoscope', 'snake mojo', 'snake prismatic', 'tiger crystal', 'tiger kaleidoscope', 'tiger mojo', 'tiger prismatic', 'zebra crystal', 'zebra kaleidoscope', 'zebra mojo', 'zebra prismatic', 'tiger eyes', 'snake eyes',
            '100th anniversary', 'black border', 'flip stock', 'magenta', 'mini parallels', 'chrome refractor', 'purple refractor', 'black bordered refractor', 'gold bordered refractor', 'superfractor',
            'zebra prizm', 'dragon scale', 'red dragon', 'peacock prizm', 'tiger prizm', 'giraffe prizm', 'elephant prizm',
            'blue ice', 'silver laser', 'silver mojo', 'silver scope', 'teal wave', 'premium set checkerboard', 'blue laser', 'blue mojo', 'green flash', 'blue flash', 'purple flash', 'purple cracked ice', 'pink flash', 'gold cracked ice', 'gold flash', 'gold laser', 'gold mojo', 'black flash', 'black laser', 'black mojo', 'gold vinyl premium set',
            'vintage stock', 'red stars', 'independence day', 'father\'s day powder blue', 'mother\'s day hot pink', 'memorial day camo',
            'camo pink mosaic', 'choice peacock mosaic', 'fast break silver mosaic', 'genesis mosaic', 'green mosaic', 'reactive blue mosaic', 'reactive orange mosaic', 'red mosaic', 'blue mosaic', 'choice red fusion mosaic', 'fast break blue mosaic', 'fast break purple mosaic', 'purple mosaic', 'orange fluorescent mosaic', 'white mosaic', 'fast break pink mosaic', 'blue fluorescent mosaic', 'pink swirl mosaic', 'fast break gold mosaic', 'gold mosaic', 'green swirl mosaic', 'pink fluorescent mosaic', 'choice black gold mosaic', 'black mosaic', 'choice nebula mosaic', 'fast break black mosaic',
            'black pulsar prizm', 'blue prizm', 'blue cracked ice prizm', 'blue pulsar prizm', 'blue wave prizm', 'flash prizm', 'gold pulsar prizm', 'green prizm', 'green cracked ice prizm', 'green pulsar prizm', 'green shimmer prizm', 'pulsar prizm', 'purple disco prizm', 'red prizm', 'red cracked ice prizm', 'red flash prizm', 'red pulsar prizm', 'red wave prizm', 'silver prizm', 'silver laser prizm', 'silver mojo prizm', 'silver scope prizm', 'teal prizm', 'teal wave prizm', 'premium set checkerboard prizm', 'blue laser prizm', 'blue mojo prizm', 'green flash prizm', 'blue flash prizm', 'purple flash prizm', 'purple cracked ice prizm', 'pink flash prizm', 'gold cracked ice prizm', 'gold flash prizm', 'gold laser prizm', 'gold mojo prizm', 'black flash prizm', 'black laser prizm', 'black mojo prizm', 'gold vinyl premium set prizm'
        ];
        
        removeTerms.push(...productTerms);
        removeTerms.push(...cardTypeTerms);

        // Sort terms by length (longest first) to remove more specific terms before general ones
        removeTerms.sort((a, b) => b.length - a.length);

        console.log('\nAll remove terms that might affect "Paula":');
        removeTerms.forEach(term => {
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

debugPlayerExtractionDetailed()
    .then(() => {
        console.log('\n✅ Debug completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Debug failed:', error);
        process.exit(1);
    });
