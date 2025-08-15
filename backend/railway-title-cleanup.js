const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Import the title generator to use its cleaning logic
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function cleanRailwayTitles() {
    console.log('🧹 Starting Railway Title Cleanup...');
    
    // Use the Railway database path
    const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to Railway database:', err.message);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to Railway database');
            
            // First, let's check what tables exist
            db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
                if (err) {
                    console.error('❌ Error getting tables:', err);
                    reject(err);
                    return;
                }
                
                console.log('📋 Available tables:', tables.map(t => t.name).join(', '));
                
                // Check if we have a cards table or need to work with sets
                if (tables.some(t => t.name === 'cards')) {
                    console.log('✅ Found cards table - proceeding with title cleanup');
                    processCardsTable(db, resolve, reject);
                } else if (tables.some(t => t.name === 'sets')) {
                    console.log('ℹ️ Found sets table - this is for learning, not individual cards');
                    console.log('ℹ️ No individual card titles to clean in the sets table');
                    db.close();
                    resolve({
                        success: true,
                        message: 'Sets table found - no individual card titles to clean',
                        totalProcessed: 0,
                        updated: 0,
                        unchanged: 0,
                        errors: 0
                    });
                } else {
                    console.log('❌ No cards or sets table found');
                    db.close();
                    reject(new Error('No cards or sets table found in database'));
                }
            });
        });
    });
}

function processCardsTable(db, resolve, reject) {
    // Get all cards with summary_title
    db.all("SELECT id, summary_title FROM cards WHERE summary_title IS NOT NULL", async (err, rows) => {
        if (err) {
            console.error('❌ Error fetching cards:', err);
            reject(err);
            return;
        }
        
        console.log(`📊 Found ${rows.length} cards with summary titles to process`);
        
        if (rows.length === 0) {
            console.log('ℹ️ No cards with summary titles found');
            db.close();
            resolve({
                success: true,
                message: 'No cards with summary titles found',
                totalProcessed: 0,
                updated: 0,
                unchanged: 0,
                errors: 0
            });
            return;
        }
        
        let updated = 0;
        let unchanged = 0;
        let errors = 0;
        const totalCards = rows.length;
        
        try {
            // Initialize the title generator
            const titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
            
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
                        try {
                            // Use the title generator to create a new standardized title
                            const newTitle = titleGenerator.generateStandardizedTitle(card.summary_title);
                            
                            if (newTitle && newTitle !== card.summary_title) {
                                // Update the cleaned title
                                db.run("UPDATE cards SET summary_title = ? WHERE id = ?", 
                                    [newTitle, card.id],
                                    function(updateErr) {
                                        if (updateErr) {
                                            console.error(`❌ Error updating card ${card.id}:`, updateErr);
                                            resolveCard({ type: 'error', card, newTitle });
                                        } else {
                                            console.log(`✅ Updated card ${card.id}: "${card.summary_title}" → "${newTitle}"`);
                                            resolveCard({ type: 'updated', card, newTitle });
                                        }
                                    }
                                );
                            } else {
                                resolveCard({ type: 'unchanged', card, newTitle: card.summary_title });
                            }
                        } catch (error) {
                            console.error(`❌ Error processing card ${card.id}:`, error);
                            resolveCard({ type: 'error', card, error: error.message });
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
            
            console.log('\n✅ Railway Title Cleanup Complete!');
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
}

// Run the cleanup
cleanRailwayTitles()
    .then(result => {
        console.log('🎉 Railway Title Cleanup completed successfully!');
        console.log('Result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Railway Title Cleanup failed:', error);
        process.exit(1);
    });
