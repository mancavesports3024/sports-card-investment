/**
 * Railway Player Extraction Script
 * 
 * This script runs on Railway to update all player names in the production database
 * using the new centralized SimplePlayerExtractor system.
 */

const { Pool } = require('pg');
const SimplePlayerExtractor = require('./simple-player-extraction.js');

class RailwayPlayerExtractor {
    constructor() {
        // Connect to Railway PostgreSQL database
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        
        this.extractor = new SimplePlayerExtractor();
        this.stats = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0,
            empty: 0
        };
    }

    async connect() {
        try {
            const client = await this.pool.connect();
            console.log('✅ Connected to Railway PostgreSQL database');
            client.release();
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
        console.log('✅ Database connection closed');
    }

    // Ensure player_name column exists
    async ensurePlayerNameColumn() {
        console.log('🔍 Checking if player_name column exists...');
        
        try {
            const client = await this.pool.connect();
            
            // Check if player_name column exists
            const result = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'cards' 
                AND column_name = 'player_name'
            `);
            
            if (result.rows.length === 0) {
                console.log('➕ Adding player_name column to cards table...');
                await client.query(`
                    ALTER TABLE cards 
                    ADD COLUMN player_name TEXT
                `);
                console.log('✅ player_name column added successfully');
            } else {
                console.log('✅ player_name column already exists');
            }
            
            client.release();
        } catch (error) {
            console.error('❌ Error ensuring player_name column:', error.message);
            throw error;
        }
    }

    // Get all cards that need player name updating
    async getCardsToUpdate() {
        console.log('🔍 Fetching cards for player name updating...');
        
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT id, title, summary_title, player_name, sport 
                FROM cards 
                WHERE title IS NOT NULL 
                AND title != ''
                ORDER BY created_at DESC
            `);
            
            client.release();
            
            console.log(`📊 Found ${result.rows.length} cards to process`);
            return result.rows;
            
        } catch (error) {
            console.error('❌ Error fetching cards:', error.message);
            throw error;
        }
    }

    // Process a single card
    async processCard(card) {
        try {
            console.log(`\n🔍 Processing card ID ${card.id}:`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Current player_name: ${card.player_name || 'NULL'}`);
            
            // Extract player name using new centralized system
            const extractedPlayerName = this.extractor.extractPlayerName(card.title);
            
            if (!extractedPlayerName || extractedPlayerName.trim() === '') {
                console.log(`   ❌ No player name extracted`);
                this.stats.empty++;
                return;
            }
            
            console.log(`   ✅ Extracted player name: ${extractedPlayerName}`);
            
            // Check if the player name actually changed
            if (card.player_name && extractedPlayerName.toLowerCase() === card.player_name.toLowerCase()) {
                console.log(`   ⏭️ Player name unchanged`);
                this.stats.unchanged++;
                return;
            }
            
            // Update the database
            const client = await this.pool.connect();
            await client.query(`
                UPDATE cards 
                SET player_name = $1, last_updated = CURRENT_TIMESTAMP 
                WHERE id = $2
            `, [extractedPlayerName, card.id]);
            
            client.release();
            
            console.log(`   ✅ Updated: "${card.player_name || 'NULL'}" → "${extractedPlayerName}"`);
            this.stats.updated++;
            
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
            this.stats.errors++;
        }
    }

    // Process all cards
    async updateAllPlayerNames() {
        console.log('🚀 Starting player name update process with new centralized system on Railway...\n');
        
        try {
            await this.ensurePlayerNameColumn();
            const cards = await this.getCardsToUpdate();
            this.stats.total = cards.length;
            
            console.log(`📋 Processing ${cards.length} cards with new SimplePlayerExtractor...\n`);
            
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
                    console.log(`   Empty: ${this.stats.empty}`);
                    console.log(`   Errors: ${this.stats.errors}`);
                }
            }
            
            this.printFinalStats();
            
        } catch (error) {
            console.error('❌ Error in updateAllPlayerNames:', error);
        }
    }

    // Print final statistics
    printFinalStats() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🎯 FINAL STATISTICS - RAILWAY PRODUCTION DATABASE');
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 Total cards processed: ${this.stats.total}`);
        console.log(`✅ Player names updated: ${this.stats.updated}`);
        console.log(`⏭️ Player names unchanged: ${this.stats.unchanged}`);
        console.log(`❌ Empty extractions: ${this.stats.empty}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`📈 Success rate: ${((this.stats.updated / this.stats.total) * 100).toFixed(1)}%`);
        console.log(`📈 Extraction rate: ${(((this.stats.updated + this.stats.unchanged) / this.stats.total) * 100).toFixed(1)}%`);
        console.log(`${'='.repeat(60)}`);
    }
}

// Main execution
async function main() {
    const extractor = new RailwayPlayerExtractor();
    
    try {
        await extractor.connect();
        await extractor.updateAllPlayerNames();
    } catch (error) {
        console.error('❌ Main execution error:', error);
        process.exit(1);
    } finally {
        await extractor.close();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = RailwayPlayerExtractor;
