const NewPricingDatabase = require('./create-new-pricing-database.js');

class UnknownSportsUpdater {
    constructor() {
        this.db = new NewPricingDatabase();
        this.updatedCount = 0;
        this.unchangedCount = 0;
        this.errorCount = 0;
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async updateUnknownSports() {
        console.log('🔄 Starting sport detection update for cards with Unknown sport...\n');
        
        try {
            // Get only cards with Unknown sport
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, sport, player_name 
                FROM cards 
                WHERE sport = 'Unknown' OR sport IS NULL
                ORDER BY created_at DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards with Unknown sport to process`);
            
            if (cards.length === 0) {
                console.log('🎉 No cards with Unknown sport found!');
                return;
            }
            
            // Process cards in batches to avoid overwhelming the API
            const batchSize = 5; // Smaller batch size for unknown sports
            const batches = [];
            
            for (let i = 0; i < cards.length; i += batchSize) {
                batches.push(cards.slice(i, i + batchSize));
            }
            
            console.log(`📦 Processing in ${batches.length} batches of ${batchSize} cards each\n`);
            
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)`);
                
                for (const card of batch) {
                    await this.processCard(card);
                    
                    // Add a small delay between cards to be respectful to the API
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                
                // Add a longer delay between batches
                if (batchIndex < batches.length - 1) {
                    console.log('⏳ Waiting 5 seconds before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Error updating unknown sports:', error);
            throw error;
        }
    }

    // Clean player name for ESPN lookups by removing team/set noise, codes and marketing terms
    cleanPlayerNameForEspn(playerName) {
        if (!playerName) return null;
        let cleaned = playerName;

        // Use existing cleaner to remove team names and common noise
        cleaned = this.db.filterTeamNamesFromPlayer(cleaned) || cleaned;

        // Remove common non-name tokens (sets, parallels, marketing, org tags)
        const noiseWords = [
            'autograph', 'autographs', 'auto', 'signature', 'signatures', 'rookie', 'rc',
            'debut', 'ssp', 'variation', 'psa', 'gem', 'mint', 'holo', 'prizm', 'prism',
            'mosaic', 'optic', 'select', 'finest', 'chrome', 'sapphire', 'update', 'refractor',
            'rated', 'retro', 'choice', 'wave', 'scope', 'pulsar', 'genesis', 'firestorm',
            'emergent', 'essentials', 'uptown', 'uptowns', 'logo', 'lightboard', 'planetary',
            'pursuit', 'mars', 'premium', 'box', 'set', 'pitch', 'prodigies', 'image', 'clear',
            'cut', 'premier', 'young', 'guns', 'star', 'starquest', 'tint', 'pandora', 'allies',
            'apex', 'on', 'iconic', 'knows', 'classic', 'events', 'edition', 'ucl', 'uefa', 'mls',
            'cc', 'mint2', 'kellogg', 'atl', 'colorado', 'picks', 'sky'
        ];
        const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
        cleaned = cleaned.replace(noiseRegex, ' ');

        // Remove set/code fragments like #RS-SGA, #CRA-AJ, CRA-AJ, RS SGA
        cleaned = cleaned.replace(/#?[A-Z]{2,4}-[A-Z]{1,4}\b/g, ' ');
        cleaned = cleaned.replace(/#?[A-Z]{2,4}\s+[A-Z]{2,4}\b/g, ' ');
        // Remove alphanumeric codes like UV15, DT36, CE14, SG5, MJ9, BDC13, ROH, CPANR, CPANK
        cleaned = cleaned.replace(/\b[A-Z]{2,5}\d{1,4}\b/g, ' ');
        cleaned = cleaned.replace(/\b(CPANR|CPANK|CPANP|BDC|BDP|ROH)\b/gi, ' ');

        // Remove standalone short ALL-CAPS tokens (2-4 letters) except valid suffixes
        cleaned = cleaned.replace(/\b(?!JR|SR|II|III|IV)[A-Z]{2,4}\b/g, ' ');

        // Normalize diacritics
        try { cleaned = cleaned.normalize('NFD').replace(/[\u0300-\u036f]+/g, ''); } catch (_) {}

        // Normalize known multi-word names and apostrophes/hyphens
        const replacements = [
            { r: /\bja\s*marr\b/gi, v: "Ja'Marr" },
            { r: /\bde\s*von\b\s+achane/gi, v: "De'Von Achane" },
            { r: /\bo\s*'?\s*hearn\b/gi, v: "O'Hearn" },
            { r: /\bo\s*'?\s*hoppe\b/gi, v: "O'Hoppe" },
            { r: /\bsmith\s*njigba\b/gi, v: 'Smith-Njigba' },
            { r: /\bkuroda\s*grauer\b/gi, v: 'Kuroda-Grauer' },
            { r: /\bcee\s*dee\s+lamb\b/gi, v: 'CeeDee Lamb' },
            { r: /\bdon[cč]i[cć]\b/gi, v: 'Doncic' },
            { r: /\bt\s*j\b/gi, v: 'TJ' }
        ];
        for (const { r, v } of replacements) cleaned = cleaned.replace(r, v);

        // If multiple names remain (e.g., duals), keep up to first 3 tokens (First Middle Last)
        let tokens = cleaned.split(/\s+/).filter(Boolean);
        if (tokens.length > 3) tokens = tokens.slice(0, 3);
        cleaned = tokens.join(' ');

        // Remove stray punctuation
        cleaned = cleaned.replace(/[.,;:()\[\]{}&]/g, ' ');

        // Token-level cleanup: drop very short tokens except allowed particles
        const allowedParticles = new Set(['jr','sr','ii','iii','iv','de','la','le','da','di','van','von','st']);
        cleaned = cleaned
            .split(/\s+/)
            .filter(tok => {
                const t = tok.toLowerCase();
                if (t.length <= 2 && !allowedParticles.has(t)) return false;
                return true;
            })
            .join(' ');

        // Collapse spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Capitalize nicely
        cleaned = this.db.capitalizePlayerName(cleaned) || cleaned;

        // If the result is too short, consider it invalid
        if (!cleaned || cleaned.length < 2) return null;
        return cleaned;
    }

    async processCard(card) {
        try {
            console.log(`\n🎯 Processing: ${card.title}`);
            console.log(`   Summary title: ${card.summary_title}`);
            console.log(`   Player name: ${card.player_name}`);
            console.log(`   Current sport: ${card.sport}`);
            
            // Use the already extracted player_name for sport detection if available
            let newSport;
            if (card.player_name) {
                // Clean player name before ESPN lookup
                const cleanedPlayer = this.cleanPlayerNameForEspn(card.player_name);
                const queryName = cleanedPlayer || card.player_name;
                newSport = await this.db.espnDetector.detectSportFromPlayer(queryName);
                console.log(`   Using ESPN v2 API with player name: ${queryName}${cleanedPlayer ? ` (from: ${card.player_name})` : ''}`);
            } else {
                // Fallback to comprehensive detection if no player name
                newSport = await this.db.detectSportFromComprehensive(card.title);
                console.log(`   Fallback to comprehensive detection (no player name)`);
            }
            
            console.log(`   New sport: ${newSport}`);
            
            if (newSport && newSport !== 'Unknown' && newSport !== card.sport) {
                // Update the card with the new sport
                await this.db.runQuery(`
                    UPDATE cards 
                    SET sport = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [newSport, card.id]);
                
                console.log(`   ✅ Updated: ${card.sport} → ${newSport}`);
                this.updatedCount++;
            } else {
                console.log(`   ⏭️ No change needed (still Unknown or no valid sport detected)`);
                this.unchangedCount++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.errorCount++;
        }
    }

    printSummary() {
        console.log('\n📊 Unknown Sports Update Summary');
        console.log('================================');
        console.log(`✅ Cards updated: ${this.updatedCount}`);
        console.log(`⏭️ Cards unchanged: ${this.unchangedCount}`);
        console.log(`❌ Errors: ${this.errorCount}`);
        console.log(`📈 Total processed: ${this.updatedCount + this.unchangedCount + this.errorCount}`);
        
        if (this.updatedCount > 0) {
            console.log('\n🎉 Successfully updated unknown sports!');
        } else {
            console.log('\nℹ️ No unknown sports were updated - may need manual review');
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addUnknownSportsUpdateRoute(app) {
    app.post('/api/admin/update-unknown-sports', async (req, res) => {
        try {
            console.log('🔄 Update unknown sports endpoint called');
            
            const updater = new UnknownSportsUpdater();
            await updater.connect();
            await updater.updateUnknownSports();
            await updater.close();

            res.json({
                success: true,
                message: 'Unknown sports update completed successfully',
                results: {
                    updated: updater.updatedCount,
                    unchanged: updater.unchangedCount,
                    errors: updater.errorCount,
                    totalProcessed: updater.updatedCount + updater.unchangedCount + updater.errorCount
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error in update unknown sports endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating unknown sports',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { UnknownSportsUpdater, addUnknownSportsUpdateRoute };
