const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleBuilder {
    constructor() {
        this.dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to Railway database');
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
                    resolve(this);
                }
            });
        });
    }

    buildSummaryTitle(components) {
        const { year, card_set, player_name, card_type, card_number, print_run, title, is_autograph } = components;
        
        let summaryTitle = '';
        
        // Start with year
        if (year) {
            summaryTitle += year;
        }
        
        // Add card set
        if (card_set) {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += card_set;
        }
        
        // Add card type (colors, parallels, etc.) - but skip "Base"
        if (card_type && card_type.toLowerCase() !== 'base') {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += card_type;
        }
        
        // Add player name
        if (player_name) {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += player_name;
        }
        
        // Add "auto" if it's an autograph
        if (is_autograph) {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += 'auto';
        }
        
        // Add card number (normalize and avoid confusing PSA grades with card numbers)
        if (card_number) {
            const t = (title || '').toUpperCase();
            let raw = String(card_number).trim();
            // Remove any leading '#'
            raw = raw.replace(/^#\s*/, '');
            // Heuristic: if the card_number is a bare 1-3 digit number and the title contains
            // "PSA <same number>" but the title does not include any real card number marker '#',
            // then it's likely a grade, not a card number → skip adding it.
            const isBareDigits = /^\d{1,3}$/.test(raw);
            const titleHasSamePSAGrade = t.includes(`PSA ${raw}`);
            const titleHasHashNumber = /#\s*\w+/.test(title || '');
            const looksLikeGrade = isBareDigits && titleHasSamePSAGrade && !titleHasHashNumber;
            if (!looksLikeGrade && raw) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += `#${raw}`;
            }
        }
        
        // Add print run
        if (print_run) {
            if (summaryTitle) summaryTitle += ' ';
            summaryTitle += print_run;
        }
        
        return summaryTitle.trim();
    }

    async rebuildAllSummaryTitles() {
        console.log('🔨 Rebuilding all summary titles from components...');
        
        try {
            const cards = await this.runQuery(`
                SELECT id, year, card_set, player_name, card_type, card_number, print_run, summary_title, title 
                FROM cards 
                ORDER BY id
            `);
            
            let updated = 0;
            let unchanged = 0;
            let errors = 0;
            
            for (const card of cards) {
                try {
                    const newSummaryTitle = this.buildSummaryTitle(card);
                    
                    // Only update if the summary title is different
                    if (newSummaryTitle !== card.summary_title) {
                        await this.runUpdate(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [newSummaryTitle, card.id]
                        );
                        updated++;
                        
                        if (updated <= 10) { // Show first 10 changes
                            console.log(`📝 Updated ID ${card.id}: "${card.summary_title}" → "${newSummaryTitle}"`);
                        }
                    } else {
                        unchanged++;
                    }
                } catch (error) {
                    console.error(`❌ Error updating card ${card.id}:`, error.message);
                    errors++;
                }
            }
            
            return {
                success: true,
                totalProcessed: cards.length,
                updated: updated,
                unchanged: unchanged,
                errors: errors
            };
            
        } catch (error) {
            throw error;
        }
    }

    async showSampleResults() {
        console.log('\n📊 Sample Results:');
        
        const samples = await this.runQuery(`
            SELECT id, year, card_set, player_name, card_type, card_number, print_run, summary_title, title 
            FROM cards 
            ORDER BY RANDOM() 
            LIMIT 10
        `);
        
        samples.forEach(card => {
            const newTitle = this.buildSummaryTitle(card);
            console.log(`\nID ${card.id}:`);
            console.log(`  Components: ${card.year} | ${card.card_set} | ${card.player_name} | ${card.card_type || 'Base'} | ${card.card_number} | ${card.print_run || ''}`);
            console.log(`  Current: "${card.summary_title}"`);
            console.log(`  New: "${newTitle}"`);
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

// Main execution
async function main() {
    const builder = new SummaryTitleBuilder();
    
    try {
        await builder.connect();
        
        // Show sample results first
        await builder.showSampleResults();
        
        // Ask for confirmation
        console.log('\n🤔 Do you want to proceed with rebuilding all summary titles? (y/n)');
        // For now, we'll proceed automatically since this is a script
        
        const result = await builder.rebuildAllSummaryTitles();
        
        console.log('\n🎉 Summary Title Rebuild Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`✅ Updated: ${result.updated} cards`);
        console.log(`⏭️ Unchanged: ${result.unchanged} cards`);
        console.log(`❌ Errors: ${result.errors} cards`);
        
        await builder.close();
        
    } catch (error) {
        console.error('❌ Error:', error);
        await builder.close();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { SummaryTitleBuilder };
