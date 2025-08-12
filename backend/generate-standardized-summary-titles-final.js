const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class StandardizedSummaryTitleGeneratorFinal {
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
            'Bowman Chrome', 'Bowman Draft', 'Bowman Sterling', 'Bowman Platinum', 'Bowman University',
            'Topps Chrome', 'Topps Finest', 'Topps Heritage', 'Topps Archives', 'Topps Update',
            'Panini Prizm', 'Panini Select', 'Panini Contenders', 'Panini Donruss', 'Panini Optic',
            'Upper Deck SP', 'Upper Deck SPx', 'Upper Deck Exquisite', 'Upper Deck',
            'Stadium Club', 'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Contenders',
            'National Treasures', 'Flawless', 'Immaculate', 'Limited', 'Certified', 'Elite',
            'Absolute', 'Spectra', 'Phoenix', 'Playbook', 'Momentum', 'Totally Certified',
            'Crown Royale', 'Threads', 'Prestige', 'Rookies & Stars', 'Score', 'Leaf',
            'Playoff', 'Press Pass', 'Sage', 'Hit', 'In The Game', 'Pacific', 'Skybox',
            'Metal', 'Gallery', 'Heritage', 'Gypsy Queen', 'Allen & Ginter',
            'Archives', 'Big League', 'Fire', 'Opening Day', 'Series 1', 'Series 2',
            'Chrome Update', 'Chrome Refractor', 'Chrome Sapphire', 'Chrome Black',
            'Bowman', 'Topps', 'Panini', 'Fleer', 'Donruss'
        ];

        const titleLower = title.toLowerCase();
        for (const product of products) {
            if (titleLower.includes(product.toLowerCase())) {
                return product;
            }
        }
        return null;
    }

    // Extract player name from title (final improved version)
    extractPlayer(title) {
        // First, clean the title to remove common non-player terms
        let cleanTitle = title;
        const removeTerms = [
            'PSA 10', 'PSA10', 'GEM MINT', 'Gem Mint', 'MT 10', 'MT10',
            'RC', 'Rookie', 'ROOKIE', 'rookie', 'SP', 'sp',
            'AUTO', 'auto', 'Autograph', 'autograph',
            'GRADED', 'Graded', 'graded', 'UNGRADED', 'Ungraded', 'ungraded',
            'CERT', 'Cert', 'cert', 'CERTIFICATE', 'Certificate', 'certificate',
            'POP', 'Pop', 'pop', 'POPULATION', 'Population', 'population',
            'Bowman', 'Topps', 'Panini', 'Upper', 'Deck', 'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Contenders', 'National', 'Treasures', 'Flawless', 'Immaculate', 'Limited', 'Certified', 'Elite', 'Absolute', 'Spectra', 'Phoenix', 'Playbook', 'Momentum', 'Totally', 'Crown', 'Royale', 'Threads', 'Prestige', 'Rookies', 'Stars', 'Score', 'Leaf', 'Playoff', 'Press', 'Pass', 'Sage', 'Hit', 'Game', 'Pacific', 'Skybox', 'Metal', 'Stadium', 'Club', 'Gallery', 'Heritage', 'Gypsy', 'Queen', 'Allen', 'Ginter', 'Archives', 'Big', 'League', 'Fire', 'Opening', 'Day', 'Update', 'Series', 'Draft', 'Sterling', 'Platinum', 'SP', 'SPx', 'Exquisite', 'University', 'Prospects', 'Rated', 'Rookie', 'Lunar', 'Glow', 'Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Gold', 'Silver', 'Bronze', 'Black', 'White', 'Rainbow', 'Prism', 'Holo', 'Holographic', 'Refractor', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Platinum', 'Titanium', 'Carbon'
        ];

        removeTerms.forEach(term => {
            const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, '');
        });

        // Look for player name patterns
        const patterns = [
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
                const skipWords = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Gold', 'Silver', 'Bronze', 'Black', 'White', 'Rainbow', 'Prism', 'Holo', 'Holographic', 'Refractor', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Platinum', 'Titanium', 'Carbon', 'Chrome', 'Finest', 'Prizm', 'Select', 'Optic', 'Contenders', 'National', 'Treasures', 'Flawless', 'Immaculate', 'Limited', 'Certified', 'Elite', 'Absolute', 'Spectra', 'Phoenix', 'Playbook', 'Momentum', 'Totally', 'Crown', 'Royale', 'Threads', 'Prestige', 'Rookies', 'Stars', 'Score', 'Leaf', 'Playoff', 'Press', 'Pass', 'Sage', 'Hit', 'Game', 'Pacific', 'Skybox', 'Metal', 'Stadium', 'Club', 'Gallery', 'Heritage', 'Gypsy', 'Queen', 'Allen', 'Ginter', 'Archives', 'Big', 'League', 'Fire', 'Opening', 'Day', 'Update', 'Series', 'Draft', 'Sterling', 'Platinum', 'SP', 'SPx', 'Exquisite'];
                
                if (!skipWords.some(word => fullName.toLowerCase().includes(word.toLowerCase())) && fullName.length > 3) {
                    return fullName;
                }
            }
        }
        return null;
    }

    // Extract color/numbering from title
    extractColorNumbering(title) {
        const patterns = [
            // Colors
            /\b(Red|Blue|Green|Yellow|Orange|Purple|Pink|Gold|Silver|Bronze|Black|White|Rainbow|Prism|Holo|Holographic|Refractor|Sapphire|Emerald|Ruby|Diamond|Platinum|Titanium|Carbon|Chrome|Finest|Prizm|Select|Optic|Contenders|National|Treasures|Flawless|Immaculate|Limited|Certified|Elite|Absolute|Spectra|Phoenix|Playbook|Momentum|Totally|Crown|Royale|Threads|Prestige|Rookies|Stars|Score|Leaf|Playoff|Press|Pass|Sage|Hit|Game|Pacific|Skybox|Metal|Stadium|Club|Gallery|Heritage|Gypsy|Queen|Allen|Ginter|Archives|Big|League|Fire|Opening|Day|Update|Series|Draft|Sterling|Platinum|SP|SPx|Exquisite)\b/gi,
            // Card numbers with # symbol
            /#\d+/g,
            // Numbered cards (like /150)
            /\b(\d+)\/(\d+)\b/g,
            // Special card numbers
            /\bBCP-(\d+)\b/gi,
            /\b(\d+)TF(\d+)\b/gi,
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
        console.log('🧪 Testing standardized title generation (Final)...\n');

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
module.exports = { StandardizedSummaryTitleGeneratorFinal };

// For testing locally
if (require.main === module) {
    const generator = new StandardizedSummaryTitleGeneratorFinal();
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
