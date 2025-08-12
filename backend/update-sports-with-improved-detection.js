const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ESPNSportDetector } = require('./espn-sport-detector.js');

class SportsUpdaterWithImprovedDetection {
    constructor() {
        this.pricingDb = null;
        this.comprehensiveDb = null;
        this.espnDetector = new ESPNSportDetector();
    }

    async connect() {
        console.log('🔗 Connecting to databases...');
        
        // Connect to pricing database
        const pricingDbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.pricingDb = new sqlite3.Database(pricingDbPath);
        
        // Connect to comprehensive database
        const comprehensiveDbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.comprehensiveDb = new sqlite3.Database(comprehensiveDbPath);
        
        console.log('✅ Connected to databases');
    }

    async close() {
        if (this.pricingDb) {
            this.pricingDb.close();
        }
        if (this.comprehensiveDb) {
            this.comprehensiveDb.close();
        }
        console.log('🔌 Database connections closed');
    }

    async extractPlayerName(title) {
        // Extract player name from card title for ESPN API calls
        // Use intelligent filtering to identify card-related terms vs player names
        const titleLower = title.toLowerCase();
        
        // First, remove basic card terms that we know are not player names
        let playerName = title
            .replace(/\d{4}/g, '') // Remove years
            .replace(/psa|bgs|beckett|gem|mint|near mint|excellent|very good|good|fair|poor/gi, '') // Remove grading terms
            .replace(/card|cards/gi, '') // Remove "card" and "cards"
            .replace(/#[A-Z0-9\-]+/g, '') // Remove card numbers like #123, #TF1, #BC-72, #CPA-BA
            .replace(/\d+\/\d+/g, '') // Remove print runs like 123/456
            .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, '') // Remove ordinal numbers like 1st, 2nd, 3rd
            .replace(/\b\d+\b/g, '') // Remove standalone numbers
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        // Split into words
        const words = playerName.split(' ').filter(word => word.length > 0);
        
        // Filter out words that are clearly card-related terms
        const filteredWords = [];
        
        for (const word of words) {
            // Skip if word is too short (likely not a player name)
            if (word.length < 2) continue;
            
            // Define clearly card-related terms that should always be filtered
            const cardTerms = [
                // Card brands and companies
                'topps', 'panini', 'donruss', 'bowman', 'upper', 'deck', 'fleer', 'score', 'leaf',
                // Card set types
                'chrome', 'prizm', 'optic', 'mosaic', 'select', 'heritage', 'stadium', 'club', 'allen', 'ginter', 'gypsy', 'queen', 'finest', 'fire', 'opening', 'day', 'big', 'league', 'immaculate', 'national', 'treasures', 'flawless', 'obsidian', 'chronicles', 'contenders', 'international',
                // Parallel and insert types
                'refractor', 'parallel', 'numbered', 'limited', 'gold', 'silver', 'bronze', 'platinum', 'diamond', 'emerald', 'sapphire', 'ruby', 'amethyst', 'onyx', 'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'teal', 'aqua', 'cyan', 'lime', 'mint', 'peach', 'salmon', 'tan', 'brown', 'gray', 'grey', 'navy', 'maroon', 'burgundy', 'crimson', 'scarlet',
                // Card features
                'rookie', 'rc', 'auto', 'autograph', 'jersey', 'patch', 'base', 'holo', 'ssp', 'sp', 'hof',
                // Other card terms
                'victory', 'crown', 'portrait', 'police', 'instant', 'impact', 'update', 'field', 'level', 'courtside', 'elephant', 'disco', 'ice', 'lazer', 'shock', 'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire', 'woo', 'draft', 'red/white/blue', 'tf1'
            ];
            
            // Check if word is a clearly card-related term
            if (cardTerms.includes(word.toLowerCase())) {
                continue;
            }
            
            // Check comprehensive database for card-related terms (but be more selective)
            if (this.comprehensiveDb) {
                try {
                    const query = `
                        SELECT name, displayName, sport, year, brand 
                        FROM sets 
                        WHERE LOWER(name) LIKE ? 
                        OR LOWER(displayName) LIKE ? 
                        OR LOWER(searchText) LIKE ?
                        OR LOWER(setName) LIKE ?
                        LIMIT 3
                    `;
                    
                    const results = await this.runComprehensiveQuery(query, [
                        `%${word.toLowerCase()}%`,
                        `%${word.toLowerCase()}%`,
                        `%${word.toLowerCase()}%`,
                        `%${word.toLowerCase()}%`
                    ]);
                    
                    // Only filter out if the database entries are clearly card-related (not player names)
                    if (results && results.length > 0) {
                        let shouldFilter = false;
                        
                        for (const result of results) {
                            const entryText = `${result.name} ${result.displayName} ${result.searchText} ${result.setName}`.toLowerCase();
                            
                            // Check if this looks like a card set/term rather than a player name
                            const cardIndicators = ['edition', 'collection', 'series', 'set', 'cards', 'card', 'prizm', 'chrome', 'topps', 'panini', 'donruss', 'bowman', 'upper', 'deck', 'fleer', 'score', 'leaf', 'victory', 'crown', 'portrait', 'police', 'instant', 'impact', 'update', 'field', 'level', 'courtside', 'elephant', 'disco', 'ice', 'lazer', 'shock', 'wave', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'aqua', 'sapphire'];
                            
                            if (cardIndicators.some(indicator => entryText.includes(indicator))) {
                                shouldFilter = true;
                                break;
                            }
                        }
                        
                        if (shouldFilter) {
                            continue;
                        }
                    }
                } catch (error) {
                    // If database query fails, keep the word (safer to include than exclude)
                }
            }
            
            // Also filter out common team names
            const teamNames = ['cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'vikings', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls'];
            
            if (teamNames.includes(word.toLowerCase())) {
                continue;
            }
            
            // Keep the word if it passes all filters
            filteredWords.push(word);
        }
        
        // Look for patterns like "First Last" or "First Middle Last"
        if (filteredWords.length >= 2 && filteredWords.length <= 3) {
            // Check if it looks like a name (reasonable length)
            const potentialName = filteredWords.slice(0, Math.min(3, filteredWords.length)).join(' ');
            if (potentialName.length >= 3 && potentialName.length <= 30) {
                return potentialName;
            }
        }
        
        return null;
    }

