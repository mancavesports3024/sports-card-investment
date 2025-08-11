const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class EnhancedSportDetector {
    constructor() {
        this.comprehensiveDbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.comprehensiveDb = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.comprehensiveDb = new sqlite3.Database(this.comprehensiveDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.warn('⚠️ Warning: Could not connect to comprehensive database:', err.message);
                    resolve();
                } else {
                    console.log('✅ Connected to comprehensive database');
                    resolve();
                }
            });
        });
    }

    async detectSport(title) {
        // First try comprehensive database
        if (this.comprehensiveDb) {
            const dbSport = await this.detectFromComprehensiveDB(title);
            if (dbSport && dbSport !== 'Unknown') {
                return dbSport;
            }
        }

        // Fall back to enhanced keyword detection
        return this.detectFromKeywords(title);
    }

    async detectFromComprehensiveDB(title) {
        try {
            const cleanTitle = this.cleanTitle(title).toLowerCase();
            
            // Search for matching sets in comprehensive database
            const query = `
                SELECT sport, COUNT(*) as matches 
                FROM sets 
                WHERE LOWER(searchText) LIKE ? 
                OR LOWER(displayName) LIKE ?
                OR LOWER(name) LIKE ?
                GROUP BY sport 
                ORDER BY matches DESC 
                LIMIT 1
            `;
            
            const result = await this.getComprehensiveQuery(query, [`%${cleanTitle}%`, `%${cleanTitle}%`, `%${cleanTitle}%`]);
            
            if (result && result.sport) {
                return result.sport;
            }
        } catch (error) {
            // Silent error handling
        }
        
        return 'Unknown';
    }

    detectFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // Card type/set detection - these are card types, not player names
        const cardTypes = [
            'draft', 'concourse', 'purple shock', 'sunday', 'preview', 'bowman u', 'chrome update', 
            'lazer', 'portals', 'disco', 'composite', 'bowman chrome', 'prizm', 'select', 'optic',
            'finest', 'contenders', 'national treasures', 'flawless', 'immaculate', 'panini one',
            'topps chrome', 'topps finest', 'topps heritage', 'topps stadium club', 'topps allen & ginter',
            'donruss optic', 'donruss elite', 'donruss rated rookie', 'panini mosaic', 'panini absolute',
            'panini contenders', 'panini prizm', 'panini select', 'panini optic', 'panini donruss',
            'upper deck', 'fleer', 'score', 'pinnacle', 'leaf', 'skybox', 'hoops', 'sp', 'spx',
            'exquisite', 'ultimate', 'reflections', 'echelon', 'titanium', 'vanguard', 'momentum',
            'gridiron gear', 'threads', 'certified', 'limited', 'elite', 'prestige', 'score',
            'topps chrome sapphire', 'topps chrome black', 'topps chrome platinum', 'topps chrome gold',
            'panini prizm silver', 'panini prizm gold', 'panini prizm black', 'panini prizm white',
            'donruss optic silver', 'donruss optic gold', 'donruss optic black', 'donruss optic white'
        ];
        
        // Check if title contains only card type keywords (no player names)
        const hasOnlyCardTypes = cardTypes.some(type => titleLower.includes(type)) && 
            !this.hasPlayerNameIndicators(titleLower);
        
        if (hasOnlyCardTypes) {
            // For card types, we need to look deeper into the title for sport indicators
            return this.detectSportFromCardType(titleLower);
        }
        
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

    // New method to detect sport from card type titles
    detectSportFromCardType(titleLower) {
        // Look for sport-specific keywords within card type titles
        if (this.hasFootballIndicators(titleLower)) {
            return 'Football';
        }
        
        if (this.hasBasketballIndicators(titleLower)) {
            return 'Basketball';
        }
        
        if (this.hasBaseballIndicators(titleLower)) {
            return 'Baseball';
        }
        
        // Check for sport-specific card brands/sets
        const footballSets = ['gridiron', 'threads', 'certified', 'limited', 'elite', 'prestige', 'score'];
        const basketballSets = ['hoops', 'sp', 'spx', 'exquisite', 'ultimate', 'reflections', 'echelon'];
        const baseballSets = ['topps', 'bowman', 'heritage', 'stadium club', 'allen & ginter'];
        
        if (footballSets.some(set => titleLower.includes(set))) {
            return 'Football';
        }
        
        if (basketballSets.some(set => titleLower.includes(set))) {
            return 'Basketball';
        }
        
        if (baseballSets.some(set => titleLower.includes(set))) {
            return 'Baseball';
        }
        
        return 'Unknown';
    }

    // New method to check if title has player name indicators
    hasPlayerNameIndicators(titleLower) {
        // Common player name patterns
        const playerPatterns = [
            // First Last pattern
            /\b[a-z]+\s+[a-z]+\b/,
            // First M. Last pattern  
            /\b[a-z]+\s+[a-z]\.\s+[a-z]+\b/,
            // First Middle Last pattern
            /\b[a-z]+\s+[a-z]+\s+[a-z]+\b/
        ];
        
        // Check if title contains player name patterns
        return playerPatterns.some(pattern => pattern.test(titleLower));
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

    cleanTitle(title) {
        return title
            .replace(/PSA\s*\d+/gi, '')
            .replace(/GEM\s*MT/gi, '')
            .replace(/MINT\s*\d+/gi, '')
            .replace(/CERT\s*#\d+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async getComprehensiveQuery(sql, params = []) {
        if (!this.comprehensiveDb) {
            return null;
        }
        
        return new Promise((resolve, reject) => {
            this.comprehensiveDb.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async close() {
        if (this.comprehensiveDb) {
            this.comprehensiveDb.close();
        }
    }
}

// Test the enhanced sport detector
async function testEnhancedDetector() {
    const detector = new EnhancedSportDetector();
    
    try {
        await detector.connect();
        
        const testCases = [
            'Bo Nix',
            'Stephon Castle', 
            'Victor Wembanyama',
            'Drake Maye',
            'Rome Odunze',
            'Lando Norris',
            'Justin Herbert',
            '2023 Panini Prizm Bo Nix #123',
            '2023 Donruss Optic Stephon Castle #456',
            '2023 Topps Chrome Victor Wembanyama #789'
        ];
        
        console.log('🧪 Testing Enhanced Sport Detector\n');
        
        for (const testCase of testCases) {
            const sport = await detector.detectSport(testCase);
            console.log(`🎯 "${testCase}" → ${sport}`);
        }
        
    } catch (error) {
        console.error('❌ Error testing detector:', error);
    } finally {
        await detector.close();
    }
}

if (require.main === module) {
    testEnhancedDetector().then(() => {
        console.log('\n✅ Enhanced detector testing complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Enhanced detector testing failed:', error);
        process.exit(1);
    });
}

module.exports = { EnhancedSportDetector };
