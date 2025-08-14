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
        // First try to match year ranges like "1994-95"
        const yearRangeMatch = title.match(/\b(19[0-9]{2}-[0-9]{2}|20[0-9]{2}-[0-9]{2})\b/);
        if (yearRangeMatch) {
            return yearRangeMatch[1];
        }
        
        // Then try single years
        const yearMatch = title.match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
        return yearMatch ? yearMatch[1] : null;
    }

    // Extract product/brand from title using learned data
    extractProduct(title) {
        const titleLower = title.toLowerCase();
        
        // Define specific product patterns with priority
        const productPatterns = [
            // Most specific patterns first (longest first)
            { pattern: 'bowman draft chrome 1st', product: 'Bowman Chrome Draft 1st' },
            { pattern: 'bowman chrome draft 1st', product: 'Bowman Chrome Draft 1st' },
            { pattern: 'bowman draft chrome', product: 'Bowman Chrome Draft' },
            { pattern: 'bowman chrome draft', product: 'Bowman Chrome Draft' },
            { pattern: 'bowman draft draft chrome', product: 'Bowman Chrome Draft' },
            { pattern: 'bowman sapphire edition chrome prospects', product: 'Bowman Sapphire Chrome Prospects' },
            { pattern: 'bowman chrome prospects', product: 'Bowman Chrome Prospects' },
            { pattern: 'bowman chrome sapphire', product: 'Bowman Chrome Sapphire' },
            { pattern: 'bowman university chrome', product: 'Bowman University Chrome' },
            { pattern: 'bowman u chrome', product: 'Bowman University Chrome' },
            { pattern: 'panini donruss optic', product: 'Panini Donruss Optic' },
            { pattern: 'donruss optic', product: 'Donruss Optic' },
            { pattern: 'panini donruss', product: 'Panini Donruss' },
            { pattern: 'bowman chrome draft', product: 'Bowman Chrome Draft' },
            { pattern: 'bowman chrome', product: 'Bowman Chrome' },
            { pattern: 'bowman draft', product: 'Bowman Draft' },
            { pattern: 'bowman sterling', product: 'Bowman Sterling' },
            { pattern: 'bowman platinum', product: 'Bowman Platinum' },
            { pattern: 'bowman university', product: 'Bowman University' },
            { pattern: 'bowman u', product: 'Bowman University' },
            { pattern: 'nscc uefa topps chrome', product: 'NSCC UEFA Topps Chrome' },
            { pattern: 'nscc uefa', product: 'NSCC UEFA' },
            { pattern: 'uefa topps chrome', product: 'UEFA Topps Chrome' },
            { pattern: 'nscc', product: 'NSCC' },
            { pattern: 'uefa', product: 'UEFA' },
            { pattern: 'topps chrome', product: 'Topps Chrome' },
            { pattern: 'topps basketball', product: 'Topps' },
            { pattern: 'topps finest', product: 'Topps Finest' },
            { pattern: 'topps heritage', product: 'Topps Heritage' },
            { pattern: 'topps archives', product: 'Topps Archives' },
            { pattern: 'topps update', product: 'Topps Update' },
            { pattern: 'panini prizm wnba', product: 'Panini Prizm WNBA' },
            { pattern: 'panini instant wnba', product: 'Panini Instant WNBA' },
            { pattern: 'prizm monopoly wnba', product: 'Prizm Monopoly WNBA' },
            { pattern: 'prizm dp', product: 'Prizm DP' },
            { pattern: 'light it up', product: 'Light It Up' },
            { pattern: 'skybox e-x2001', product: 'Skybox E-X2001' },
            { pattern: 'bowman chrome prospects', product: 'Bowman Chrome Prospects' },
            { pattern: 'one and one', product: 'One and One' },
            { pattern: 'road to uefa euro', product: 'Road To UEFA Euro' },
            { pattern: 'usa basketball', product: 'USA Basketball' },
            { pattern: 'panini prizm', product: 'Panini Prizm' },
            { pattern: 'panini select', product: 'Panini Select' },
            { pattern: 'panini contenders', product: 'Panini Contenders' },
            { pattern: 'panini donruss', product: 'Panini Donruss' },
            { pattern: 'panini optic', product: 'Panini Optic' },
            { pattern: 'panini mosaic storm chasers', product: 'Panini Mosaic Storm Chasers' },
            { pattern: 'panini mosaic', product: 'Panini Mosaic' },
            { pattern: 'storm chasers', product: 'Storm Chasers' },
            { pattern: 'upper deck sp', product: 'Upper Deck SP' },
            { pattern: 'upper deck spx', product: 'Upper Deck SPx' },
            { pattern: 'upper deck exquisite', product: 'Upper Deck Exquisite' },
            { pattern: 'upper deck', product: 'Upper Deck' },
            { pattern: 'topps stadium club chrome', product: 'Topps Stadium Club Chrome' },
            { pattern: 'stadium club chrome', product: 'Stadium Club Chrome' },
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
            { pattern: 'chronicles wwe', product: 'Chronicles WWE' },
            { pattern: 'chronicles', product: 'Chronicles' },
            { pattern: 'rookies & stars', product: 'Rookies & Stars' },
            { pattern: 'flair', product: 'Flair' },
            { pattern: 'score', product: 'Score' },
            { pattern: 'leaf', product: 'Leaf' },
            { pattern: 'playoff', product: 'Playoff' },
            { pattern: 'press pass', product: 'Press Pass' },
            { pattern: 'sage', product: 'Sage' },
            { pattern: 'hit', product: 'Hit' },
            { pattern: 'pacific', product: 'Pacific' },

            { pattern: 'skybox', product: 'Skybox' },
            { pattern: 'downtown', product: 'Downtown' },
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
                        // Special case: if we matched "Bowman" or "Bowman Draft" but the title also contains "Chrome", it should be "Bowman Chrome Draft"
                        if ((product === 'Bowman' || product === 'Bowman Draft') && titleLower.includes('chrome')) {
                            return 'Bowman Chrome Draft';
                        }
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
                // Special case: if we matched "Bowman" or "Bowman Draft" but the title also contains "Chrome", it should be "Bowman Chrome Draft"
                if ((product === 'Bowman' || product === 'Bowman Draft') && titleLower.includes('chrome')) {
                    return 'Bowman Chrome Draft';
                }
                return product;
            }
        }
        
        // Fallback: check for partial matches in specific order
        if (titleLower.includes('bowman') && titleLower.includes('chrome') && titleLower.includes('prospects')) {
            return 'Bowman Chrome Prospects';
        }
        if (titleLower.includes('bowman') && titleLower.includes('chrome') && titleLower.includes('draft')) {
            return 'Bowman Chrome Draft';
        }
        if (titleLower.includes('bowman') && titleLower.includes('chrome')) {
            return 'Bowman Chrome';
        }
        
        // Special case: if we have "Bowman Draft" but also "Chrome" in the title, it should be "Bowman Chrome Draft"
        if (titleLower.includes('bowman') && titleLower.includes('draft') && titleLower.includes('chrome')) {
            return 'Bowman Chrome Draft';
        }
        
        // Special case: if we have "Bowman" and "Draft" and "Chrome" anywhere in the title, it should be "Bowman Chrome Draft"
        if (titleLower.includes('bowman') && titleLower.includes('draft') && titleLower.includes('chrome')) {
            return 'Bowman Chrome Draft';
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
            'bowman draft chrome 1st', 'bowman chrome draft 1st', 'bowman chrome sapphire', 'bowman university chrome', 'bowman u chrome', 'bowman chrome draft', 'bowman chrome', 'bowman draft', 'bowman sterling', 'bowman platinum', 'bowman university', 'bowman u',
            'panini donruss optic', 'panini donruss', 'panini prizm', 'panini select', 'panini contenders', 'panini optic', 'panini prizm wnba', 'panini instant wnba', 'prizm monopoly wnba',
            'topps chrome', 'topps finest', 'topps heritage', 'topps archives', 'topps update',
            'upper deck sp', 'upper deck spx', 'upper deck exquisite', 'upper deck',
            'stadium club', 'national treasures', 'flawless', 'immaculate', 'limited', 'certified', 'elite', 'absolute',
            'spectra', 'phoenix', 'playbook', 'momentum', 'totally certified', 'crown royale', 'threads', 'prestige',
            'rookies & stars', 'score', 'leaf', 'playoff', 'press pass', 'sage', 'pacific', 'skybox', 'metal',
            'gallery', 'heritage', 'gypsy queen', 'allen & ginter', 'archives', 'big league', 'fire', 'opening day',
            'series 1', 'series 2', 'chrome update', 'chrome refractor', 'chrome sapphire', 'chrome black',
            'bowman', 'topps', 'panini', 'fleer', 'donruss', 'flair', 'chronicles', 'chronicles wwe', 'rated rookie', 'rated rookies', 'optic', 'kings', 'rookie kings',
            'rookies', 'rookie', 'nscc uefa', 'nscc', 'uefa', 'wnba', 'storm chasers'
        ];
        
        // Add card set prefixes that should be removed but preserve player names
        const cardSetPrefixes = [
            'wnba', 'nba', 'nfl', 'mlb', 'nhl', 'usa', 'euro', 'downtown', 'uptowns', 'negative', 'pulsar'
        ];
        
        // Add card type terms that might interfere with player extraction - expanded from Sundo Cards guide (updated)
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
            'black pulsar prizm', 'blue prizm', 'blue cracked ice prizm', 'blue pulsar prizm', 'blue wave prizm', 'flash prizm', 'gold pulsar prizm', 'green prizm', 'green cracked ice prizm', 'green pulsar prizm', 'green shimmer prizm', 'pulsar prizm', 'purple disco prizm', 'red prizm', 'red cracked ice prizm', 'red flash prizm', 'red pulsar prizm', 'red wave prizm', 'silver prizm', 'silver laser prizm', 'silver mojo prizm', 'silver scope prizm', 'teal prizm', 'teal wave prizm', 'premium set checkerboard prizm', 'blue laser prizm', 'blue mojo prizm', 'green flash prizm', 'blue flash prizm', 'purple flash prizm', 'purple cracked ice prizm', 'pink flash prizm', 'gold cracked ice prizm', 'gold flash prizm', 'gold laser prizm', 'gold mojo prizm', 'black flash prizm', 'black laser prizm', 'black mojo prizm', 'gold vinyl premium set prizm',
            // Additional terms that are being incorrectly included in player names
            'chrome', 'refractor', 'draft', 'helmet', 'heroes', 'sapphire', 'optic', 'hit', 'basketball', 'one and one', 'downtown', 'road to uefa euro', 'usa basketball', 'downtown', 'skybox', 'dp', 'light it up', 'disco', 'orange', 'prizm', 'mosaic', 'prospect', 'prospects', 'starcade'
        ];
        
        removeTerms.push(...productTerms);
        removeTerms.push(...cardTypeTerms);

        // Add team names and stadium names to prevent them from being extracted as player names
        const teamAndStadiumTerms = [
            // NFL Teams
            'Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets', 'Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans', 'Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders', 'Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings', 'Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers', 'Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks',
            // MLB Teams
            'New York Yankees', 'Boston Red Sox', 'Toronto Blue Jays', 'Baltimore Orioles', 'Tampa Bay Rays', 'Chicago White Sox', 'Cleveland Guardians', 'Detroit Tigers', 'Kansas City Royals', 'Minnesota Twins', 'Houston Astros', 'Los Angeles Angels', 'Oakland Athletics', 'Seattle Mariners', 'Texas Rangers', 'Atlanta Braves', 'Miami Marlins', 'New York Mets', 'Philadelphia Phillies', 'Washington Nationals', 'Chicago Cubs', 'Cincinnati Reds', 'Milwaukee Brewers', 'Pittsburgh Pirates', 'St. Louis Cardinals', 'Arizona Diamondbacks', 'Colorado Rockies', 'Los Angeles Dodgers', 'San Diego Padres', 'San Francisco Giants',
            // NBA Teams
            'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
            // NHL Teams
            'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens', 'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers', 'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets',
            // Common team name variations
            'Bills', 'Dolphins', 'Patriots', 'Jets', 'Ravens', 'Bengals', 'Browns', 'Steelers', 'Texans', 'Colts', 'Jaguars', 'Titans', 'Broncos', 'Chiefs', 'Raiders', 'Chargers', 'Cowboys', 'Giants', 'Eagles', 'Commanders', 'Bears', 'Lions', 'Packers', 'Vikings', 'Falcons', 'Panthers', 'Saints', 'Buccaneers', 'Cardinals', 'Rams', '49ers', 'Seahawks',
            'Yankees', 'Red Sox', 'Blue Jays', 'Orioles', 'Rays', 'White Sox', 'Guardians', 'Tigers', 'Royals', 'Twins', 'Astros', 'Angels', 'Athletics', 'Mariners', 'Rangers', 'Braves', 'Marlins', 'Mets', 'Phillies', 'Nationals', 'Cubs', 'Reds', 'Brewers', 'Pirates', 'Cardinals', 'Diamondbacks', 'Rockies', 'Dodgers', 'Padres', 'Giants',
            'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Mavericks', 'Nuggets', 'Pistons', 'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves', 'Pelicans', 'Knicks', 'Thunder', 'Magic', '76ers', 'Suns', 'Trail Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards',
            'Ducks', 'Coyotes', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Blackhawks', 'Avalanche', 'Blue Jackets', 'Stars', 'Red Wings', 'Oilers', 'Panthers', 'Kings', 'Wild', 'Canadiens', 'Predators', 'Devils', 'Islanders', 'Rangers', 'Senators', 'Flyers', 'Penguins', 'Sharks', 'Kraken', 'Blues', 'Lightning', 'Maple Leafs', 'Canucks', 'Golden Knights', 'Capitals', 'Jets',
            // Stadium names (excluding card products like "Stadium Club")
            'Jack Murphy Stadium', 'Petco Park', 'Fenway Park', 'Wrigley Field', 'Yankee Stadium', 'Dodger Stadium', 'Oracle Park', 'Coors Field', 'Minute Maid Park', 'Globe Life Field', 'Truist Park', 'LoanDepot Park', 'Citi Field', 'Citizens Bank Park', 'Nationals Park', 'Guaranteed Rate Field', 'Progressive Field', 'Comerica Park', 'Kauffman Stadium', 'Target Field', 'Angel Stadium', 'RingCentral Coliseum', 'T-Mobile Park', 'Rogers Centre', 'Camden Yards', 'Tropicana Field',
            // Cities and locations
            'Buffalo', 'Miami', 'New England', 'New York', 'Baltimore', 'Cincinnati', 'Cleveland', 'Pittsburgh', 'Houston', 'Indianapolis', 'Jacksonville', 'Tennessee', 'Denver', 'Kansas City', 'Las Vegas', 'Los Angeles', 'Dallas', 'Philadelphia', 'Washington', 'Chicago', 'Detroit', 'Green Bay', 'Minnesota', 'Atlanta', 'Carolina', 'New Orleans', 'Tampa Bay', 'Arizona', 'San Francisco', 'Seattle', 'Boston', 'Toronto', 'Oakland', 'Texas', 'Colorado', 'San Diego', 'St. Louis', 'Milwaukee', 'Sacramento', 'Utah', 'Anaheim', 'Calgary', 'Columbus', 'Edmonton', 'Florida', 'Montreal', 'Nashville', 'New Jersey', 'Ottawa', 'Vancouver', 'Vegas', 'Winnipeg',
            // Additional terms that should be filtered out
            'Downtown', 'Lakers'
        ];
        
        removeTerms.push(...teamAndStadiumTerms);

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

        // Normalize spaces after filtering to ensure proper pattern matching
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

        // Look for player name patterns
        const patterns = [
            // Handle quoted nicknames like "Hacksaw" Jim Duggan
            /"([^"]+)"\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // Handle names with periods like "J.J. MCCARTHY"
            /\b([A-Z]\.[A-Z]\.)\s+([A-Z]+)\b/g,
            // Handle initials like "CJ Kayfus" and "JJ McCarthy"
            /\b([A-Z]{2,3})\s+([A-Z][a-z]+)\b/g,
            // Handle specific initials like "JJ McCarthy"
            /\bJJ\s+McCarthy\b/g,
            // Handle three-part names like "Shai Gilgeous-Alexander" first
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)-([A-Z][a-z]+)\b/g,
            // Handle names with apostrophes in first part like "De'Von Achane"
            /\b([A-Z][a-z]+'[A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // Handle names with internal capitals like "McConkey", "O'Neal"
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]*[A-Z][a-z]*)\b/g,
            // Handle all-caps names with apostrophes like "SHAQUILLE O'NEAL"
            /\b([A-Z]+'[A-Z]+)\s+([A-Z]+)\b/g,
            // Handle all-caps names with apostrophes in second part like "SHAQUILLE O'NEAL"
            /\b([A-Z]+)\s+([A-Z]+'[A-Z]+)\b/g,
            // Handle all-caps names like "PAUL SKENES"
            /\b([A-Z]+)\s+([A-Z]+)\b/g,
            // Handle three-part names like "Josue De Paula"
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // First Last pattern (most common)
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // Handle special cases like "LeBron James", "De'Aaron Fox"
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+'[A-Z][a-z]+)\b/g
        ];

        for (const pattern of patterns) {
            const matches = [...cleanTitle.matchAll(pattern)];
            for (const match of matches) {
                const fullName = match[0];
                // Additional validation - skip if it looks like a product name or is too short
                const skipWords = Array.from(this.cardSets).concat(Array.from(this.cardTypes));
                
                if (!skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase())) && fullName.length > 3) {
                    // Format player name with proper case
                    return fullName.split(' ').map(word => {
                        // Handle quoted nicknames - preserve original case
                        if (word.startsWith('"') && word.endsWith('"')) {
                            return word;
                        }
                        // Handle special cases like "O'Neal", "De'Von", etc.
                        if (word.includes("'")) {
                            return word.split("'").map(part => 
                                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                            ).join("'");
                        }
                        // Handle hyphenated names like "Smith-Njigba"
                        if (word.includes("-")) {
                            return word.split("-").map(part => 
                                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                            ).join("-");
                        }
                        // Handle initials like "JJ", "CJ", etc.
                        if (word.length === 2 && word.toUpperCase() === word) {
                            return word.toUpperCase();
                        }
                        // Handle names that should be properly cased (like "McCarthy")
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    }).join(' ');
                }
            }
        }
        return null;
    }

    // Extract color/numbering from title using learned data
    extractColorNumbering(title) {
        // First, extract the product and player to avoid duplicating terms
        const product = this.extractProduct(title);
        const productLower = product ? product.toLowerCase() : '';
        const player = this.extractPlayer(title);
        const playerLower = player ? player.toLowerCase() : '';
        
        const patterns = [
            // Multi-word card types (check these first) - from Sundo Cards guide
            /\b(Green Pulsar|Blue Pulsar|Red Pulsar|Purple Pulsar|Orange Pulsar|Pink Pulsar|Gold Pulsar|Silver Pulsar|Black Pulsar|White Pulsar|Sky Blue|Neon Green|Purple Pattern|Pink Pattern|Blue Pattern|Green Pattern|Yellow Pattern|Black Pattern|Red Pattern|Printing Plate|Checkerboard|X-Fractor|Cracked Ice|Atomic|Disco|Fast Break|No Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Wave|Multi Wave|Carved in Time|Lenticular|Synthesis|Outburst|Electric Ice|Ellipse|Color Wheel|Color Blast|Die-cut|National Landmarks|Stained Glass|Lava Lamp|Dazzle|Blue Velocity|Hyper Pink|Red Dragon|Laser|Liberty|Diamond Marvels|On Fire|Voltage|Career Stat Line|Alligator Crystal|Alligator Kaleidoscope|Alligator Mojo|Alligator Prismatic|Butterfly Crystal|Butterfly Kaleidoscope|Butterfly Mojo|Butterfly Prismatic|Chameleon Crystal|Chameleon Kaleidoscope|Chameleon Mojo|Chameleon Prismatic|Clown Fish Crystal|Clown Fish Kaleidoscope|Clown Fish Mojo|Clown Fish Prismatic|Deer Crystal|Deer Kaleidoscope|Deer Mojo|Deer Prismatic|Dragon Crystal|Dragon Kaleidoscope|Dragon Mojo|Dragon Prismatic|Elephant Crystal|Elephant Kaleidoscope|Elephant Mojo|Elephant Prismatic|Giraffe Crystal|Giraffe Kaleidoscope|Giraffe Mojo|Giraffe Prismatic|Leopard Crystal|Leopard Kaleidoscope|Leopard Mojo|Leopard Prismatic|Parrot Crystal|Parrot Kaleidoscope|Parrot Mojo|Parrot Prismatic|Peacock Crystal|Peacock Kaleidoscope|Peacock Mojo|Peacock Prismatic|Snake Crystal|Snake Kaleidoscope|Snake Mojo|Snake Prismatic|Tiger Crystal|Tiger Kaleidoscope|Tiger Mojo|Tiger Prismatic|Zebra Crystal|Zebra Kaleidoscope|Zebra Mojo|Zebra Prismatic|Tiger Eyes|Snake Eyes|100th Anniversary|Black Border|Flip Stock|Magenta|Mini Parallels|Chrome Refractor|Purple Refractor|Black Bordered Refractor|Gold Bordered Refractor|Superfractor|Zebra Prizm|Dragon Scale|Red Dragon|Peacock Prizm|Tiger Prizm|Giraffe Prizm|Elephant Prizm|Blue Ice|Silver Laser|Silver Mojo|Silver Scope|Teal Wave|Premium Set Checkerboard|Blue Laser|Blue Mojo|Green Flash|Blue Flash|Purple Flash|Purple Cracked Ice|Pink Flash|Gold Cracked Ice|Gold Flash|Gold Laser|Gold Mojo|Black Flash|Black Laser|Black Mojo|Gold Vinyl Premium Set|Vintage Stock|Red Stars|Independence Day|Father's Day Powder Blue|Mother's Day Hot Pink|Memorial Day Camo|Camo Pink Mosaic|Choice Peacock Mosaic|Fast Break Silver Mosaic|Genesis Mosaic|Green Mosaic|Reactive Blue Mosaic|Reactive Orange Mosaic|Red Mosaic|Blue Mosaic|Choice Red Fusion Mosaic|Fast Break Blue Mosaic|Fast Break Purple Mosaic|Purple Mosaic|Orange Fluorescent Mosaic|White Mosaic|Fast Break Pink Mosaic|Blue Fluorescent Mosaic|Pink Swirl Mosaic|Fast Break Gold Mosaic|Gold Mosaic|Green Swirl Mosaic|Pink Fluorescent Mosaic|Choice Black Gold Mosaic|Black Mosaic|Choice Nebula Mosaic|Fast Break Black Mosaic|Black Pulsar Prizm|Blue Prizm|Blue Cracked Ice Prizm|Blue Pulsar Prizm|Blue Wave Prizm|Flash Prizm|Gold Pulsar Prizm|Green Prizm|Green Cracked Ice Prizm|Green Pulsar Prizm|Green Shimmer Prizm|Pulsar Prizm|Purple Disco Prizm|Red Prizm|Red Cracked Ice Prizm|Red Flash Prizm|Red Pulsar Prizm|Red Wave Prizm|Silver Prizm|Silver Laser Prizm|Silver Mojo Prizm|Silver Scope Prizm|Teal Prizm|Teal Wave Prizm|Premium Set Checkerboard Prizm|Blue Laser Prizm|Blue Mojo Prizm|Green Flash Prizm|Blue Flash Prizm|Purple Flash Prizm|Purple Cracked Ice Prizm|Pink Flash Prizm|Gold Cracked Ice Prizm|Gold Flash Prizm|Gold Laser Prizm|Gold Mojo Prizm|Black Flash Prizm|Black Laser Prizm|Black Mojo Prizm|Gold Vinyl Premium Set Prizm|Helmet Heroes|Light It Up|Sepia Refractor)\b/gi,
            // Comprehensive card types and colors (but exclude product terms) - expanded from Sundo Cards guide
            /\b(Red|Blue|Green|Yellow|Orange|Purple|Pink|Gold|Silver|Bronze|Black|White|Rainbow|Prism|Holo|Holographic|Refractor|Sapphire|Emerald|Ruby|Diamond|Platinum|Titanium|Carbon|Prizm|Select|Optic|Contenders|National|Treasures|Flawless|Immaculate|Limited|Certified|Elite|Absolute|Spectra|Phoenix|Playbook|Momentum|Totally|Crown|Royale|Threads|Prestige|Rookies|Stars|Score|Leaf|Playoff|Press|Pass|Sage|Game|Pacific|Skybox|Metal|Stadium|Club|Gallery|Heritage|Gypsy|Queen|Allen|Ginter|Archives|Big|League|Fire|Opening|Day|Update|Series|Draft|Sterling|Platinum|SP|SPx|Exquisite|Lunar Glow|Wave|Holo|Holographic|Pulsar|Fuchsia|Pattern|Plate|Checkerboard|X-Fractor|Cracked|Ice|Atomic|Disco|Fast|Break|Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Multi|Carved|Time|Lenticular|Synthesis|Outburst|Electric|Ellipse|Wheel|Blast|Die|Cut|Landmarks|Stained|Glass|Lava|Lamp|Dazzle|Velocity|Hyper|Dragon|Laser|Liberty|Marvels|Fire|Voltage|Career|Stat|Line|Alligator|Kaleidoscope|Prismatic|Butterfly|Chameleon|Clown|Fish|Deer|Elephant|Giraffe|Leopard|Parrot|Peacock|Snake|Tiger|Zebra|Eyes|Anniversary|Border|Flip|Stock|Magenta|Mini|Parallels|Bordered|Superfractor|Scale|Vintage|Stars|Independence|Father|Mother|Memorial|Camo|Choice|Fusion|Nebula|Reactive|Fluorescent|Swirl|Vinyl|Premium|Set|Cyan|Yellow|Magenta|Downtown|Sepia)\b/gi,
            // Card numbers with # symbol followed by letters and hyphens (like #BDC-168, #CDA-LK, #17hh) - check this first
            /#[A-Za-z]+[-\dA-Za-z]+/g,
            // Card numbers with # symbol followed by letters (like #17hh)
            /#\d+[A-Za-z]+/g,
            // Card numbers with # symbol followed by pure numbers (like #168, #123)
            /#(?!SSP)\d+/g,
            // Bowman Draft card numbers (BDP, BDC, CDA, etc.)
            /\b(BD[A-Z]?\d+)\b/g,
            // Print run numbers (like /150, /5) - capture the full pattern including slash
            /\/\d+\b/g,
            // Standalone card numbers (but exclude PSA grades and POP numbers)
            /\b(\d{1,3})\b/g,
            // Special editions
            /\b(1st Edition|First Edition|Limited Edition|Special Edition|Anniversary|Century|Millennium|Legacy|Legendary|Iconic|Epic|Rare|Ultra Rare|Secret Rare|Common|Uncommon|Rare|Mythic|Legendary)\b/gi
        ];

        const found = [];
        const usedWords = new Set(); // Track words that have been used in multi-word patterns
        const foundTerms = new Set(); // Track exact terms that have been found to prevent exact duplicates
        
        for (const pattern of patterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
                // Skip PSA grades, year fragments, and POP numbers
                const value = match[0];
                const titleLower = title.toLowerCase();
                
                // Skip PSA grades (10, 9, 8, etc.)
                if (value === '10' || value === '9' || value === '8' || value === '7' || value === '6' || value === '5' || value === '4' || value === '3' || value === '2' || value === '1') {
                    // Check if it's near PSA or POP keywords
                    const beforePSA = titleLower.includes('psa ' + value) || titleLower.includes('psa' + value);
                    const beforePOP = titleLower.includes('pop ' + value) || titleLower.includes('pop' + value);
                    if (beforePSA || beforePOP) {
                        continue;
                    }
                }
                
                // Skip year fragments and parts of year ranges
                if (value === '23' || value === '24' || value === '25' || value === '26' || value === '27' || value === '28' || value === '29' || value === '30' || value === '31' || value === '32' || value === '33' || value === '34' || value === '35' || value === '36' || value === '37' || value === '38' || value === '39' || value === '40' || value === '41' || value === '42' || value === '43' || value === '44' || value === '45' || value === '46' || value === '47' || value === '48' || value === '49' || value === '50' || value === '51' || value === '52' || value === '53' || value === '54' || value === '55' || value === '56' || value === '57' || value === '58' || value === '59' || value === '60' || value === '61' || value === '62' || value === '63' || value === '64' || value === '65' || value === '66' || value === '67' || value === '68' || value === '69' || value === '70' || value === '71' || value === '72' || value === '73' || value === '74' || value === '75' || value === '76' || value === '77' || value === '78' || value === '79' || value === '80' || value === '81' || value === '82' || value === '83' || value === '84' || value === '85' || value === '86' || value === '87' || value === '88' || value === '89' || value === '90' || value === '91' || value === '92' || value === '93' || value === '94' || value === '95' || value === '96' || value === '97' || value === '98' || value === '99' || value === '2022' || value === '2023' || value === '2024' || value === '2025') {
                    // Check if this number is part of a year range in the title
                    const yearRangePattern = /\b(19[0-9]{2}-[0-9]{2}|20[0-9]{2}-[0-9]{2})\b/;
                    const yearMatch = title.match(yearRangePattern);
                    if (yearMatch && yearMatch[0].includes(value)) {
                        continue; // Skip if it's part of a year range
                    }
                    
                    // Check if this number appears near a year (like "2021 32" or "32 2021")
                    const yearPattern = /\b(19[0-9]{2}|20[0-9]{2})\b/;
                    const yearMatches = title.match(yearPattern);
                    if (yearMatches) {
                        const yearIndex = title.indexOf(yearMatches[0]);
                        const numberIndex = title.indexOf(value);
                        const distance = Math.abs(yearIndex - numberIndex);
                        if (distance <= 10) { // If the number is close to a year, it's likely a year fragment
                            continue;
                        }
                    }
                    
                    // If it's not near a year, don't skip it - it might be a card number
                }
                
                // Skip if this number is part of a print run (like /5, /150)
                if (value.match(/^\d+$/) && title.includes('/' + value)) {
                    continue;
                }
                
                // Skip if this number appears right after a / (print run)
                const beforeNumber = title.substring(0, title.indexOf(value));
                if (beforeNumber.endsWith('/') || beforeNumber.endsWith('/ ')) {
                    // But don't skip if it's a card number with letters (like #CDA-LK)
                    if (!value.startsWith('#') || !value.match(/^#[A-Za-z]/)) {
                        continue;
                    }
                }
                
                // Handle standalone numbers that are likely card numbers
                if (value.match(/^\d+$/)) {
                    // Check if this number appears in any card number pattern
                    const cardNumberPattern = new RegExp(`#[A-Za-z0-9-]*${value}[A-Za-z0-9-]*`, 'g');
                    if (cardNumberPattern.test(title)) {
                        continue;
                    }
                    
                    // If it's a standalone number that's not a PSA grade and not part of a card number,
                    // it's likely a card number, so add the # prefix
                    if (!foundTerms.has('#' + value)) {
                        found.push('#' + value);
                        foundTerms.add('#' + value);
                    }
                    continue;
                }
                
                // Skip if this term is part of the product name
                const valueLower = value.toLowerCase();
                if (productLower && productLower.includes(valueLower)) {
                    continue;
                }
                
                // Skip if this term is part of the player name
                if (player && player.toLowerCase().includes(valueLower)) {
                    continue;
                }
                
                // Skip "Prizm" if it's part of the product name (to avoid duplication)
                if (valueLower === 'prizm' && productLower && productLower.includes('prizm')) {
                    continue;
                }
                
                // Skip "Edition" if it's part of a product name that contains "Edition"
                if (valueLower === 'edition' && (productLower.includes('edition') || title.toLowerCase().includes('bowman sapphire edition'))) {
                    continue;
                }
                
                // Skip "Chrome Prospects" if it's part of a Bowman product
                if (valueLower === 'chrome prospects' && (productLower.includes('chrome prospects') || title.toLowerCase().includes('bowman chrome prospects'))) {
                    continue;
                }
                
                // Skip "Prospects" if it's part of a Bowman product
                if (valueLower === 'prospects' && (productLower.includes('prospects') || title.toLowerCase().includes('bowman chrome prospects') || title.toLowerCase().includes('bowman prospects'))) {
                    continue;
                }
                
                // Skip "Chrome" if it's part of a Chrome product or if we have a Chrome product
                if (valueLower === 'chrome' && (productLower.includes('chrome') || title.toLowerCase().includes('bowman chrome') || title.toLowerCase().includes('topps chrome'))) {
                    continue;
                }
                
                // Skip "Chrome" if it appears in multi-word patterns that contain "Chrome" and the product already has "Chrome"
                if (value.includes(' ') && value.toLowerCase().includes('chrome') && productLower && productLower.includes('chrome')) {
                    // Extract the non-Chrome part of the pattern
                    const nonChromeParts = value.split(' ').filter(word => word.toLowerCase() !== 'chrome');
                    if (nonChromeParts.length > 0) {
                        // Add only the non-Chrome parts
                        const nonChromeValue = nonChromeParts.join(' ');
                        if (!foundTerms.has(nonChromeValue)) {
                            found.push(nonChromeValue);
                            foundTerms.add(nonChromeValue);
                            // Mark individual words as used
                            nonChromeParts.forEach(word => usedWords.add(word.toLowerCase()));
                        }
                    }
                    continue;
                }
                
                // Skip "Prizm" if it appears in multi-word patterns that contain "Prizm" and the product already has "Prizm"
                if (value.includes(' ') && value.toLowerCase().includes('prizm') && productLower && productLower.includes('prizm')) {
                    // Extract the non-Prizm part of the pattern
                    const nonPrizmParts = value.split(' ').filter(word => word.toLowerCase() !== 'prizm');
                    if (nonPrizmParts.length > 0) {
                        // Add only the non-Prizm parts
                        const nonPrizmValue = nonPrizmParts.join(' ');
                        if (!foundTerms.has(nonPrizmValue)) {
                            found.push(nonPrizmValue);
                            foundTerms.add(nonPrizmValue);
                            // Mark individual words as used
                            nonPrizmParts.forEach(word => usedWords.add(word.toLowerCase()));
                        }
                    }
                    continue;
                }
                
                // Skip "Mosaic" if it appears in multi-word patterns that contain "Mosaic" and the product already has "Mosaic"
                if (value.includes(' ') && value.toLowerCase().includes('mosaic') && productLower && productLower.includes('mosaic')) {
                    // Extract the non-Mosaic part of the pattern
                    const nonMosaicParts = value.split(' ').filter(word => word.toLowerCase() !== 'mosaic');
                    if (nonMosaicParts.length > 0) {
                        // Add only the non-Mosaic parts
                        const nonMosaicValue = nonMosaicParts.join(' ');
                        if (!foundTerms.has(nonMosaicValue)) {
                            found.push(nonMosaicValue);
                            foundTerms.add(nonMosaicValue);
                            // Mark individual words as used
                            nonMosaicParts.forEach(word => usedWords.add(word.toLowerCase()));
                        }
                    }
                    continue;
                }
                
                // Skip "Draft" if it appears in multi-word patterns and the product already has "Draft"
                if (value.includes(' ') && value.toLowerCase().includes('draft') && productLower && productLower.includes('draft')) {
                    // Extract the non-Draft part of the pattern
                    const nonDraftParts = value.split(' ').filter(word => word.toLowerCase() !== 'draft');
                    if (nonDraftParts.length > 0) {
                        // Add only the non-Draft parts
                        const nonDraftValue = nonDraftParts.join(' ');
                        if (!foundTerms.has(nonDraftValue)) {
                            found.push(nonDraftValue);
                            foundTerms.add(nonDraftValue);
                            // Mark individual words as used
                            nonDraftParts.forEach(word => usedWords.add(word.toLowerCase()));
                        }
                    }
                    continue;
                }
                
                // Skip terms that should be excluded from summary titles
                if (['SP', 'sp', 'SSP', 'ssp'].includes(value)) {
                    continue;
                }
                
                // Skip SSP completely (it's not a card number, it's a designation)
                if (value === 'SSP' || value === 'ssp') {
                    continue;
                }
                
                // Skip print runs (like /5, /150) - these are not card numbers
                // REMOVED: Print runs are important information and should be included
                // if (value.startsWith('/') || (value.match(/^\d+$/) && title.includes('/' + value))) {
                //     continue;
                // }
                
                // Skip card numbers that are actually print runs (like #5 when there's /5 in the title)
                if (value.startsWith('#') && value.match(/^#\d+$/)) {
                    const numberPart = value.substring(1);
                    if (title.includes('/' + numberPart)) {
                        continue;
                    }
                }
                
                // Skip if we've already found this exact term
                if (foundTerms.has(value)) {
                    continue;
                }
                
                // Skip if this is a subset of an already found term (e.g., skip #168 if #BDC-168 is already found)
                if (value.startsWith('#')) {
                    let skipThis = false;
                    for (const foundTerm of foundTerms) {
                        if (foundTerm.startsWith('#') && foundTerm.length > value.length && foundTerm.includes(value.substring(1))) {
                            skipThis = true;
                            break;
                        }
                    }
                    if (skipThis) {
                        continue;
                    }
                }
                
                // Skip if we've already found this number with # formatting
                if (value.match(/^\d{1,3}$/) && foundTerms.has('#' + value)) {
                    continue;
                }
                
                // Skip if we've already found this number without # formatting
                if (value.startsWith('#') && foundTerms.has(value.substring(1))) {
                    continue;
                }
                
                // Skip if we've already found a similar card number (e.g., #17 and #17hh)
                if (value.startsWith('#')) {
                    const baseNumber = value.replace(/[A-Za-z]/g, '');
                    // Check if we already have a more specific version (e.g., #17hh when we're looking at #17)
                    let hasMoreSpecific = false;
                    for (const foundTerm of foundTerms) {
                        if (foundTerm.startsWith('#' + baseNumber) && foundTerm.length > value.length) {
                            hasMoreSpecific = true;
                            break;
                        }
                    }
                    if (hasMoreSpecific) {
                        continue;
                    }
                    // Check if we already have the base number
                    const hasBaseNumber = foundTerms.has(baseNumber) || foundTerms.has('#' + baseNumber);
                    if (hasBaseNumber) {
                        continue;
                    }
                    // Check if we already have a more specific version of this number
                    const moreSpecificPattern = new RegExp('^#' + baseNumber + '[A-Za-z]+$');
                    let skipThis = false;
                    for (const foundTerm of foundTerms) {
                        if (moreSpecificPattern.test(foundTerm)) {
                            skipThis = true;
                            break;
                        }
                    }
                    if (skipThis) {
                        continue;
                    }
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
                        // Add # formatting to standalone card numbers (1-3 digits)
                        if (/^\d{1,3}$/.test(value) && !value.startsWith('#')) {
                            found.push('#' + value);
                            foundTerms.add('#' + value);
                        } else {
                            found.push(match[0]);
                            foundTerms.add(value);
                        }
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
        if (player) parts.push(player);
        if (product) parts.push(product);
        if (colorNumbering) parts.push(colorNumbering);
        if (hasAuto) parts.push('Auto');

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
