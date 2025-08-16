const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

class SummaryComponentsFieldManager {
    constructor() {
        // Use Railway volume mount path if available (production), otherwise use local path
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        this.db = null;
        this.titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
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

    // Add new columns to the cards table
    async addSummaryComponentColumns() {
        console.log('📝 Adding summary component columns to cards table...');
        
        const columns = [
            'year INTEGER',
            'card_set TEXT', 
            'card_type TEXT',
            'card_number TEXT',
            'print_run TEXT'
        ];

        for (const column of columns) {
            try {
                const [columnName] = column.split(' ');
                await this.runUpdate(`ALTER TABLE cards ADD COLUMN ${columnName} ${column.split(' ').slice(1).join(' ')}`);
                console.log(`✅ Added column: ${columnName}`);
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log(`ℹ️ Column already exists: ${column.split(' ')[0]}`);
                } else {
                    console.error(`❌ Error adding column ${column}:`, error.message);
                }
            }
        }

        // Add indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_year ON cards(year)',
            'CREATE INDEX IF NOT EXISTS idx_card_set ON cards(card_set)',
            'CREATE INDEX IF NOT EXISTS idx_card_type ON cards(card_type)',
            'CREATE INDEX IF NOT EXISTS idx_card_number ON cards(card_number)',
            'CREATE INDEX IF NOT EXISTS idx_print_run ON cards(print_run)'
        ];

        for (const index of indexes) {
            try {
                await this.runUpdate(index);
                console.log(`✅ Added index: ${index.split(' ')[4]}`);
            } catch (error) {
                console.error(`❌ Error adding index:`, error.message);
            }
        }
    }

    // Extract card type (colors and parallels) from color/numbering
    extractCardType(colorNumbering) {
        if (!colorNumbering) return null;
        
        // Remove card numbers and print runs to get just colors/parallels
        let cardType = colorNumbering;
        
        // Remove card numbers (patterns like #123, #BDC-168, etc.)
        cardType = cardType.replace(/#[A-Za-z0-9-]+/g, '');
        
        // Remove print runs (patterns like /150, /5, etc.)
        cardType = cardType.replace(/\/\d+/g, '');
        
        // Clean up extra spaces
        cardType = cardType.replace(/\s+/g, ' ').trim();
        
        return cardType || null;
    }

    // Extract card number from color/numbering
    extractCardNumber(colorNumbering) {
        if (!colorNumbering) return null;
        
        // Look for card number patterns
        const cardNumberMatch = colorNumbering.match(/#[A-Za-z0-9-]+/);
        return cardNumberMatch ? cardNumberMatch[0] : null;
    }

    // Extract print run from color/numbering
    extractPrintRun(colorNumbering) {
        if (!colorNumbering) return null;
        
        // Look for print run patterns
        const printRunMatch = colorNumbering.match(/\/\d+/);
        return printRunMatch ? printRunMatch[0] : null;
    }

    // Populate the new fields for all cards
    async populateSummaryComponents() {
        console.log('🔄 Populating summary component fields...');
        
        try {
            // Initialize the title generator
            await this.titleGenerator.connect();
            await this.titleGenerator.learnFromDatabase();
            
            // Get all cards
            const cards = await this.runQuery('SELECT id, title, summary_title, player_name FROM cards');
            console.log(`📊 Found ${cards.length} cards to process`);

            let updated = 0;
            let unchanged = 0;
            let errors = 0;

            for (const card of cards) {
                try {
                    // Extract components using existing logic
                    const year = this.titleGenerator.extractYear(card.title);
                    const cardSet = this.titleGenerator.extractProduct(card.title);
                    const colorNumbering = this.titleGenerator.extractColorNumbering(card.title);
                    
                    // Extract specific components
                    const cardType = this.extractCardType(colorNumbering);
                    const cardNumber = this.extractCardNumber(colorNumbering);
                    const printRun = this.extractPrintRun(colorNumbering);

                    // Update the card with new fields
                    await this.runUpdate(
                        `UPDATE cards SET 
                         year = ?, 
                         card_set = ?, 
                         card_type = ?, 
                         card_number = ?, 
                         print_run = ? 
                         WHERE id = ?`,
                        [year, cardSet, cardType, cardNumber, printRun, card.id]
                    );

                    console.log(`✅ Updated card ${card.id}:`);
                    console.log(`   Year: ${year || 'N/A'}`);
                    console.log(`   Card Set: ${cardSet || 'N/A'}`);
                    console.log(`   Card Type: ${cardType || 'N/A'}`);
                    console.log(`   Card Number: ${cardNumber || 'N/A'}`);
                    console.log(`   Print Run: ${printRun || 'N/A'}`);
                    
                    updated++;
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error);
                    errors++;
                }
            }

            console.log('\n🎉 Summary Component Population Complete!');
            console.log('==========================================');
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
            console.error('❌ Error during population:', error);
            throw error;
        }
    }

    // Show sample of populated data
    async showSampleData() {
        console.log('📋 Sample of populated summary components:');
        console.log('==========================================');
        
        const sample = await this.runQuery(`
            SELECT id, title, year, card_set, card_type, card_number, print_run 
            FROM cards 
            WHERE year IS NOT NULL OR card_set IS NOT NULL OR card_type IS NOT NULL 
            LIMIT 10
        `);

        sample.forEach((card, index) => {
            console.log(`\n${index + 1}. Card ID: ${card.id}`);
            console.log(`   Title: ${card.title}`);
            console.log(`   Year: ${card.year || 'N/A'}`);
            console.log(`   Card Set: ${card.card_set || 'N/A'}`);
            console.log(`   Card Type: ${card.card_type || 'N/A'}`);
            console.log(`   Card Number: ${card.card_number || 'N/A'}`);
            console.log(`   Print Run: ${card.print_run || 'N/A'}`);
        });
    }

    // Close database connection
    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
        if (this.titleGenerator) {
            await this.titleGenerator.close();
        }
    }
}

// Main execution function
async function main() {
    const manager = new SummaryComponentsFieldManager();
    
    try {
        await manager.connect();
        
        // Add the new columns
        await manager.addSummaryComponentColumns();
        
        // Populate the fields
        await manager.populateSummaryComponents();
        
        // Show sample data
        await manager.showSampleData();
        
        console.log('\n✅ Summary components fields added and populated successfully!');
        
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await manager.close();
    }
}

// Export for use in other modules
module.exports = { SummaryComponentsFieldManager };

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}
