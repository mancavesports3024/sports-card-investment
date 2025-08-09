// API endpoint version for running on Railway
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function cleanSummaryTitles() {
    return new Promise(async (resolve, reject) => {
        const dbPath = process.env.NODE_ENV === 'production' 
            ? path.join(__dirname, 'data', 'scorecard.db')
            : path.join(__dirname, 'data', 'scorecard.db');
        
        console.log('🧹 Starting Summary Title Cleanup on Railway...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // Get all cards with summaryTitle
            db.all("SELECT id, summaryTitle FROM cards WHERE summaryTitle IS NOT NULL", (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} cards with summary titles to process`);
                
                let updated = 0;
                let unchanged = 0;
                const totalCards = rows.length;
                
                // Process each card
                rows.forEach((card, index) => {
                    const cleanedTitle = cleanSummaryTitle(card.summaryTitle);
                    
                    if (cleanedTitle !== card.summaryTitle) {
                        // Update the cleaned title
                        db.run("UPDATE cards SET summaryTitle = ? WHERE id = ?", 
                            [cleanedTitle, card.id], 
                            function(err) {
                                if (err) {
                                    console.error(`❌ Error updating card ${card.id}:`, err);
                                } else {
                                    updated++;
                                }
                                
                                // Check if this is the last card
                                if (index === totalCards - 1) {
                                    unchanged = totalCards - updated;
                                    
                                    console.log('\n✅ Summary Title Cleanup Complete!');
                                    console.log('=====================================');
                                    console.log(`📊 Total cards processed: ${totalCards}`);
                                    console.log(`🔄 Updated: ${updated}`);
                                    console.log(`✓ Unchanged: ${unchanged}`);
                                    
                                    db.close();
                                    resolve({
                                        success: true,
                                        totalProcessed: totalCards,
                                        updated: updated,
                                        unchanged: unchanged
                                    });
                                }
                            }
                        );
                    } else {
                        unchanged++;
                        
                        // Check if this is the last card
                        if (index === totalCards - 1) {
                            console.log('\n✅ Summary Title Cleanup Complete!');
                            console.log('=====================================');
                            console.log(`📊 Total cards processed: ${totalCards}`);
                            console.log(`🔄 Updated: ${updated}`);
                            console.log(`✓ Unchanged: ${unchanged}`);
                            
                            db.close();
                            resolve({
                                success: true,
                                totalProcessed: totalCards,
                                updated: updated,
                                unchanged: unchanged
                            });
                        }
                    }
                });
            });
        });
    });
}

// Comprehensive cleaning function for summary titles
function cleanSummaryTitle(title) {
    if (!title) return '';
    
    let cleaned = title.trim();
    
    // Remove PSA certification numbers and related info
    cleaned = cleaned.replace(/PSA\s+GEM\s+M[T]?(\s+\d+)?(\s+CERT\s*#?\s*\d+)?/gi, '');
    cleaned = cleaned.replace(/PSA\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    cleaned = cleaned.replace(/CERT\s*#?\s*\d{8,}/gi, ''); // 8+ digit cert numbers
    
    // Remove other grading company cert numbers
    cleaned = cleaned.replace(/BGS\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    cleaned = cleaned.replace(/SGC\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    cleaned = cleaned.replace(/CGC\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    
    // Remove standalone grading terms at the end
    cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC|BECKETT)\s*(GEM\s*)?(MINT|MT|M)\s*\d*\s*$/gi, '');
    cleaned = cleaned.replace(/\s+(PSA|BGS|SGC|CGC)\s+\d+(\.\d+)?\s*$/gi, '');
    
    // Remove grade-specific terms
    cleaned = cleaned.replace(/\s+(GEM\s+)?(MINT|MT)\s+\d+\s*$/gi, '');
    cleaned = cleaned.replace(/\s+PRISTINE\s*$/gi, '');
    cleaned = cleaned.replace(/\s+AUTHENTIC\s*$/gi, '');
    cleaned = cleaned.replace(/\s+AUTH\s*$/gi, '');
    
    // Remove population reports
    cleaned = cleaned.replace(/\s+POP\s+\d+/gi, '');
    cleaned = cleaned.replace(/\s+POPULATION\s+\d+/gi, '');
    
    // Remove authentication codes
    cleaned = cleaned.replace(/\s+DNA\s+AUTH\s*$/gi, '');
    cleaned = cleaned.replace(/\s+JSA\s+AUTH\s*$/gi, '');
    cleaned = cleaned.replace(/\s+PSA\/DNA\s*$/gi, '');
    cleaned = cleaned.replace(/\s+MBA\s+AUTH\s*$/gi, '');
    
    // Remove serial numbers (8+ digits, often cert numbers)
    cleaned = cleaned.replace(/\s+#?\s*\d{8,}\s*$/gi, '');
    
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// Export for use as API endpoint
module.exports = { cleanSummaryTitles };

// For testing locally
if (require.main === module) {
    cleanSummaryTitles()
        .then(result => {
            console.log('Result:', result);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}
