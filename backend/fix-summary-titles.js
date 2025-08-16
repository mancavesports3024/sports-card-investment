const NewPricingDatabase = require('./create-new-pricing-database.js');

class SummaryTitleFixer {
    constructor() {
        this.db = new NewPricingDatabase();
        this.brands = ['Topps', 'Panini', 'Upper Deck', 'Donruss', 'Fleer', 'Bowman', 'Slania'];
        this.fixes = {
            total: 0,
            playerNameFixes: 0,
            brandFixes: 0,
            formatFixes: 0,
            errors: 0
        };
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
        await this.db.close();
    }

    // Extract clean player name from title
    extractPlayerName(title) {
        if (!title) return '';
        
        // Remove common prefixes and suffixes
        let cleanTitle = title
            .replace(/^\d{4}[-]?\d{0,2}\s*/, '') // Remove year prefix
            .replace(/PSA\s*10.*$/i, '') // Remove PSA 10 and everything after
            .replace(/GEM\s*MINT.*$/i, '') // Remove GEM MINT and everything after
            .replace(/RC.*$/i, '') // Remove RC and everything after
            .replace(/ROOKIE.*$/i, '') // Remove ROOKIE and everything after
            .replace(/AUTO.*$/i, '') // Remove AUTO and everything after
            .trim();

        // Split by spaces and take first 2-3 words as player name
        const words = cleanTitle.split(/\s+/);
        
        // Look for player name patterns
        for (let i = 0; i < Math.min(4, words.length); i++) {
            const potentialName = words.slice(0, i + 1).join(' ');
            if (potentialName.length >= 3 && !this.brands.some(brand => 
                potentialName.toLowerCase().includes(brand.toLowerCase()))) {
                return potentialName.trim();
            }
        }

        return words.slice(0, 2).join(' ').trim();
    }

    // Extract brand from title
    extractBrand(title) {
        if (!title) return '';
        
        const brandMatch = title.match(new RegExp(`\\b(${this.brands.join('|')})\\b`, 'i'));
        return brandMatch ? brandMatch[1] : '';
    }

    // Extract year from title
    extractYear(title) {
        if (!title) return '';
        
        const yearMatch = title.match(/\b(19|20)\d{2}(?:[-]\d{2})?\b/);
        return yearMatch ? yearMatch[0] : '';
    }

