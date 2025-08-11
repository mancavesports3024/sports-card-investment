const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EnhancedSportDetector } = require('./enhanced-sport-detector');

class SportDetectionUpdater {
    constructor() {
        // Use the Railway database path (same as other scripts)
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
        this.detector = new EnhancedSportDetector();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, async (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    await this.detector.connect();
                    resolve();
                }
            });
        });
    }

    async updateSportDetection() {
        try {
            console.log('🔄 Starting sport detection update...');
            
            // Get all cards with unknown or missing sport
            const cards = await this.getCardsToUpdate();
            console.log(`📊 Found ${cards.length} cards to update`);
            
            let updatedCount = 0;
            let errorCount = 0;
            
            for (const card of cards) {
                try {
                    const detectedSport = await this.detector.detectSport(card.title);
                    
                    if (detectedSport && detectedSport !== 'Unknown') {
                        await this.updateCardSport(card.id, detectedSport);
                        updatedCount++;
                        
                        if (updatedCount % 100 === 0) {
                            console.log(`✅ Updated ${updatedCount} cards so far...`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error updating card ${card.id}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log(`\n🎉 Sport detection update complete!`);
            console.log(`✅ Updated: ${updatedCount} cards`);
            console.log(`❌ Errors: ${errorCount} cards`);
            
        } catch (error) {
            console.error('❌ Error in sport detection update:', error);
        }
    }

    async getCardsToUpdate() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, sport 
                FROM cards 
                WHERE sport IS NULL OR sport = 'Unknown' OR sport = ''
                ORDER BY id DESC
                LIMIT 1000
            `;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async updateCardSport(cardId, sport) {
        return new Promise((resolve, reject) => {
            const query = `UPDATE cards SET sport = ? WHERE id = ?`;
            
            this.db.run(query, [sport, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
        await this.detector.close();
    }
}

// Run the sport detection update
async function main() {
    const updater = new SportDetectionUpdater();
    
    try {
        await updater.connect();
        await updater.updateSportDetection();
    } catch (error) {
        console.error('❌ Sport detection update failed:', error);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Sport detection update script complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Sport detection update script failed:', error);
        process.exit(1);
    });
}

module.exports = { SportDetectionUpdater };
