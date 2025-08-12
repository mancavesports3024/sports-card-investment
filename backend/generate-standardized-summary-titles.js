const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class StandardizedSummaryTitleGenerator {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
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

    // Extract year from title
    extractYear(title) {
        // Look for 4-digit years (1900-2099)
        const yearMatch = title.match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
        return yearMatch ? yearMatch[1] : null;
    }

    // Extract product/brand from title
    extractProduct(title) {
        const products = [
            'Bowman', 'Topps', 'Panini', 'Upper Deck', 'Fleer', 'Donruss', 'Score', 'Pro Set',
            'Stadium Club', 'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Contenders',
            'National Treasures', 'Flawless', 'Immaculate', 'Limited', 'Certified', 'Elite',
            'Absolute', 'Spectra', 'Phoenix', 'Playbook', 'Momentum', 'Totally Certified',
            'Crown Royale', 'Threads', 'Prestige', 'Rookies & Stars', 'Score', 'Leaf',
            'Playoff', 'Press Pass', 'Sage', 'Hit', 'In The Game', 'Pacific', 'Skybox',
            'Metal', 'Stadium Club', 'Gallery', 'Heritage', 'Gypsy Queen', 'Allen & Ginter',
            'Archives', 'Big League', 'Fire', 'Opening Day', 'Update', 'Series 1', 'Series 2',
            'Chrome Update', 'Chrome Refractor', 'Chrome Sapphire', 'Chrome Black',
            'Bowman Chrome', 'Bowman Draft', 'Bowman Sterling', 'Bowman Platinum',
            'Topps Chrome', 'Topps Finest', 'Topps Heritage', 'Topps Archives',
            'Panini Prizm', 'Panini Select', 'Panini Contenders', 'Panini Donruss',
            'Upper Deck', 'Upper Deck SP', 'Upper Deck SPx', 'Upper Deck Exquisite'
        ];

        const titleLower = title.toLowerCase();
        for (const product of products) {
            if (titleLower.includes(product.toLowerCase())) {
                return product;
            }
        }
        return null;
    }

    // Extract player name from title
    extractPlayer(title) {
        // Common patterns for player names
        const patterns = [
            // First Last pattern
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            // Handle special cases like "LeBron James", "De'Aaron Fox"
            /\b([A-Z][a-z]+'[A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g,
            /\b([A-Z][a-z]+)\s+([A-Z][a-z]+'[A-Z][a-z]+)\b/g
        ];

        for (const pattern of patterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
                const fullName = match[0];
                // Skip common non-player words
                const skipWords = ['Bowman', 'Topps', 'Panini', 'Upper', 'Deck', 'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Contenders', 'National', 'Treasures', 'Flawless', 'Immaculate', 'Limited', 'Certified', 'Elite', 'Absolute', 'Spectra', 'Phoenix', 'Playbook', 'Momentum', 'Totally', 'Crown', 'Royale', 'Threads', 'Prestige', 'Rookies', 'Stars', 'Score', 'Leaf', 'Playoff', 'Press', 'Pass', 'Sage', 'Hit', 'Game', 'Pacific', 'Skybox', 'Metal', 'Stadium', 'Club', 'Gallery', 'Heritage', 'Gypsy', 'Queen', 'Allen', 'Ginter', 'Archives', 'Big', 'League', 'Fire', 'Opening', 'Day', 'Update', 'Series', 'Refractor', 'Sapphire', 'Black', 'Draft', 'Sterling', 'Platinum', 'SP', 'SPx', 'Exquisite'];
                
                if (!skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase()))) {
                    return fullName;
                }
            }
        }
        return null;
    }

    // Extract color/numbering from title
    extractColorNumbering(title) {
        const colorPatterns = [
            // Colors
            /\b(Red|Blue|Green|Yellow|Orange|Purple|Pink|Gold|Silver|Bronze|Black|White|Rainbow|Prism|Holo|Holographic|Refractor|Sapphire|Emerald|Ruby|Diamond|Platinum|Titanium|Carbon|Chrome|Finest|Prizm|Select|Optic|Contenders|National|Treasures|Flawless|Immaculate|Limited|Certified|Elite|Absolute|Spectra|Phoenix|Playbook|Momentum|Totally|Crown|Royale|Threads|Prestige|Rookies|Stars|Score|Leaf|Playoff|Press|Pass|Sage|Hit|Game|Pacific|Skybox|Metal|Stadium|Club|Gallery|Heritage|Gypsy|Queen|Allen|Ginter|Archives|Big|League|Fire|Opening|Day|Update|Series|Draft|Sterling|Platinum|SP|SPx|Exquisite)\b/gi,
            // Numbered cards
            /\b(\d+)\/(\d+)\b/g,
            /\b#(\d+)\b/g,
            // Special editions
            /\b(1st Edition|First Edition|Limited Edition|Special Edition|Anniversary|Century|Millennium|Legacy|Legendary|Iconic|Epic|Rare|Ultra Rare|Secret Rare|Common|Uncommon|Rare|Mythic|Legendary)\b/gi
        ];

        const found = [];
        for (const pattern of colorPatterns) {
            const matches = [...title.matchAll(pattern)];
            for (const match of matches) {
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
        
        if (year) parts.push(`(${year})`);
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
        console.log('🔄 Starting standardized summary title generation...\n');

        try {
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

            console.log('\n🎉 Standardized Summary Title Generation Complete!');
            console.log('==================================================');
            console.log(`📊 Total cards processed: ${cards.length}`);
            console.log(`🔄 Updated: ${updated}`);
            console.log(`✓ Unchanged: ${unchanged}`);
            console.log(`❌ Errors: ${errors}`);

            return {
                success: true,
                totalProcessed: cards.length,
                updated: updated,
                unchanged: unchanged,
                errors: errors
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
        console.log('🧪 Testing standardized title generation...\n');

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
module.exports = { StandardizedSummaryTitleGenerator };

// For testing locally
if (require.main === module) {
    const generator = new StandardizedSummaryTitleGenerator();
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
