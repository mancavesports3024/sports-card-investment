// Fixed API endpoint version for running on Railway
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function cleanSummaryTitles() {
    return new Promise(async (resolve, reject) => {
        const dbPath = process.env.NODE_ENV === 'production' 
            ? path.join(__dirname, 'data', 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        
        console.log('🧹 Starting FIXED Summary Title Cleanup on Railway...');
        console.log(`Database path: ${dbPath}`);
        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err);
                reject(err);
                return;
            }
            
            console.log('✅ Connected to SQLite database');
            
            // Get all cards with summary_title
            db.all("SELECT id, summary_title FROM cards WHERE summary_title IS NOT NULL", async (err, rows) => {
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
                                const cleanedTitle = cleanSummaryTitle(card.summary_title);
                                
                                if (cleanedTitle !== card.summary_title) {
                                    // Update the cleaned title
                                    db.run("UPDATE cards SET summary_title = ? WHERE id = ?", 
                                        [cleanedTitle, card.id],
                                        function(updateErr) {
                                            if (updateErr) {
                                                console.error(`❌ Error updating card ${card.id}:`, updateErr);
                                                resolveCard({ type: 'error', card, cleanedTitle });
                                            } else {
                                                console.log(`✅ Updated card ${card.id}: "${card.summary_title}" → "${cleanedTitle}"`);
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
    
    // Remove unwanted descriptive keywords (case insensitive)
    const unwantedKeywords = [
        'RC', 'Rookie', 'ROOKIE', 'rookie',
        'SP', 'sp',
        'PSA 10', 'psa 10', 'PSA10', 'psa10',
        'MT 10', 'mt 10', 'MT10', 'mt10',
        'MT 9', 'mt 9', 'MT9', 'mt9',
        'MT 8', 'mt 8', 'MT8', 'mt8',
        'MT', 'mt', 'MINT', 'Mint', 'mint',
        'AUTO GRADE', 'auto grade', 'AUTO', 'auto',
        'GRADE', 'Grade', 'grade', 'GRADED', 'Graded', 'graded',
        'GEM MINT', 'Gem Mint', 'gem mint', 'GEM', 'Gem', 'gem',
        'BEAUTIFUL', 'Beautiful', 'beautiful',
        'GORGEOUS', 'Gorgeous', 'gorgeous', 
        'STUNNING', 'Stunning', 'stunning',
        'SHARP', 'Sharp', 'sharp',
        'CLEAN', 'Clean', 'clean',
        'NICE', 'Nice', 'nice',
        'PERFECT', 'Perfect', 'perfect',
        'PRISTINE', 'Pristine', 'pristine',
        'FLAWLESS', 'Flawless', 'flawless',
        'SUPERB', 'Superb', 'superb',
        'EXCELLENT', 'Excellent', 'excellent',
        'Full Art', 'full art', 'FULL ART',
        'PSA 5', 'psa 5', 'PSA5', 'psa5',
        'EX', 'Ex', 'ex',
        'GEM MINT PSA 10', 'Gem Mint PSA 10', 'gem mint psa 10',
        'PSA 10 GEM MINT', 'psa 10 gem mint',
        'GEM MINT PSA', 'Gem Mint PSA', 'gem mint psa',
        'PSA GEM MINT', 'psa gem mint',
        '25th Anniversary', '25th anniversary', '25TH ANNIVERSARY',
        'POP*', 'pop*', 'Pop*',
        'Base Set', 'base set', 'BASE SET'
    ];
    
    // Remove each unwanted keyword
    unwantedKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });
    
    // Remove POP followed by numbers (like "POP 5", "Pop 1", "pop 10")
    cleaned = cleaned.replace(/\bPOP\s+\d+\b/gi, '');
    
    // Replace "Autograph" with "auto" (case insensitive)
    cleaned = cleaned.replace(/\bAutograph\b/gi, 'auto');
    
    // Remove 8-digit PSA certificate numbers (like 50979626)
    cleaned = cleaned.replace(/\b\d{8}\b/g, '');
    
    // Remove team names from all major sports leagues
    const teamNames = [
        // NBA Teams
        'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
        'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
        'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
        'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
        'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
        'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
        // NFL Teams
        'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
        'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
        'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
        'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
        'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
        'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 'Seattle Seahawks', 'Tampa Bay Buccaneers',
        'Tennessee Titans', 'Washington Commanders',
        // MLB Teams
        'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox', 'Chicago Cubs',
        'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers',
        'Houston Astros', 'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
        'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
        'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants', 'Seattle Mariners',
        'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers', 'Toronto Blue Jays', 'Washington Nationals',
        // NHL Teams
        'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames',
        'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars',
        'Detroit Red Wings', 'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild',
        'Montreal Canadiens', 'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
        'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken',
        'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Vancouver Canucks', 'Vegas Golden Knights',
        'Washington Capitals', 'Winnipeg Jets',
        // Soccer Teams (Major League Soccer)
        'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'Colorado Rapids',
        'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas', 'Houston Dynamo',
        'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United', 'Montreal Impact',
        'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls', 'Orlando City',
        'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake', 'San Jose Earthquakes', 'Seattle Sounders',
        'Sporting Kansas City', 'Toronto FC', 'Vancouver Whitecaps',
        // International Soccer Teams
        'Manchester United', 'Manchester City', 'Manchester',
        // Common team name variations and abbreviations
        'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Cavs', 'Mavericks', 'Mavs',
        'Nuggets', 'Pistons', 'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies',
        'Heat', 'Bucks', 'Timberwolves', 'Wolves', 'Pelicans', 'Knicks', 'Thunder',
        '76ers', 'Suns', 'Trail Blazers', 'Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards',
        'Cardinals', 'Cards', 'Falcons', 'Ravens', 'Bills', 'Buffalo', 'Panthers', 'Bears', 'Bengals',
        'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Jags',
        'Chiefs', 'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Pats',
        'Saints', 'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers', 'Bucs',
        'Titans', 'Commanders', 'Diamondbacks', 'D-backs', 'Braves', 'Orioles', 'Red Sox', 'Cubs',
        'White Sox', 'Reds', 'Guardians', 'Rockies', 'Tigers', 'Astros', 'Royals', 'Angels',
        'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees', 'Athletics', 'A\'s', 'Phillies',
        'Pirates', 'Padres', 'Giants', 'Mariners', 'Cardinals', 'Rays', 'Rangers', 'Blue Jays',
        'Nationals', 'Nats', 'Ducks', 'Coyotes', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Canes',
        'Blackhawks', 'Hawks', 'Avalanche', 'Avs', 'Blue Jackets', 'Jackets', 'Stars', 'Red Wings',
        'Wings', 'Oilers', 'Panthers', 'Kings', 'Wild', 'Canadiens', 'Habs', 'Predators', 'Preds',
        'Devils', 'Islanders', 'Isles', 'Rangers', 'Senators', 'Sens', 'Flyers', 'Penguins', 'Pens',
        'Sharks', 'Kraken', 'Blues', 'Lightning', 'Bolts', 'Maple Leafs', 'Leafs', 'Canucks',
        'Golden Knights', 'Knights', 'Capitals', 'Caps', 'Jets', 'United', 'Fire', 'Rapids',
        'Crew', 'Dynamo', 'Galaxy', 'Revolution', 'Revolution', 'Timbers', 'Sounders', 'Whitecaps'
    ];
    
    // Remove team names
    teamNames.forEach(teamName => {
        const regex = new RegExp(`\\b${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    });
    
    // Remove PSA certification numbers and related info
    cleaned = cleaned.replace(/PSA\s+GEM\s+M[T]?(\s+\d+)?(\s+CERT\s*#?\s*\d+)?/gi, '');
    cleaned = cleaned.replace(/PSA\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    cleaned = cleaned.replace(/CERT\s*#?\s*\d{8,}/gi, ''); // 8+ digit cert numbers
    
    // Remove other grading company cert numbers
    cleaned = cleaned.replace(/BGS\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
    cleaned = cleaned.replace(/SGS\s+\d+(\.\d+)?\s+CERT\s*#?\s*\d+/gi, '');
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
    
    // Remove odd characters (emojis, special characters, etc.)
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]/gu, '');
    
    // Remove other special characters that might cause issues
    cleaned = cleaned.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters
    
    // Remove any remaining odd characters and symbols  
    cleaned = cleaned.replace(/[^\w\s\-\.\#\&\//]/g, ''); // Keep only letters, numbers, spaces, hyphens, dots, #, &, and /
    
    // Remove extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove duplicate words (case insensitive)
    const words = cleaned.split(' ');
    const uniqueWords = [];
    const seenWords = new Set();
    
    for (const word of words) {
        const lowerWord = word.toLowerCase();
        if (!seenWords.has(lowerWord) && word.trim()) {
            seenWords.add(lowerWord);
            uniqueWords.push(word);
        }
    }
    
    // Join back together
    cleaned = uniqueWords.join(' ');
    
    // Final cleanup - remove any remaining extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove leading dash if present
    cleaned = cleaned.replace(/^-+\s*/, '');
    
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
}
