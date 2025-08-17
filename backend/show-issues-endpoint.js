const NewPricingDatabase = require('./create-new-pricing-database.js');

async function showRemainingIssues() {
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name, card_set FROM cards');
        
        const issues = [];
        
        cards.forEach(card => {
            const summaryTitle = card.summary_title || '';
            const playerName = card.player_name || '';
            const cardSet = card.card_set || '';
            
            const problems = [];
            
            // Check for missing product names (check card_set field first, then fallback to summary_title)
            if (!cardSet) {
                const productNamePattern = /\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman|Finest|Mosaic|Select|Contenders|Hoops|Pokemon|O-Pee-Chee|Score|Phoenix|Chronicles|Stadium Club|Gallery|Chrome Update|Diamond Kings|National Treasures|Flawless|Spectra|Zenith|One and One|Slania Stamps|Kellogg's|Skybox|USA Basketball|Fleer Metal|Fleer Tradition|Panini Absolute|Panini Origins|Panini Instant|Panini Crown Royale|Panini Limited|Panini Threads|Panini Certified|Panini Triple Threads|Panini Tribute|Panini Rookies & Stars|Panini Elite|Panini Prestige|Upper Deck Young Guns|Upper Deck Synergy|Panini Prizm DP|Panini Prizm WNBA|Panini Prizm Monopoly WNBA|Topps Heritage|Topps Archives|Topps Update|Topps Allen & Ginter|Topps Gypsy Queen|Bowman Chrome|Panini Mosaic|Panini Absolute|Panini Zenith|Panini Diamond Kings|Panini Origins|Panini One and One|Panini Instant|Panini Contenders|Panini Immaculate|Panini National Treasures|Panini Spectra|Panini Crown Royale|Panini Limited|Panini Threads|Panini Certified|Panini Triple Threads|Panini Tribute|Panini Rookies & Stars|Panini Elite|Panini Prestige|Upper Deck Young Guns|Upper Deck Synergy|Slania Stamps|Kellogg's|O-Pee-Chee|Fleer Metal|Fleer Tradition|Fleer)\b/i;
                if (!summaryTitle.match(productNamePattern)) {
                    problems.push('Missing product name');
                }
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
                    cardSet: card.card_set,
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
