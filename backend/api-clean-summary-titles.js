// Fixed API endpoint version for running on Railway
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function cleanSummaryTitles() {
    return new Promise(async (resolve, reject) => {
        const dbPath = process.env.NODE_ENV === 'production' 
            ? path.join(__dirname, 'data', 'scorecard.db')
            : path.join(__dirname, 'data', 'scorecard.db');
        
        console.log('🧹 Starting FIXED Summary Title Cleanup on Railway...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // Get all cards with summaryTitle
            db.all("SELECT id, summaryTitle FROM cards WHERE summaryTitle IS NOT NULL", async (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} cards with summary titles to process`);
                
                let updated = 0;
                let unchanged = 0;
                let errors = 0;
                const totalCards = rows.length;
                
                try {
                    // Process cards in batches to avoid overwhelming the database
                    const batchSize = 50;
                    const batches = [];
                    
                    for (let i = 0; i < rows.length; i += batchSize) {
                        batches.push(rows.slice(i, i + batchSize));
                    }
                    
                    console.log(`📦 Processing ${totalCards} cards in ${batches.length} batches of ${batchSize}...`);
                    
                    // Process each batch sequentially to avoid database locking
                    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                        const batch = batches[batchIndex];
                        
                        // Process each card in the batch
                        const batchPromises = batch.map(card => {
                            return new Promise((resolveCard, rejectCard) => {
                                const cleanedTitle = cleanSummaryTitle(card.summaryTitle);
                                
                                if (cleanedTitle !== card.summaryTitle) {
                                    // Update the cleaned title
                                    db.run("UPDATE cards SET summaryTitle = ? WHERE id = ?", 
                                        [cleanedTitle, card.id], 
                                        function(updateErr) {
                                            if (updateErr) {
                                                console.error(`❌ Error updating card ${card.id}:`, updateErr);
                                                resolveCard({ type: 'error', card, cleanedTitle });
                                            } else {
                                                console.log(`✅ Updated card ${card.id}: "${card.summaryTitle}" → "${cleanedTitle}"`);
                                                resolveCard({ type: 'updated', card, cleanedTitle });
                                            }
                                        }
                                    );
                                } else {
                                    resolveCard({ type: 'unchanged', card, cleanedTitle });
                                }
                            });
                        });
                        
                        // Wait for the entire batch to complete
                        const batchResults = await Promise.all(batchPromises);
                        
                        // Count the results
                        batchResults.forEach(result => {
                            if (result.type === 'updated') {
                                updated++;
                            } else if (result.type === 'error') {
                                errors++;
                            } else {
                                unchanged++;
                            }
                        });
                        
                        // Progress update
                        const processed = (batchIndex + 1) * batchSize;
                        const progressPercent = Math.round(Math.min(processed, totalCards) / totalCards * 100);
                        console.log(`📈 Batch ${batchIndex + 1}/${batches.length} (${progressPercent}%) - Updated: ${updated}, Unchanged: ${unchanged}, Errors: ${errors}`);
                    }
                    
                    console.log('\\n✅ Summary Title Cleanup Complete!');
                    console.log('=====================================');
                    console.log(`📊 Total cards processed: ${totalCards}`);
                    console.log(`🔄 Updated: ${updated}`);
                    console.log(`✓ Unchanged: ${unchanged}`);
                    console.log(`❌ Errors: ${errors}`);
                    
                    db.close();
                    resolve({
                        success: true,
                        totalProcessed: totalCards,
                        updated: updated,
                        unchanged: unchanged,
                        errors: errors
                    });
                    
                } catch (error) {
                    console.error('❌ Error during batch processing:', error);
                    db.close();
                    reject(error);
                }
            });
        });
    });
}

// Enhanced comprehensive cleaning function for summary titles
function cleanSummaryTitle(title) {
    if (!title) return '';
    
    let cleaned = title.trim();
    const original = cleaned;
    
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
    
    // Remove grade-specific terms (enhanced)
    cleaned = cleaned.replace(/\s+(GEM\s+)?(MINT|MT)\s+\d+\s*$/gi, '');
    cleaned = cleaned.replace(/\s+(GEM\s+)?(MINT|MT)\s*$/gi, '');
    cleaned = cleaned.replace(/\s+GEM\s*$/gi, '');
    cleaned = cleaned.replace(/\s+PRISTINE\s*$/gi, '');
    cleaned = cleaned.replace(/\s+AUTHENTIC\s*$/gi, '');
    cleaned = cleaned.replace(/\s+AUTH\s*$/gi, '');
    
    // Remove condition terms that shouldn't be in summary titles
    cleaned = cleaned.replace(/\s+(NM-MT|NMMT|NM|VF|EX|VG|GOOD|FAIR|POOR)\s*\d*\s*$/gi, '');
    cleaned = cleaned.replace(/\s+(NEAR\s+MINT|VERY\s+FINE|EXCELLENT|VERY\s+GOOD)\s*$/gi, '');
    cleaned = cleaned.replace(/\s+(GRADED|UNGRADED)\s*$/gi, '');
    
    // Remove holder and slab terms
    cleaned = cleaned.replace(/\s+(NEW\s+HOLDER|OLD\s+HOLDER|HOLDER)\s*$/gi, '');
    cleaned = cleaned.replace(/\s+(SLAB|SLABBED)\s*$/gi, '');
    
    // Remove population reports
    cleaned = cleaned.replace(/\s+POP\s+\d+/gi, '');
    cleaned = cleaned.replace(/\s+POPULATION\s+\d+/gi, '');
    cleaned = cleaned.replace(/\s+POP-\d+/gi, '');
    cleaned = cleaned.replace(/\s+NONE\s+HIGHER/gi, '');
    
    // Remove authentication codes and DNA references
    cleaned = cleaned.replace(/\s+DNA\s+AUTH\s*$/gi, '');
    cleaned = cleaned.replace(/\s+JSA\s+AUTH\s*$/gi, '');
    cleaned = cleaned.replace(/\s+PSA\/DNA\s*$/gi, '');
    cleaned = cleaned.replace(/\s+MBA\s+AUTH\s*$/gi, '');
    cleaned = cleaned.replace(/\s+\/DNA\s+CERTIFIED\s+AUTO\s*\d*\s*$/gi, '');
    
    // Remove grade numbers at the end (like "8", "9", "10")
    cleaned = cleaned.replace(/\s+\d+(\.\d+)?\s*$/gi, '');
    
    // Remove serial numbers (8+ digits, often cert numbers)
    cleaned = cleaned.replace(/\s+#?\s*\d{8,}\s*$/gi, '');
    
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Debug logging for verification
    if (cleaned !== original) {
        console.log(`🧹 Cleaned: "${original}" → "${cleaned}"`);
    }
    
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
}"
