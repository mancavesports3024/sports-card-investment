const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleCleaner {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    // Comprehensive cleaning function for summary titles
    cleanSummaryTitle(title) {
        if (!title) return '';
        
        let cleaned = title.trim();
        
        // Remove PSA certification numbers and related info
        cleaned = cleaned.replace(/PSA\s+GEM\s+M[T]?(\s+\d+)?(\s+CERT\s*#?\s*\d+)?/gi, '');
        cleaned = cleaned.replace(/PSA\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
        cleaned = cleaned.replace(/CERT\s*#?\s*\d+/gi, '');
        
        // Remove other grading company cert numbers
        cleaned = cleaned.replace(/BGS\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
        cleaned = cleaned.replace(/SGC\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
        cleaned = cleaned.replace(/CGC\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
        
        // Remove grading terms more comprehensively
        cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC|BECKETT)\s*(GEM\s*)?(MINT|MT|M)\s*\d*\s*$/gi, '');
        cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC)\s+\d+(\.\d+)?\s*$/gi, '');
        cleaned = cleaned.replace(/\s+GEM\s+M[T]?\s+\d*\s*$/gi, '');
        cleaned = cleaned.replace(/\s+M[T]\s+\d+\s*$/gi, '');
        
        // Remove population reports
        cleaned = cleaned.replace(/\s+POP\s+\d+/gi, '');
        cleaned = cleaned.replace(/\s+POPULATION\s+\d+/gi, '');
        
        // Remove serial numbers (long numeric sequences)
        cleaned = cleaned.replace(/\s+\d{8,}/g, '');
        
        // Remove auction/listing specific terms
        cleaned = cleaned.replace(/\s+(AUCTION|PWCC|GOLDIN|HERITAGE)\s*/gi, '');
        cleaned = cleaned.replace(/\s+MBA\s+AUTH\s*/gi, '');
        cleaned = cleaned.replace(/\s+DNA\s+AUTH\s*/gi, '');
        
        // Remove condition descriptions at the end
        cleaned = cleaned.replace(/\s+(MINT|NM|NEAR\s+MINT|EXCELLENT|GOOD|FAIR|POOR)\s*$/gi, '');
        
        // Remove trailing special characters and extra spaces
        cleaned = cleaned.replace(/\s*[-–—]\s*$/, '');
        cleaned = cleaned.replace(/\s*[,;]\s*$/, '');
        cleaned = cleaned.replace(/\s+/g, ' ');
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    // Update all summary titles in the database
    async cleanAllSummaryTitles() {
        console.log('🧹 Starting summary title cleaning process...');
        
        // Get all cards with titles
        const cards = await new Promise((resolve, reject) => {
            this.db.all('SELECT id, title, summaryTitle FROM cards WHERE title IS NOT NULL', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📊 Found ${cards.length} cards to process`);
        
        let updated = 0;
        let unchanged = 0;
        
        for (const card of cards) {
            const originalSummary = card.summaryTitle || card.title;
            const cleanedSummary = this.cleanSummaryTitle(originalSummary);
            
            // Only update if there's a change
            if (cleanedSummary !== originalSummary) {
                await new Promise((resolve, reject) => {
                    this.db.run(
                        'UPDATE cards SET summaryTitle = ? WHERE id = ?',
                        [cleanedSummary, card.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                
                console.log(`🔄 Updated card ${card.id}:`);
                console.log(`   Before: "${originalSummary}"`);
                console.log(`   After:  "${cleanedSummary}"`);
                updated++;
            } else {
                unchanged++;
            }
        }
        
        console.log('✅ Summary title cleaning complete!');
        console.log(`📈 Updated: ${updated} cards`);
        console.log(`📋 Unchanged: ${unchanged} cards`);
        
        return { updated, unchanged };
    }

    // Test the cleaning function with examples
    testCleaning() {
        const testCases = [
            "2022 FLUX EVAN MOBLEY EQUINOX auto #EAEVM PSA GEM MT CERT # 110664432",
            "2018 Donruss Optic Luka Doncic #177 PSA 10 GEM MINT",
            "1986 Fleer Michael Jordan #57 BGS 9.5 CERT # 12345678",
            "Pikachu Base Set 58/102 PSA 9 MINT POP 42",
            "2020 Bowman Chrome Jasson Dominguez Auto SGC 10 PRISTINE",
            "LeBron James 2003 Topps Chrome #111 CGC 9.5 MBA AUTH",
            "2022 Topps Heritage Aaron Judge Real One Auto",
            "2018 Donruss Optic Luka Doncic #177 MT 10",
            "1996 Topps Basketball Kobe Bryant #138 GEM MINT 10"
        ];
        
        console.log('🧪 Testing summary title cleaning:');
        console.log('================================');
        
        testCases.forEach((test, index) => {
            const cleaned = this.cleanSummaryTitle(test);
            console.log(`\nTest ${index + 1}:`);
            console.log(`  Before: "${test}"`);
            console.log(`  After:  "${cleaned}"`);
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Main execution
async function main() {
    const cleaner = new SummaryTitleCleaner();
    
    try {
        await cleaner.connect();
        
        // Test the cleaning function first
        cleaner.testCleaning();
        
        console.log('\n' + '='.repeat(50));
        console.log('Do you want to clean all summary titles in the database? (This will modify data)');
        console.log('Comment out the return statement below to proceed.');
        
        // Uncomment the line below to actually run the cleaning
        // return;
        
        // Clean all summary titles
        await cleaner.cleanAllSummaryTitles();
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        cleaner.close();
    }
}

// Export for use in other scripts
module.exports = { SummaryTitleCleaner };

// Run if called directly
if (require.main === module) {
    main();
}
