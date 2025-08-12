// Debug script to see exactly what the cleanup job is doing
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

async function debugCleanupJob() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, 'new-scorecard.db');
        
        console.log('🔍 Debugging cleanup job...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // Get all cards with summaryTitle (same query as cleanup job)
            db.all("SELECT id, summaryTitle FROM cards WHERE summaryTitle IS NOT NULL", async (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} cards with summary titles`);
                
                let updated = 0;
                let unchanged = 0;
                let errors = 0;
                
                // Look for cards with Buffalo or Bucs
                const targetCards = rows.filter(card => 
                    card.summaryTitle && 
                    (card.summaryTitle.toLowerCase().includes('buffalo') || 
                     card.summaryTitle.toLowerCase().includes('bucs'))
                );
                
                console.log(`🎯 Found ${targetCards.length} cards with Buffalo or Bucs:`);
                targetCards.forEach(card => {
                    console.log(`   ID ${card.id}: "${card.summaryTitle}"`);
                });
                
                if (targetCards.length === 0) {
                    console.log('❌ No cards found with Buffalo or Bucs!');
                    db.close();
                    resolve();
                    return;
                }
                
                // Test the first card with Buffalo or Bucs
                const testCard = targetCards[0];
                console.log(`\n🧪 Testing card ID ${testCard.id}:`);
                console.log(`   Original: "${testCard.summaryTitle}"`);
                
                const cleanedTitle = cleanSummaryTitle(testCard.summaryTitle);
                console.log(`   Cleaned:  "${cleanedTitle}"`);
                console.log(`   Changed:  ${cleanedTitle !== testCard.summaryTitle ? 'YES' : 'NO'}`);
                
                if (cleanedTitle !== testCard.summaryTitle) {
                    console.log('✅ This card should be updated!');
                    
                    // Try to update it
                    db.run("UPDATE cards SET summaryTitle = ? WHERE id = ?", 
                        [cleanedTitle, testCard.id], 
                        function(updateErr) {
                            if (updateErr) {
                                console.error(`❌ Error updating card ${testCard.id}:`, updateErr);
                            } else {
                                console.log(`✅ Successfully updated card ${testCard.id}`);
                            }
                            db.close();
                            resolve();
                        }
                    );
                } else {
                    console.log('❌ This card would not be updated!');
                    db.close();
                    resolve();
                }
            });
        });
    });
}

debugCleanupJob().catch(console.error);
