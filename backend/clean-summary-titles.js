require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleCleaner {
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

    cleanSummaryTitle(summaryTitle) {
        if (!summaryTitle) return summaryTitle;
        
        let cleaned = summaryTitle;
        
        // Remove team names and locations
        const teamNames = [
            'Florida Gators', 'Gators', 'Florida',
            'Lakers', 'Bulls', 'Bears', '49ers', 'Redskins', 'Washington',
            'Patriots', 'NE Patriots', 'Broncos', 'Denver Broncos',
            'Giants', 'New York Giants', 'Raiders', 'Lions', 'Detroit Lions',
            'Mets', 'Nationals', 'Washington Nationals', 'Angels',
            'Packers', 'Jets', 'Spurs', 'Nuggets', 'Mavs', 'Lakers',
            'Fever', 'Texas Longhorns', 'Longhorns'
        ];
        
        teamNames.forEach(team => {
            const regex = new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        // Remove extra words that shouldn't be in summary titles
        const extraWords = [
            'PSA 10', 'PSA', 'GEM MINT', 'GEM MT', 'GEM', 'MINT', 'CERT',
            'ROOKIE', 'RC', 'Rookie Card', 'Rookie RC', '1st RC', '1st Rookie',
            'Luck of Lottery', 'Luck of the Lottery', 'LUCK OF LOTTERY',
            'Dragon Scale Prizm', 'Dragon Scale', 'DRAGON SCALE',
            'Blue Refractor', 'BLUE REFRACTOR', 'Refractor',
            'Chrome auto', 'Chrome RC Auto', 'Chrome',
            'Fast Break', 'FAST BREAK',
            'Rookie Phenom', 'Phenom',
            'Case Hit', 'SSP', 'SP'
        ];
        
        extraWords.forEach(word => {
            const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        // Fix capitalization - make it title case
        cleaned = cleaned.replace(/\b\w/g, (match) => match.toLowerCase());
        cleaned = cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
        
        // Special capitalization rules
        cleaned = cleaned.replace(/\bAuto\b/gi, 'auto');
        cleaned = cleaned.replace(/\bRc\b/gi, 'RC');
        cleaned = cleaned.replace(/\bPsa\b/gi, 'PSA');
        
        // Clean up extra spaces and punctuation
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        cleaned = cleaned.replace(/\s*,\s*/g, ' ');
        cleaned = cleaned.replace(/\s*\.\s*/g, ' ');
        
        // Remove leading/trailing punctuation
        cleaned = cleaned.replace(/^[,\s.]+|[,\s.]+$/g, '');
        
        return cleaned.trim();
    }

    async cleanAllSummaryTitles() {
        console.log('🧹 Cleaning all summary titles...');
        
        try {
            const cards = await this.runQuery(`
                SELECT id, summary_title 
                FROM cards 
                ORDER BY id
            `);
            
            let updated = 0;
            let unchanged = 0;
            let errors = 0;
            
            for (const card of cards) {
                try {
                    const cleanedTitle = this.cleanSummaryTitle(card.summary_title);
                    
                    // Only update if the title is different
                    if (cleanedTitle !== card.summary_title) {
                        await this.runUpdate(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [cleanedTitle, card.id]
                        );
                        updated++;
                        
                        if (updated <= 10) { // Show first 10 changes
                            console.log(`📝 Updated ID ${card.id}: "${card.summary_title}" → "${cleanedTitle}"`);
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
            SELECT id, summary_title 
            FROM cards 
            ORDER BY RANDOM() 
            LIMIT 10
        `);
        
        samples.forEach(card => {
            const cleanedTitle = this.cleanSummaryTitle(card.summary_title);
            console.log(`\nID ${card.id}:`);
            console.log(`  Current: "${card.summary_title}"`);
            console.log(`  Cleaned: "${cleanedTitle}"`);
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
    const cleaner = new SummaryTitleCleaner();
    
    try {
        await cleaner.connect();
        
        // Show sample results first
        await cleaner.showSampleResults();
        
        const result = await cleaner.cleanAllSummaryTitles();
        
        console.log('\n🎉 Summary Title Cleanup Complete!');
        console.log(`📊 Total cards processed: ${result.totalProcessed}`);
        console.log(`✅ Updated: ${result.updated} cards`);
        console.log(`⏭️ Unchanged: ${result.unchanged} cards`);
        console.log(`❌ Errors: ${result.errors} cards`);
        
        await cleaner.close();
        
    } catch (error) {
        console.error('❌ Error:', error);
        await cleaner.close();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { SummaryTitleCleaner };
