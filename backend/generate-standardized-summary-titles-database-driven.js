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
        
        // Sort by length (longest first) to match more specific products first
        const sortedSets = Array.from(this.cardSets).sort((a, b) => b.length - a.length);
        
        for (const product of sortedSets) {
            const productLower = product.toLowerCase();
            // Handle exact matches, hyphenated versions, and variations with hyphens
            const variations = [
                productLower,
                productLower.replace(/\s+/g, ' - '),
                productLower.replace(/\s+/g, ' - ').replace('bowman - chrome', 'bowman - chrome'),
                productLower.replace('bowman chrome', 'bowman - chrome')
            ];
            
            for (const variation of variations) {
                if (titleLower.includes(variation)) {
                    return product;
                }
            }
        }
        return null;
    }

    // Extract player name from title (improved version)
    extractPlayer(title) {
        // First, clean the title to remove common non-player terms
        let cleanTitle = title;
        const removeTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'MT 10', 'MT10',
            'RC', 'Rookie', 'ROOKIE', 'rookie', 'SP', 'sp',
            'AUTO', 'auto', 'Autograph', 'autograph',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population'
        ];

        // Add learned card sets and types to removal list
        removeTerms.push(...Array.from(this.cardSets));
        removeTerms.push(...Array.from(this.cardTypes));
        removeTerms.push(...Array.from(this.brands));

        removeTerms.forEach(term => {
            const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, '');
        });

        // Look for player name patterns
        const patterns = [
            // Handle names with periods like "J.J. MCCARTHY"
            /\b([A-Z]\.[A-Z]\.)\s+([A-Z]+)\b/g,
            // Handle three-part names like "Shai Gilgeous-Alexander" first
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)-([A-Z][a-z]+)\b/g,
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
        const patterns = [
            // Learned card types
            new RegExp(`\\b(${Array.from(this.cardTypes).join('|')})\\b`, 'gi'),
            // Card numbers with # symbol (including alphanumeric)
            /#[A-Z0-9-]+/g,
            // Print run numbers (like /150, /5)
            /\/(\d+)\b/g,
            // Special editions
            /\b(1st Edition|First Edition|Limited Edition|Special Edition|Anniversary|Century|Millennium|Legacy|Legendary|Iconic|Epic|Rare|Ultra Rare|Secret Rare|Common|Uncommon|Rare|Mythic|Legendary)\b/gi
        ];

        const found = [];
        for (const pattern of patterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
                // Skip PSA grades and year fragments
                const value = match[0];
                if (value === '10' || value === '23' || value === '2022' || value === '2023' || value === '2024') {
                    continue;
                }
                found.push(match[0]);
            }
        }

        return found.length > 0 ? found.join(' ') : null;
    }

    // Generate standardized summary title
    generateStandardizedTitle(title) {
        const year = this.extractYear(title);
        const product = this.extractProduct(title);
        const player = this.extractPlayer(title);
        const colorNumbering = this.extractColorNumbering(title);

        const parts = [];
        
        if (year) parts.push(year);
        if (product) parts.push(product);
        if (player) parts.push(player);
        if (colorNumbering) parts.push(colorNumbering);

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
