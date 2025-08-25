const NewPricingDatabase = require('./create-new-pricing-database.js');

class SportsUpdaterWithESPNV2 {
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

    // Clean player name for ESPN lookups by removing team/set noise, codes and marketing terms
    cleanPlayerNameForEspn(playerName) {
        if (!playerName) return null;
        let cleaned = playerName;

        // Use existing cleaner to remove team names and common noise
        cleaned = this.db.filterTeamNamesFromPlayer(cleaned) || cleaned;

        // Remove common non-name tokens (sets, parallels, marketing, org tags)
        const noiseWords = [
            // Card brands and sets
            'autograph', 'autographs', 'auto', 'signature', 'signatures', 'rookie', 'rc',
            'debut', 'ssp', 'variation', 'psa', 'gem', 'mint', 'holo', 'prizm', 'prism',
            'mosaic', 'optic', 'select', 'finest', 'chrome', 'sapphire', 'update', 'refractor',
            'rated', 'retro', 'choice', 'wave', 'scope', 'pulsar', 'genesis', 'firestorm',
            'emergent', 'essentials', 'uptown', 'uptowns', 'logo', 'lightboard', 'planetary',
            'pursuit', 'mars', 'premium', 'box', 'set', 'pitch', 'prodigies', 'image', 'clear',
            'cut', 'premier', 'young', 'guns', 'star', 'starquest', 'tint', 'pandora', 'allies',
            'apex', 'on', 'iconic', 'knows', 'classic', 'events', 'edition', 'ucl', 'uefa', 'mls',
            'cc', 'mint2', 'kellogg', 'atl', 'colorado', 'picks', 'sky',
            
            // Additional card sets and terms from the errors
            'sun', 'ascensions', 'future', 'fireworks', 'kaboom', 'truth', 'persona', 'hoops',
            'and', 'ohtani', 'judge', 'sox', 'field', 'women', 'champions', 'origins',
            'checkerboard', 'fever', 'luck', 'lottery', 'phenom', 'lava', 'sparks', 'authentix',
            'portrait', 'national', 'razzle', 'tectonic', 'euro', 'wings',
            
            // Team names and locations
            'bears', 'lakers', 'bulls', '49ers', 'chicago', 'detroit', 'new york', 'los angeles',
            'boston', 'philadelphia', 'miami', 'atlanta', 'houston', 'dallas', 'denver', 'seattle',
            'portland', 'minnesota', 'milwaukee', 'cleveland', 'cincinnati', 'pittsburgh',
            'baltimore', 'washington', 'tampa', 'orlando', 'phoenix', 'las vegas', 'san francisco',
            'san diego', 'oakland', 'sacramento', 'memphis', 'new orleans', 'oklahoma', 'utah',
            'indiana', 'kentucky', 'tennessee', 'missouri', 'arkansas', 'louisiana', 'mississippi',
            'alabama', 'georgia', 'florida', 'south carolina', 'north carolina', 'virginia',
            'west virginia', 'maryland', 'delaware', 'new jersey', 'connecticut', 'rhode island',
            'vermont', 'new hampshire', 'maine', 'massachusetts', 'pennsylvania', 'ohio', 'michigan',
            'wisconsin', 'illinois', 'iowa', 'nebraska', 'kansas', 'texas', 'new mexico', 'arizona',
            'nevada', 'california', 'oregon', 'washington', 'idaho', 'montana', 'wyoming', 'colorado',
            'north dakota', 'south dakota',
            
            // Common card terms
            'graded', 'numbered', 'print', 'run', 'parallel', 'rainbow', 'gold', 'silver', 'bronze',
            'platinum', 'diamond', 'emerald', 'ruby', 'amethyst', 'onyx', 'obsidian', 'case hit',
            'storm chasers', 'winning ticket', 'focus', 'supernatural'
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
            { r: /\bja\s*marr\s+chase\b/gi, v: "Ja'Marr Chase" },
            { r: /\bde\s*von\b\s+achane/gi, v: "De'Von Achane" },
            { r: /\bo\s*'?\s*hearn\b/gi, v: "O'Hearn" },
            { r: /\bo\s*'?\s*hoppe\b/gi, v: "O'Hoppe" },
            { r: /\bsmith\s*njigba\b/gi, v: 'Smith-Njigba' },
            { r: /\bkuroda\s*grauer\b/gi, v: 'Kuroda-Grauer' },
            { r: /\bcee\s*dee\s+lamb\b/gi, v: 'CeeDee Lamb' },
            { r: /\bdon[cč]i[cć]\b/gi, v: 'Doncic' },
            { r: /\bt\s*j\b/gi, v: 'TJ' },
            { r: /\bcassius\s+clay\b/gi, v: 'Muhammad Ali' },
            { r: /\bryan\s+o\s*'?\s*hearn\b/gi, v: "Ryan O'Hearn" },
            { r: /\bstephon\s+castle\b/gi, v: 'Stephon Castle' },
            { r: /\bchase\s+burns\b/gi, v: 'Chase Burns' },
            { r: /\bcameron\s+brink\b/gi, v: 'Cameron Brink' },
            { r: /\blebron\s+james\b/gi, v: 'LeBron James' },
            { r: /\blando\s+norris\b/gi, v: 'Lando Norris' },
            { r: /\bderrick\s+henry\b/gi, v: 'Derrick Henry' },
            { r: /\bcaitlin\s+clark\b/gi, v: 'Caitlin Clark' },
            { r: /\bdrake\s+maye\b/gi, v: 'Drake Maye' },
            { r: /\broman\s+anthony\b/gi, v: 'Roman Anthony' },
            { r: /\balex\s+rodriguez\b/gi, v: 'Alex Rodriguez' },
            { r: /\bjack\s+grealish\b/gi, v: 'Jack Grealish' },
            { r: /\bjosh\s+allen\b/gi, v: 'Josh Allen' },
            { r: /\bfrank\s+thomas\b/gi, v: 'Frank Thomas' },
            { r: /\bsaquon\s+barkley\b/gi, v: 'Saquon Barkley' },
            { r: /\bmichael\s+penix\b/gi, v: 'Michael Penix' },
            { r: /\blarry\s+wilson\b/gi, v: 'Larry Wilson' },
            { r: /\bjayden\s+daniels\b/gi, v: 'Jayden Daniels' },
            { r: /\bdevonte\s+booker\b/gi, v: 'Devin Booker' },
            { r: /\barda\s+guler\b/gi, v: 'Arda Guler' },
            { r: /\bkris\s+draper\b/gi, v: 'Kris Draper' }
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

        if (!cleaned || cleaned.length < 2) return null;
        return cleaned;
    }

    async updateSportsForExistingCards() {
        console.log('🔄 Starting ESPN v2 sport detection update for existing cards...\n');
        
        try {
            // Get only cards with Unknown sport from the database
            const cards = await this.db.allQuery(`
                SELECT id, title, summary_title, sport, player_name 
                FROM cards 
                WHERE sport IS NULL OR sport = 'Unknown' OR sport = 'UNKNOWN'
                ORDER BY created_at DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards to process`);
            
            // Process cards in batches to avoid overwhelming the API
            const batchSize = 10;
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
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Add a longer delay between batches
                if (batchIndex < batches.length - 1) {
                    console.log('⏳ Waiting 3 seconds before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Error updating sports:', error);
            throw error;
        }
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
                newSport = await this.db.detectSportFromComprehensive(card.summary_title);
                console.log(`   Fallback to comprehensive detection (no player name)`);
            }
            
            console.log(`   New sport: ${newSport}`);
            
            // Only update if:
            // 1. Current sport is "Unknown" or "UNKNOWN" 
            // 2. New sport is not "Unknown" and is different from current
            const currentSportIsUnknown = !card.sport || card.sport === 'Unknown' || card.sport === 'UNKNOWN';
            const newSportIsValid = newSport && newSport !== 'Unknown' && newSport !== 'UNKNOWN';
            
            if (currentSportIsUnknown && newSportIsValid && newSport !== card.sport) {
                // Update the card with the new sport
                await this.db.runQuery(`
                    UPDATE cards 
                    SET sport = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [newSport, card.id]);
                
                console.log(`   ✅ Updated: ${card.sport} → ${newSport}`);
                this.updatedCount++;
            } else if (currentSportIsUnknown && (!newSportIsValid || newSport === card.sport)) {
                console.log(`   ⏭️ Skipping: Current sport is Unknown but ESPN couldn't find better sport`);
                this.unchangedCount++;
            } else if (!currentSportIsUnknown) {
                console.log(`   ⏭️ Skipping: Card already has valid sport (${card.sport})`);
                this.unchangedCount++;
            } else {
                console.log(`   ⏭️ No change needed`);
                this.unchangedCount++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.errorCount++;
        }
    }

    printSummary() {
        console.log('\n📊 ESPN v2 Sport Detection Update Summary');
        console.log('==========================================');
        console.log(`✅ Cards updated: ${this.updatedCount}`);
        console.log(`⏭️ Cards unchanged: ${this.unchangedCount}`);
        console.log(`❌ Errors: ${this.errorCount}`);
        console.log(`📈 Total processed: ${this.updatedCount + this.unchangedCount + this.errorCount}`);
        
        if (this.updatedCount > 0) {
            console.log('\n🎉 Successfully updated sports using ESPN v2 API!');
        } else {
            console.log('\nℹ️ No sports needed updating - all cards already have correct sports');
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Main execution
async function main() {
    const updater = new SportsUpdaterWithESPNV2();
    
    try {
        await updater.connect();
        await updater.updateSportsForExistingCards();
    } catch (error) {
        console.error('❌ Error in main:', error);
        process.exit(1);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ ESPN v2 sport detection update completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ ESPN v2 sport detection update failed:', error);
            process.exit(1);
        });
}

module.exports = { SportsUpdaterWithESPNV2 };
