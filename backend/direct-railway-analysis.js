const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function analyzeRailwayDatabase() {
    console.log('🔍 Analyzing Railway database for remaining summary title issues...\n');
    
    // Use Railway volume mount path
    const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
        ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
        : path.join(__dirname, 'data', 'new-scorecard.db');
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        // Get all cards
        const cards = await new Promise((resolve, reject) => {
            db.all('SELECT id, title, summary_title, player_name FROM cards', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Found ${cards.length} cards to analyze\n`);
        
        const issues = [];
        
        cards.forEach(card => {
            const summaryTitle = card.summary_title || '';
            const playerName = card.player_name || '';
            
            const problems = [];
            
            // Check for missing product names
            if (!summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman|Finest|Mosaic|Select|Contenders|Hoops|Pokemon|O-Pee-Chee)\b/i)) {
                problems.push('Missing product name');
            }
            
            // Check for missing player names
            if (playerName && !summaryTitle.includes(playerName)) {
                problems.push(`Missing player name: ${playerName}`);
            }
            
            // Check for empty or very short summary titles
            if (!summaryTitle || summaryTitle.length < 10) {
                problems.push('Summary title too short or empty');
            }
            
            if (problems.length > 0) {
                issues.push({
                    id: card.id,
                    title: card.title,
                    summaryTitle: card.summary_title,
                    playerName: card.player_name,
                    problems: problems
                });
            }
        });
        
        console.log(`🔍 Found ${issues.length} cards with summary title issues:\n`);
        
        issues.forEach((issue, index) => {
            console.log(`${index + 1}. Card ID: ${issue.id}`);
            console.log(`   Title: "${issue.title}"`);
            console.log(`   Summary: "${issue.summaryTitle}"`);
            console.log(`   Player: "${issue.playerName}"`);
            console.log(`   Problems:`);
            issue.problems.forEach(problem => {
                console.log(`     - ${problem}`);
            });
            console.log('');
        });
        
        console.log(`📊 Summary:`);
        console.log(`   Total cards: ${cards.length}`);
        console.log(`   Cards with issues: ${issues.length}`);
        console.log(`   Health score: ${((cards.length - issues.length) / cards.length * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    } finally {
        db.close();
        console.log('✅ Database connection closed');
    }
}

// Run the analysis
analyzeRailwayDatabase();
