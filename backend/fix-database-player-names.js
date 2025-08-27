const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const NewPricingDatabase = require('./create-new-pricing-database.js');

class DatabasePlayerNameFixer {
    constructor() {
        // Use Railway volume mount path if available (production), otherwise use local path
        const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        this.db = new sqlite3.Database(dbPath);
        this.extractor = new NewPricingDatabase();
        this.stats = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0
        };
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db.run("PRAGMA foreign_keys = ON", (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                } else {
                    console.log('✅ Database connection closed');
                }
                resolve();
            });
        });
    }

    // Add player_name column if it doesn't exist
    async ensurePlayerNameColumn() {
        console.log('🔍 Checking if player_name column exists...');
        
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(cards)", [], (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const hasPlayerNameColumn = columns.some(col => col.name === 'player_name');
                
                if (!hasPlayerNameColumn) {
                    console.log('➕ Adding player_name column to cards table...');
                    this.db.run("ALTER TABLE cards ADD COLUMN player_name TEXT", (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('✅ player_name column added successfully');
                            resolve();
                        }
                    });
                } else {
                    console.log('✅ player_name column already exists');
                    resolve();
                }
            });
        });
    }

    // Get all cards that need player name fixing
    async getCardsToFix() {
        console.log('🔍 Fetching cards for player name fixing...');
        
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, title, summary_title, player_name, sport 
                FROM cards 
                WHERE title IS NOT NULL 
                AND title != ''
                ORDER BY created_at DESC
            `, [], (err, cards) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`📊 Found ${cards.length} cards to process`);
                    resolve(cards);
                }
            });
        });
    }

    // Process a single card
    async processCard(card) {
        return new Promise((resolve) => {
            try {
                console.log(`\n🔍 Processing card ID ${card.id}:`);
                console.log(`   Title: ${card.title}`);
                console.log(`   Current player_name: ${card.player_name || 'NULL'}`);
                
                // Extract player name using improved system
                const extractedPlayerName = this.extractor.extractPlayerName(card.title);
                
                if (!extractedPlayerName) {
                    console.log(`   ❌ No player name extracted`);
                    this.stats.unchanged++;
                    resolve();
                    return;
                }
                
                console.log(`   ✅ Extracted player name: ${extractedPlayerName}`);
                
                // Check if the player name actually changed
                if (card.player_name && extractedPlayerName.toLowerCase() === card.player_name.toLowerCase()) {
                    console.log(`   ⏭️ Player name unchanged`);
                    this.stats.unchanged++;
                    resolve();
                    return;
                }
                
                // Update the database
                this.db.run(`
                    UPDATE cards 
                    SET player_name = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [extractedPlayerName, card.id], (err) => {
                    if (err) {
                        console.error(`   ❌ Error updating card ${card.id}:`, err.message);
                        this.stats.errors++;
                    } else {
                        console.log(`   ✅ Updated: "${card.player_name || 'NULL'}" → "${extractedPlayerName}"`);
                        this.stats.updated++;
                    }
                    resolve();
                });
                
            } catch (error) {
                console.error(`   ❌ Error processing card ${card.id}:`, error.message);
                this.stats.errors++;
                resolve();
            }
        });
    }

    // Process all cards
    async fixAllPlayerNames() {
        console.log('🚀 Starting player name fixing process...\n');
        
        try {
            await this.ensurePlayerNameColumn();
            const cards = await this.getCardsToFix();
            this.stats.total = cards.length;
            
            console.log(`📋 Processing ${cards.length} cards...\n`);
            
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                console.log(`\n${'='.repeat(60)}`);
                console.log(`Card ${i + 1} of ${cards.length}`);
                console.log(`${'='.repeat(60)}`);
                
                await this.processCard(card);
                
                // Progress indicator
                if ((i + 1) % 10 === 0) {
                    console.log(`\n📊 Progress: ${i + 1}/${cards.length} cards processed`);
                    console.log(`   Updated: ${this.stats.updated}`);
                    console.log(`   Unchanged: ${this.stats.unchanged}`);
                    console.log(`   Errors: ${this.stats.errors}`);
                }
            }
            
            this.printFinalStats();
            
        } catch (error) {
            console.error('❌ Error in fixAllPlayerNames:', error);
        }
    }

    // Print final statistics
    printFinalStats() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🎯 FINAL STATISTICS');
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 Total cards processed: ${this.stats.total}`);
        console.log(`✅ Player names updated: ${this.stats.updated}`);
        console.log(`⏭️ Player names unchanged: ${this.stats.unchanged}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`📈 Success rate: ${((this.stats.updated / this.stats.total) * 100).toFixed(1)}%`);
        console.log(`${'='.repeat(60)}`);
    }

    // Test on a small sample first
    async testOnSample(limit = 5) {
        console.log(`🧪 Testing on sample of ${limit} cards...\n`);
        
        try {
            await this.ensurePlayerNameColumn();
            
            return new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT id, title, summary_title, player_name, sport 
                    FROM cards 
                    WHERE title IS NOT NULL 
                    AND title != ''
                    ORDER BY created_at DESC
                    LIMIT ?
                `, [limit], (err, cards) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    console.log(`📊 Found ${cards.length} cards for testing`);
                    
                    cards.forEach((card, index) => {
                        console.log(`\n${'='.repeat(60)}`);
                        console.log(`Testing card ID ${card.id}:`);
                        console.log(`   Title: ${card.title}`);
                        console.log(`   Current player_name: ${card.player_name || 'NULL'}`);
                        
                        const extractedPlayerName = this.extractor.extractPlayerName(card.title);
                        console.log(`   ✅ Extracted player name: ${extractedPlayerName || 'NOT FOUND'}`);
                        
                        if (extractedPlayerName && (!card.player_name || extractedPlayerName.toLowerCase() !== card.player_name.toLowerCase())) {
                            console.log(`   🔄 Would update: "${card.player_name || 'NULL'}" → "${extractedPlayerName}"`);
                        } else {
                            console.log(`   ⏭️ Would leave unchanged`);
                        }
                    });
                    
                    console.log(`\n${'='.repeat(60)}`);
                    console.log('🧪 Test completed - no database changes made');
                    console.log(`${'='.repeat(60)}`);
                    resolve();
                });
            });
            
        } catch (error) {
            console.error('❌ Error in testOnSample:', error);
        }
    }
}

// Main execution
async function main() {
    const fixer = new DatabasePlayerNameFixer();
    
    try {
        await fixer.connect();
        
        // Check command line arguments
        const args = process.argv.slice(2);
        
        if (args.includes('--test') || args.includes('-t')) {
            const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || 5;
            await fixer.testOnSample(parseInt(limit));
        } else {
            await fixer.fixAllPlayerNames();
        }
        
    } catch (error) {
        console.error('❌ Error in main:', error);
    } finally {
        await fixer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { DatabasePlayerNameFixer };
