const NewPricingDatabase = require('./create-new-pricing-database.js');

async function showRemainingIssues() {
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name FROM cards');
        
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
        
        return {
            success: true,
            totalCards: cards.length,
            issuesFound: issues.length,
            issues: issues
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    } finally {
        await db.close();
    }
}

module.exports = { showRemainingIssues };
