const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SportUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    detectSportFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // Pokemon detection
        if (titleLower.includes('pokemon') || titleLower.includes('pikachu') || titleLower.includes('charizard') || 
            titleLower.includes('moltres') || titleLower.includes('zapdos') || titleLower.includes('articuno') ||
            titleLower.includes('gx') || titleLower.includes('sm210')) {
            return 'Pokemon';
        }
        
        // Racing detection (F1) - check this first to avoid false matches
        if (titleLower.includes('f1') || titleLower.includes('formula 1') || titleLower.includes('lando norris') ||
            titleLower.includes('mclaren') || titleLower.includes('racing') || titleLower.includes('grand prix') ||
            titleLower.includes('max verstappen') || titleLower.includes('lewis hamilton') || titleLower.includes('charles leclerc')) {
            return 'Racing';
        }
        
        // Football detection - enhanced with more specific terms
        if (this.hasFootballIndicators(titleLower)) {
            return 'Football';
        }
        
        // Basketball detection - enhanced with more specific terms
        if (this.hasBasketballIndicators(titleLower)) {
            return 'Basketball';
        }
        
        // Baseball detection - enhanced with more specific terms
        if (this.hasBaseballIndicators(titleLower)) {
            return 'Baseball';
        }
        
        // Hockey detection
        if (titleLower.includes('blackhawks') || titleLower.includes('bruins') || titleLower.includes('rangers') ||
            titleLower.includes('hockey') || titleLower.includes('nhl') || titleLower.includes('goalie') ||
            titleLower.includes('goaltender') || titleLower.includes('defenseman') || titleLower.includes('forward') ||
            titleLower.includes('auston matthews') || titleLower.includes('connor mcdavid') || titleLower.includes('leon draisaitl') ||
            titleLower.includes('nathan mackinnon') || titleLower.includes('sydney crosby') || titleLower.includes('alex ovechkin')) {
            return 'Hockey';
        }
        
        // Soccer detection
        if (titleLower.includes('soccer') || titleLower.includes('fifa') || titleLower.includes('premier league') ||
            titleLower.includes('manchester') || titleLower.includes('barcelona') || titleLower.includes('real madrid') ||
            titleLower.includes('lionel messi') || titleLower.includes('cristiano ronaldo') || titleLower.includes('kylian mbappe')) {
            return 'Soccer';
        }
        
        // Card game detection
        if (titleLower.includes('yugioh') || titleLower.includes('yu-gi-oh')) {
            return 'Yu-Gi-Oh';
        }
        if (titleLower.includes('magic the gathering') || titleLower.includes('mtg') || 
            (titleLower.includes('magic') && !titleLower.includes('orlando magic'))) {
            return 'Magic';
        }
        
        return 'Unknown';
    }

    hasFootballIndicators(titleLower) {
        // Team names
        const footballTeams = [
            'bears', 'packers', 'cowboys', 'eagles', 'giants', 'redskins', 'commanders', 'patriots', 'steelers', '49ers',
            'seahawks', 'cardinals', 'rams', 'saints', 'buccaneers', 'falcons', 'panthers', 'vikings', 'lions', 'bills',
            'dolphins', 'jets', 'bengals', 'browns', 'ravens', 'texans', 'colts', 'jaguars', 'titans', 'broncos',
            'chargers', 'raiders', 'chiefs'
        ];
        
        // Position terms
        const footballPositions = [
            'qb', 'quarterback', 'running back', 'wide receiver', 'tight end', 'defensive', 'linebacker',
            'cornerback', 'safety', 'defensive end', 'defensive tackle', 'offensive line', 'kicker', 'punter'
        ];
        
        // Player names (current and recent players)
        const footballPlayers = [
            'patrick mahomes', 'josh allen', 'joe burrow', 'justin herbert', 'lamar jackson', 'jalen hurts',
            'dak prescott', 'aaron rodgers', 'tom brady', 'christian mccaffrey', 'saquon barkley', 'derrick henry',
            'tyreek hill', 'justin jefferson', 'jamarr chase', 'stefon diggs', 'davante adams', 'cooper kupp',
            'caleb williams', 'drake maye', 'bo nix', 'jayden daniels', 'michael penix', 'jj mccarthy',
            'bryce young', 'rome odunze', 'marvin harrison', 'blake corum', 'bijan robinson', 'rashee rice',
            'brock bowers', 'trevor lawrence', 'myles garrett'
        ];
        
        // Sport terms
        const footballTerms = ['football', 'nfl', 'college football', 'ncaa football'];
        
        return footballTeams.some(team => titleLower.includes(team)) ||
               footballPositions.some(pos => titleLower.includes(pos)) ||
               footballPlayers.some(player => titleLower.includes(player)) ||
               footballTerms.some(term => titleLower.includes(term));
    }

    hasBasketballIndicators(titleLower) {
        // Team names
        const basketballTeams = [
            'lakers', 'celtics', 'bulls', 'warriors', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks',
            'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks',
            'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers',
            'kings', 'suns', 'clippers'
        ];
        
        // Position terms
        const basketballPositions = [
            'point guard', 'shooting guard', 'small forward', 'power forward', 'center', 'forward', 'guard'
        ];
        
        // Player names (current and recent players)
        const basketballPlayers = [
            'lebron james', 'stephen curry', 'kevin durant', 'giannis', 'nikola jokic', 'joel embiid',
            'luka doncic', 'ja morant', 'zion williamson', 'anthony edwards', 'lamelo ball', 'cade cunningham',
            'paolo banchero', 'chet holmgren', 'victor wembanyama', 'scoot henderson', 'domantas sabonis',
            'caitlin clark', 'brock purdy', 'rj barrett', 'sabrina ionescu', 'stephon castle'
        ];
        
        // Sport terms
        const basketballTerms = ['basketball', 'nba', 'college basketball', 'ncaa basketball', 'wnba'];
        
        return basketballTeams.some(team => titleLower.includes(team)) ||
               basketballPositions.some(pos => titleLower.includes(pos)) ||
               basketballPlayers.some(player => titleLower.includes(player)) ||
               basketballTerms.some(term => titleLower.includes(term));
    }

    hasBaseballIndicators(titleLower) {
        // Team names
        const baseballTeams = [
            'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians',
            'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers',
            'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies',
            'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals'
        ];
        
        // Position terms
        const baseballPositions = [
            'pitcher', 'hitter', 'outfielder', 'infielder', 'catcher', 'shortstop', 'first base',
            'second base', 'third base', 'designated hitter', 'dh'
        ];
        
        // Player names (current and recent players)
        const baseballPlayers = [
            'shohei ohtani', 'gunnar henderson', 'elly de la cruz', 'mike trout', 'bryce harper',
            'ronald acuna', 'juan soto', 'fernando tatis', 'vladimir guerrero', 'bo bichette',
            'julio rodriguez', 'spencer strider', 'corbin carroll', 'anthony volpe', 'eloy jimenez',
            'luis robert', 'yordan alvarez', 'kyle tucker', 'jose altuve', 'aaron judge', 'gerrit cole',
            'jacob degrom', 'max scherzer', 'justin verlander', 'clayton kershaw', 'justin crawford',
            'sebastian walcott', 'daiverson gutierrez', 'luis baez', 'roderick arias', 'spencer jones',
            'kyle lewis', 'jackson merrill', 'cavan biggio', 'mickey moniak', 'dylan crews',
            'wyatt langford', 'jackson holliday', 'jeremy pena', 'yoniel curet', 'edouard julien',
            'paul skenes', 'gg jackson'
        ];
        
        // Sport terms
        const baseballTerms = ['baseball', 'mlb', 'major league', 'minor league'];
        
        return baseballTeams.some(team => titleLower.includes(team)) ||
               baseballPositions.some(pos => titleLower.includes(pos)) ||
               baseballPlayers.some(player => titleLower.includes(player)) ||
               baseballTerms.some(term => titleLower.includes(term));
    }

    async updateSportsInDatabase() {
        try {
            console.log('🔄 Updating sports in database...');
            const cards = await this.getAllCards();
            console.log(`📊 Found ${cards.length} cards to process`);
            
            let updatedCount = 0;
            let unchangedCount = 0;
            let sportChanges = {};

            for (const card of cards) {
                const originalSport = card.sport || 'Unknown';
                const newSport = this.detectSportFromKeywords(card.title);
                
                if (newSport !== originalSport) {
                    await this.updateCardSport(card.id, newSport);
                    console.log(`✅ Updated card ${card.id}: "${card.title}"`);
                    console.log(`   Sport: "${originalSport}" → "${newSport}"`);
                    
                    // Track sport changes
                    if (!sportChanges[originalSport]) sportChanges[originalSport] = {};
                    if (!sportChanges[originalSport][newSport]) sportChanges[originalSport][newSport] = 0;
                    sportChanges[originalSport][newSport]++;
                    
                    updatedCount++;
                } else {
                    unchangedCount++;
                }
            }

            console.log(`\n📈 Summary:`);
            console.log(`   ✅ Updated: ${updatedCount} cards`);
            console.log(`   ⏭️  Unchanged: ${unchangedCount} cards`);
            console.log(`   📊 Total processed: ${cards.length} cards`);

            if (Object.keys(sportChanges).length > 0) {
                console.log(`\n🔄 Sport Changes:`);
                for (const [fromSport, toSports] of Object.entries(sportChanges)) {
                    for (const [toSport, count] of Object.entries(toSports)) {
                        console.log(`   ${fromSport} → ${toSport}: ${count} cards`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error updating sports:', error);
            throw error;
        }
    }

    async getAllCards() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT id, title, sport FROM cards", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateCardSport(id, newSport) {
        return new Promise((resolve, reject) => {
            this.db.run("UPDATE cards SET sport = ? WHERE id = ?", [newSport, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                    } else {
                        console.log('✅ Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

async function main() {
    const updater = new SportUpdater();
    try {
        await updater.connect();
        await updater.updateSportsInDatabase();
        console.log('✅ Sport update completed successfully!');
    } catch (error) {
        console.error('❌ Sport update failed:', error);
        process.exit(1);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { SportUpdater };
