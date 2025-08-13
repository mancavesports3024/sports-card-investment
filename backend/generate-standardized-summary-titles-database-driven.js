const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseDrivenStandardizedTitleGenerator {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
        this.cardSets = new Set();
        this.cardTypes = new Set();
        this.players = new Set();
        this.brands = new Set();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async runUpdate(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    // Learn from existing database data
    async learnFromDatabase() {
        console.log('🧠 Learning from existing database data...\n');

        try {
            // Extract card sets from existing titles
            const cardSetsQuery = await this.runQuery(`
                SELECT DISTINCT 
                    CASE 
                        WHEN title LIKE '%Bowman Chrome Prospects%' THEN 'Bowman Chrome Prospects'
                        WHEN title LIKE '%Bowman Chrome%' THEN 'Bowman Chrome'
                        WHEN title LIKE '%Bowman Draft%' THEN 'Bowman Draft'
                        WHEN title LIKE '%Bowman Sterling%' THEN 'Bowman Sterling'
                        WHEN title LIKE '%Bowman Platinum%' THEN 'Bowman Platinum'
                        WHEN title LIKE '%Bowman University%' THEN 'Bowman University'
                        WHEN title LIKE '%Topps Chrome%' THEN 'Topps Chrome'
                        WHEN title LIKE '%Topps Finest%' THEN 'Topps Finest'
                        WHEN title LIKE '%Topps Heritage%' THEN 'Topps Heritage'
                        WHEN title LIKE '%Topps Archives%' THEN 'Topps Archives'
                        WHEN title LIKE '%Topps Update%' THEN 'Topps Update'
                        WHEN title LIKE '%Panini Prizm%' THEN 'Panini Prizm'
                        WHEN title LIKE '%Panini Select%' THEN 'Panini Select'
                        WHEN title LIKE '%Panini Contenders%' THEN 'Panini Contenders'
                        WHEN title LIKE '%Panini Donruss%' THEN 'Panini Donruss'
                        WHEN title LIKE '%Panini Optic%' THEN 'Panini Optic'
                        WHEN title LIKE '%Upper Deck SP%' THEN 'Upper Deck SP'
                        WHEN title LIKE '%Upper Deck SPx%' THEN 'Upper Deck SPx'
                        WHEN title LIKE '%Upper Deck Exquisite%' THEN 'Upper Deck Exquisite'
                        WHEN title LIKE '%Upper Deck%' THEN 'Upper Deck'
                        WHEN title LIKE '%Stadium Club%' THEN 'Stadium Club'
                        WHEN title LIKE '%National Treasures%' THEN 'National Treasures'
                        WHEN title LIKE '%Flawless%' THEN 'Flawless'
                        WHEN title LIKE '%Immaculate%' THEN 'Immaculate'
                        WHEN title LIKE '%Limited%' THEN 'Limited'
                        WHEN title LIKE '%Certified%' THEN 'Certified'
                        WHEN title LIKE '%Elite%' THEN 'Elite'
                        WHEN title LIKE '%Absolute%' THEN 'Absolute'
                        WHEN title LIKE '%Spectra%' THEN 'Spectra'
                        WHEN title LIKE '%Phoenix%' THEN 'Phoenix'
                        WHEN title LIKE '%Playbook%' THEN 'Playbook'
                        WHEN title LIKE '%Momentum%' THEN 'Momentum'
                        WHEN title LIKE '%Totally Certified%' THEN 'Totally Certified'
                        WHEN title LIKE '%Crown Royale%' THEN 'Crown Royale'
                        WHEN title LIKE '%Threads%' THEN 'Threads'
                        WHEN title LIKE '%Prestige%' THEN 'Prestige'
                        WHEN title LIKE '%Rookies & Stars%' THEN 'Rookies & Stars'
                        WHEN title LIKE '%Score%' THEN 'Score'
                        WHEN title LIKE '%Leaf%' THEN 'Leaf'
                        WHEN title LIKE '%Playoff%' THEN 'Playoff'
                        WHEN title LIKE '%Press Pass%' THEN 'Press Pass'
                        WHEN title LIKE '%Sage%' THEN 'Sage'
                        WHEN title LIKE '%Hit%' THEN 'Hit'
                        WHEN title LIKE '%Pacific%' THEN 'Pacific'
                        WHEN title LIKE '%Skybox%' THEN 'Skybox'
                        WHEN title LIKE '%Metal%' THEN 'Metal'
                        WHEN title LIKE '%Gallery%' THEN 'Gallery'
                        WHEN title LIKE '%Heritage%' THEN 'Heritage'
                        WHEN title LIKE '%Gypsy Queen%' THEN 'Gypsy Queen'
                        WHEN title LIKE '%Allen & Ginter%' THEN 'Allen & Ginter'
                        WHEN title LIKE '%Archives%' THEN 'Archives'
                        WHEN title LIKE '%Big League%' THEN 'Big League'
                        WHEN title LIKE '%Fire%' THEN 'Fire'
                        WHEN title LIKE '%Opening Day%' THEN 'Opening Day'
                        WHEN title LIKE '%Series 1%' THEN 'Series 1'
                        WHEN title LIKE '%Series 2%' THEN 'Series 2'
                        WHEN title LIKE '%Chrome Update%' THEN 'Chrome Update'
                        WHEN title LIKE '%Chrome Refractor%' THEN 'Chrome Refractor'
                        WHEN title LIKE '%Chrome Sapphire%' THEN 'Chrome Sapphire'
                        WHEN title LIKE '%Chrome Black%' THEN 'Chrome Black'
                        WHEN title LIKE '%Bowman%' THEN 'Bowman'
                        WHEN title LIKE '%Topps%' THEN 'Topps'
                        WHEN title LIKE '%Panini%' THEN 'Panini'
                        WHEN title LIKE '%Fleer%' THEN 'Fleer'
                        WHEN title LIKE '%Donruss%' THEN 'Donruss'
                        ELSE NULL
                    END as card_set
                FROM cards 
                WHERE title IS NOT NULL AND title != ''
                AND card_set IS NOT NULL
                ORDER BY card_set
            `);

            // Extract card types/colors from existing titles
            const cardTypesQuery = await this.runQuery(`
                SELECT DISTINCT 
                    CASE 
                        WHEN title LIKE '%Red%' THEN 'Red'
                        WHEN title LIKE '%Blue%' THEN 'Blue'
                        WHEN title LIKE '%Green%' THEN 'Green'
                        WHEN title LIKE '%Yellow%' THEN 'Yellow'
                        WHEN title LIKE '%Orange%' THEN 'Orange'
                        WHEN title LIKE '%Purple%' THEN 'Purple'
                        WHEN title LIKE '%Pink%' THEN 'Pink'
                        WHEN title LIKE '%Gold%' THEN 'Gold'
                        WHEN title LIKE '%Silver%' THEN 'Silver'
                        WHEN title LIKE '%Bronze%' THEN 'Bronze'
                        WHEN title LIKE '%Black%' THEN 'Black'
                        WHEN title LIKE '%White%' THEN 'White'
                        WHEN title LIKE '%Rainbow%' THEN 'Rainbow'
                        WHEN title LIKE '%Prism%' THEN 'Prism'
                        WHEN title LIKE '%Holo%' THEN 'Holo'
                        WHEN title LIKE '%Holographic%' THEN 'Holographic'
                        WHEN title LIKE '%Refractor%' THEN 'Refractor'
                        WHEN title LIKE '%Sapphire%' THEN 'Sapphire'
                        WHEN title LIKE '%Emerald%' THEN 'Emerald'
                        WHEN title LIKE '%Ruby%' THEN 'Ruby'
                        WHEN title LIKE '%Diamond%' THEN 'Diamond'
                        WHEN title LIKE '%Platinum%' THEN 'Platinum'
                        WHEN title LIKE '%Titanium%' THEN 'Titanium'
                        WHEN title LIKE '%Carbon%' THEN 'Carbon'
                        WHEN title LIKE '%Lunar Glow%' THEN 'Lunar Glow'
                        WHEN title LIKE '%Wave%' THEN 'Wave'
                        WHEN title LIKE '%1st Edition%' THEN '1st Edition'
                        WHEN title LIKE '%First Edition%' THEN 'First Edition'
                        WHEN title LIKE '%Limited Edition%' THEN 'Limited Edition'
                        WHEN title LIKE '%Special Edition%' THEN 'Special Edition'
                        WHEN title LIKE '%Anniversary%' THEN 'Anniversary'
                        WHEN title LIKE '%Century%' THEN 'Century'
                        WHEN title LIKE '%Millennium%' THEN 'Millennium'
                        WHEN title LIKE '%Legacy%' THEN 'Legacy'
                        WHEN title LIKE '%Legendary%' THEN 'Legendary'
                        WHEN title LIKE '%Iconic%' THEN 'Iconic'
                        WHEN title LIKE '%Epic%' THEN 'Epic'
                        WHEN title LIKE '%Rare%' THEN 'Rare'
                        WHEN title LIKE '%Ultra Rare%' THEN 'Ultra Rare'
                        WHEN title LIKE '%Secret Rare%' THEN 'Secret Rare'
                        WHEN title LIKE '%Common%' THEN 'Common'
                        WHEN title LIKE '%Uncommon%' THEN 'Uncommon'
                        WHEN title LIKE '%Mythic%' THEN 'Mythic'
                        ELSE NULL
                    END as card_type
                FROM cards 
                WHERE title IS NOT NULL AND title != ''
                AND card_type IS NOT NULL
                ORDER BY card_type
            `);

            // Extract brands from existing data
            const brandsQuery = await this.runQuery(`
                SELECT DISTINCT brand 
                FROM cards 
                WHERE brand IS NOT NULL AND brand != ''
                ORDER BY brand
            `);

            // Extract years from existing data
            const yearsQuery = await this.runQuery(`
                SELECT DISTINCT year 
                FROM cards 
                WHERE year IS NOT NULL
                ORDER BY year DESC
            `);

            // Populate our learning sets
            cardSetsQuery.forEach(row => {
                if (row.card_set) this.cardSets.add(row.card_set);
            });

            cardTypesQuery.forEach(row => {
                if (row.card_type) this.cardTypes.add(row.card_type);
            });

            brandsQuery.forEach(row => {
                if (row.brand) this.brands.add(row.brand);
            });

            console.log(`📚 Learned ${this.cardSets.size} card sets from database`);
            console.log(`🎨 Learned ${this.cardTypes.size} card types from database`);
            console.log(`🏷️ Learned ${this.brands.size} brands from database`);
            console.log(`📅 Found ${yearsQuery.length} years in database\n`);

            // Show some examples of what we learned
            console.log('📋 Examples of learned card sets:');
            Array.from(this.cardSets).slice(0, 10).forEach(set => {
                console.log(`   • ${set}`);
            });
            console.log('');

            console.log('📋 Examples of learned card types:');
            Array.from(this.cardTypes).slice(0, 10).forEach(type => {
                console.log(`   • ${type}`);
            });
            console.log('');

        } catch (error) {
            console.error('❌ Error learning from database:', error);
            throw error;
        }
    }

    // Extract year from title
    extractYear(title) {
        const yearMatch = title.match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
        return yearMatch ? yearMatch[1] : null;
    }

    // Extract product/brand from title using learned data
    extractProduct(title) {
        const titleLower = title.toLowerCase();
        
        // Define specific product patterns with priority
        const productPatterns = [
            // Most specific patterns first (longest first)
            { pattern: 'bowman chrome draft 1st', product: 'Bowman Chrome Draft 1st' },
            { pattern: 'bowman chrome prospects', product: 'Bowman Chrome Prospects' },
            { pattern: 'bowman chrome sapphire', product: 'Bowman Chrome Sapphire' },
            { pattern: 'bowman university chrome', product: 'Bowman University Chrome' },
            { pattern: 'bowman u chrome', product: 'Bowman University Chrome' },
            { pattern: 'panini donruss optic', product: 'Panini Donruss Optic' },
            { pattern: 'panini donruss', product: 'Panini Donruss' },
            { pattern: 'bowman chrome draft', product: 'Bowman Chrome Draft' },
            { pattern: 'bowman chrome', product: 'Bowman Chrome' },
            { pattern: 'bowman draft', product: 'Bowman Draft' },
            { pattern: 'bowman sterling', product: 'Bowman Sterling' },
            { pattern: 'bowman platinum', product: 'Bowman Platinum' },
            { pattern: 'bowman university', product: 'Bowman University' },
            { pattern: 'bowman u', product: 'Bowman University' },
            { pattern: 'topps chrome', product: 'Topps Chrome' },
            { pattern: 'topps finest', product: 'Topps Finest' },
            { pattern: 'topps heritage', product: 'Topps Heritage' },
            { pattern: 'topps archives', product: 'Topps Archives' },
            { pattern: 'topps update', product: 'Topps Update' },
            { pattern: 'panini prizm', product: 'Panini Prizm' },
            { pattern: 'panini select', product: 'Panini Select' },
            { pattern: 'panini contenders', product: 'Panini Contenders' },
            { pattern: 'panini donruss', product: 'Panini Donruss' },
            { pattern: 'panini optic', product: 'Panini Optic' },
            { pattern: 'upper deck sp', product: 'Upper Deck SP' },
            { pattern: 'upper deck spx', product: 'Upper Deck SPx' },
            { pattern: 'upper deck exquisite', product: 'Upper Deck Exquisite' },
            { pattern: 'upper deck', product: 'Upper Deck' },
            { pattern: 'stadium club', product: 'Stadium Club' },
            { pattern: 'national treasures', product: 'National Treasures' },
            { pattern: 'flawless', product: 'Flawless' },
            { pattern: 'immaculate', product: 'Immaculate' },
            { pattern: 'limited', product: 'Limited' },
            { pattern: 'certified', product: 'Certified' },
            { pattern: 'elite', product: 'Elite' },
            { pattern: 'absolute', product: 'Absolute' },
            { pattern: 'spectra', product: 'Spectra' },
            { pattern: 'phoenix', product: 'Phoenix' },
            { pattern: 'playbook', product: 'Playbook' },
            { pattern: 'momentum', product: 'Momentum' },
            { pattern: 'totally certified', product: 'Totally Certified' },
            { pattern: 'crown royale', product: 'Crown Royale' },
            { pattern: 'threads', product: 'Threads' },
            { pattern: 'prestige', product: 'Prestige' },
            { pattern: 'rookies & stars', product: 'Rookies & Stars' },
            { pattern: 'score', product: 'Score' },
            { pattern: 'leaf', product: 'Leaf' },
            { pattern: 'playoff', product: 'Playoff' },
            { pattern: 'press pass', product: 'Press Pass' },
            { pattern: 'sage', product: 'Sage' },
            { pattern: 'hit', product: 'Hit' },
            { pattern: 'pacific', product: 'Pacific' },
            { pattern: 'skybox', product: 'Skybox' },
            { pattern: 'metal', product: 'Metal' },
            { pattern: 'gallery', product: 'Gallery' },
            { pattern: 'heritage', product: 'Heritage' },
            { pattern: 'gypsy queen', product: 'Gypsy Queen' },
            { pattern: 'allen & ginter', product: 'Allen & Ginter' },
            { pattern: 'archives', product: 'Archives' },
            { pattern: 'big league', product: 'Big League' },
            { pattern: 'fire', product: 'Fire' },
            { pattern: 'opening day', product: 'Opening Day' },
            { pattern: 'series 1', product: 'Series 1' },
            { pattern: 'series 2', product: 'Series 2' },
            { pattern: 'chrome update', product: 'Chrome Update' },
            { pattern: 'chrome refractor', product: 'Chrome Refractor' },
            { pattern: 'chrome sapphire', product: 'Chrome Sapphire' },
            { pattern: 'chrome black', product: 'Chrome Black' },
            { pattern: 'bowman', product: 'Bowman' },
            { pattern: 'topps', product: 'Topps' },
            { pattern: 'panini', product: 'Panini' },
            { pattern: 'fleer', product: 'Fleer' },
            { pattern: 'donruss', product: 'Donruss' }
        ];
        
        // Check for mixed hyphenated patterns FIRST (some words hyphenated, others not)
        // This handles cases like "bowman - chrome prospects" where only some words are hyphenated
        // Sort by length (longest first) to match more specific products first
        const sortedPatterns = productPatterns.sort((a, b) => b.pattern.length - a.pattern.length);
        
        for (const { pattern, product } of sortedPatterns) {
            const words = pattern.split(' ');
            if (words.length >= 2) {
                // Try different combinations of hyphenation
                const variations = [];
                
                // Original pattern
                variations.push(pattern);
                
                // All hyphenated
                variations.push(words.join(' - '));
                
                // First two words hyphenated, rest not
                if (words.length >= 3) {
                    variations.push(`${words[0]} - ${words[1]} ${words.slice(2).join(' ')}`);
                }
                
                // First word hyphenated, rest not
                if (words.length >= 2) {
                    variations.push(`${words[0]} - ${words.slice(1).join(' ')}`);
                }
                
                // Check each variation
                for (const variation of variations) {
                    if (titleLower.includes(variation.toLowerCase())) {
                        return product;
                    }
                }
            }
        }
        
        // Check for hyphenated versions (most specific/longest first)
        const hyphenatedPatterns = productPatterns.map(({ pattern, product }) => ({
            pattern: pattern.replace(/\s+/g, ' - '),
            product
        })).sort((a, b) => b.pattern.length - a.pattern.length);
        
        for (const { pattern, product } of hyphenatedPatterns) {
            if (titleLower.includes(pattern)) {
                return product;
            }
        }
        
        // Then check for regular patterns (most specific first)
        for (const { pattern, product } of productPatterns) {
            if (titleLower.includes(pattern)) {
                return product;
            }
        }
        
        // Fallback: check for partial matches in specific order
        if (titleLower.includes('bowman') && titleLower.includes('chrome') && titleLower.includes('prospects')) {
            return 'Bowman Chrome Prospects';
        }
        if (titleLower.includes('bowman') && titleLower.includes('chrome')) {
            return 'Bowman Chrome';
        }
        if (titleLower.includes('panini') && titleLower.includes('donruss') && titleLower.includes('optic')) {
            return 'Panini Donruss Optic';
        }
        if (titleLower.includes('panini') && titleLower.includes('donruss')) {
            return 'Panini Donruss';
        }
        
        return null;
    }

    // Extract player name from title (improved version)
    extractPlayer(title) {
        // First, clean the title to remove common non-player terms
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
        removeTerms.push(...Array.from(this.cardSets));
        removeTerms.push(...Array.from(this.cardTypes));
        removeTerms.push(...Array.from(this.brands));

        // Add specific product names that might interfere with player extraction
        const productTerms = [
            'bowman chrome draft 1st', 'bowman chrome prospects', 'bowman chrome sapphire', 'bowman university chrome', 'bowman u chrome', 'bowman chrome draft', 'bowman chrome', 'bowman draft', 'bowman sterling', 'bowman platinum', 'bowman university', 'bowman u',
            'panini donruss optic', 'panini donruss', 'panini prizm', 'panini select', 'panini contenders', 'panini optic',
            'topps chrome', 'topps finest', 'topps heritage', 'topps archives', 'topps update',
            'upper deck sp', 'upper deck spx', 'upper deck exquisite', 'upper deck',
            'stadium club', 'national treasures', 'flawless', 'immaculate', 'limited', 'certified', 'elite', 'absolute',
            'spectra', 'phoenix', 'playbook', 'momentum', 'totally certified', 'crown royale', 'threads', 'prestige',
            'rookies & stars', 'score', 'leaf', 'playoff', 'press pass', 'sage', 'pacific', 'skybox', 'metal',
            'gallery', 'heritage', 'gypsy queen', 'allen & ginter', 'archives', 'big league', 'fire', 'opening day',
            'series 1', 'series 2', 'chrome update', 'chrome refractor', 'chrome sapphire', 'chrome black',
            'bowman', 'topps', 'panini', 'fleer', 'donruss', 'rated rookie', 'optic', 'kings', 'rookie kings'
        ];
        
        // Add card type terms that might interfere with player extraction - expanded from Sundo Cards guide
        const cardTypeTerms = [
            // Original terms
            'sky blue', 'neon green', 'purple pattern', 'pink pattern', 'blue pattern', 'green pattern', 'yellow pattern', 'black pattern', 'red pattern', 'printing plate', 'fuchsia',
            // Pattern types from Sundo Cards guide
            'checkerboard', 'x-fractor', 'cracked ice', 'atomic', 'disco', 'fast break', 'no huddle', 'flash', 'shock', 'mojo', 'mega', 'scope', 'shimmer', 'wave', 'multi wave', 'carved in time', 'lenticular', 'synthesis', 'outburst', 'electric ice', 'ellipse', 'color wheel', 'color blast', 'die-cut', 'national landmarks', 'stained glass', 'lava lamp', 'dazzle',
            // Donruss & Donruss Optic
            'blue velocity', 'hyper pink', 'red dragon', 'laser', 'liberty', 'diamond marvels', 'on fire', 'voltage', 'career stat line',
            // Leaf Exotic patterns
            'alligator crystal', 'alligator kaleidoscope', 'alligator mojo', 'alligator prismatic', 'butterfly crystal', 'butterfly kaleidoscope', 'butterfly mojo', 'butterfly prismatic', 'chameleon crystal', 'chameleon kaleidoscope', 'chameleon mojo', 'chameleon prismatic', 'clown fish crystal', 'clown fish kaleidoscope', 'clown fish mojo', 'clown fish prismatic', 'deer crystal', 'deer kaleidoscope', 'deer mojo', 'deer prismatic', 'dragon crystal', 'dragon kaleidoscope', 'dragon mojo', 'dragon prismatic', 'elephant crystal', 'elephant kaleidoscope', 'elephant mojo', 'elephant prismatic', 'giraffe crystal', 'giraffe kaleidoscope', 'giraffe mojo', 'giraffe prismatic', 'leopard crystal', 'leopard kaleidoscope', 'leopard mojo', 'leopard prismatic', 'parrot crystal', 'parrot kaleidoscope', 'parrot mojo', 'parrot prismatic', 'peacock crystal', 'peacock kaleidoscope', 'peacock mojo', 'peacock prismatic', 'snake crystal', 'snake kaleidoscope', 'snake mojo', 'snake prismatic', 'tiger crystal', 'tiger kaleidoscope', 'tiger mojo', 'tiger prismatic', 'zebra crystal', 'zebra kaleidoscope', 'zebra mojo', 'zebra prismatic', 'tiger eyes', 'snake eyes',
            // Topps Heritage
            '100th anniversary', 'black border', 'flip stock', 'magenta', 'mini parallels', 'chrome refractor', 'purple refractor', 'black bordered refractor', 'gold bordered refractor', 'superfractor',
            // Animal prints
            'zebra prizm', 'dragon scale', 'red dragon', 'peacock prizm', 'tiger prizm', 'giraffe prizm', 'elephant prizm',
            // NBA Hoops patterns
            'blue ice', 'silver laser', 'silver mojo', 'silver scope', 'teal wave', 'premium set checkerboard', 'blue laser', 'blue mojo', 'green flash', 'blue flash', 'purple flash', 'purple cracked ice', 'pink flash', 'gold cracked ice', 'gold flash', 'gold laser', 'gold mojo', 'black flash', 'black laser', 'black mojo', 'gold vinyl premium set',
            // Foilboard cards
            'vintage stock', 'red stars', 'independence day', 'father\'s day powder blue', 'mother\'s day hot pink', 'memorial day camo',
            // Mosaic patterns
            'camo pink mosaic', 'choice peacock mosaic', 'fast break silver mosaic', 'genesis mosaic', 'green mosaic', 'reactive blue mosaic', 'reactive orange mosaic', 'red mosaic', 'blue mosaic', 'choice red fusion mosaic', 'fast break blue mosaic', 'fast break purple mosaic', 'purple mosaic', 'orange fluorescent mosaic', 'white mosaic', 'fast break pink mosaic', 'blue fluorescent mosaic', 'pink swirl mosaic', 'fast break gold mosaic', 'gold mosaic', 'green swirl mosaic', 'pink fluorescent mosaic', 'choice black gold mosaic', 'black mosaic', 'choice nebula mosaic', 'fast break black mosaic',
            // NBA Hoops Prizm patterns
            'black pulsar prizm', 'blue prizm', 'blue cracked ice prizm', 'blue pulsar prizm', 'blue wave prizm', 'flash prizm', 'gold pulsar prizm', 'green prizm', 'green cracked ice prizm', 'green pulsar prizm', 'green shimmer prizm', 'pulsar prizm', 'purple disco prizm', 'red prizm', 'red cracked ice prizm', 'red flash prizm', 'red pulsar prizm', 'red wave prizm', 'silver prizm', 'silver laser prizm', 'silver mojo prizm', 'silver scope prizm', 'teal prizm', 'teal wave prizm', 'premium set checkerboard prizm', 'blue laser prizm', 'blue mojo prizm', 'green flash prizm', 'blue flash prizm', 'purple flash prizm', 'purple cracked ice prizm', 'pink flash prizm', 'gold cracked ice prizm', 'gold flash prizm', 'gold laser prizm', 'gold mojo prizm', 'black flash prizm', 'black laser prizm', 'black mojo prizm', 'gold vinyl premium set prizm'
        ];
        
        removeTerms.push(...productTerms);
        removeTerms.push(...cardTypeTerms);

        // Sort terms by length (longest first) to remove more specific terms before general ones
        removeTerms.sort((a, b) => b.length - a.length);

        removeTerms.forEach(term => {
            // Handle both word boundaries and hyphenated versions
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, '');
            
            // Also handle hyphenated versions (e.g., "bowman - chrome prospects")
            const hyphenatedRegex = new RegExp(`\\b${escapedTerm.replace(/\s+/g, '\\s*-\\s*')}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(hyphenatedRegex, '');
            
            // Also handle mixed versions where some words are hyphenated and others aren't
            const words = term.split(' ');
            if (words.length >= 2) {
                // Try different combinations of hyphenation
                const variations = [
                    term,
                    words.join(' - '),
                    `${words[0]} - ${words.slice(1).join(' ')}`,
                    `${words[0]} ${words[1]} - ${words.slice(2).join(' ')}`
                ];
                
                for (const variation of variations) {
                    const escapedVariation = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const variationRegex = new RegExp(`\\b${escapedVariation}\\b`, 'gi');
                    cleanTitle = cleanTitle.replace(variationRegex, '');
                }
            }
        });

        // Look for player name patterns
        const patterns = [
            // Handle names with periods like "J.J. MCCARTHY"
            /\b([A-Z]\.[A-Z]\.)\s+([A-Z]+)\b/g,
            // Handle initials like "CJ Kayfus"
            /\b([A-Z]{2,3})\s+([A-Z][a-z]+)\b/g,
            // Handle three-part names like "Shai Gilgeous-Alexander" first
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)-([A-Z][a-z]+)\b/g,
            // Handle all-caps names like "PAUL SKENES"
            /\b([A-Z]+)\s+([A-Z]+)\b/g,
            // First Last pattern (most common)
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // Handle special cases like "LeBron James", "De'Aaron Fox"
            /\b([A-Z][a-z]+'[A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+'[A-Z][a-z]+)\b/g
        ];

        for (const pattern of patterns) {
            const matches = [...cleanTitle.matchAll(pattern)];
            for (const match of matches) {
                const fullName = match[0];
                // Additional validation - skip if it looks like a product name or is too short
                const skipWords = Array.from(this.cardSets).concat(Array.from(this.cardTypes));
                
                if (!skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase())) && fullName.length > 3) {
                    return fullName;
                }
            }
        }
        return null;
    }

    // Extract color/numbering from title using learned data
    extractColorNumbering(title) {
        // First, extract the product to avoid duplicating product terms
        const product = this.extractProduct(title);
        const productLower = product ? product.toLowerCase() : '';
        
        const patterns = [
            // Multi-word card types (check these first) - from Sundo Cards guide
            /\b(Green Pulsar|Blue Pulsar|Red Pulsar|Purple Pulsar|Orange Pulsar|Pink Pulsar|Gold Pulsar|Silver Pulsar|Black Pulsar|White Pulsar|Sky Blue|Neon Green|Purple Pattern|Pink Pattern|Blue Pattern|Green Pattern|Yellow Pattern|Black Pattern|Red Pattern|Printing Plate|Checkerboard|X-Fractor|Cracked Ice|Atomic|Disco|Fast Break|No Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Wave|Multi Wave|Carved in Time|Lenticular|Synthesis|Outburst|Electric Ice|Ellipse|Color Wheel|Color Blast|Die-cut|National Landmarks|Stained Glass|Lava Lamp|Dazzle|Blue Velocity|Hyper Pink|Red Dragon|Laser|Liberty|Diamond Marvels|On Fire|Voltage|Career Stat Line|Alligator Crystal|Alligator Kaleidoscope|Alligator Mojo|Alligator Prismatic|Butterfly Crystal|Butterfly Kaleidoscope|Butterfly Mojo|Butterfly Prismatic|Chameleon Crystal|Chameleon Kaleidoscope|Chameleon Mojo|Chameleon Prismatic|Clown Fish Crystal|Clown Fish Kaleidoscope|Clown Fish Mojo|Clown Fish Prismatic|Deer Crystal|Deer Kaleidoscope|Deer Mojo|Deer Prismatic|Dragon Crystal|Dragon Kaleidoscope|Dragon Mojo|Dragon Prismatic|Elephant Crystal|Elephant Kaleidoscope|Elephant Mojo|Elephant Prismatic|Giraffe Crystal|Giraffe Kaleidoscope|Giraffe Mojo|Giraffe Prismatic|Leopard Crystal|Leopard Kaleidoscope|Leopard Mojo|Leopard Prismatic|Parrot Crystal|Parrot Kaleidoscope|Parrot Mojo|Parrot Prismatic|Peacock Crystal|Peacock Kaleidoscope|Peacock Mojo|Peacock Prismatic|Snake Crystal|Snake Kaleidoscope|Snake Mojo|Snake Prismatic|Tiger Crystal|Tiger Kaleidoscope|Tiger Mojo|Tiger Prismatic|Zebra Crystal|Zebra Kaleidoscope|Zebra Mojo|Zebra Prismatic|Tiger Eyes|Snake Eyes|100th Anniversary|Black Border|Flip Stock|Magenta|Mini Parallels|Chrome Refractor|Purple Refractor|Black Bordered Refractor|Gold Bordered Refractor|Superfractor|Zebra Prizm|Dragon Scale|Red Dragon|Peacock Prizm|Tiger Prizm|Giraffe Prizm|Elephant Prizm|Blue Ice|Silver Laser|Silver Mojo|Silver Scope|Teal Wave|Premium Set Checkerboard|Blue Laser|Blue Mojo|Green Flash|Blue Flash|Purple Flash|Purple Cracked Ice|Pink Flash|Gold Cracked Ice|Gold Flash|Gold Laser|Gold Mojo|Black Flash|Black Laser|Black Mojo|Gold Vinyl Premium Set|Vintage Stock|Red Stars|Independence Day|Father's Day Powder Blue|Mother's Day Hot Pink|Memorial Day Camo|Camo Pink Mosaic|Choice Peacock Mosaic|Fast Break Silver Mosaic|Genesis Mosaic|Green Mosaic|Reactive Blue Mosaic|Reactive Orange Mosaic|Red Mosaic|Blue Mosaic|Choice Red Fusion Mosaic|Fast Break Blue Mosaic|Fast Break Purple Mosaic|Purple Mosaic|Orange Fluorescent Mosaic|White Mosaic|Fast Break Pink Mosaic|Blue Fluorescent Mosaic|Pink Swirl Mosaic|Fast Break Gold Mosaic|Gold Mosaic|Green Swirl Mosaic|Pink Fluorescent Mosaic|Choice Black Gold Mosaic|Black Mosaic|Choice Nebula Mosaic|Fast Break Black Mosaic|Black Pulsar Prizm|Blue Prizm|Blue Cracked Ice Prizm|Blue Pulsar Prizm|Blue Wave Prizm|Flash Prizm|Gold Pulsar Prizm|Green Prizm|Green Cracked Ice Prizm|Green Pulsar Prizm|Green Shimmer Prizm|Pulsar Prizm|Purple Disco Prizm|Red Prizm|Red Cracked Ice Prizm|Red Flash Prizm|Red Pulsar Prizm|Red Wave Prizm|Silver Prizm|Silver Laser Prizm|Silver Mojo Prizm|Silver Scope Prizm|Teal Prizm|Teal Wave Prizm|Premium Set Checkerboard Prizm|Blue Laser Prizm|Blue Mojo Prizm|Green Flash Prizm|Blue Flash Prizm|Purple Flash Prizm|Purple Cracked Ice Prizm|Pink Flash Prizm|Gold Cracked Ice Prizm|Gold Flash Prizm|Gold Laser Prizm|Gold Mojo Prizm|Black Flash Prizm|Black Laser Prizm|Black Mojo Prizm|Gold Vinyl Premium Set Prizm)\b/gi,
            // Comprehensive card types and colors (but exclude product terms) - expanded from Sundo Cards guide
            /\b(Red|Blue|Green|Yellow|Orange|Purple|Pink|Gold|Silver|Bronze|Black|White|Rainbow|Prism|Holo|Holographic|Refractor|Sapphire|Emerald|Ruby|Diamond|Platinum|Titanium|Carbon|Finest|Prizm|Select|Optic|Contenders|National|Treasures|Flawless|Immaculate|Limited|Certified|Elite|Absolute|Spectra|Phoenix|Playbook|Momentum|Totally|Crown|Royale|Threads|Prestige|Rookies|Stars|Score|Leaf|Playoff|Press|Pass|Sage|Game|Pacific|Skybox|Metal|Stadium|Club|Gallery|Heritage|Gypsy|Queen|Allen|Ginter|Archives|Big|League|Fire|Opening|Day|Update|Series|Draft|Sterling|Platinum|SP|SPx|Exquisite|Lunar Glow|Wave|Holo|Holographic|Pulsar|Fuchsia|Pattern|Plate|Checkerboard|X-Fractor|Cracked|Ice|Atomic|Disco|Fast|Break|Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Multi|Carved|Time|Lenticular|Synthesis|Outburst|Electric|Ellipse|Wheel|Blast|Die|Cut|Landmarks|Stained|Glass|Lava|Lamp|Dazzle|Velocity|Hyper|Dragon|Laser|Liberty|Marvels|Fire|Voltage|Career|Stat|Line|Alligator|Kaleidoscope|Prismatic|Butterfly|Chameleon|Clown|Fish|Deer|Elephant|Giraffe|Leopard|Parrot|Peacock|Snake|Tiger|Zebra|Eyes|Anniversary|Border|Flip|Stock|Magenta|Mini|Parallels|Bordered|Superfractor|Scale|Vintage|Stars|Independence|Father|Mother|Memorial|Camo|Choice|Fusion|Nebula|Reactive|Fluorescent|Swirl|Vinyl|Premium|Set|Cyan|Yellow|Magenta)\b/gi,
            // Card numbers with # symbol (including alphanumeric)
            /#[A-Z0-9-]+/g,
            // Print run numbers (like /150, /5)
            /\/(\d+)\b/g,
            // Special editions
            /\b(1st Edition|First Edition|Limited Edition|Special Edition|Anniversary|Century|Millennium|Legacy|Legendary|Iconic|Epic|Rare|Ultra Rare|Secret Rare|Common|Uncommon|Rare|Mythic|Legendary)\b/gi
        ];

        const found = [];
        const usedWords = new Set(); // Track words that have been used in multi-word patterns
        const foundTerms = new Set(); // Track exact terms that have been found to prevent exact duplicates
        
        for (const pattern of patterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
                // Skip PSA grades and year fragments
                const value = match[0];
                if (value === '10' || value === '23' || value === '2022' || value === '2023' || value === '2024') {
                    continue;
                }
                
                // Skip if this term is part of the product name
                const valueLower = value.toLowerCase();
                if (productLower && productLower.includes(valueLower)) {
                    continue;
                }
                
                // Skip if we've already found this exact term
                if (foundTerms.has(value)) {
                    continue;
                }
                
                // Check if this is a multi-word pattern (contains space)
                if (value.includes(' ')) {
                    // Add the full multi-word term
                    found.push(match[0]);
                    foundTerms.add(value);
                    // Mark individual words as used to prevent duplication
                    const words = value.split(' ');
                    words.forEach(word => usedWords.add(word.toLowerCase()));
                } else {
                    // For single words, check if they were already used in a multi-word pattern
                    if (!usedWords.has(value.toLowerCase())) {
                        found.push(match[0]);
                        foundTerms.add(value);
                    }
                }
            }
        }

        return found.length > 0 ? found.join(' ') : null;
    }

    // Check if title contains autograph-related terms
    hasAutograph(title) {
        const titleLower = title.toLowerCase();
        const autoTerms = [
            'auto', 'autograph', 'signed', 'signature', 'rookie auto', 'rookie autograph',
            'on-card auto', 'on-card autograph', 'sticker auto', 'sticker autograph',
            'patch auto', 'patch autograph', 'jersey auto', 'jersey autograph'
        ];
        
        return autoTerms.some(term => titleLower.includes(term));
    }

    // Generate standardized summary title
    generateStandardizedTitle(title) {
        const year = this.extractYear(title);
        const product = this.extractProduct(title);
        const player = this.extractPlayer(title);
        const colorNumbering = this.extractColorNumbering(title);
        const hasAuto = this.hasAutograph(title);

        const parts = [];
        
        if (year) parts.push(year);
        if (product) parts.push(product);
        if (player) parts.push(player);
        if (colorNumbering) parts.push(colorNumbering);
        if (hasAuto) parts.push('auto');

        const standardizedTitle = parts.join(' ').trim();
        
        // If we couldn't extract enough information, return a cleaned version of the original
        if (parts.length < 2) {
            return this.cleanTitle(title);
        }

        return standardizedTitle;
    }

    // Clean title as fallback
    cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove common unwanted terms
        const unwantedTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'MT 10', 'MT10',
            'RC', 'Rookie', 'ROOKIE', 'rookie', 'SP', 'sp',
            'AUTO', 'auto', 'Autograph', 'autograph',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population'
        ];

        unwantedTerms.forEach(term => {
            const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });

        // Remove extra spaces and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
    }

    async generateAllStandardizedTitles() {
        console.log('🔄 Starting database-driven standardized summary title generation...\n');

        try {
            // First, connect to database
            await this.connect();
            
            // Then learn from existing data
            await this.learnFromDatabase();

            // Get all cards
            const cards = await this.runQuery('SELECT id, title, summary_title FROM cards');
            console.log(`📊 Found ${cards.length} cards to process`);

            let updated = 0;
            let unchanged = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    const newSummaryTitle = this.generateStandardizedTitle(card.title);
                    
                    if (newSummaryTitle && newSummaryTitle !== card.summary_title) {
                        await this.runUpdate(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [newSummaryTitle, card.id]
                        );
                        
                        console.log(`✅ Updated card ${card.id}: "${card.summary_title || 'N/A'}" → "${newSummaryTitle}"`);
                        updated++;
                    } else {
                        unchanged++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error);
                    errors++;
                }
            }

            console.log('\n🎉 Database-Driven Standardized Summary Title Generation Complete!');
            console.log('================================================================');
            console.log(`📊 Total cards processed: ${cards.length}`);
            console.log(`🔄 Updated: ${updated}`);
            console.log(`✓ Unchanged: ${unchanged}`);
            console.log(`❌ Errors: ${errors}`);

            return {
                success: true,
                totalProcessed: cards.length,
                updated: updated,
                unchanged: unchanged,
                errors: errors,
                learnedSets: this.cardSets.size,
                learnedTypes: this.cardTypes.size,
                learnedBrands: this.brands.size
            };

        } catch (error) {
            console.error('❌ Error during title generation:', error);
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    // Test function to see examples
    async testStandardizedTitles() {
        console.log('🧪 Testing database-driven standardized title generation...\n');

        // First, connect to database
        await this.connect();
        
        // Then learn from database
        await this.learnFromDatabase();

        const testTitles = [
            'PSA 10 2022-23 Bowman University Chrome - Caitlin Clark #50 Pink Refractor (RC)',
            '2023 Bowman - Chrome Prospects Junior Caminero #BCP-61 Lunar Glow PSA 10 (RC)',
            '2024 Panini Donruss Optic - Rated Rookie Jayden Daniels #248 (RC) PSA 10 GEM MT',
            '2024 Topps Chrome #74TF1 Caleb Williams RC PSA 10',
            '2024 Bowman U Chrome #16 Cooper Flagg Duke RC Rookie AUTO PSA 10 GEM MINT',
            '2018 Panini Donruss Optic Rated Rookie Shai Gilgeous-Alexander #162 Holo PSA 10',
            '2024 Bowman - Chrome Rookie Auto Bryan Woo Blue Refractor /150 Mariners PSA 10',
            'PAUL SKENES 2024 BOWMAN CHROME SAPPHIRE ROOKIE RC RED /5 PSA 10 GEM MINT PIRATES'
        ];

        console.log('📋 Test Results:');
        console.log('================');
        
        testTitles.forEach((title, index) => {
            const standardized = this.generateStandardizedTitle(title);
            console.log(`\n${index + 1}. Original: "${title}"`);
            console.log(`   Standardized: "${standardized}"`);
            
            // Show extracted components
            const year = this.extractYear(title);
            const product = this.extractProduct(title);
            const player = this.extractPlayer(title);
            const colorNumbering = this.extractColorNumbering(title);
            
            console.log(`   Components: Year="${year}", Product="${product}", Player="${player}", Color/Numbering="${colorNumbering}"`);
        });
    }
}

// Export for use
module.exports = { DatabaseDrivenStandardizedTitleGenerator };

// For testing locally
if (require.main === module) {
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    generator.testStandardizedTitles()
        .then(() => {
            console.log('\n✅ Test completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}
