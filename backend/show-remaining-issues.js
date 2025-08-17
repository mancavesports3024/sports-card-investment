const NewPricingDatabase = require('./create-new-pricing-database.js');

async function showRemainingIssues() {
    console.log('🔍 Showing remaining summary title issues...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        console.log('✅ Connected to Railway database');
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name, card_set FROM cards');
        console.log(`📊 Found ${cards.length} cards to analyze\n`);
        
        const issues = [];
        
        cards.forEach(card => {
            const title = card.title || '';
            const summaryTitle = card.summary_title || '';
            const playerName = card.player_name || '';
            const cardSet = card.card_set || '';
            
            // Check for various issues
            const problems = [];
            
            // Check for team names
            const teamNames = ['Florida Gators', 'Gators', 'COWBOYS', 'Cowboys', 'VIKINGS', 'Vikings', 'BULLS', 'Bulls', 'LAKERS', 'Lakers', 'WARRIORS', 'Warriors', 'PATRIOTS', 'Patriots', 'BENGALS', 'Bengals', 'RAIDERS', 'Raiders', 'CHARGERS', 'Chargers', 'GIANTS', 'Giants', 'EAGLES', 'Eagles', 'COMMANDERS', 'Commanders', 'BEARS', 'Bears', 'LIONS', 'Lions', 'PACKERS', 'Packers', 'FALCONS', 'Falcons', 'PANTHERS', 'Panthers', 'SAINTS', 'Saints', 'BUCCANEERS', 'Buccaneers', 'CARDINALS', 'Cardinals', 'RAMS', 'Rams', '49ERS', '49ers', 'SEAHAWKS', 'Seahawks', 'YANKEES', 'Yankees', 'RED SOX', 'Red Sox', 'BLUE JAYS', 'Blue Jays', 'ORIOLES', 'Orioles', 'RAYS', 'Rays', 'WHITE SOX', 'White Sox', 'GUARDIANS', 'Guardians', 'TIGERS', 'Tigers', 'ROYALS', 'Royals', 'TWINS', 'Twins', 'ASTROS', 'Astros', 'ANGELS', 'Angels', 'ATHLETICS', 'Athletics', 'MARINERS', 'Mariners', 'RANGERS', 'Rangers', 'BRAVES', 'Braves', 'MARLINS', 'Marlins', 'METS', 'Mets', 'PHILLIES', 'Phillies', 'NATIONALS', 'Nationals', 'CUBS', 'Cubs', 'REDS', 'Reds', 'BREWERS', 'Brewers', 'PIRATES', 'Pirates', 'DIAMONDBACKS', 'Diamondbacks', 'ROCKIES', 'Rockies', 'DODGERS', 'Dodgers', 'PADRES', 'Padres', 'GIANTS', 'Giants', 'HAWKS', 'Hawks', 'CELTICS', 'Celtics', 'NETS', 'Nets', 'HORNETS', 'Hornets', 'CAVALIERS', 'Cavaliers', 'MAVERICKS', 'Mavericks', 'NUGGETS', 'Nuggets', 'PISTONS', 'Pistons', 'ROCKETS', 'Rockets', 'PACERS', 'Pacers', 'CLIPPERS', 'Clippers', 'GRIZZLIES', 'Grizzlies', 'HEAT', 'Heat', 'BUCKS', 'Bucks', 'TIMBERWOLVES', 'Timberwolves', 'PELICANS', 'Pelicans', 'KNICKS', 'Knicks', 'THUNDER', 'Thunder', 'MAGIC', 'Magic', '76ERS', '76ers', 'SUNS', 'Suns', 'TRAIL BLAZERS', 'Trail Blazers', 'KINGS', 'Kings', 'SPURS', 'Spurs', 'RAPTORS', 'Raptors', 'JAZZ', 'Jazz', 'WIZARDS', 'Wizards'];
            teamNames.forEach(team => {
                if (summaryTitle.toLowerCase().includes(team.toLowerCase())) {
                    problems.push(`Contains team name: ${team}`);
                }
            });
            
            // Check for "LOW"
            if (summaryTitle.toLowerCase().includes('low')) {
                problems.push('Contains "LOW"');
            }
            
            // Check for "Edition"
            if (summaryTitle.toLowerCase().includes('edition')) {
                problems.push('Contains "Edition"');
            }
            
            // Check for "Ucl" (should be "UCL")
            if (summaryTitle.includes('Ucl')) {
                problems.push('Contains "Ucl" (should be "UCL")');
            }
            
            // Check for ". Cpanr Prospect"
            if (summaryTitle.toLowerCase().includes('. cpanr prospect')) {
                problems.push('Contains ". Cpanr Prospect" parsing error');
            }
            
            // Check for grading terms that might be parsed as numbers
            const gradingTerms = ['SGC 9.5', 'SGC 10', 'SGC 9', 'SGC 8', 'SGC 7', 'SGC 6', 'SGC 5', 'SGC 4', 'SGC 3', 'SGC 2', 'SGC 1', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6', 'PSA 5', 'PSA 4', 'PSA 3', 'PSA 2', 'PSA 1', 'BGS 10', 'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8', 'BGS 7.5', 'BGS 7', 'BGS 6.5', 'BGS 6', 'BGS 5.5', 'BGS 5', 'GEM MINT', 'Gem Mint', 'MINT', 'Mint', 'MT', 'NM-MT', 'NM', 'EX-MT', 'EX', 'VG-EX', 'VG', 'GOOD', 'Good'];
            gradingTerms.forEach(term => {
                if (summaryTitle.toLowerCase().includes(term.toLowerCase())) {
                    problems.push(`Contains grading term: ${term}`);
                }
            });
            
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
        await db.close();
        console.log('✅ Database connection closed');
    }
}

// Run the analysis
showRemainingIssues();