    // Clean up summary title
    cleanSummaryTitle(title, playerName, brand, year) {
        if (!title) return '';

        // Remove duplicate player names
        let cleaned = title;
        const playerNameRegex = new RegExp(`\\b${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = cleaned.match(playerNameRegex);
        if (matches && matches.length > 1) {
            // Keep only the first occurrence
            cleaned = cleaned.replace(playerNameRegex, (match, index) => {
                return index === 0 ? match : '';
            });
        }

        // Remove duplicate brand names
        if (brand) {
            const brandRegex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const brandMatches = cleaned.match(brandRegex);
            if (brandMatches && brandMatches.length > 1) {
                cleaned = cleaned.replace(brandRegex, (match, index) => {
                    return index === 0 ? match : '';
                });
            }
        }

        // Clean up extra spaces and formatting
        cleaned = cleaned
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/\s+([A-Z]{2,})/g, ' $1') // Fix spacing before uppercase words
            .replace(/([A-Z]{2,})\s+/g, '$1 ') // Fix spacing after uppercase words
            .trim();

        return cleaned;
    }

    // Generate a proper summary title
    generateSummaryTitle(title, playerName, brand, year) {
        if (!title || !playerName) return title;

        // Extract additional info from title
        const hasChrome = title.toLowerCase().includes('chrome');
        const hasPrizm = title.toLowerCase().includes('prizm');
        const hasAuto = title.toLowerCase().includes('auto');
        const hasRC = title.toLowerCase().includes('rc') || title.toLowerCase().includes('rookie');
        const hasNumber = title.match(/#\d+/);
        const hasParallel = title.match(/(blue|red|green|gold|silver|black|white|refractor|parallel)/i);

        let parts = [];

        // Add year if available
        if (year) parts.push(year);

        // Add brand
        if (brand) {
            let brandPart = brand;
            if (hasChrome) brandPart += ' Chrome';
            if (hasPrizm) brandPart += ' Prizm';
            parts.push(brandPart);
        }

        // Add player name
        parts.push(playerName);

        // Add additional info
        if (hasAuto) parts.push('Auto');
        if (hasRC) parts.push('RC');
        if (hasNumber) parts.push(hasNumber[0]);
        if (hasParallel) parts.push(hasParallel[0]);

        return parts.join(' ');
    }

    // Fix a single card's summary title
    async fixCardSummaryTitle(card) {
        try {
            const title = card.title || '';
            const currentSummaryTitle = card.summary_title || '';

            // Extract components
            const playerName = this.extractPlayerName(title);
            const brand = this.extractBrand(title);
            const year = this.extractYear(title);

            if (!playerName) {
                console.log(`⚠️ Could not extract player name from: "${title}"`);
                return false;
            }

            // Generate new summary title
            const newSummaryTitle = this.generateSummaryTitle(title, playerName, brand, year);

            // Clean up the new summary title
            const cleanedSummaryTitle = this.cleanSummaryTitle(newSummaryTitle, playerName, brand, year);

            // Check if it needs updating
            if (cleanedSummaryTitle !== currentSummaryTitle && cleanedSummaryTitle.length > 0) {
                await this.db.runQuery(
                    'UPDATE cards SET summary_title = ? WHERE id = ?',
                    [cleanedSummaryTitle, card.id]
                );

                console.log(`✅ Fixed card ${card.id}:`);
                console.log(`   Old: "${currentSummaryTitle}"`);
                console.log(`   New: "${cleanedSummaryTitle}"`);
                console.log(`   Player: "${playerName}", Brand: "${brand}", Year: "${year}"`);

                this.fixes.total++;
                return true;
            }

            return false;

        } catch (error) {
            console.error(`❌ Error fixing card ${card.id}:`, error);
            this.fixes.errors++;
            return false;
        }
    }

    // Fix all summary titles in the database
    async fixAllSummaryTitles() {
        console.log('🔧 Starting comprehensive summary title fix...\n');

        try {
            await this.connect();

            // Get all cards
            const cards = await this.db.allQuery('SELECT * FROM cards');
            console.log(`📊 Found ${cards.length} cards to process\n`);

            let processed = 0;
            let fixed = 0;

            // Process cards in batches to avoid overwhelming the database
            const batchSize = 10;
            for (let i = 0; i < cards.length; i += batchSize) {
                const batch = cards.slice(i, i + batchSize);
                
                console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)} (cards ${i + 1}-${Math.min(i + batchSize, cards.length)})`);

                for (const card of batch) {
                    const wasFixed = await this.fixCardSummaryTitle(card);
                    if (wasFixed) fixed++;
                    processed++;
                }

                // Progress update
                const progress = Math.round((processed / cards.length) * 100);
                console.log(`📈 Progress: ${progress}% (${processed}/${cards.length}) - Fixed: ${fixed}\n`);
            }

            console.log('🎉 Summary title fix completed!');
            console.log('=====================================');
            console.log(`📊 Total cards processed: ${processed}`);
            console.log(`✅ Cards fixed: ${fixed}`);
            console.log(`❌ Errors: ${this.fixes.errors}`);
            console.log(`📈 Success rate: ${Math.round((fixed / processed) * 100)}%`);

            return {
                success: true,
                totalProcessed: processed,
                totalFixed: fixed,
                errors: this.fixes.errors
            };

        } catch (error) {
            console.error('❌ Summary title fix failed:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            await this.close();
        }
    }
}

// Export the class
module.exports = SummaryTitleFixer;

// If run directly, execute the fix
if (require.main === module) {
    const fixer = new SummaryTitleFixer();
    fixer.fixAllSummaryTitles().then(result => {
        if (result.success) {
            console.log('\n🎉 Summary title fix completed successfully!');
            process.exit(0);
        } else {
            console.error('\n❌ Summary title fix failed:', result.error);
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Summary title fix failed:', error);
        process.exit(1);
    });
}
