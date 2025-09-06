/**
 * Railway Player Extraction Script
 * 
 * This script runs on Railway to update all player names in the production database
 * using the new centralized SimplePlayerExtractor system.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const SimplePlayerExtractor = require('./simple-player-extraction.js');
const NewPricingDatabase = require('./create-new-pricing-database.js');

class RailwayPlayerExtractor {
    constructor() {
        // Connect to Railway SQLite database
        const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        this.db = new sqlite3.Database(dbPath);
        this.extractor = new SimplePlayerExtractor();
        this.pricingDb = new NewPricingDatabase();
        this.stats = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0,
            empty: 0
        };
    }

    async connect() {
        // Connect to the main database
        const dbPromise = new Promise((resolve, reject) => {
            this.db.get("SELECT 1", (err) => {
                if (err) {
                    console.error('❌ Failed to connect to database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to Railway SQLite database');
                    resolve();
                }
            });
        });
        
        // Connect to the pricing database for extraction methods
        await this.pricingDb.connect();
        console.log('✅ Connected to pricing database for extraction methods');
        
        return dbPromise;
    }

    async close() {
        // Close the pricing database
        if (this.pricingDb) {
            await this.pricingDb.close();
            console.log('✅ Pricing database connection closed');
        }
        
        // Close the main database
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

    // Ensure player_name column exists
    async ensurePlayerNameColumn() {
        console.log('🔍 Checking if player_name column exists...');
        
        return new Promise((resolve, reject) => {
            this.db.get("PRAGMA table_info(cards)", (err, rows) => {
                if (err) {
                    console.error('❌ Error checking table schema:', err.message);
                    reject(err);
                    return;
                }
                
                // Check if player_name column exists
                this.db.all("PRAGMA table_info(cards)", (err, columns) => {
                    if (err) {
                        console.error('❌ Error getting table info:', err.message);
                        reject(err);
                        return;
                    }
                    
                    const hasPlayerNameColumn = columns.some(col => col.name === 'player_name');
                    
                    if (!hasPlayerNameColumn) {
                        console.log('➕ Adding player_name column to cards table...');
                        this.db.run("ALTER TABLE cards ADD COLUMN player_name TEXT", (err) => {
                            if (err) {
                                console.error('❌ Error adding player_name column:', err.message);
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
        });
    }

    // Get all cards that need player name updating
    async getCardsToUpdate() {
        console.log('🔍 Fetching cards for player name updating...');
        
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, title, summary_title, player_name, sport 
                FROM cards 
                WHERE title IS NOT NULL 
                AND title != ''
                ORDER BY created_at DESC
            `, (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards:', err.message);
                    reject(err);
                } else {
                    console.log(`📊 Found ${rows.length} cards to process`);
                    resolve(rows);
                }
            });
        });
    }

    // Process a single card
    async processCard(card) {
        try {
            console.log(`\n🔍 Processing card ID ${card.id}:`);
            console.log(`   Title: ${card.title}`);
            
            // Extract player name using the updated NewPricingDatabase system (includes sapphire fix)
            const extractedPlayerName = this.pricingDb.extractPlayerName(card.title);
            
            console.log(`   Extracted: "${extractedPlayerName}"`);
            console.log(`   Current: "${card.player_name || 'NULL'}"`);
            
            // Check if player name is empty
            if (!extractedPlayerName || extractedPlayerName.trim() === '') {
                console.log(`   ⚠️  No player name extracted - keeping current value`);
                this.stats.empty++;
                return;
            }
            
            // Check if player name has changed
            if (card.player_name === extractedPlayerName) {
                console.log(`   ✅ No change needed`);
                this.stats.unchanged++;
            } else {
                // Update the player name in the database
                await this.updatePlayerName(card.id, extractedPlayerName);
                console.log(`   ✅ Updated player name`);
                this.stats.updated++;
            }
            
            this.stats.total++;
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.stats.errors++;
        }
    }

    // Update player name in database
    async updatePlayerName(cardId, playerName) {
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE cards SET player_name = ? WHERE id = ?",
                [playerName, cardId],
                function(err) {
                    if (err) {
                        console.error(`   ❌ Error updating card ${cardId}:`, err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Update all player names
    async updateAllPlayerNames() {
        try {
            console.log('🚀 Starting player name update with new centralized system...');
            
            // Ensure player_name column exists
            await this.ensurePlayerNameColumn();
            
            // Get all cards to update
            const cards = await this.getCardsToUpdate();
            
            if (cards.length === 0) {
                console.log('📊 No cards found to process');
                return;
            }
            
            console.log(`📊 Processing ${cards.length} cards...`);
            
            // Process each card
            for (const card of cards) {
                await this.processCard(card);
            }
            
            console.log('\n✅ Player name update completed!');
            this.printFinalStats();
            
        } catch (error) {
            console.error('❌ Error updating player names:', error.message);
            throw error;
        }
    }

    // Print final statistics
    printFinalStats() {
        console.log('\n📊 Final Statistics:');
        console.log(`   Total cards processed: ${this.stats.total}`);
        console.log(`   Cards updated: ${this.stats.updated}`);
        console.log(`   Cards unchanged: ${this.stats.unchanged}`);
        console.log(`   Cards with no player name: ${this.stats.empty}`);
        console.log(`   Errors: ${this.stats.errors}`);
    }
}

// Main execution
async function main() {
    const extractor = new RailwayPlayerExtractor();
    
    try {
        await extractor.connect();
        await extractor.updateAllPlayerNames();
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    } finally {
        await extractor.close();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = RailwayPlayerExtractor;
