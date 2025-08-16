const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MissingComponentsReporter {
    constructor() {
        // Use Railway volume mount path if available (production), otherwise use local path
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
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

    // Generate comprehensive report of missing components
    async generateMissingComponentsReport() {
        console.log('📊 Generating missing summary components report...\n');
        
        try {
            // Get total count of cards
            const totalCards = await this.runQuery('SELECT COUNT(*) as count FROM cards');
            const total = totalCards[0].count;
            
            console.log(`📋 Total cards in database: ${total}\n`);
            
            // Cards missing card_set
            const missingCardSet = await this.runQuery(`
                SELECT id, title, card_set, card_type, card_number, print_run 
                FROM cards 
                WHERE card_set IS NULL OR card_set = '' OR card_set = 'Unknown'
                ORDER BY id
            `);
            
            // Cards missing card_type
            const missingCardType = await this.runQuery(`
                SELECT id, title, card_set, card_type, card_number, print_run 
                FROM cards 
                WHERE card_type IS NULL OR card_type = '' OR card_type = 'Unknown'
                ORDER BY id
            `);
            
            // Cards missing card_number
            const missingCardNumber = await this.runQuery(`
                SELECT id, title, card_set, card_type, card_number, print_run 
                FROM cards 
                WHERE card_number IS NULL OR card_number = '' OR card_number = 'Unknown'
                ORDER BY id
            `);
            
            // Cards missing multiple fields
            const missingMultiple = await this.runQuery(`
                SELECT id, title, card_set, card_type, card_number, print_run 
                FROM cards 
                WHERE (card_set IS NULL OR card_set = '' OR card_set = 'Unknown')
                   OR (card_type IS NULL OR card_type = '' OR card_type = 'Unknown')
                   OR (card_number IS NULL OR card_number = '' OR card_number = 'Unknown')
                ORDER BY id
            `);
            
            // Cards missing ALL three fields
            const missingAll = await this.runQuery(`
                SELECT id, title, card_set, card_type, card_number, print_run 
                FROM cards 
                WHERE (card_set IS NULL OR card_set = '' OR card_set = 'Unknown')
                  AND (card_type IS NULL OR card_type = '' OR card_type = 'Unknown')
                  AND (card_number IS NULL OR card_number = '' OR card_number = 'Unknown')
                ORDER BY id
            `);
            
            // Generate the report
            console.log('🔍 MISSING SUMMARY COMPONENTS REPORT');
            console.log('=====================================\n');
            
            console.log(`📊 SUMMARY STATISTICS:`);
            console.log(`   Total cards: ${total}`);
            console.log(`   Missing card_set: ${missingCardSet.length} (${((missingCardSet.length/total)*100).toFixed(1)}%)`);
            console.log(`   Missing card_type: ${missingCardType.length} (${((missingCardType.length/total)*100).toFixed(1)}%)`);
            console.log(`   Missing card_number: ${missingCardNumber.length} (${((missingCardNumber.length/total)*100).toFixed(1)}%)`);
            console.log(`   Missing any field: ${missingMultiple.length} (${((missingMultiple.length/total)*100).toFixed(1)}%)`);
            console.log(`   Missing ALL fields: ${missingAll.length} (${((missingAll.length/total)*100).toFixed(1)}%)\n`);
            
            // Show cards missing card_set
            if (missingCardSet.length > 0) {
                console.log(`❌ CARDS MISSING CARD_SET (${missingCardSet.length} cards):`);
                console.log('='.repeat(80));
                missingCardSet.forEach((card, index) => {
                    console.log(`${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Card Set: ${card.card_set || 'NULL'}`);
                    console.log(`   Card Type: ${card.card_type || 'NULL'}`);
                    console.log(`   Card Number: ${card.card_number || 'NULL'}`);
                    console.log(`   Print Run: ${card.print_run || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Show cards missing card_type
            if (missingCardType.length > 0) {
                console.log(`❌ CARDS MISSING CARD_TYPE (${missingCardType.length} cards):`);
                console.log('='.repeat(80));
                missingCardType.forEach((card, index) => {
                    console.log(`${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Card Set: ${card.card_set || 'NULL'}`);
                    console.log(`   Card Type: ${card.card_type || 'NULL'}`);
                    console.log(`   Card Number: ${card.card_number || 'NULL'}`);
                    console.log(`   Print Run: ${card.print_run || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Show cards missing card_number
            if (missingCardNumber.length > 0) {
                console.log(`❌ CARDS MISSING CARD_NUMBER (${missingCardNumber.length} cards):`);
                console.log('='.repeat(80));
                missingCardNumber.forEach((card, index) => {
                    console.log(`${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Card Set: ${card.card_set || 'NULL'}`);
                    console.log(`   Card Type: ${card.card_type || 'NULL'}`);
                    console.log(`   Card Number: ${card.card_number || 'NULL'}`);
                    console.log(`   Print Run: ${card.print_run || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Show cards missing ALL fields
            if (missingAll.length > 0) {
                console.log(`🚨 CARDS MISSING ALL FIELDS (${missingAll.length} cards):`);
                console.log('='.repeat(80));
                missingAll.forEach((card, index) => {
                    console.log(`${index + 1}. Card ID: ${card.id}`);
                    console.log(`   Title: "${card.title}"`);
                    console.log(`   Card Set: ${card.card_set || 'NULL'}`);
                    console.log(`   Card Type: ${card.card_type || 'NULL'}`);
                    console.log(`   Card Number: ${card.card_number || 'NULL'}`);
                    console.log(`   Print Run: ${card.print_run || 'NULL'}`);
                    console.log('');
                });
            }
            
            // Return structured data for API response
            return {
                success: true,
                totalCards: total,
                summary: {
                    missingCardSet: missingCardSet.length,
                    missingCardType: missingCardType.length,
                    missingCardNumber: missingCardNumber.length,
                    missingAny: missingMultiple.length,
                    missingAll: missingAll.length
                },
                details: {
                    missingCardSet: missingCardSet,
                    missingCardType: missingCardType,
                    missingCardNumber: missingCardNumber,
                    missingAll: missingAll
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating report:', error);
            throw error;
        }
    }

    // Close database connection
    async close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

// Main execution function
async function main() {
    const reporter = new MissingComponentsReporter();
    
    try {
        await reporter.connect();
        await reporter.generateMissingComponentsReport();
        console.log('\n✅ Report generated successfully!');
        
    } catch (error) {
        console.error('❌ Error in main execution:', error);
    } finally {
        await reporter.close();
    }
}

// Export for use in other modules
module.exports = { MissingComponentsReporter };

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
