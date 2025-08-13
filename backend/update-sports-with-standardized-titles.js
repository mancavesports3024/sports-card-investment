const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');
const { ESPNSportDetectorV2Integrated } = require('./espn-sport-detector-v2-integrated.js');

class SportsUpdaterWithStandardizedTitles {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
        this.titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
        this.espnDetector = new ESPNSportDetectorV2Integrated();
        this.titleGeneratorInitialized = false;
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

    async initializeTitleGenerator() {
        if (this.titleGeneratorInitialized) {
            return;
        }
        
        try {
            console.log('🧠 Initializing database-driven standardized title generator...');
            await this.titleGenerator.connect();
            await this.titleGenerator.learnFromDatabase();
            this.titleGeneratorInitialized = true;
            console.log('✅ Title generator initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing title generator:', error);
            throw error;
        }
    }

    async extractPlayerNameFromTitle(title) {
        try {
            // Use our advanced player extraction from the standardized title generator
            const player = this.titleGenerator.extractPlayer(title);
            return player;
        } catch (error) {
            console.warn(`⚠️ Player extraction failed for "${title}": ${error.message}`);
            return null;
        }
    }

    async detectSportForCard(card) {
        try {
            // First, try to extract player name using our improved method
            const playerName = await this.extractPlayerNameFromTitle(card.title);
            
            if (playerName) {
                console.log(`🔍 Extracted player: "${playerName}" from title: "${card.title}"`);
                
                // Use ESPN API to detect sport
                const sport = await this.espnDetector.detectSportFromPlayer(playerName);
                
                if (sport && sport !== 'Unknown') {
                    console.log(`✅ ESPN API detected sport for ${playerName}: ${sport}`);
                    return sport;
                } else {
                    console.log(`❌ ESPN API could not determine sport for ${playerName}`);
                }
            } else {
                console.log(`⚠️ Could not extract player name from: "${card.title}"`);
            }
            
            // Fallback: try with summary title if available
            if (card.summary_title && card.summary_title !== card.title) {
                const summaryPlayerName = await this.extractPlayerNameFromTitle(card.summary_title);
                if (summaryPlayerName) {
                    console.log(`🔍 Trying summary title - extracted player: "${summaryPlayerName}"`);
                    const sport = await this.espnDetector.detectSportFromPlayer(summaryPlayerName);
                    if (sport && sport !== 'Unknown') {
                        console.log(`✅ ESPN API detected sport for ${summaryPlayerName}: ${sport}`);
                        return sport;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Error detecting sport for card ${card.id}:`, error.message);
            return null;
        }
    }

    async updateSportsWithStandardizedTitles() {
        console.log('🔄 Starting sport detection update using standardized title player extraction...\n');

        try {
            // Connect to database first
            await this.connect();
            
            // Initialize title generator
            await this.initializeTitleGenerator();

            // Get all cards that need sport detection
            const cards = await this.runQuery(`
                SELECT id, title, summary_title, sport 
                FROM cards 
                WHERE sport IS NULL OR sport = 'Unknown' OR sport = 'UNKNOWN'
                ORDER BY id
            `);

            console.log(`📊 Found ${cards.length} cards needing sport detection`);

            let updated = 0;
            let unchanged = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    console.log(`\n🔍 Processing card ${card.id}: "${card.title}"`);
                    
                    const detectedSport = await this.detectSportForCard(card);
                    
                    if (detectedSport) {
                        await this.runUpdate(
                            'UPDATE cards SET sport = ? WHERE id = ?',
                            [detectedSport, card.id]
                        );
                        
                        console.log(`✅ Updated card ${card.id}: sport = "${detectedSport}"`);
                        updated++;
                    } else {
                        console.log(`⚠️ Could not detect sport for card ${card.id}`);
                        unchanged++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                    errors++;
                }
            }

            console.log('\n🎉 Sport Detection Update Complete!');
            console.log('====================================');
            console.log(`📊 Total cards processed: ${cards.length}`);
            console.log(`🔄 Updated: ${updated}`);
            console.log(`⚠️ Unchanged: ${unchanged}`);
            console.log(`❌ Errors: ${errors}`);

            return {
                success: true,
                totalProcessed: cards.length,
                updated: updated,
                unchanged: unchanged,
                errors: errors
            };

        } catch (error) {
            console.error('❌ Error during sport detection update:', error);
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
            if (this.titleGenerator && this.titleGenerator.db) {
                this.titleGenerator.db.close();
            }
        }
    }
}

// Export for use
module.exports = { SportsUpdaterWithStandardizedTitles };

// For testing locally
if (require.main === module) {
    const updater = new SportsUpdaterWithStandardizedTitles();
    updater.updateSportsWithStandardizedTitles()
        .then((result) => {
            console.log('\n✅ Sport detection update completed successfully');
            console.log('Results:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Sport detection update failed:', error);
            process.exit(1);
        });
}
