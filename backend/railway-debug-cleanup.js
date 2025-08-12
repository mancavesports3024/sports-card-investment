// Railway debug script to see exactly what the cleanup job is doing
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

async function railwayDebugCleanup() {
    return new Promise((resolve, reject) => {
        // Use Railway database path
        const dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        
        console.log('🔍 Railway Debug: Checking cleanup job...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to Railway SQLite database');
            
            // Get all cards with summary_title
            db.all("SELECT id, summary_title FROM cards WHERE summary_title IS NOT NULL", async (err, rows) => {
                if (err) {
                    console.error('❌ Error fetching cards:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📊 Found ${rows.length} cards with summary titles`);
                
                // Look for cards with Buffalo or Bucs
                const targetCards = rows.filter(card => 
                    card.summary_title && 
                    (card.summary_title.toLowerCase().includes('buffalo') || 
                     card.summary_title.toLowerCase().includes('bucs'))
                );
                
                console.log(`🎯 Found ${targetCards.length} cards with Buffalo or Bucs:`);
                targetCards.forEach(card => {
                    console.log(`   ID ${card.id}: "${card.summary_title}"`);
                });
                
                if (targetCards.length === 0) {
                    console.log('❌ No cards found with Buffalo or Bucs!');
                    db.close();
                    resolve();
                    return;
                }
                
                // Test each card
                let wouldUpdate = 0;
                targetCards.forEach(card => {
                    const cleanedTitle = cleanSummaryTitle(card.summary_title);
                    const wouldChange = cleanedTitle !== card.summary_title;
                    
                    console.log(`\n🧪 Card ID ${card.id}:`);
                    console.log(`   Original: "${card.summary_title}"`);
                    console.log(`   Cleaned:  "${cleanedTitle}"`);
                    console.log(`   Would update: ${wouldChange ? 'YES' : 'NO'}`);
                    
                    if (wouldChange) {
                        wouldUpdate++;
                    }
                });
                
                console.log(`\n📊 Summary: ${wouldUpdate} out of ${targetCards.length} cards would be updated`);
                
                db.close();
                resolve();
            });
        });
    });
}

// Export the function for use in API endpoint
module.exports = { railwayDebugCleanup };

// Run the debug if called directly
if (require.main === module) {
  railwayDebugCleanup().catch(console.error);
}
