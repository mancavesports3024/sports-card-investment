const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ESPNSportDetectorV2Integrated } = require('./espn-sport-detector-v2-integrated.js');

class SportsUpdaterWithImprovedDetection {
    constructor() {
        this.pricingDb = null;
        this.comprehensiveDb = null;
        this.espnDetector = new ESPNSportDetectorV2Integrated();
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
        // Use the main database method for player name extraction
        return this.db.extractPlayerName(title);
    }
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
                    
                    // First try keyword detection (more reliable for known players)
                    let detectedSport = this.detectSportFromKeywords(card.title);
                    if (detectedSport && detectedSport !== 'Unknown') {
                        console.log(`🔍 Keyword detection found sport: ${detectedSport}`);
                        keywordSuccessCount++;
                    }
                    
                    // If keyword detection didn't work, try ESPN API with improved player name extraction
                    if (!detectedSport || detectedSport === 'Unknown') {
                        const playerName = await this.extractPlayerName(card.title);
                        
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