    async runComprehensiveQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.comprehensiveDb.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async runPricingQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.pricingDb.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateSportsForExistingCards() {
        console.log('🔄 Starting improved sport detection update for existing cards...');
        
        try {
            // Get all cards to re-evaluate sport detection
            const cards = await this.runPricingQuery(`
                SELECT id, title, summary_title, sport 
                FROM cards 
                LIMIT 1000
            `);
            
            console.log(`📊 Found ${cards.length} cards with Unknown/missing sport`);
            
            let updatedCount = 0;
            let espnSuccessCount = 0;
            let keywordSuccessCount = 0;
            
            for (const card of cards) {
                try {
                    console.log(`🔍 Processing card ${card.id}: "${card.title}"`);
                    
                    // First try ESPN API with improved player name extraction
                    const playerName = await this.extractPlayerName(card.title);
                    let detectedSport = null;
                    
                    if (playerName) {
                        console.log(`👤 Extracted player name: "${playerName}"`);
                        
                        try {
                            detectedSport = await this.espnDetector.detectSportFromPlayer(playerName);
                            if (detectedSport && detectedSport !== 'Unknown') {
                                console.log(`✅ ESPN API detected sport: ${detectedSport}`);
                                espnSuccessCount++;
                            }
                        } catch (error) {
                            console.log(`⚠️ ESPN API failed for "${playerName}": ${error.message}`);
                        }
                    }
                    
                    // If ESPN didn't work, try keyword detection
                    if (!detectedSport || detectedSport === 'Unknown') {
                        detectedSport = this.detectSportFromKeywords(card.title);
                        if (detectedSport && detectedSport !== 'Unknown') {
                            console.log(`🔍 Keyword detection found sport: ${detectedSport}`);
                            keywordSuccessCount++;
                        }
                    }
                    
                    // Update the card if we found a sport and it's different from current
                    if (detectedSport && detectedSport !== 'Unknown' && detectedSport !== card.sport) {
                        await this.runPricingQuery(
                            'UPDATE cards SET sport = ? WHERE id = ?',
                            [detectedSport, card.id]
                        );
                        updatedCount++;
                        console.log(`✅ Updated card ${card.id} sport from "${card.sport}" to: ${detectedSport}`);
                    } else if (detectedSport && detectedSport !== 'Unknown') {
                        console.log(`ℹ️ Card ${card.id} already has correct sport: ${detectedSport}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                }
            }
            
            console.log(`✅ Sport detection update completed!`);
            console.log(`📊 Results:`);
            console.log(`   - Total cards processed: ${cards.length}`);
            console.log(`   - Cards updated: ${updatedCount}`);
            console.log(`   - ESPN API successes: ${espnSuccessCount}`);
            console.log(`   - Keyword detection successes: ${keywordSuccessCount}`);
            
        } catch (error) {
            console.error('❌ Error in sport detection update:', error);
            throw error;
        }
    }

    detectSportFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // Football detection
        if (titleLower.includes('football') || titleLower.includes('nfl') || titleLower.includes('college football') ||
            titleLower.includes('patrick mahomes') || titleLower.includes('josh allen') || titleLower.includes('joe burrow') ||
            titleLower.includes('justin herbert') || titleLower.includes('lamar jackson') || titleLower.includes('jalen hurts') ||
            titleLower.includes('dak prescott') || titleLower.includes('aaron rodgers') || titleLower.includes('tom brady') ||
            titleLower.includes('christian mccaffrey') || titleLower.includes('saquon barkley') || titleLower.includes('derrick henry') ||
            titleLower.includes('tyreek hill') || titleLower.includes('justin jefferson') || titleLower.includes('jamarr chase') ||
            titleLower.includes('stefon diggs') || titleLower.includes('davante adams') || titleLower.includes('cooper kupp') ||
            titleLower.includes('caleb williams') || titleLower.includes('drake maye') || titleLower.includes('bo nix') ||
            titleLower.includes('jayden daniels') || titleLower.includes('michael penix') || titleLower.includes('jj mccarthy') ||
            titleLower.includes('bryce young') || titleLower.includes('rome odunze') || titleLower.includes('marvin harrison') ||
            titleLower.includes('blake corum') || titleLower.includes('bijan robinson') || titleLower.includes('rashee rice') ||
            titleLower.includes('brock bowers') || titleLower.includes('trevor lawrence') || titleLower.includes('myles garrett')) {
            return 'Football';
        }
        
        // Basketball detection
        if (titleLower.includes('basketball') || titleLower.includes('nba') || titleLower.includes('college basketball') ||
            titleLower.includes('lebron james') || titleLower.includes('stephen curry') || titleLower.includes('kevin durant') ||
            titleLower.includes('giannis') || titleLower.includes('nikola jokic') || titleLower.includes('joel embiid') ||
            titleLower.includes('luka doncic') || titleLower.includes('ja morant') || titleLower.includes('zion williamson') ||
            titleLower.includes('anthony edwards') || titleLower.includes('lamelo ball') || titleLower.includes('cade cunningham') ||
            titleLower.includes('paolo banchero') || titleLower.includes('chet holmgren') || titleLower.includes('victor wembanyama') ||
            titleLower.includes('scoot henderson') || titleLower.includes('domantas sabonis') || titleLower.includes('caitlin clark') ||
            titleLower.includes('brock purdy') || titleLower.includes('rj barrett') || titleLower.includes('sabrina ionescu') ||
            titleLower.includes('stephon castle') || titleLower.includes('cooper flagg')) {
            return 'Basketball';
        }
        
        // Baseball detection
        if (titleLower.includes('baseball') || titleLower.includes('mlb') || titleLower.includes('college baseball') ||
            titleLower.includes('mike trout') || titleLower.includes('aaron judge') || titleLower.includes('shohei ohtani') ||
            titleLower.includes('ronald acuna') || titleLower.includes('mookie betts') || titleLower.includes('freddie freeman') ||
            titleLower.includes('juan soto') || titleLower.includes('yordan alvarez') || titleLower.includes('kyle tucker') ||
            titleLower.includes('jose altuve') || titleLower.includes('alex bregman') || titleLower.includes('carlos correa') ||
            titleLower.includes('fernando tatis') || titleLower.includes('machado') || titleLower.includes('xander bogaerts') ||
            titleLower.includes('rafael devers') || titleLower.includes('vladimir guerrero') || titleLower.includes('bo bichette') ||
            titleLower.includes('julio rodriguez') || titleLower.includes('adley rutschman') || titleLower.includes('gunnar henderson') ||
            titleLower.includes('elly de la cruz') || titleLower.includes('jackson holliday') || titleLower.includes('wyatt flores') ||
            titleLower.includes('paul skenes') || titleLower.includes('jackson chourio') || titleLower.includes('jordan lawlar') ||
            titleLower.includes('junior caminero')) {
            return 'Baseball';
        }
        
        // Hockey detection
        if (titleLower.includes('hockey') || titleLower.includes('nhl') || titleLower.includes('college hockey') ||
            titleLower.includes('auston matthews') || titleLower.includes('connor mcdavid') || titleLower.includes('leon draisaitl') ||
            titleLower.includes('nathan mackinnon') || titleLower.includes('sydney crosby') || titleLower.includes('alex ovechkin') ||
            titleLower.includes('david pastrnak') || titleLower.includes('artemi panarin') || titleLower.includes('mikko rantanen') ||
            titleLower.includes('nikita kucherov') || titleLower.includes('steven stamkos') || titleLower.includes('brayden point') ||
            titleLower.includes('victor hedman') || titleLower.includes('roman josi') || titleLower.includes('cale makar') ||
            titleLower.includes('quinn hughes') || titleLower.includes('adam fox') || titleLower.includes('morgan rielly') ||
            titleLower.includes('jake guentzel') || titleLower.includes('mitch marner') || titleLower.includes('william nylander')) {
            return 'Hockey';
        }
        
        // Soccer detection
        if (titleLower.includes('soccer') || titleLower.includes('fifa') || titleLower.includes('premier league') ||
            titleLower.includes('manchester') || titleLower.includes('barcelona') || titleLower.includes('real madrid') ||
            titleLower.includes('lionel messi') || titleLower.includes('cristiano ronaldo') || titleLower.includes('kylian mbappe')) {
            return 'Soccer';
        }
        
        // Golf detection
        if (titleLower.includes('golf') || titleLower.includes('liv golf') || titleLower.includes('pga') || 
            titleLower.includes('tiger woods') || titleLower.includes('rory mcilroy') || titleLower.includes('brooks koepka') ||
            titleLower.includes('jon rahm') || titleLower.includes('scottie scheffler') || titleLower.includes('jordan spieth') ||
            titleLower.includes('justin thomas') || titleLower.includes('collin morikawa') || titleLower.includes('viktor hovland') ||
            titleLower.includes('masters') || titleLower.includes('us open') || titleLower.includes('pga championship') ||
            titleLower.includes('open championship') || titleLower.includes('ryder cup') || titleLower.includes('presidents cup')) {
            return 'Golf';
        }
        
        return 'Unknown';
    }
}

module.exports = { SportsUpdaterWithImprovedDetection };
