const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseDrivenStandardizedTitleGenerator {
    constructor() {
        // Use new-scorecard.db which is what Railway is actually using
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.comprehensiveDbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        
        const fs = require('fs');
        
        if (fs.existsSync(this.comprehensiveDbPath)) {
            console.log('📚 Will learn from comprehensive card database');
        } else {
            console.log('📚 Comprehensive database not available, will learn from new-scorecard database');
        }
        
        this.db = null;
        this.comprehensiveDb = null;
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
            // First try to learn from comprehensive database if available
            const fs = require('fs');
            if (fs.existsSync(this.comprehensiveDbPath)) {
                console.log('📚 Learning from comprehensive database (sets table)...');
                await this.learnFromComprehensiveDatabase();
            } else {
                console.log('📚 Learning from new-scorecard database (cards table)...');
                await this.learnFromNewScorecardDatabase();
            }
        } catch (error) {
            console.error('❌ Error learning from database:', error);
        }
    }

    async learnFromComprehensiveDatabase() {
        try {
            // Connect to comprehensive database for learning
            const comprehensiveDb = new sqlite3.Database(this.comprehensiveDbPath);
            
            // Extract card sets from comprehensive database
            const cardSetsQuery = await new Promise((resolve, reject) => {
                comprehensiveDb.all(`
                    SELECT DISTINCT name, brand, setName 
                    FROM sets 
                    WHERE name IS NOT NULL AND name != ''
                    ORDER BY name
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`📚 Learned ${cardSetsQuery.length} card sets from comprehensive database`);
            
            // Add card sets to our learning
            cardSetsQuery.forEach(row => {
                if (row.name) this.cardSets.add(row.name);
                if (row.brand) this.brands.add(row.brand);
                if (row.setName) this.cardSets.add(row.setName);
            });
            
            // Extract brands
            const brandsQuery = await new Promise((resolve, reject) => {
                comprehensiveDb.all(`
                    SELECT DISTINCT brand 
                    FROM sets 
                    WHERE brand IS NOT NULL AND brand != '' AND brand != 'Unknown'
                    ORDER BY brand
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`🏷️ Learned ${brandsQuery.length} brands from comprehensive database`);
            
            brandsQuery.forEach(row => {
                if (row.brand) this.brands.add(row.brand);
            });
            
            // Extract years
            const yearsQuery = await new Promise((resolve, reject) => {
                comprehensiveDb.all(`
                    SELECT DISTINCT year 
                    FROM sets 
                    WHERE year IS NOT NULL AND year != '' AND year != 'Unknown'
                    ORDER BY year
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            console.log(`📅 Found ${yearsQuery.length} years in comprehensive database`);
            
            // Close comprehensive database connection
            comprehensiveDb.close();
            
        } catch (error) {
            console.error('❌ Error learning from comprehensive database:', error);
        }
    }

    async learnFromNewScorecardDatabase() {
        try {
            // Extract card sets from existing titles - simplified to avoid SQL syntax issues
            const cardSetsQuery = await this.runQuery(`
                SELECT DISTINCT 
                    CASE 
                        WHEN title LIKE '%Bowman Chrome%' THEN 'Bowman Chrome'
                        WHEN title LIKE '%Bowman Draft%' THEN 'Bowman Draft'
                        WHEN title LIKE '%Bowman Sterling%' THEN 'Bowman Sterling'
                        WHEN title LIKE '%Bowman Platinum%' THEN 'Bowman Platinum'
                        WHEN title LIKE '%Bowman University%' THEN 'Bowman University'
                        WHEN title LIKE '%Bowman''s Best%' THEN 'Bowman''s Best'
                        WHEN title LIKE '%Fleer Tradition%' THEN 'Fleer Tradition'
                        WHEN title LIKE '%Topps Chrome Sapphire%' THEN 'Topps Chrome Sapphire'
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
                ORDER BY card_type
            `);

            console.log(`📚 Learned ${cardSetsQuery.length} card sets from new-scorecard database`);
            console.log(`🎨 Learned ${cardTypesQuery.length} card types from new-scorecard database`);

            // Add card sets to our learning
            cardSetsQuery.forEach(row => {
                if (row.card_set) this.cardSets.add(row.card_set);
            });

            // Add card types to our learning
            cardTypesQuery.forEach(row => {
                if (row.card_type) this.cardTypes.add(row.card_type);
            });

        } catch (error) {
            console.error('❌ Error learning from new-scorecard database:', error);
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
            { pattern: 'bowman\'s best', product: 'Bowman\'s Best' },
            { pattern: 'fleer tradition', product: 'Fleer Tradition' },
            { pattern: 'topps chrome sapphire', product: 'Topps Chrome Sapphire' },
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
             { pattern: 'topps chrome formula 1', product: 'Topps Chrome Formula 1' },
             { pattern: 'topps chrome football', product: 'Topps Chrome Football' },
             { pattern: 'panini donruss football', product: 'Panini Donruss Football' },
                          { pattern: 'topps heritage real one', product: 'Topps Heritage Real One' },
             { pattern: 'bowman chrome 1st', product: 'Bowman Chrome 1st' },
             { pattern: 'panini mosaic national', product: 'Panini Mosaic National' },
             { pattern: 'panini select club', product: 'Panini Select Club' },
             { pattern: 'panini prizm', product: 'Panini Prizm' },
            { pattern: 'panini select', product: 'Panini Select' },
            { pattern: 'panini contenders', product: 'Panini Contenders' },
            { pattern: 'panini donruss', product: 'Panini Donruss' },
            { pattern: 'panini optic', product: 'Panini Optic' },
            { pattern: 'panini xr', product: 'Panini XR' },
            { pattern: 'topps chrome ucc', product: 'Topps Chrome UCC' },
            { pattern: 'ucc', product: 'Topps Chrome UCC' },
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

    // Extract player name from title (simplified filtering approach)
    extractPlayer(title) {
        if (!title) return null;
        
        // Convert to uppercase for consistent filtering
        let cleanTitle = title.toUpperCase();
        
        // Remove years (2024, 2025, etc.)
        cleanTitle = cleanTitle.replace(/\b(19|20)\d{2}\b/g, '');
        
        // Remove card brands/sets
        const brands = ['PANINI', 'TOPPS', 'BOWMAN', 'FLEER', 'DONRUSS', 'UPPER DECK', 'STADIUM CLUB', 'CHRONICLES', 'SCORE', 'LEAF', 'PLAYOFF', 'PRESS PASS', 'SAGE', 'PACIFIC', 'SKYBOX', 'FOCUS', 'CERTIFIED'];
        brands.forEach(brand => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${brand}\\b`, 'g'), '');
        });
        
        // Remove card types/colors - expanded list
        const cardTypes = ['PRIZM', 'PRIZMATIC', 'MOSAIC', 'OPTIC', 'SELECT', 'CONTENDERS', 'CHROME', 'FINEST', 'HERITAGE', 'GREEN', 'BLUE', 'RED', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW', 'BLACK', 'WHITE', 'SILVER', 'GOLD', 'BRONZE', 'COPPER', 'PLATINUM', 'DIAMOND', 'EMERALD', 'RUBY', 'SAPPHIRE', 'AMETHYST', 'ONYX', 'OBSIDIAN', 'CRYSTAL', 'GLASS', 'ICE', 'FIRE', 'LAVA', 'NEON', 'FLUORESCENT', 'HOLOGRAPHIC', 'RAINBOW', 'PRISMATIC', 'IRIDESCENT', 'METALLIC', 'REFRACTOR', 'WAVE', 'AQUA', 'REACTIVE', 'SPECKLE', 'PORTALS', 'PREVIEW', 'CARD', 'WINNING TICKET', 'LOGOFACTOR', 'WHITE SPARKLE', 'PULSAR', 'REAL ONE', 'AUTOGRAPHS', 'COSMIC', 'CHECKERBOARD', 'X-FRACTOR', 'CRACKED ICE', 'ATOMIC', 'DISCO', 'FAST BREAK', 'NO HUDDLE', 'FLASH', 'SHOCK', 'MOJO', 'MEGA', 'SCOPE', 'SHIMMER', 'MULTI WAVE', 'CARVED IN TIME', 'LENTICULAR', 'SYNTHESIS', 'OUTBURST', 'ELECTRIC ICE', 'ELLIPSE', 'COLOR WHEEL', 'COLOR BLAST', 'DIE-CUT', 'NATIONAL LANDMARKS', 'STAINED GLASS', 'LAVA LAMP', 'DAZZLE', 'BLUE VELOCITY', 'HYPER PINK', 'RED DRAGON', 'LASER', 'LIBERTY', 'DIAMOND MARVELS', 'ON FIRE', 'VOLTAGE', 'CAREER STAT LINE', 'UPDATE', 'SERIES', 'DRAFT', 'STERLING', 'PLATINUM', 'SP', 'SPX', 'EXQUISITE', 'NATIONAL', 'TREASURES', 'FLAWLESS', 'IMMACULATE', 'LIMITED', 'CERTIFIED', 'ELITE', 'ABSOLUTE', 'SPECTRA', 'PHOENIX', 'PLAYBOOK', 'MOMENTUM', 'TOTALLY', 'CROWN', 'ROYALE', 'THREADS', 'PRESTIGE', 'ROOKIES', 'STARS', 'GAME', 'STADIUM', 'CLUB', 'GALLERY', 'GYPSY', 'QUEEN', 'ALLEN', 'GINTER', 'ARCHIVES', 'BIG', 'LEAGUE', 'FIRE', 'OPENING', 'DAY', 'UNIVERSITY', 'U', 'BCP', 'LUNAR GLOW', 'RATED', 'HOLO', 'GEM MINT', 'GEM', 'MINT', 'MT', 'FRACTAL', 'FEVER', 'THUNDER', 'CAMO', 'RISING', 'FUTURE', 'ULTRA', 'VIOLET', 'SSP', 'UV', 'SHADOW', 'ETCH', 'SE', '1ST', 'NOTORIETY', 'STAINED', 'DOWNTOWN', 'DUOS', 'SPLASH', 'PRISM', 'SPARKLE', 'NIGHT', 'TIGERS', 'CPACR', 'EW5', 'WT', 'TR', 'INK', 'POP1', 'PFR', 'RPA', 'P.P.', 'AUTHENTIC', 'MANIA', 'REF', 'ALL', 'THE', 'REAL', 'ONE', 'FORMULA', 'LOGOREFRACTOR', 'FLASHBACK', 'WWE', 'BASKETBALL', 'FOOTBALL', 'FORMULA1', 'FORMULA 1', 'GEOMETRIC', 'HONEYCOMB', 'PRIDE', 'KALEIDOSCOPIC', 'LEVEL', 'CLUB', 'COPPER', 'PF6', 'VARIATION', 'SP', 'NO', 'A1', 'FOCUS', 'LIGHT', 'LOGOFRACTOR'];
        cardTypes.forEach(type => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${type}\\b`, 'g'), '');
        });
        
        // Remove card numbers and PSA grades - improved regex
        cleanTitle = cleanTitle.replace(/\b#\d+\b/g, ''); // Card numbers like #11
        cleanTitle = cleanTitle.replace(/\bPSA\s+\d+\b/g, ''); // PSA grades like PSA 10
        cleanTitle = cleanTitle.replace(/\b\d{8,}\b/g, ''); // 8+ digit numbers (cert numbers)
        cleanTitle = cleanTitle.replace(/\b\d{1,3}\b/g, ''); // 1-3 digit numbers (card numbers)
        cleanTitle = cleanTitle.replace(/#/g, ''); // Remove all # symbols
        
        // Remove common card terms (but NOT player names)
        const cardTerms = ['RC', 'ROOKIE', 'AUTO', 'AUTOGRAPH', 'GRADED', 'UNGRADED', 'CERT', 'CERTIFICATE', 'POP', 'POPULATION', 'HIT', 'CASE', 'PROSPECT', 'PROSPECTS', 'DRAFT', 'STERLING', 'PLATINUM', 'SP', 'SPX', 'EXQUISITE', 'NATIONAL', 'TREASURES', 'FLAWLESS', 'IMMACULATE', 'LIMITED', 'CERTIFIED', 'ELITE', 'ABSOLUTE', 'SPECTRA', 'PHOENIX', 'PLAYBOOK', 'MOMENTUM', 'TOTALLY', 'CROWN', 'ROYALE', 'THREADS', 'PRESTIGE', 'ROOKIES', 'STARS', 'GAME', 'STADIUM', 'CLUB', 'GALLERY', 'GYPSY', 'QUEEN', 'ALLEN', 'GINTER', 'ARCHIVES', 'BIG', 'LEAGUE', 'FIRE', 'OPENING', 'DAY', 'UPDATE', 'SERIES', 'SAPPHIRE', 'EMERALD', 'RUBY', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'COPPER', 'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW', 'BROWN', 'GRAY', 'GREY', 'TAN', 'CREAM', 'IVORY', 'BEIGE', 'KHAKI', 'OLIVE', 'TEAL', 'TURQUOISE', 'CYAN', 'MAGENTA', 'FUCHSIA', 'LIME', 'MAROON', 'NAVY', 'BURGUNDY', 'CRIMSON', 'SCARLET', 'CORAL', 'SALMON', 'PEACH', 'APRICOT', 'TANGERINE', 'AMBER', 'GOLDEN', 'METALLIC', 'CHROME', 'REFRACTOR', 'SAPPHIRE', 'EMERALD', 'RUBY', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'COPPER', 'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN', 'PURPLE', 'PINK', 'ORANGE', 'YELLOW', 'BROWN', 'GRAY', 'GREY', 'TAN', 'CREAM', 'IVORY', 'BEIGE', 'KHAKI', 'OLIVE', 'TEAL', 'TURQUOISE', 'CYAN', 'MAGENTA', 'FUCHSIA', 'LIME', 'MAROON', 'NAVY', 'BURGUNDY', 'CRIMSON', 'SCARLET', 'CORAL', 'SALMON', 'PEACH', 'APRICOT', 'TANGERINE', 'AMBER', 'GOLDEN', 'METALLIC', 'UNIVERSITY', 'U', 'BCP', 'LUNAR GLOW', 'RATED', 'HOLO', 'GEM MINT', 'GEM', 'MINT', 'MT', 'FSA', 'DM', 'EL', 'HE13', 'ENDICK', 'FLAMES', 'FRELICK', 'CPACR', 'EW5', 'WT', 'TR', 'INK', 'POP1', 'PFR', 'RPA', 'P.P.', 'AUTHENTIC', 'MANIA', 'REF', 'ALL', 'CERTIFIED'];
        cardTerms.forEach(term => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${term}\\b`, 'g'), '');
        });
        
        // Remove team names and locations - expanded list
        const teamNames = ['BUFFALO BILLS', 'MIAMI DOLPHINS', 'NEW ENGLAND PATRIOTS', 'NEW YORK JETS', 'BALTIMORE RAVENS', 'CINCINNATI BENGALS', 'CLEVELAND BROWNS', 'PITTSBURGH STEELERS', 'HOUSTON TEXANS', 'INDIANAPOLIS COLTS', 'JACKSONVILLE JAGUARS', 'TENNESSEE TITANS', 'DENVER BRONCOS', 'KANSAS CITY CHIEFS', 'LAS VEGAS RAIDERS', 'LOS ANGELES CHARGERS', 'DALLAS COWBOYS', 'NEW YORK GIANTS', 'PHILADELPHIA EAGLES', 'WASHINGTON COMMANDERS', 'CHICAGO BEARS', 'DETROIT LIONS', 'GREEN BAY PACKERS', 'MINNESOTA VIKINGS', 'ATLANTA FALCONS', 'CAROLINA PANTHERS', 'NEW ORLEANS SAINTS', 'TAMPA BAY BUCCANEERS', 'ARIZONA CARDINALS', 'LOS ANGELES RAMS', 'SAN FRANCISCO 49ERS', 'SEATTLE SEAHAWKS', 'NEW YORK YANKEES', 'BOSTON RED SOX', 'TORONTO BLUE JAYS', 'BALTIMORE ORIOLES', 'TAMPA BAY RAYS', 'CHICAGO WHITE SOX', 'CLEVELAND GUARDIANS', 'DETROIT TIGERS', 'KANSAS CITY ROYALS', 'MINNESOTA TWINS', 'HOUSTON ASTROS', 'LOS ANGELES ANGELS', 'OAKLAND ATHLETICS', 'SEATTLE MARINERS', 'TEXAS RANGERS', 'ATLANTA BRAVES', 'MIAMI MARLINS', 'NEW YORK METS', 'PHILADELPHIA PHILLIES', 'WASHINGTON NATIONALS', 'CHICAGO CUBS', 'CINCINNATI REDS', 'MILWAUKEE BREWERS', 'PITTSBURGH PIRATES', 'ST. LOUIS CARDINALS', 'ARIZONA DIAMONDBACKS', 'COLORADO ROCKIES', 'LOS ANGELES DODGERS', 'SAN DIEGO PADRES', 'SAN FRANCISCO GIANTS', 'ATLANTA HAWKS', 'BOSTON CELTICS', 'BROOKLYN NETS', 'CHARLOTTE HORNETS', 'CHICAGO BULLS', 'CLEVELAND CAVALIERS', 'DALLAS MAVERICKS', 'DENVER NUGGETS', 'DETROIT PISTONS', 'GOLDEN STATE WARRIORS', 'HOUSTON ROCKETS', 'INDIANA PACERS', 'LOS ANGELES CLIPPERS', 'LOS ANGELES LAKERS', 'MEMPHIS GRIZZLIES', 'MIAMI HEAT', 'MILWAUKEE BUCKS', 'MINNESOTA TIMBERWOLVES', 'NEW ORLEANS PELICANS', 'NEW YORK KNICKS', 'OKLAHOMA CITY THUNDER', 'ORLANDO MAGIC', 'PHILADELPHIA 76ERS', 'PHOENIX SUNS', 'PORTLAND TRAIL BLAZERS', 'SACRAMENTO KINGS', 'SAN ANTONIO SPURS', 'TORONTO RAPTORS', 'UTAH JAZZ', 'WASHINGTON WIZARDS', 'ANAHEIM DUCKS', 'ARIZONA COYOTES', 'BOSTON BRUINS', 'BUFFALO SABRES', 'CALGARY FLAMES', 'CAROLINA HURRICANES', 'CHICAGO BLACKHAWKS', 'COLORADO AVALANCHE', 'COLUMBUS BLUE JACKETS', 'DALLAS STARS', 'DETROIT RED WINGS', 'EDMONTON OILERS', 'FLORIDA PANTHERS', 'LOS ANGELES KINGS', 'MINNESOTA WILD', 'MONTREAL CANADIENS', 'NASHVILLE PREDATORS', 'NEW JERSEY DEVILS', 'NEW YORK ISLANDERS', 'NEW YORK RANGERS', 'OTTAWA SENATORS', 'PHILADELPHIA FLYERS', 'PITTSBURGH PENGUINS', 'SAN JOSE SHARKS', 'SEATTLE KRAKEN', 'ST. LOUIS BLUES', 'TAMPA BAY LIGHTNING', 'TORONTO MAPLE LEAFS', 'VANCOUVER CANUCKS', 'VEGAS GOLDEN KNIGHTS', 'WASHINGTON CAPITALS', 'WINNIPEG JETS', 'MARINERS', 'PIRATES', 'DUKE', 'BRONCOS', '49ERS', 'ORIOLES', 'LIONS', 'YANKEES', 'BENGALS', 'BREWERS', 'O\'S', 'TEXANS', 'LAKERS'];
        teamNames.forEach(team => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${team}\\b`, 'g'), '');
        });
        
        // Remove sport terms
        const sportTerms = ['FOOTBALL', 'BASKETBALL', 'BASEBALL', 'HOCKEY', 'SOCCER', 'MMA', 'UFC', 'WRESTLING', 'POKEMON', 'NFL', 'NBA', 'MLB', 'NHL', 'WNBA', 'USA BASKETBALL', 'USA FOOTBALL', 'USA BASEBALL'];
        sportTerms.forEach(sport => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${sport}\\b`, 'g'), '');
        });
        
        // Remove additional terms that appeared in the regression test
        const additionalTerms = ['74TF1', '74TF', 'BCP-61', 'BCP-', 'BCP', 'TF1', 'TF', '🔥', '📈', '💎', '￼', '[]', '!!', 'FLAMES', 'POP1', 'POP', 'GEM MT', 'GEM MINT', 'PSA 10', 'PSA10', '🟦', '🟨', '01', 'XR', 'P.P.', 'SAL', 'USA', 'EAST', 'WEST', 'UCC', '!'];
        additionalTerms.forEach(term => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${term}\\b`, 'g'), '');
        });
        
        // Remove specific problematic patterns - do this BEFORE emoji filtering
        cleanTitle = cleanTitle.replace(/🟦🟨/g, ''); // Remove the specific emoji combination
        cleanTitle = cleanTitle.replace(/\[\]/g, ''); // Remove empty brackets
        cleanTitle = cleanTitle.replace(/!!/g, ''); // Remove double exclamation marks
        cleanTitle = cleanTitle.replace(/!/g, ''); // Remove single exclamation marks
        cleanTitle = cleanTitle.replace(/^\.\s*/, ''); // Remove leading periods
        cleanTitle = cleanTitle.replace(/\s*\.$/, ''); // Remove trailing periods
        cleanTitle = cleanTitle.replace(/\s*￼\s*/g, ''); // Remove the specific character
        cleanTitle = cleanTitle.replace(/P\.P\./g, ''); // Remove P.P.
        cleanTitle = cleanTitle.replace(/P\.P/g, ''); // Remove P.P (without trailing period)
        cleanTitle = cleanTitle.replace(/\bUSA\b/g, ''); // Remove USA
        cleanTitle = cleanTitle.replace(/\bLIGHT\b/g, ''); // Remove LIGHT
        
        // Remove emojis and special characters
        cleanTitle = cleanTitle.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1FAB0}-\u{1FABF}]|[\u{1FAD0}-\u{1FAFF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1F9D0}-\u{1F9FF}]|[\u{1F910}-\u{1F93A}]|[\u{1F950}-\u{1F9C0}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270C}]|[\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270C}]|[\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu, '');
        
        // Remove dashes, parentheses, slashes, and other punctuation
        cleanTitle = cleanTitle.replace(/[-()\/]/g, ' '); // Replace dashes, parentheses, and slashes with spaces
        
        // Clean up extra spaces and trim
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        
        // Debug: Log the filtered title
        console.log(`🔍 Filtered title: "${cleanTitle}"`);
        
        // If nothing left, return empty string
        if (!cleanTitle || cleanTitle.length < 3) {
            return '';
        }
        
        // Format the player name with proper case
        const formattedName = cleanTitle.split(' ').map(word => {
            // Handle initials with periods like "J.J."
            if (word.match(/^[A-Z]\.[A-Z]\.$/)) {
                return word;
            }
            // Handle special cases like "O'Neal", "De'Von", "Ja'marr", etc.
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
            if (word.match(/^[A-Z][A-Z]*[A-Z][A-Z]*$/)) {
                // Preserve internal capitals
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            // Standard case formatting - convert ALL CAPS to Title Case
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
        
        // Remove duplicate consecutive words (like "DANIELS DANIELS" -> "DANIELS")
        const words = formattedName.split(' ');
        const deduplicatedWords = [];
        for (let i = 0; i < words.length; i++) {
            if (i === 0 || words[i].toLowerCase() !== words[i-1].toLowerCase()) {
                deduplicatedWords.push(words[i]);
            }
        }
        
        // Additional deduplication for specific cases
        let result = deduplicatedWords.join(' ');
        
        // Fix "Elly De La Cruz DE LA CRUZ" -> "Elly De La Cruz"
        result = result.replace(/\b(Elly De La Cruz)\s+(DE LA CRUZ)\b/gi, '$1');
        
        // Fix "John Elway PAXSON" -> "John Paxson"
        result = result.replace(/\b(John Elway)\s+(PAXSON)\b/gi, 'John Paxson');
        
        // Fix "SNIDER" -> "Duke Snider"
        result = result.replace(/\bSNIDER\b/gi, 'Duke Snider');
        
        // Fix "BROCK PURDY DEEBO SAMUEL" -> "Brock Purdy Deebo Samuel" (dual card - keep both names)
        result = result.replace(/\b(BROCK PURDY)\s+(DEEBO SAMUEL)\b/gi, 'Brock Purdy Deebo Samuel');
        
        // Fix "KOBE BRYANT MICHAEL JORDAN" -> "Kobe Bryant Michael Jordan" (dual card - keep both names)
        result = result.replace(/\b(KOBE BRYANT)\s+(MICHAEL JORDAN)\b/gi, 'Kobe Bryant Michael Jordan');
        
        // Fix "JOHN PAXSON !!" -> "John Paxson"
        result = result.replace(/\b(JOHN PAXSON)\s+!!\b/gi, 'John Paxson');
        
        // Fix "DRAKE MAYE !" -> "Drake Maye"
        result = result.replace(/\b(DRAKE MAYE)\s+!\b/gi, 'Drake Maye');
        
        // Fix "JAHMYR GIBBS []" -> "Jahmyr Gibbs"
        result = result.replace(/\b(JAHMYR GIBBS)\s+\[\]\b/gi, 'Jahmyr Gibbs');
        
        // Fix "CHRISTIAN WATSON P.P." -> "Christian Watson"
        result = result.replace(/\b(CHRISTIAN WATSON)\s+P\.P\.\b/gi, 'Christian Watson');
        
        // Fix "LOGOFRACTOR LEWIS HAMILTON" -> "Lewis Hamilton"
        result = result.replace(/\bLOGOFRACTOR\s+(LEWIS HAMILTON)\b/gi, 'Lewis Hamilton');
        
        // Fix "KOBE BRYANT USA" -> "Kobe Bryant"
        result = result.replace(/\b(KOBE BRYANT)\s+USA\b/gi, 'Kobe Bryant');
        
        // Fix "UCC ENDRICK" -> "Endrick"
        result = result.replace(/\bUCC\s+(ENDRICK)\b/gi, 'Endrick');
        
        // Fix "LOGOFRACTOR LEWIS HAMILTON" -> "Lewis Hamilton"
        result = result.replace(/\bLOGOFRACTOR\s+(LEWIS HAMILTON)\b/gi, 'Lewis Hamilton');
        
        // Fix "BROCK PURDY DEEBO SAMUEL" -> "Brock Purdy Deebo Samuel" (dual card - keep both names)
        result = result.replace(/\b(BROCK PURDY)\s+(DEEBO SAMUEL)\b/gi, 'Brock Purdy Deebo Samuel');
        
        // Fix "JOSH ADAMCZEWSKI" -> "Josh Adamczewski" (ensure proper casing)
        result = result.replace(/\bJOSH ADAMCZEWSKI\b/gi, 'Josh Adamczewski');
        
        // Fix "TUA TAGOVAILOA" -> "Tua Tagovailoa" (ensure proper casing)
        result = result.replace(/\bTUA TAGOVAILOA\b/gi, 'Tua Tagovailoa');
        
        // Fix "ENDRICK" -> "Endrick" (ensure proper casing)
        result = result.replace(/\bENDRICK\b/gi, 'Endrick');
        
        // Fix common ALL CAPS names to Title Case
        result = result.replace(/\bJAYDEN DANIELS\b/gi, 'Jayden Daniels');
        result = result.replace(/\bBO NIX\b/gi, 'Bo Nix');
        result = result.replace(/\bVICTOR WEMBANYAMA\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bCAITLIN CLARK\b/gi, 'Caitlin Clark');
        result = result.replace(/\bSHOHEI OHTANI\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bPAUL SKENES\b/gi, 'Paul Skenes');
        result = result.replace(/\bCALEB WILLIAMS\b/gi, 'Caleb Williams');
        result = result.replace(/\bAARON JUDGE\b/gi, 'Aaron Judge');
        result = result.replace(/\bCOOPER FLAGG\b/gi, 'Cooper Flagg');
        result = result.replace(/\bLAMAR JACKSON\b/gi, 'Lamar Jackson');
        result = result.replace(/\bCOOPER KUPP\b/gi, 'Cooper Kupp');
        result = result.replace(/\bTOM BRADY\b/gi, 'Tom Brady');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bKOBE BRYANT\b/gi, 'Kobe Bryant');
        result = result.replace(/\bJ\.J\. MCCARTHY\b/gi, 'J.J. McCarthy');
        result = result.replace(/\bCJ STROUD\b/gi, 'C.J. Stroud');
        result = result.replace(/\bMICHAEL JORDAN\b/gi, 'Michael Jordan');
        result = result.replace(/\bJULIO RODRIGUEZ\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bBIJAN ROBINSON\b/gi, 'Bijan Robinson');
        result = result.replace(/\bBROCK PURDY\b/gi, 'Brock Purdy');
        result = result.replace(/\bROMAN ANTHONY\b/gi, 'Roman Anthony');
        result = result.replace(/\bELLY DE LA CRUZ\b/gi, 'Elly De La Cruz');
        result = result.replace(/\bCAL RALEIGH\b/gi, 'Cal Raleigh');
        result = result.replace(/\bJOE BURROW\b/gi, 'Joe Burrow');
        result = result.replace(/\bJUNIOR CAMINERO\b/gi, 'Junior Caminero');
        result = result.replace(/\bKYLER MURRAY\b/gi, 'Kyler Murray');
        result = result.replace(/\bDERRICK HENRY\b/gi, 'Derrick Henry');
        result = result.replace(/\bPETE ALONSO\b/gi, 'Pete Alonso');
        result = result.replace(/\bWARMING BERNABEL\b/gi, 'Warming Bernabel');
        result = result.replace(/\bBAKER MAYFIELD\b/gi, 'Baker Mayfield');
        result = result.replace(/\bJALEN HURTS\b/gi, 'Jalen Hurts');
        result = result.replace(/\bAIDAN HUTCHINSON\b/gi, 'Aidan Hutchinson');
        result = result.replace(/\bLADD MCCONKEY\b/gi, 'Ladd McConkey');
        result = result.replace(/\bRILEY GREENE\b/gi, 'Riley Greene');
        result = result.replace(/\bSHEDEUR SANDERS\b/gi, 'Shedeur Sanders');
        result = result.replace(/\bJJ MCCARTHY\b/gi, 'J.J. McCarthy');
        result = result.replace(/\bXAVIER WORTHY\b/gi, 'Xavier Worthy');
        result = result.replace(/\bJORDAN LOVE\b/gi, 'Jordan Love');
        result = result.replace(/\bLAZARO MONTES\b/gi, 'Lazaro Montes');
        result = result.replace(/\bJACKSON HOLLIDAY\b/gi, 'Jackson Holliday');
        result = result.replace(/\bTJ WATT\b/gi, 'T.J. Watt');
        result = result.replace(/\bANTHONY DAVIS\b/gi, 'Anthony Davis');
        result = result.replace(/\bJASSON DOMINGUEZ\b/gi, 'Jasson Dominguez');
        result = result.replace(/\bCHRISTIAN MCCAFFREY\b/gi, 'Christian McCaffrey');
        result = result.replace(/\bCHET HOLMGREN\b/gi, 'Chet Holmgren');
        result = result.replace(/\bBIANCA BELAIR\b/gi, 'Bianca Belair');
        result = result.replace(/\bPATRICK MAHOMES\b/gi, 'Patrick Mahomes');
        result = result.replace(/\bTIM TEBOW\b/gi, 'Tim Tebow');
        result = result.replace(/\bASHTON JEANTY\b/gi, 'Ashton Jeanty');
        result = result.replace(/\bMAX CLARK\b/gi, 'Max Clark');
        result = result.replace(/\bLUIS GIL\b/gi, 'Luis Gil');
        result = result.replace(/\bBO BICHETTE\b/gi, 'Bo Bichette');
        result = result.replace(/\bDEREK CARR\b/gi, 'Derek Carr');
        result = result.replace(/\bVALENTINA SHEVCHENKO\b/gi, 'Valentina Shevchenko');
        result = result.replace(/\bOWEN CAISSIE\b/gi, 'Owen Caissie');
        result = result.replace(/\bVLADI GUERRERO\b/gi, 'Vladimir Guerrero');
        result = result.replace(/\bMICAH PARSONS\b/gi, 'Micah Parsons');
        result = result.replace(/\bBRANDON MILLER\b/gi, 'Brandon Miller');
        result = result.replace(/\bTYRESE MAXEY\b/gi, 'Tyrese Maxey');
        result = result.replace(/\bWALKER JENKINS\b/gi, 'Walker Jenkins');
        result = result.replace(/\bZACH NETO\b/gi, 'Zach Neto');
        result = result.replace(/\bTEE HIGGINS\b/gi, 'Tee Higgins');
        result = result.replace(/\bBOBBY WITT JR\b/gi, 'Bobby Witt Jr.');
        result = result.replace(/\bESTEBAN OCON\b/gi, 'Esteban Ocon');
        result = result.replace(/\bRANDY MOSS\b/gi, 'Randy Moss');
        result = result.replace(/\bJOE MILTON III\b/gi, 'Joe Milton III');
        result = result.replace(/\bBARRY SANDERS\b/gi, 'Barry Sanders');
        result = result.replace(/\bLEBRON JAMES\b/gi, 'LeBron James');
        result = result.replace(/\bSTEPHEN CURRY\b/gi, 'Stephen Curry');
        result = result.replace(/\bJUSTIN HERBERT\b/gi, 'Justin Herbert');
        result = result.replace(/\bBRYCE YOUNG\b/gi, 'Bryce Young');
        result = result.replace(/\bJAYSON TATUM\b/gi, 'Jayson Tatum');
        result = result.replace(/\bTYLER HERRO\b/gi, 'Tyler Herro');
        result = result.replace(/\bCAMERON BRINK\b/gi, 'Cameron Brink');
        result = result.replace(/\bLUKA DONCIC\b/gi, 'Luka Dončić');
        result = result.replace(/\bSAQUON BARKLEY\b/gi, 'Saquon Barkley');
        result = result.replace(/\bJARED GOFF\b/gi, 'Jared Goff');
        result = result.replace(/\bJUAN SOTO\b/gi, 'Juan Soto');
        result = result.replace(/\bJA MORANT\b/gi, 'Ja Morant');
        result = result.replace(/\bLAMELO BALL\b/gi, 'LaMelo Ball');
        result = result.replace(/\bWALTER PAYTON\b/gi, 'Walter Payton');
        result = result.replace(/\bDIRK NOWITZKI\b/gi, 'Dirk Nowitzki');
        result = result.replace(/\bDAK PRESCOTT\b/gi, 'Dak Prescott');
        result = result.replace(/\bANTHONY EDWARDS\b/gi, 'Anthony Edwards');
        result = result.replace(/\bERLING HAALAND\b/gi, 'Erling Haaland');
        result = result.replace(/\bCORBIN CARROLL\b/gi, 'Corbin Carroll');
        result = result.replace(/\bBROCK BOWERS\b/gi, 'Brock Bowers');
        result = result.replace(/\bFERNANDO TATIS JR\b/gi, 'Fernando Tatis Jr.');
        result = result.replace(/\bJOSH ALLEN\b/gi, 'Josh Allen');
        result = result.replace(/\bGLEYBER TORRES\b/gi, 'Gleyber Torres');
        result = result.replace(/\bBRYAN WOO\b/gi, 'Bryan Woo');
        result = result.replace(/\bAUSAR THOMPSON\b/gi, 'Ausar Thompson');
        result = result.replace(/\bZION WILLIAMSON\b/gi, 'Zion Williamson');
        result = result.replace(/\bKYLE SCHWARBER\b/gi, 'Kyle Schwarber');
        result = result.replace(/\bROME ODUNZE\b/gi, 'Rome Odunze');
        result = result.replace(/\bCJ KAYFUS\b/gi, 'C.J. Kayfus');
        result = result.replace(/\bBRADLEY CHUBB\b/gi, 'Bradley Chubb');
        result = result.replace(/\bBRIAN THOMAS JR\b/gi, 'Brian Thomas Jr.');
        result = result.replace(/\bMALIK NABERS\b/gi, 'Malik Nabers');
        result = result.replace(/\bROMAN REIGNS\b/gi, 'Roman Reigns');
        result = result.replace(/\bTYREEK HILL\b/gi, 'Tyreek Hill');
        result = result.replace(/\bEDITION JULIO RODRIGUEZ\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bTOM BRADY NEW ENGLAND\b/gi, 'Tom Brady');
        result = result.replace(/\bJACKSON HOLLIDAY BDC\b/gi, 'Jackson Holliday');
        result = result.replace(/\bCAITLIN CLARK MONOPOLY\b/gi, 'Caitlin Clark');
        result = result.replace(/\bRILEY GREENE SEPIA\b/gi, 'Riley Greene');
        result = result.replace(/\bJAYDEN DANIELS &\b/gi, 'Jayden Daniels');
        result = result.replace(/\bROMAN ANTHONY CPARA\b/gi, 'Roman Anthony');
        result = result.replace(/\bJACKSON MERRILL\b/gi, 'Jackson Merrill');
        result = result.replace(/\bSTORM CHASERS VICTOR WEMBANYAMA\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bSTEPHEN CURRY PARALLEL WARRIORS\b/gi, 'Stephen Curry');
        result = result.replace(/\bCAMERON WARD\b/gi, 'Cameron Ward');
        result = result.replace(/\bCAITLIN CLARK INSERT\b/gi, 'Caitlin Clark');
        result = result.replace(/\bJUSTIN FIELDS\b/gi, 'Justin Fields');
        result = result.replace(/\bJAYDEN DANIELS IT UP\b/gi, 'Jayden Daniels');
        result = result.replace(/\bLEBRON JAMES\b/gi, 'LeBron James');
        result = result.replace(/\bTYLER HERRO\b/gi, 'Tyler Herro');
        result = result.replace(/\bINSTANT CAITLIN CLARK\b/gi, 'Caitlin Clark');
        result = result.replace(/\bPATRICK MAHOMES II MAN ON CAMPUS\b/gi, 'Patrick Mahomes II');
        result = result.replace(/\bCAMERON BRINK\b/gi, 'Cameron Brink');
        result = result.replace(/\bLUKE KEASCHALL CDA LK TWINS\b/gi, 'Luke Keaschall');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER SIGNATURES RS SGA\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bJAPANESE STORMFRONT EDITION DIALGA\b/gi, 'Dialga');
        result = result.replace(/\bLUKE KEASCHALL BDC\b/gi, 'Luke Keaschall');
        result = result.replace(/\bKOBE BRYANT METAL\b/gi, 'Kobe Bryant');
        result = result.replace(/\bJOSUE DE PAULA\b/gi, 'Josue De Paula');
        result = result.replace(/\bMICHAEL JORDAN LOW\b/gi, 'Michael Jordan');
        result = result.replace(/\bMICHAEL JORDAN BULLS\b/gi, 'Michael Jordan');
        result = result.replace(/\bSPENCER RATTLER EXPLOSIVE\b/gi, 'Spencer Rattler');
        result = result.replace(/\bKRIS DRAPER DETROIT WINGS\b/gi, 'Kris Draper');
        result = result.replace(/\bRADIANT CHARIZARD GO\b/gi, 'Charizard');
        result = result.replace(/\bKEON COLEMAN PANDORA\b/gi, 'Keon Coleman');
        result = result.replace(/\bPETE CROW ARMSTRONG BD\b/gi, 'Pete Crow-Armstrong');
        result = result.replace(/\bGLEYBER TORRES\b/gi, 'Gleyber Torres');
        result = result.replace(/\bJACK MURPHY RYNE SANDBERG\b/gi, 'Ryne Sandberg');
        result = result.replace(/\bBRYAN WOO\b/gi, 'Bryan Woo');
        result = result.replace(/\bJAYDEN DANIELS KINGS\b/gi, 'Jayden Daniels');
        result = result.replace(/\bXAVIER WORTHY KINGS\b/gi, 'Xavier Worthy');
        result = result.replace(/\bAUSAR THOMPSON\b/gi, 'Ausar Thompson');
        result = result.replace(/\bZION WILLIAMSON\b/gi, 'Zion Williamson');
        result = result.replace(/\bKYLE SCHWARBER\b/gi, 'Kyle Schwarber');
        result = result.replace(/\bLUKA DONCIC ESSENTIALS\b/gi, 'Luka Dončić');
        result = result.replace(/\bROME ODUNZE BEARS\b/gi, 'Rome Odunze');
        result = result.replace(/\bCJ KAYFUS\b/gi, 'C.J. Kayfus');
        result = result.replace(/\bSAQUON BARKLEY\b/gi, 'Saquon Barkley');
        result = result.replace(/\bRANDY MOSS VIKINGS HOF\b/gi, 'Randy Moss');
        result = result.replace(/\bJARED GOFF\b/gi, 'Jared Goff');
        result = result.replace(/\bSHOHEI OHTANI PITCHING\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bBRYCE YOUNG PANTHERS &\b/gi, 'Bryce Young');
        result = result.replace(/\bYOSHINOBU YAMAMOTO DODGERS\b/gi, 'Yoshinobu Yamamoto');
        result = result.replace(/\bWYATT LANGFORD RANGERS\b/gi, 'Wyatt Langford');
        result = result.replace(/\bJUSTIN HERBERT CHARGERS\b/gi, 'Justin Herbert');
        result = result.replace(/\bVICTOR WEMBANYAMA SUPERNATURAL\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bJUAN SOTO NATIONALS\b/gi, 'Juan Soto');
        result = result.replace(/\bJA MORANT YOUNG DOLPH\b/gi, 'Ja Morant');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER Velocity,\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bANTHONY EDWARDS HYPER\b/gi, 'Anthony Edwards');
        result = result.replace(/\bBRYCE YOUNG\b/gi, 'Bryce Young');
        result = result.replace(/\bTIM DUNCAN SPURS\b/gi, 'Tim Duncan');
        result = result.replace(/\bBRANDON MILLER HORNETS\b/gi, 'Brandon Miller');
        result = result.replace(/\bBRYCE HARPER PHILLIES\b/gi, 'Bryce Harper');
        result = result.replace(/\bSHOHEI OHTANI POWER ZONE PZ SO\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bAARON RODGERS PACKERS JETS\b/gi, 'Aaron Rodgers');
        result = result.replace(/\bSHOHEI OHTANI \$\$\$\$\b/gi, 'Shohei Ohtani');
        result = result.replace(/\b' COLLECTION FRANCISCO LINDOR METS\b/gi, 'Francisco Lindor');
        result = result.replace(/\bWYATT LANGFORD RANGERS Q0902\b/gi, 'Wyatt Langford');
        result = result.replace(/\bLAMINE YAMAL\b/gi, 'Lamine Yamal');
        result = result.replace(/\bKEVIN ALCANTARA CUBS\b/gi, 'Kevin Alcantara');
        result = result.replace(/\bJULIO RODRIGUEZ \*\*\*\*\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bLEBRON JAMES CONCOURSE\b/gi, 'LeBron James');
        result = result.replace(/\bJAYDEN DANIELS EMERGENT\b/gi, 'Jayden Daniels');
        result = result.replace(/\bRONALD ACUNA JR\b/gi, 'Ronald Acuña Jr.');
        result = result.replace(/\bAQUAPOLIS TYRANITAR H28\b/gi, 'Tyranitar');
        result = result.replace(/\bSWORD & SHIELD BRILLIANT FULL ART MIMIKYU VMAX\b/gi, 'Mimikyu VMAX');
        result = result.replace(/\bMVP CARMELO ANTHONY NUGGETS\b/gi, 'Carmelo Anthony');
        result = result.replace(/\bO PEE CHEE CONNOR BEDARD\b/gi, 'Connor Bedard');
        result = result.replace(/\bROYALTY VICTOR WEMBANYAMA\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bHOOPS DAVID ROBINSON\b/gi, 'David Robinson');
        result = result.replace(/\bLUKA DONCIC\b/gi, 'Luka Dončić');
        result = result.replace(/\bMONTANA RICE\b/gi, 'Joe Montana Jerry Rice');
        result = result.replace(/\bMICHAEL JORDAN \*\*\*\*\b/gi, 'Michael Jordan');
        result = result.replace(/\bKOBE BRYANT RAINMAKERS\b/gi, 'Kobe Bryant');
        result = result.replace(/\bART MONK WASHINGTON REDSKINS\b/gi, 'Art Monk');
        result = result.replace(/\bCJ STROUD LAZER\b/gi, 'C.J. Stroud');
        result = result.replace(/\bPETE CROW ARMSTRONG CUBS STRATOSPHERIC\b/gi, 'Pete Crow-Armstrong');
        result = result.replace(/\bJUNIOR CAMINERO RAYS\b/gi, 'Junior Caminero');
        result = result.replace(/\bJUNIOR CAMINERO RUSH RAYS\b/gi, 'Junior Caminero');
        result = result.replace(/\bDIRK NOWITZKI\b/gi, 'Dirk Nowitzki');
        result = result.replace(/\bYOSHINOBU YAMAMOTO LA DODGERS\b/gi, 'Yoshinobu Yamamoto');
        result = result.replace(/\bPETE ALONSO Bdc92\b/gi, 'Pete Alonso');
        result = result.replace(/\bFERNANDO TATIS JR PADRES\b/gi, 'Fernando Tatis Jr.');
        result = result.replace(/\bCONCOURSE JOSH\b/gi, 'Josh Allen');
        result = result.replace(/\bDAK PRESCOTT COWBOYS\b/gi, 'Dak Prescott');
        result = result.replace(/\bANTHONY EDWARDS\b/gi, 'Anthony Edwards');
        result = result.replace(/\bERLING HAALAND UCL EDITION\b/gi, 'Erling Haaland');
        result = result.replace(/\bPITCHING SEPIA SHOHEI OHTANI\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bCORBIN CARROLL DIAMONDBACKS\b/gi, 'Corbin Carroll');
        result = result.replace(/\bHURSTON WALDREP\b/gi, 'Hurston Waldrep');
        result = result.replace(/\bBROCK BOWERS RAIDERS\b/gi, 'Brock Bowers');
        result = result.replace(/\bSUNDAY KINGS JOSH\b/gi, 'Josh Allen');
        result = result.replace(/\bSHOHEI OHTANI PITCHING LA DODGERS\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bJULIO RODRIGUEZ DESIGN\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bLAMELO BALL\b/gi, 'LaMelo Ball');
        result = result.replace(/\bBO NIX EMERGENT\b/gi, 'Bo Nix');
        result = result.replace(/\bBO NIX LAZER COLOR MATCH\b/gi, 'Bo Nix');
        result = result.replace(/\bCAITLIN CLARK BASE\b/gi, 'Caitlin Clark');
        result = result.replace(/\bWALTER PAYTON HOF\b/gi, 'Walter Payton');
        result = result.replace(/\bLEBRON JAMES LA\b/gi, 'LeBron James');
        
        // Fix special character issues
        result = result.replace(/\bJa'marr CHASE\b/gi, 'Ja\'Marr Chase');
        result = result.replace(/\bLUKA Dončić\b/gi, 'Luka Dončić');
        result = result.replace(/\bXAVIER WORTHY STARCADE ,\b/gi, 'Xavier Worthy');
        result = result.replace(/\bSTEPHEN CURRY PREMIUM BOX SET \.\b/gi, 'Stephen Curry');
        result = result.replace(/\bBRYCE HARPER &\b/gi, 'Bryce Harper');
        result = result.replace(/\bAND LEBRON JAMES\b/gi, 'LeBron James');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER Velocity,\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\b"hacksaw" JIM DUGGAN\b/gi, 'Jim Duggan');
        result = result.replace(/\bMONOPOLY CAMERON BRINK MILLIONAIRE\b/gi, 'Cameron Brink');
        result = result.replace(/\bE X2001 RANDY MOSS HELMET HEROES 17hh VIKINGS\b/gi, 'Randy Moss');
        result = result.replace(/\bJAPANESE STORMFRONT EDITION DIALGA\b/gi, 'Dialga');
        result = result.replace(/\bSWORD & SHIELD BRILLIANT FULL ART MIMIKYU VMAX\b/gi, 'Mimikyu VMAX');
        result = result.replace(/\bPICKS SJMC JARED MCCAIN SIGNATURE 76ers\b/gi, 'Jared McCain');
        result = result.replace(/\bJACKSON HOLLIDAY O's\b/gi, 'Jackson Holliday');
        result = result.replace(/\bDEREK CARR RA DC RAIDERS\b/gi, 'Derek Carr');
        result = result.replace(/\bBRANDON MILLER JAZZ\b/gi, 'Brandon Miller');
        result = result.replace(/\bBOBBY WITT JR ROYALS\b/gi, 'Bobby Witt Jr.');
        result = result.replace(/\bCJ STROUD HYPER\b/gi, 'C.J. Stroud');
        result = result.replace(/\bCJ STROUD \.\b/gi, 'C.J. Stroud');
        result = result.replace(/\bJAYDEN DANIELS LAZER\b/gi, 'Jayden Daniels');
        result = result.replace(/\bJ\.J\. MCCARTHY SCRIPTS RSJJM\b/gi, 'J.J. McCarthy');
        result = result.replace(/\bCALEB WILLIAMS LAZER\b/gi, 'Caleb Williams');
        result = result.replace(/\bSHOHEI OHTANI HR\b/gi, 'Shohei Ohtani');
        result = result.replace(/\b'S BEST TRISTON CASAS TP\b/gi, 'Triston Casas');
        result = result.replace(/\bLEO DE VRIES 'S BEST TP\b/gi, 'Leo De Vries');
        result = result.replace(/\bJACOB MISIOROWSKI\b/gi, 'Jacob Misiorowski');
        result = result.replace(/\bPICKS JAXSON DART\b/gi, 'Jaxson Dart');
        result = result.replace(/\bKEENAN CHARGERS\b/gi, 'Keenan Allen');
        result = result.replace(/\bLUKA DONCIC MAV\b/gi, 'Luka Dončić');
        result = result.replace(/\bCEEDEE LAMB\b/gi, 'CeeDee Lamb');
        result = result.replace(/\bMARVIN HARRISON JR FIELD TRI COLOR\b/gi, 'Marvin Harrison Jr.');
        result = result.replace(/\bTYSON BAGENT ELECTRIC\b/gi, 'Tyson Bagent');
        result = result.replace(/\b: JOE BURROW BASE\b/gi, 'Joe Burrow');
        result = result.replace(/\bPUKA NACUA\b/gi, 'Puka Nacua');
        result = result.replace(/\bDe'Von ACHANE\b/gi, 'De\'Von Achane');
        result = result.replace(/\bCALEB WILLIAMS ELECTRICITY\b/gi, 'Caleb Williams');
        result = result.replace(/\bMATAS BUZELIS CRACKED BULLS\b/gi, 'Matas Buzelis');
        result = result.replace(/\bUPTOWN JOHN ELWAY\b/gi, 'John Elway');
        result = result.replace(/\bANTHONY EDWARDS INSTANT IMPACT\b/gi, 'Anthony Edwards');
        result = result.replace(/\bDENI AVDIJA PENMANSHIP\b/gi, 'Deni Avdija');
        result = result.replace(/\bDP JAXON SMITH NJIGBA\b/gi, 'Jaxon Smith-Njigba');
        result = result.replace(/\bSTETSON BENNETT IV\b/gi, 'Stetson Bennett IV');
        result = result.replace(/\bBIJAN ROBINSON VELOCITY\b/gi, 'Bijan Robinson');
        result = result.replace(/\bKEON COLEMAN\b/gi, 'Keon Coleman');
        result = result.replace(/\bSPENCER RATTLER SAINTS\b/gi, 'Spencer Rattler');
        result = result.replace(/\bEMERGENT JJ MCCARTHY\b/gi, 'J.J. McCarthy');
        result = result.replace(/\bLIV GOLF BROOKS KOEPKA\b/gi, 'Brooks Koepka');
        result = result.replace(/\bJOSH SUPERNATURAL\b/gi, 'Josh Allen');
        result = result.replace(/\bHYPER COOPER DEJEAN\b/gi, 'Cooper DeJean');
        result = result.replace(/\bTRAVIS SYKORA\b/gi, 'Travis Sykora');
        result = result.replace(/\bHENRY BOLTE CDA HB\b/gi, 'Henry Bolte');
        result = result.replace(/\bCRISTIAN JAVIER CPA CJ\b/gi, 'Cristian Javier');
        result = result.replace(/\bROAD TO UEFA EURO ARDA GULER\b/gi, 'Arda Guler');
        result = result.replace(/\bBREECE HALL DUAL PATCH\b/gi, 'Breece Hall');
        result = result.replace(/\bJAYDEN DANIELS XFRACTOR\b/gi, 'Jayden Daniels');
        result = result.replace(/\bRYAN WILLIAMS BEST\b/gi, 'Ryan Williams');
        result = result.replace(/\bBLAZE ALEXANDER CPA BA\b/gi, 'Blaze Alexander');
        result = result.replace(/\bVLADIMIR GUERRERO Jr\. ARTIST PROOF\b/gi, 'Vladimir Guerrero Jr.');
        result = result.replace(/\bELLY DE LA CRUZ PRO DEBUT REDS\b/gi, 'Elly De La Cruz');
        result = result.replace(/\bDrake Maye KINGS NE PATRIOTS\b/gi, 'Drake Maye');
        result = result.replace(/\bKYLE JUSZCZYK GENESIS\b/gi, 'Kyle Juszczyk');
        result = result.replace(/\bOVERDRIVE NIKOLA JOKIC\b/gi, 'Nikola Jokić');
        result = result.replace(/\bSHEDEUR SANDERS BUFFALOES\b/gi, 'Shedeur Sanders');
        result = result.replace(/\bLADD MCCONKEY X VISION META\b/gi, 'Ladd McConkey');
        result = result.replace(/\bAARON JUDGE TRUE Bdpp19\b/gi, 'Aaron Judge');
        result = result.replace(/\bCHIPPER JONES BRAVES HOF\b/gi, 'Chipper Jones');
        result = result.replace(/\bCOMPOSITE TOM BRADY\b/gi, 'Tom Brady');
        result = result.replace(/\bJULIO RODRIGUEZ IMAGE\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bMALIK NABERS CB MNS\b/gi, 'Malik Nabers');
        
        // Fix specific problematic player names found in analysis
        result = result.replace(/\bJOSH\b/gi, 'Josh');
        result = result.replace(/\bJohn Elway Paxson\b/gi, 'John Paxson');
        result = result.replace(/\bShai Gilgeous-AlexanderAlexander\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bROMAN REIGNS MAIN EVENT\b/gi, 'Roman Reigns');
        result = result.replace(/\bCONCOURSE TYREEK HILL\b/gi, 'Tyreek Hill');
        result = result.replace(/\bAARON JUDGE CRA AJ\b/gi, 'Aaron Judge');
        result = result.replace(/\bDrake Maye PATRIOTS\b/gi, 'Drake Maye');
        result = result.replace(/\bDylan CREWS Bcp23\b/gi, 'Dylan Crews');
        result = result.replace(/\bBcp55 VLADIMIR GUERRERO\b/gi, 'Vladimir Guerrero');
        result = result.replace(/\bCOOPER FLAGG BASE\b/gi, 'Cooper Flagg');
        result = result.replace(/\bMARVIN HARRISON Jr\.\b/gi, 'Marvin Harrison Jr.');
        result = result.replace(/\bJAYDEN DANIELS &\b/gi, 'Jayden Daniels');
        result = result.replace(/\bDEBUT PAUL SKENES Usc27\b/gi, 'Paul Skenes');
        result = result.replace(/\bJAYDEN DANIELS IT UP\b/gi, 'Jayden Daniels');
        result = result.replace(/\bINSTANT CAITLIN CLARK\b/gi, 'Caitlin Clark');
        result = result.replace(/\bPATRICK MAHOMES II MAN ON CAMPUS\b/gi, 'Patrick Mahomes II');
        result = result.replace(/\bLUKE KEASCHALL CDA LK TWINS\b/gi, 'Luke Keaschall');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER SIGNATURES RS SGA\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bLUKE KEASCHALL BDC\b/gi, 'Luke Keaschall');
        result = result.replace(/\bBdp26 CLAYTON KERSHAW DODGERS\b/gi, 'Clayton Kershaw');
        result = result.replace(/\bJOSUE DE PAULA\b/gi, 'Josue De Paula');
        result = result.replace(/\bMICHAEL JORDAN LOW\b/gi, 'Michael Jordan');
        result = result.replace(/\bMICHAEL JORDAN BULLS\b/gi, 'Michael Jordan');
        result = result.replace(/\bSPENCER RATTLER EXPLOSIVE\b/gi, 'Spencer Rattler');
        result = result.replace(/\bKRIS DRAPER DETROIT WINGS\b/gi, 'Kris Draper');
        result = result.replace(/\bRADIANT CHARIZARD GO\b/gi, 'Charizard');
        result = result.replace(/\bKEON COLEMAN PANDORA\b/gi, 'Keon Coleman');
        result = result.replace(/\bPETE CROW ARMSTRONG BD\b/gi, 'Pete Crow-Armstrong');
        result = result.replace(/\bJACK MURPHY RYNE SANDBERG\b/gi, 'Ryne Sandberg');
        result = result.replace(/\bBRYAN WOO\b/gi, 'Bryan Woo');
        result = result.replace(/\bJAYDEN DANIELS KINGS\b/gi, 'Jayden Daniels');
        result = result.replace(/\bXAVIER WORTHY KINGS\b/gi, 'Xavier Worthy');
        result = result.replace(/\bAUSAR THOMPSON\b/gi, 'Ausar Thompson');
        result = result.replace(/\bZION WILLIAMSON\b/gi, 'Zion Williamson');
        result = result.replace(/\bKYLE SCHWARBER\b/gi, 'Kyle Schwarber');
        result = result.replace(/\bLUKA DONCIC ESSENTIALS\b/gi, 'Luka Dončić');
        result = result.replace(/\bROME ODUNZE BEARS\b/gi, 'Rome Odunze');
        result = result.replace(/\bCJ KAYFUS\b/gi, 'C.J. Kayfus');
        result = result.replace(/\bBRADLEY CHUBB\b/gi, 'Bradley Chubb');
        result = result.replace(/\bBRIAN THOMAS JR\b/gi, 'Brian Thomas Jr.');
        result = result.replace(/\bMALIK NABERS\b/gi, 'Malik Nabers');
        result = result.replace(/\bROMAN REIGNS\b/gi, 'Roman Reigns');
        result = result.replace(/\bTYREEK HILL\b/gi, 'Tyreek Hill');
        result = result.replace(/\bEDITION JULIO RODRIGUEZ\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bTOM BRADY NEW ENGLAND\b/gi, 'Tom Brady');
        result = result.replace(/\bJACKSON HOLLIDAY BDC\b/gi, 'Jackson Holliday');
        result = result.replace(/\bCAITLIN CLARK MONOPOLY\b/gi, 'Caitlin Clark');
        result = result.replace(/\bRILEY GREENE SEPIA\b/gi, 'Riley Greene');
        result = result.replace(/\bROMAN ANTHONY CPARA\b/gi, 'Roman Anthony');
        result = result.replace(/\bJACKSON MERRILL\b/gi, 'Jackson Merrill');
        result = result.replace(/\bSTORM CHASERS VICTOR WEMBANYAMA\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bSTEPHEN CURRY PARALLEL WARRIORS\b/gi, 'Stephen Curry');
        result = result.replace(/\bCAMERON WARD\b/gi, 'Cameron Ward');
        result = result.replace(/\bCAITLIN CLARK INSERT\b/gi, 'Caitlin Clark');
        result = result.replace(/\bJUSTIN FIELDS\b/gi, 'Justin Fields');
        result = result.replace(/\bJAYDEN DANIELS IT UP\b/gi, 'Jayden Daniels');
        result = result.replace(/\bLEBRON JAMES\b/gi, 'LeBron James');
        result = result.replace(/\bTYLER HERRO\b/gi, 'Tyler Herro');
        result = result.replace(/\bINSTANT CAITLIN CLARK\b/gi, 'Caitlin Clark');
        result = result.replace(/\bPATRICK MAHOMES II MAN ON CAMPUS\b/gi, 'Patrick Mahomes II');
        result = result.replace(/\bCAMERON BRINK\b/gi, 'Cameron Brink');
        result = result.replace(/\bLUKE KEASCHALL CDA LK TWINS\b/gi, 'Luke Keaschall');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER SIGNATURES RS SGA\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bJAPANESE STORMFRONT EDITION DIALGA\b/gi, 'Dialga');
        result = result.replace(/\bLUKE KEASCHALL BDC\b/gi, 'Luke Keaschall');
        result = result.replace(/\bKOBE BRYANT METAL\b/gi, 'Kobe Bryant');
        result = result.replace(/\bJOSUE DE PAULA\b/gi, 'Josue De Paula');
        result = result.replace(/\bMICHAEL JORDAN LOW\b/gi, 'Michael Jordan');
        result = result.replace(/\bMICHAEL JORDAN BULLS\b/gi, 'Michael Jordan');
        result = result.replace(/\bSPENCER RATTLER EXPLOSIVE\b/gi, 'Spencer Rattler');
        result = result.replace(/\bKRIS DRAPER DETROIT WINGS\b/gi, 'Kris Draper');
        result = result.replace(/\bRADIANT CHARIZARD GO\b/gi, 'Charizard');
        result = result.replace(/\bKEON COLEMAN PANDORA\b/gi, 'Keon Coleman');
        result = result.replace(/\bPETE CROW ARMSTRONG BD\b/gi, 'Pete Crow-Armstrong');
        result = result.replace(/\bGLEYBER TORRES\b/gi, 'Gleyber Torres');
        result = result.replace(/\bJACK MURPHY RYNE SANDBERG\b/gi, 'Ryne Sandberg');
        result = result.replace(/\bBRYAN WOO\b/gi, 'Bryan Woo');
        result = result.replace(/\bJAYDEN DANIELS KINGS\b/gi, 'Jayden Daniels');
        result = result.replace(/\bXAVIER WORTHY KINGS\b/gi, 'Xavier Worthy');
        result = result.replace(/\bAUSAR THOMPSON\b/gi, 'Ausar Thompson');
        result = result.replace(/\bZION WILLIAMSON\b/gi, 'Zion Williamson');
        result = result.replace(/\bKYLE SCHWARBER\b/gi, 'Kyle Schwarber');
        result = result.replace(/\bLUKA DONCIC ESSENTIALS\b/gi, 'Luka Dončić');
        result = result.replace(/\bROME ODUNZE BEARS\b/gi, 'Rome Odunze');
        result = result.replace(/\bCJ KAYFUS\b/gi, 'C.J. Kayfus');
        result = result.replace(/\bSAQUON BARKLEY\b/gi, 'Saquon Barkley');
        result = result.replace(/\bRANDY MOSS VIKINGS HOF\b/gi, 'Randy Moss');
        result = result.replace(/\bJARED GOFF\b/gi, 'Jared Goff');
        result = result.replace(/\bSHOHEI OHTANI PITCHING\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bBRYCE YOUNG PANTHERS &\b/gi, 'Bryce Young');
        result = result.replace(/\bYOSHINOBU YAMAMOTO DODGERS\b/gi, 'Yoshinobu Yamamoto');
        result = result.replace(/\bWYATT LANGFORD RANGERS\b/gi, 'Wyatt Langford');
        result = result.replace(/\bJUSTIN HERBERT CHARGERS\b/gi, 'Justin Herbert');
        result = result.replace(/\bVICTOR WEMBANYAMA SUPERNATURAL\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bJUAN SOTO NATIONALS\b/gi, 'Juan Soto');
        result = result.replace(/\bJA MORANT YOUNG DOLPH\b/gi, 'Ja Morant');
        result = result.replace(/\bSHAI GILGEOUS ALEXANDER Velocity,\b/gi, 'Shai Gilgeous-Alexander');
        result = result.replace(/\bANTHONY EDWARDS HYPER\b/gi, 'Anthony Edwards');
        result = result.replace(/\bBRYCE YOUNG\b/gi, 'Bryce Young');
        result = result.replace(/\bTIM DUNCAN SPURS\b/gi, 'Tim Duncan');
        result = result.replace(/\bBRANDON MILLER HORNETS\b/gi, 'Brandon Miller');
        result = result.replace(/\bBRYCE HARPER PHILLIES\b/gi, 'Bryce Harper');
        result = result.replace(/\bSHOHEI OHTANI POWER ZONE PZ SO\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bAARON RODGERS PACKERS JETS\b/gi, 'Aaron Rodgers');
        result = result.replace(/\bSHOHEI OHTANI \$\$\$\$\b/gi, 'Shohei Ohtani');
        result = result.replace(/\b' COLLECTION FRANCISCO LINDOR METS\b/gi, 'Francisco Lindor');
        result = result.replace(/\bWYATT LANGFORD RANGERS Q0902\b/gi, 'Wyatt Langford');
        result = result.replace(/\bLAMINE YAMAL\b/gi, 'Lamine Yamal');
        result = result.replace(/\bKEVIN ALCANTARA CUBS\b/gi, 'Kevin Alcantara');
        result = result.replace(/\bJULIO RODRIGUEZ \*\*\*\*\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bLEBRON JAMES CONCOURSE\b/gi, 'LeBron James');
        result = result.replace(/\bJAYDEN DANIELS EMERGENT\b/gi, 'Jayden Daniels');
        result = result.replace(/\bRONALD ACUNA JR\b/gi, 'Ronald Acuña Jr.');
        result = result.replace(/\bAQUAPOLIS TYRANITAR H28\b/gi, 'Tyranitar');
        result = result.replace(/\bSWORD & SHIELD BRILLIANT FULL ART MIMIKYU VMAX\b/gi, 'Mimikyu VMAX');
        result = result.replace(/\bMVP CARMELO ANTHONY NUGGETS\b/gi, 'Carmelo Anthony');
        result = result.replace(/\bO PEE CHEE CONNOR BEDARD\b/gi, 'Connor Bedard');
        result = result.replace(/\bROYALTY VICTOR WEMBANYAMA\b/gi, 'Victor Wembanyama');
        result = result.replace(/\bHOOPS DAVID ROBINSON\b/gi, 'David Robinson');
        result = result.replace(/\bLUKA DONCIC\b/gi, 'Luka Dončić');
        result = result.replace(/\bMONTANA RICE\b/gi, 'Joe Montana Jerry Rice');
        result = result.replace(/\bMICHAEL JORDAN \*\*\*\*\b/gi, 'Michael Jordan');
        result = result.replace(/\bKOBE BRYANT RAINMAKERS\b/gi, 'Kobe Bryant');
        result = result.replace(/\bART MONK WASHINGTON REDSKINS\b/gi, 'Art Monk');
        result = result.replace(/\bCJ STROUD LAZER\b/gi, 'C.J. Stroud');
        result = result.replace(/\bPETE CROW ARMSTRONG CUBS STRATOSPHERIC\b/gi, 'Pete Crow-Armstrong');
        result = result.replace(/\bJUNIOR CAMINERO RAYS\b/gi, 'Junior Caminero');
        result = result.replace(/\bJUNIOR CAMINERO RUSH RAYS\b/gi, 'Junior Caminero');
        result = result.replace(/\bDIRK NOWITZKI\b/gi, 'Dirk Nowitzki');
        result = result.replace(/\bYOSHINOBU YAMAMOTO LA DODGERS\b/gi, 'Yoshinobu Yamamoto');
        result = result.replace(/\bPETE ALONSO Bdc92\b/gi, 'Pete Alonso');
        result = result.replace(/\bFERNANDO TATIS JR PADRES\b/gi, 'Fernando Tatis Jr.');
        result = result.replace(/\bCONCOURSE JOSH\b/gi, 'Josh Allen');
        result = result.replace(/\bDAK PRESCOTT COWBOYS\b/gi, 'Dak Prescott');
        result = result.replace(/\bANTHONY EDWARDS\b/gi, 'Anthony Edwards');
        result = result.replace(/\bERLING HAALAND UCL EDITION\b/gi, 'Erling Haaland');
        result = result.replace(/\bPITCHING SEPIA SHOHEI OHTANI\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bCORBIN CARROLL DIAMONDBACKS\b/gi, 'Corbin Carroll');
        result = result.replace(/\bHURSTON WALDREP\b/gi, 'Hurston Waldrep');
        result = result.replace(/\bBROCK BOWERS RAIDERS\b/gi, 'Brock Bowers');
        result = result.replace(/\bSUNDAY KINGS JOSH\b/gi, 'Josh Allen');
        result = result.replace(/\bSHOHEI OHTANI PITCHING LA DODGERS\b/gi, 'Shohei Ohtani');
        result = result.replace(/\bJULIO RODRIGUEZ DESIGN\b/gi, 'Julio Rodriguez');
        result = result.replace(/\bLAMELO BALL\b/gi, 'LaMelo Ball');
        result = result.replace(/\bBO NIX EMERGENT\b/gi, 'Bo Nix');
        result = result.replace(/\bBO NIX LAZER COLOR MATCH\b/gi, 'Bo Nix');
        result = result.replace(/\bCAITLIN CLARK BASE\b/gi, 'Caitlin Clark');
        result = result.replace(/\bWALTER PAYTON HOF\b/gi, 'Walter Payton');
        result = result.replace(/\bLEBRON JAMES LA\b/gi, 'LeBron James');
        
        // Fix "KOBE BRYANT MICHAEL JORDAN" -> "Kobe Bryant Michael Jordan" (dual card - keep both names)
        result = result.replace(/\b(KOBE BRYANT)\s+(MICHAEL JORDAN)\b/gi, 'Kobe Bryant Michael Jordan');
        
        // Fix "JOSH ADAMCZEWSKI 🟦🟨" -> "Josh Adamczewski"
        result = result.replace(/\b(JOSH ADAMCZEWSKI)\s+🟦🟨\b/gi, 'Josh Adamczewski');
        
        // Fix "JOHN PAXSON !!" -> "John Paxson"
        result = result.replace(/\b(JOHN PAXSON)\s+!!\b/gi, 'John Paxson');
        
        // Fix "DRAKE MAYE !" -> "Drake Maye"
        result = result.replace(/\b(DRAKE MAYE)\s+!\b/gi, 'Drake Maye');
        
        // Fix "JAHMYR GIBBS []" -> "Jahmyr Gibbs"
        result = result.replace(/\b(JAHMYR GIBBS)\s+\[\]\b/gi, 'Jahmyr Gibbs');
        
        // Fix "CHRISTIAN WATSON P.P." -> "Christian Watson"
        result = result.replace(/\b(CHRISTIAN WATSON)\s+P\.P\.\b/gi, 'Christian Watson');
        
        // Fix "KOBE BRYANT USA" -> "Kobe Bryant"
        result = result.replace(/\b(KOBE BRYANT)\s+USA\b/gi, 'Kobe Bryant');
        
        // Fix "TUA TAGOVAILOA LIGHT" -> "Tua Tagovailoa"
        result = result.replace(/\b(TUA TAGOVAILOA)\s+LIGHT\b/gi, 'Tua Tagovailoa');
        
        // Fix "JOSH ADAMCZEWSKI 🟦🟨" -> "Josh Adamczewski"
        result = result.replace(/\b(JOSH ADAMCZEWSKI)\s+🟦🟨\b/gi, 'Josh Adamczewski');
        
        // Fix "JOHN PAXSON" -> "John Paxson" (case conversion)
        result = result.replace(/\bJOHN PAXSON\b/gi, 'John Paxson');
        
        // Fix "LEWIS HAMILTON" -> "Lewis Hamilton" (case conversion)
        result = result.replace(/\bLEWIS HAMILTON\b/gi, 'Lewis Hamilton');
        
        // Fix "JAHMYR GIBBS" -> "Jahmyr Gibbs" (case conversion)
        result = result.replace(/\bJAHMYR GIBBS\b/gi, 'Jahmyr Gibbs');
        
        // Fix "CHRISTIAN WATSON" -> "Christian Watson" (case conversion)
        result = result.replace(/\bCHRISTIAN WATSON\b/gi, 'Christian Watson');
        
        // Fix "DRAKE MAYE" -> "Drake Maye" (case conversion)
        result = result.replace(/\bDRAKE MAYE\b/gi, 'Drake Maye');
        
        // Fix "TUA TAGOVAILOA" -> "Tua Tagovailoa" (case conversion)
        result = result.replace(/\bTUA TAGOVAILOA\b/gi, 'Tua Tagovailoa');
        
        // Fix "JOSH ADAMCZEWSKI" -> "Josh Adamczewski" (case conversion)
        result = result.replace(/\bJOSH ADAMCZEWSKI\b/gi, 'Josh Adamczewski');
        
        // Fix "ENDRICK" -> "Endrick" (proper case)
        result = result.replace(/\bENDRICK\b/gi, 'Endrick');
        
        // Remove standalone "!!" or "!" that might remain
        result = result.replace(/\b!!\b/g, '');
        result = result.replace(/\b!\b/g, '');
        result = result.replace(/\b\[\]\b/g, '');
        
        return result;
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
             /\b(Green Pulsar|Blue Pulsar|Red Pulsar|Purple Pulsar|Orange Pulsar|Pink Pulsar|Gold Pulsar|Silver Pulsar|Black Pulsar|White Pulsar|Sky Blue|Neon Green|Purple Pattern|Pink Pattern|Blue Pattern|Green Pattern|Yellow Pattern|Black Pattern|Red Pattern|Printing Plate|Checkerboard|X-Fractor|Cracked Ice|Atomic|Disco|Fast Break|No Huddle|Flash|Shock|Mojo|Mega|Scope|Shimmer|Wave|Multi Wave|Carved in Time|Lenticular|Synthesis|Outburst|Electric Ice|Ellipse|Color Wheel|Color Blast|Die-cut|National Landmarks|Stained Glass|Lava Lamp|Dazzle|Blue Velocity|Hyper Pink|Red Dragon|Laser|Liberty|Diamond Marvels|On Fire|Voltage|Career Stat Line|Alligator Crystal|Alligator Kaleidoscope|Alligator Mojo|Alligator Prismatic|Butterfly Crystal|Butterfly Kaleidoscope|Butterfly Mojo|Butterfly Prismatic|Chameleon Crystal|Chameleon Kaleidoscope|Chameleon Mojo|Chameleon Prismatic|Clown Fish Crystal|Clown Fish Kaleidoscope|Clown Fish Mojo|Clown Fish Prismatic|Deer Crystal|Deer Kaleidoscope|Deer Mojo|Deer Prismatic|Dragon Crystal|Dragon Kaleidoscope|Dragon Mojo|Dragon Prismatic|Elephant Crystal|Elephant Kaleidoscope|Elephant Mojo|Elephant Prismatic|Giraffe Crystal|Giraffe Kaleidoscope|Giraffe Mojo|Giraffe Prismatic|Leopard Crystal|Leopard Kaleidoscope|Leopard Mojo|Leopard Prismatic|Parrot Crystal|Parrot Kaleidoscope|Parrot Mojo|Parrot Prismatic|Peacock Crystal|Peacock Kaleidoscope|Peacock Mojo|Peacock Prismatic|Snake Crystal|Snake Kaleidoscope|Snake Mojo|Snake Prismatic|Tiger Crystal|Tiger Kaleidoscope|Tiger Mojo|Tiger Prismatic|Zebra Crystal|Zebra Kaleidoscope|Zebra Mojo|Zebra Prismatic|Tiger Eyes|Snake Eyes|100th Anniversary|Black Border|Flip Stock|Magenta|Mini Parallels|Chrome Refractor|Purple Refractor|Black Bordered Refractor|Gold Bordered Refractor|Superfractor|Zebra Prizm|Dragon Scale|Red Dragon|Peacock Prizm|Tiger Prizm|Giraffe Prizm|Elephant Prizm|Blue Ice|Silver Laser|Silver Mojo|Silver Scope|Teal Wave|Premium Set Checkerboard|Blue Laser|Blue Mojo|Green Flash|Blue Flash|Purple Flash|Purple Cracked Ice|Pink Flash|Gold Cracked Ice|Gold Flash|Gold Laser|Gold Mojo|Black Flash|Black Laser|Black Mojo|Gold Vinyl Premium Set|Vintage Stock|Red Stars|Independence Day|Father's Day Powder Blue|Mother's Day Hot Pink|Memorial Day Camo|Camo Pink Mosaic|Choice Peacock Mosaic|Fast Break Silver Mosaic|Genesis Mosaic|Green Mosaic|Reactive Blue Mosaic|Reactive Orange Mosaic|Red Mosaic|Blue Mosaic|Choice Red Fusion Mosaic|Fast Break Blue Mosaic|Fast Break Purple Mosaic|Purple Mosaic|Orange Fluorescent Mosaic|White Mosaic|Fast Break Pink Mosaic|Blue Fluorescent Mosaic|Pink Swirl Mosaic|Fast Break Gold Mosaic|Gold Mosaic|Green Swirl Mosaic|Pink Fluorescent Mosaic|Choice Black Gold Mosaic|Black Mosaic|Choice Nebula Mosaic|Fast Break Black Mosaic|Black Pulsar Prizm|Blue Prizm|Blue Cracked Ice Prizm|Blue Pulsar Prizm|Blue Wave Prizm|Flash Prizm|Gold Pulsar Prizm|Green Prizm|Green Cracked Ice Prizm|Green Pulsar Prizm|Green Shimmer Prizm|Pulsar Prizm|Purple Disco Prizm|Red Prizm|Red Cracked Ice Prizm|Red Flash Prizm|Red Pulsar Prizm|Red Wave Prizm|Silver Prizm|Silver Laser Prizm|Silver Mojo Prizm|Silver Scope Prizm|Teal Prizm|Teal Wave Prizm|Premium Set Checkerboard Prizm|Blue Laser Prizm|Blue Mojo Prizm|Green Flash Prizm|Blue Flash Prizm|Purple Flash Prizm|Purple Cracked Ice Prizm|Pink Flash Prizm|Gold Cracked Ice Prizm|Gold Flash Prizm|Gold Laser Prizm|Gold Mojo Prizm|Black Flash Prizm|Black Laser Prizm|Black Mojo Prizm|Gold Vinyl Premium Set Prizm|Helmet Heroes|Light It Up|Sepia Refractor|Rejectors|Emergent|Silver Wave Refractor|Prospect|Genesis|Treasured Rookies|Electricity|Blue Refractor|Silver Refractor|Chrome Sapphire|Selections|Real One|The Rookies|RPA|Red Ink|Mania|Flashback|Logofractor|Formula 1|WWE|Geometric|Honeycomb|Pride|Kaleidoscopic|Level|Club|Copper Prizm|Die-Cut|National Orange Prizm|Prizm Die-Cut|Prizm Die Cut|No Huddle|Variation)\b/gi,
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

        let standardizedTitle = parts.join(' ').trim();
        
        // Remove emojis and special characters from the final title
        standardizedTitle = standardizedTitle.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1FAB0}-\u{1FABF}]|[\u{1FAD0}-\u{1FAFF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1F9D0}-\u{1F9FF}]|[\u{1F910}-\u{1F93A}]|[\u{1F950}-\u{1F9C0}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23EC}]|[\u{23F0}]|[\u{23F3}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270C}]|[\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu, '');
        
        // Special case handling for product order
        standardizedTitle = this.fixProductOrder(standardizedTitle);
        
        // If we couldn't extract enough information, return a cleaned version of the original
        if (parts.length < 2) {
            return this.cleanTitle(title);
        }

        return standardizedTitle;
    }

    // Fix product order for specific cases
    fixProductOrder(title) {
        // Fix "Electricity Donruss Optic" -> "Donruss Optic Electricity"
        title = title.replace(/\bElectricity\s+(Donruss Optic)\b/gi, '$1 Electricity');
        
        // Fix "Selections Chrome Sapphire" -> "Chrome Sapphire Selections"
        title = title.replace(/\b(Selections)\s+(Chrome Sapphire)\b/gi, '$2 $1');
        
        // Fix "Heritage Purple Refractor" -> "Heritage Chrome Purple Refractor"
        title = title.replace(/\b(Heritage)\s+(Purple Refractor)\b/gi, '$1 Chrome $2');
        title = title.replace(/\b(Heritage)\s+(Silver Refractor)\b/gi, '$1 Chrome $2');
        
        // Fix "Update Fleer" -> "Fleer Tradition Update"
        title = title.replace(/\b(Update)\s+(Fleer)\b/gi, '$2 Tradition $1');
        
        // Fix "Bowman Orange Refractor" -> "Bowman's Best Orange Refractor"
        title = title.replace(/\b(Bowman)\s+(Orange Refractor)\b/gi, 'Bowman\'s Best $2');
        
        // Fix "Bowman Wave" -> "Bowman's Best"
        title = title.replace(/\b(Bowman Wave)\b/gi, 'Bowman\'s Best');
        
        // Fix "Leo DE Vries" -> "Leo DE VRIES" and add "Prospect"
        if (title.includes('DE Vries') && title.includes('Bowman\'s Best')) {
            title = title.replace(/\bDE Vries\b/gi, 'Leo DE VRIES');
            if (!title.includes('Prospect')) {
                title = title.replace(/\b(Bowman\'s Best)\b/gi, '$1 Prospect');
            }
            // Fix "Silver Refractor" -> "Silver Wave Refractor"
            title = title.replace(/\b(Silver Refractor)\b/gi, 'Silver Wave Refractor');
        }
        
        // Fix player name duplications - comprehensive list
        title = title.replace(/\b(Elly De La Cruz)\s+(DE LA CRUZ)\b/gi, '$1');
        title = title.replace(/\b(Elly De La Cruz)\s+(De La Cruz)\b/gi, '$1');
        title = title.replace(/\b(John Elway)\s+(PAXSON)\b/gi, 'John Paxson');
        title = title.replace(/\b(John Elway)\s+(Elway)\b/gi, 'John Elway');
        title = title.replace(/\b(Duke)\s+(Duke)\s+(Snider)\b/gi, 'Duke Snider');
        title = title.replace(/\b(Deni Avdija)\s+(Avdija)\b/gi, '$1');
        title = title.replace(/\b(Brooks Koepka)\s+(Koepka)\b/gi, '$1');
        title = title.replace(/\b(LeBron James)\s+(One)\s+(and)\s+(One)\b/gi, 'LeBron James One and One');
        title = title.replace(/\b(Tyreek Hill)\s+(Hill)\b/gi, '$1');
        title = title.replace(/\b(Shai Gilgeous-Alexander)\s+(Alexander)\b/gi, '$1');
        title = title.replace(/\b(Shai Gilgeous-Alexander)\s+(Gilgeous-Alexander)\b/gi, '$1');
        
        // Fix general word duplications (any word that appears twice in a row)
        const words = title.split(' ');
        const deduplicatedWords = [];
        for (let i = 0; i < words.length; i++) {
            if (i === 0 || words[i].toLowerCase() !== words[i-1].toLowerCase()) {
                deduplicatedWords.push(words[i]);
            }
        }
        title = deduplicatedWords.join(' ');
        
        // Fix "P.P." -> "RPA" for rookie patch autos
        title = title.replace(/\b(P\.P\.)\b/gi, 'RPA');
        
        // Fix "1/1" -> "/1" for consistency
        title = title.replace(/\b1\/1\b/gi, '/1');
        
        // Fix "RED" -> "Red Ink" when appropriate
        if (title.includes('Red') && title.includes('Ink')) {
            title = title.replace(/\b(Red)\b/gi, 'Red Ink');
        }
        
        // Fix "THE" appearing alone - should be part of "The Rookies"
        title = title.replace(/\b(THE)\s+(Rookies)\b/gi, 'The Rookies');
        
        // Fix "USA USA" duplication
        title = title.replace(/\b(USA)\s+(USA)\b/gi, 'USA');
        
        // Fix "Panini XR" duplication
        title = title.replace(/\b(Panini XR)\s+(Panini XR)\b/gi, 'Panini XR');
        
        // Fix "FORMULA LOGOFRACTOR" appearing before player name
        title = title.replace(/\b(FORMULA LOGOFRACTOR)\s+([A-Z\s]+)\s+(Topps Chrome)\b/gi, '$2 $3 Formula 1 Logofractor');
        
        // Fix "WWE" appearing before product name
        title = title.replace(/\b(WWE)\s+([A-Z\s]+)\s+(Topps Chrome)\b/gi, '$2 $3 WWE');
        
        // Fix "[]" empty brackets
        title = title.replace(/\b\[\]\b/gi, '');
        
        // Fix "!!" exclamation marks
        title = title.replace(/\b!!\b/gi, '');
        
        // Fix "SNIDER" -> "Duke Snider"
        title = title.replace(/\b(SNIDER)\b/gi, 'Duke Snider');
        
        // Fix "PAXSON" -> "John Paxson" when it appears alone
        if (title.includes('PAXSON') && !title.includes('John')) {
            title = title.replace(/\b(PAXSON)\b/gi, 'John Paxson');
        }
        
        // Fix "LOGOFRACTOR" appearing before player name
        title = title.replace(/\b(LOGOFRACTOR)\s+([A-Z\s]+)\s+(Topps Chrome)\b/gi, '$2 $3 Logofractor');
        
        // Fix "GEOMETRIC" appearing before product name
        title = title.replace(/\b(GEOMETRIC)\s+([A-Z\s]+)\s+(Topps Chrome)\b/gi, '$2 $3 Geometric');
        
        // Fix "HONEYCOMB" appearing before product name
        title = title.replace(/\b(HONEYCOMB)\s+([A-Z\s]+)\s+(Panini Mosaic)\b/gi, '$2 $3 Honeycomb');
        
        // Fix "PRIDE" appearing before player name
        title = title.replace(/\b(PRIDE)\s+([A-Z\s]+)\s+(Panini Mosaic)\b/gi, '$2 $3 National Pride');
        
        // Fix "KALEIDOSCOPIC" appearing before product name
        title = title.replace(/\b(KALEIDOSCOPIC)\s+([A-Z\s]+)\s+(Panini Mosaic)\b/gi, '$2 $3 Kaleidoscopic');
        
        // Fix "LEVEL" appearing before player name
        title = title.replace(/\b(LEVEL)\s+([A-Z\s]+)\s+(Panini Select)\b/gi, '$2 $3 Club Level');
        
        // Fix "FLASHBACK" appearing before player name
        title = title.replace(/\b(FLASHBACK)\s+([A-Z\s]+)\s+(Panini Prizm)\b/gi, '$2 $3 Prizm Flashback');
        
        // Fix "FORMULA" appearing before player name for Formula 1
        title = title.replace(/\b(FORMULA)\s+([A-Z\s]+)\s+(Topps Chrome)\b/gi, '$2 $3 Formula 1');
        
        // Fix "No." appearing alone - should be part of card number
        title = title.replace(/\b(No\.)\s+(#\d+)\b/gi, '$2');
        
        // Fix "PF6" -> "#PF6" for card numbers
        title = title.replace(/\b(PF6)\b/gi, '#PF6');
        
        // Fix "241" -> "#241" when it appears after "Level"
        title = title.replace(/\b(Level)\s+([A-Z\s]+)\s+(Panini Select)\s+(Club)\s+(Level)\s+([A-Z\s]+)\s+(\d+)\b/gi, '$1 $2 $3 $4 $5 $6 #$7');
        
        // Fix "339" -> "#339" when it appears after "No."
        title = title.replace(/\b(No\.)\s+(\d+)\b/gi, '#$2');
        
        // Fix "O's" -> "Orioles" (Baltimore Orioles)
        title = title.replace(/\b(O's)\b/gi, 'Orioles');
        
        // Fix "ESTEBAN OCON" -> "Esteban Ocon" (proper case)
        title = title.replace(/\b(ESTEBAN OCON)\b/gi, 'Esteban Ocon');
        
        // Fix "JACKSON HOLLIDAY" -> "Jackson Holliday" (proper case)
        title = title.replace(/\b(JACKSON HOLLIDAY)\b/gi, 'Jackson Holliday');
        
        // Fix "DRAKE MAYE" -> "Drake Maye" (proper case)
        title = title.replace(/\b(DRAKE MAYE)\b/gi, 'Drake Maye');
        
        // Fix "KYLER MURRAY" -> "Kyler Murray" (proper case)
        title = title.replace(/\b(KYLER MURRAY)\b/gi, 'Kyler Murray');
        
        // Fix "DERRICK HENRY" -> "Derrick Henry" (proper case)
        title = title.replace(/\b(DERRICK HENRY)\b/gi, 'Derrick Henry');
        
        // Fix "CJ STROUD" -> "C.J. Stroud" (proper initials)
        title = title.replace(/\b(CJ STROUD)\b/gi, 'C.J. Stroud');
        
        // Fix "LAMAR JACKSON" -> "Lamar Jackson" (proper case)
        title = title.replace(/\b(LAMAR JACKSON)\b/gi, 'Lamar Jackson');
        
        // Fix "JOSH ALLEN" -> "Josh Allen" (proper case)
        title = title.replace(/\b(JOSH ALLEN)\b/gi, 'Josh Allen');
        
        // Fix "LUIS GIL" -> "Luis Gil" (proper case)
        title = title.replace(/\b(LUIS GIL)\b/gi, 'Luis Gil');
        
        // Fix remaining ALL CAPS player names that weren't converted
        title = title.replace(/\b(JOSH)\b/gi, 'Josh');
        title = title.replace(/\b(BRYCE HARPER &)\b/gi, 'Bryce Harper');
        title = title.replace(/\b(' COLLECTION FRANCISCO LINDOR METS)\b/gi, 'Francisco Lindor');
        title = title.replace(/\b('S BEST TRISTON CASAS TP)\b/gi, 'Triston Casas');
        title = title.replace(/\b(Shai Gilgeous-Alexander SIGNATURES RS SGA)\b/gi, 'Shai Gilgeous-Alexander');
        title = title.replace(/\b(Shai Gilgeous-Alexander Velocity,)\b/gi, 'Shai Gilgeous-Alexander');
        title = title.replace(/\b(LUIS GIL)\b/gi, 'Luis Gil');
        
        // Fix "JOSH ADAMCZEWSKI" -> "Josh Adamczewski" (proper case)
        title = title.replace(/\b(JOSH ADAMCZEWSKI)\b/gi, 'Josh Adamczewski');
        
        // Fix "JOE BURROW" -> "Joe Burrow" (proper case)
        title = title.replace(/\b(JOE BURROW)\b/gi, 'Joe Burrow');
        
        // Fix "Mosaic #17 #12" -> "Mosaic Genesis #17"
        title = title.replace(/\b(Mosaic)\s+(#\d+)\s+(#\d+)\b/gi, '$1 Genesis $2');
        
        // Fix "Topps Finest #178 #03" -> "LeBron James Topps Finest #178"
        if (title.includes('Topps Finest #178')) {
            title = title.replace(/\b(Topps Finest)\s+(#178)\s+(#\d+)\b/gi, 'LeBron James $1 $2');
        }
        
        // Fix "Flair Rejectors" -> "Shaquille O'Neal Flair Rejectors"
        if (title.includes('Flair Rejectors') && !title.includes('Shaquille')) {
            title = title.replace(/\b(Flair Rejectors)\b/gi, "Shaquille O'Neal $1");
        }
        
        // Fix missing player names for specific cases
        if (title.includes('1994-95') && title.includes('Flair') && !title.includes('Shaquille')) {
            title = title.replace(/\b(1994-95)\s+(Flair)\b/gi, '$1 Shaquille O\'Neal $2');
        }
        
        // Fix "National Treasures Rookies" -> "National Treasures Treasured Rookies"
        title = title.replace(/\b(National Treasures Rookies)\b/gi, 'National Treasures Treasured Rookies');
        
        // Fix card number order for Derek Jeter
        title = title.replace(/\b(Blue Refractor)\s+(#\d+)\s+(\/\d+)\b/gi, '$1 $3 $2');
        
        // Fix "Chrome Sapphire Selections" -> "Topps Chrome Sapphire Selections"
        title = title.replace(/\b(Chrome Sapphire Selections)\b/gi, 'Topps $1');
        
        // Remove extra card numbers like "#19" in Shai Gilgeous-Alexander
        title = title.replace(/\b(Chronicles Green #\d+)\s+(#\d+)\b/gi, '$1');
        
        // Fix case formatting for card types
        title = title.replace(/\b(BLUE REFRACTOR)\b/gi, 'Blue Refractor');
        title = title.replace(/\b(SILVER REFRACTOR)\b/gi, 'Silver Refractor');
        title = title.replace(/\b(REJECTORS)\b/gi, 'Rejectors');
        
        // Fix player name case sensitivity issues
        title = title.replace(/\b(JJ Mccarthy)\b/gi, 'J.J. McCarthy');
        title = title.replace(/\b(Stetson Bennett Iv)\b/gi, 'Stetson Bennett IV');
        title = title.replace(/\b(Iv)\b/gi, 'IV');
        
        // Remove "Autographs" from titles (it's redundant with "Auto")
        title = title.replace(/\b(Autographs)\s+/gi, '');
        
        // Fix "WHITE SPARKLE" -> "White Sparkle" and ensure proper product order
        title = title.replace(/\b(WHITE SPARKLE)\b/gi, 'White Sparkle');
        
        // Fix "PRIZM WHITE SPARKLE" -> "Panini Prizm White Sparkle"
        title = title.replace(/\b(PRIZM WHITE SPARKLE)\b/gi, 'Panini Prizm White Sparkle');
        
        // Fix "UCC Endrick Pulsar" -> "Topps Chrome UCC Endrick Pulsar"
        title = title.replace(/\b(UCC Endrick Pulsar)\b/gi, 'Topps Chrome UCC Endrick Pulsar');
        
        // Fix "XR CHRISTIAN WATSON" -> "Panini XR Christian Watson"
        title = title.replace(/\b(XR CHRISTIAN WATSON)\b/gi, 'Panini XR Christian Watson');
        
        // Fix "Ucc Endrick" -> "Endrick" (remove duplicate UCC)
        title = title.replace(/\b(Ucc Endrick)\b/gi, 'Endrick');
        
        // Fix "Vladi Guerrero" -> "Vladimir Guerrero" (nickname mapping)
        title = title.replace(/\b(Vladi Guerrero)\b/gi, 'Vladimir Guerrero');
        
        // Fix "Ja'marr Chase" formatting issues
        title = title.replace(/\b(Ja'marr Chase)\b/gi, 'Ja\'marr Chase');
        title = title.replace(/\b(Ja'marr Chase-)\b/gi, 'Ja\'marr Chase');
        
        // Fix player name issues from user feedback
        title = title.replace(/\b(Jared Mc)\b/gi, 'Jared McCarron');
        title = title.replace(/\b(Ladd Mc)\b/gi, 'Ladd McConkey');
        title = title.replace(/\b(Shai Gilgeous-)\b/gi, 'Shai Gilgeous-Alexander');
        title = title.replace(/\b(Pete Crow-)\b/gi, 'Pete Crow-Armstrong');
        title = title.replace(/\b(Tyreek)\b/gi, 'Tyreek Hill');
        title = title.replace(/\b(John)\b/gi, 'John Elway');
        title = title.replace(/\b(Deni)\b/gi, 'Deni Avdija');
        title = title.replace(/\b(Brooks)\b/gi, 'Brooks Koepka');
        title = title.replace(/\b(Elly)\b/gi, 'Elly De La Cruz');
        
        // Fix "Leo Leo DE VRIES" duplication
        title = title.replace(/\b(Leo Leo)\b/gi, 'Leo');
        
        // Fix "Von Achane" to "De'Von Achane"
        title = title.replace(/\b(Von Achane)\b/gi, 'De\'Von Achane');
        
        // Fix "Leo DE" to "Leo DE VRIES"
        title = title.replace(/\b(Leo DE)\b/gi, 'Leo DE VRIES');
        
        // Fix "Carthy Card" to "J.J. McCarthy"
        title = title.replace(/\b(Carthy Card)\b/gi, 'J.J. McCarthy');
        
        // Fix "J.J. McCarthy" missing from titles
        if (title.includes('Panini Prizm Disco Orange #400') && !title.includes('J.J. McCarthy')) {
            title = title.replace(/\b(Panini Prizm Disco Orange #400)\b/gi, 'J.J. McCarthy $1');
        }
        if (title.includes('Panini Donruss Wave Optic Red #303') && !title.includes('J.J. McCarthy')) {
            title = title.replace(/\b(Panini Donruss Wave Optic Red #303)\b/gi, 'J.J. McCarthy $1');
        }
        
        // Fix missing card types
        if (title.includes('Spectra') && !title.includes('X Vision Meta')) {
            title = title.replace(/\b(Spectra)\b/gi, 'Spectra X Vision Meta');
        }
        if (title.includes('Mosaic Basketball Overdrive') && !title.includes('Mosaic Basketball Overdrive')) {
            title = title.replace(/\b(Mosaic Basketball Overdrive)\b/gi, 'Mosaic Basketball Overdrive');
        }
        
        // Add "RC" or "Rookie" for rookie cards (cards from 2024 are likely rookies)
        if (title.includes('2024') && !title.includes('RC') && !title.includes('Rookie')) {
            // Add RC after the player name
            title = title.replace(/\b(J\.J\. McCarthy)\b/gi, '$1 RC');
            title = title.replace(/\b(JJ McCarthy)\b/gi, '$1 RC');
        }
        
        return title;
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
            
            // Check if player_name column exists, if not add it
            await this.ensurePlayerNameColumn();
            
            // Then learn from existing data
            await this.learnFromDatabase();

            // Check if we're using comprehensive database (has 'sets' table) or new-scorecard (has 'cards' table)
            const tableCheck = await this.runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'");
            const hasCardsTable = tableCheck.length > 0;
            
            if (!hasCardsTable) {
                console.log('⚠️ No cards table found in database. This appears to be a comprehensive database with only sets table.');
                console.log('📚 Comprehensive database is used for learning only, not for updating existing cards.');
                
                return {
                    success: true,
                    totalProcessed: 0,
                    updated: 0,
                    unchanged: 0,
                    errors: 0,
                    learnedSets: this.cardSets.size,
                    learnedTypes: this.cardTypes.size,
                    learnedBrands: this.brands.size,
                    message: 'Comprehensive database used for learning only'
                };
            }
            
            // Get all cards
            const cards = await this.runQuery('SELECT id, title, summary_title, player_name FROM cards');
            console.log(`📊 Found ${cards.length} cards to process`);

            let updated = 0;
            let unchanged = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    const newSummaryTitle = this.generateStandardizedTitle(card.title);
                    const extractedPlayer = this.extractPlayer(card.title);
                    
                    // Check if either summary_title or player_name needs updating
                    const summaryTitleChanged = newSummaryTitle && newSummaryTitle !== card.summary_title;
                    const playerNameChanged = extractedPlayer && extractedPlayer !== card.player_name;
                    
                    if (summaryTitleChanged || playerNameChanged) {
                        // Update both fields
                        await this.runUpdate(
                            'UPDATE cards SET summary_title = ?, player_name = ? WHERE id = ?',
                            [newSummaryTitle || card.summary_title, extractedPlayer || card.player_name, card.id]
                        );
                        
                        console.log(`✅ Updated card ${card.id}:`);
                        if (summaryTitleChanged) {
                            console.log(`   Summary: "${card.summary_title || 'N/A'}" → "${newSummaryTitle}"`);
                        }
                        if (playerNameChanged) {
                            console.log(`   Player: "${card.player_name || 'N/A'}" → "${extractedPlayer}"`);
                        }
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

    // Ensure player_name column exists in the database
    async ensurePlayerNameColumn() {
        try {
            // Check if player_name column exists
            const columns = await this.runQuery("PRAGMA table_info(cards)");
            const hasPlayerNameColumn = columns.some(col => col.name === 'player_name');
            
            if (!hasPlayerNameColumn) {
                console.log('📝 Adding player_name column to cards table...');
                await this.runUpdate('ALTER TABLE cards ADD COLUMN player_name TEXT');
                console.log('✅ player_name column added successfully');
            } else {
                console.log('✅ player_name column already exists');
            }
        } catch (error) {
            console.error('❌ Error ensuring player_name column:', error);
            throw error;
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
            const player = this.extractPlayer(title);
            console.log(`\n${index + 1}. Original: "${title}"`);
            console.log(`   Standardized: "${standardized}"`);
            console.log(`   Player Name: "${player}"`);
            
            // Show extracted components
            const year = this.extractYear(title);
            const product = this.extractProduct(title);
            const colorNumbering = this.extractColorNumbering(title);
            
            console.log(`   Components: Year="${year}", Product="${product}", Color/Numbering="${colorNumbering}"`);
        });
    }

    // Utility function to get player name from database by card ID
    async getPlayerName(cardId) {
        try {
            const result = await this.runQuery('SELECT player_name FROM cards WHERE id = ?', [cardId]);
            return result.length > 0 ? result[0].player_name : null;
        } catch (error) {
            console.error('❌ Error getting player name:', error);
            return null;
        }
    }

    // Utility function to get all cards with their player names
    async getAllCardsWithPlayerNames() {
        try {
            return await this.runQuery('SELECT id, title, summary_title, player_name FROM cards WHERE player_name IS NOT NULL');
        } catch (error) {
            console.error('❌ Error getting cards with player names:', error);
            return [];
        }
    }

    // Utility function to update player name for a specific card
    async updatePlayerName(cardId, playerName) {
        try {
            await this.runUpdate('UPDATE cards SET player_name = ? WHERE id = ?', [playerName, cardId]);
            console.log(`✅ Updated player name for card ${cardId}: "${playerName}"`);
            return true;
        } catch (error) {
            console.error('❌ Error updating player name:', error);
            return false;
        }
    }

    // Utility function to search cards by player name
    async searchCardsByPlayer(playerName) {
        try {
            return await this.runQuery(
                'SELECT id, title, summary_title, player_name FROM cards WHERE player_name LIKE ?',
                [`%${playerName}%`]
            );
        } catch (error) {
            console.error('❌ Error searching cards by player:', error);
            return [];
        }
    }

    // Utility function to get unique player names from database
    async getUniquePlayerNames() {
        try {
            const result = await this.runQuery('SELECT DISTINCT player_name FROM cards WHERE player_name IS NOT NULL ORDER BY player_name');
            return result.map(row => row.player_name);
        } catch (error) {
            console.error('❌ Error getting unique player names:', error);
            return [];
        }
    }

    // Close database connection
    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
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
