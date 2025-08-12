// Manual update test script to update specific cards
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Copy the exact cleanSummaryTitle function from api-clean-summary-titles.js
function cleanSummaryTitle(title) {
    if (!title) return '';
    
    let cleaned = title.trim();
    
    // Team names list (exact copy from api-clean-summary-titles.js)
    const teamNames = [
        // NFL Teams
        'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Buffalo', 'Panthers', 'Bears', 'Bengals',
        'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Jags',
        'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Pats',
        'Saints', 'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers', 'Bucs',
        'Titans', 'Commanders'
    ];
    
    // Remove team names
    teamNames.forEach(teamName => {
        const regex = new RegExp(`\\b${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });
    
    // Remove extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

async function manualUpdateTest() {
    return new Promise((resolve, reject) => {
        // Use Railway database path
        const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        
        console.log('🔧 Manual update test...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to Railway SQLite database');
            
            // Get the specific cards that should be updated
            const targetCardIds = [372, 360];
            
            console.log(`🎯 Testing manual update for cards: ${targetCardIds.join(', ')}`);
            
            let updatedCount = 0;
            let processedCount = 0;
            
            targetCardIds.forEach(cardId => {
                // Get the current card
                db.get("SELECT id, summary_title FROM cards WHERE id = ?", [cardId], (err, card) => {
                    if (err) {
                        console.error(`❌ Error fetching card ${cardId}:`, err);
                        processedCount++;
                        if (processedCount === targetCardIds.length) {
                            db.close();
                            resolve();
                        }
                        return;
                    }
                    
                    if (!card) {
                        console.log(`❌ Card ${cardId} not found`);
                        processedCount++;
                        if (processedCount === targetCardIds.length) {
                            db.close();
                            resolve();
                        }
                        return;
                    }
                    
                    console.log(`\n🧪 Card ID ${cardId}:`);
                    console.log(`   Original: "${card.summary_title}"`);
                    
                    const cleanedTitle = cleanSummaryTitle(card.summary_title);
                    console.log(`   Cleaned:  "${cleanedTitle}"`);
                    
                    const wouldChange = cleanedTitle !== card.summary_title;
                    console.log(`   Would change: ${wouldChange ? 'YES' : 'NO'}`);
                    
                    if (wouldChange) {
                        // Actually update the card
                        db.run("UPDATE cards SET summary_title = ? WHERE id = ?", 
                            [cleanedTitle, cardId], 
                            function(updateErr) {
                                if (updateErr) {
                                    console.error(`❌ Error updating card ${cardId}:`, updateErr);
                                } else {
                                    console.log(`✅ Successfully updated card ${cardId}`);
                                    updatedCount++;
                                }
                                
                                processedCount++;
                                if (processedCount === targetCardIds.length) {
                                    console.log(`\n📊 Manual update complete: ${updatedCount} cards updated`);
                                    db.close();
                                    resolve();
                                }
                            }
                        );
                    } else {
                        console.log(`   No update needed for card ${cardId}`);
                        processedCount++;
                        if (processedCount === targetCardIds.length) {
                            console.log(`\n📊 Manual update complete: ${updatedCount} cards updated`);
                            db.close();
                            resolve();
                        }
                    }
                });
            });
        });
    });
}

// Export the function for use in API endpoint
module.exports = { manualUpdateTest };

// Run the test if called directly
if (require.main === module) {
    manualUpdateTest().catch(console.error);
}
