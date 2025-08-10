const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SummaryTitleUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    cleanSummaryTitle(title) {
        return title
            // Remove grading terms
            .replace(/PSA\s*\d+/gi, '') // Remove PSA grades
            .replace(/GEM\s*MT/gi, '') // Remove GEM MT
            .replace(/GEM/gi, '') // Remove GEM
            .replace(/MINT\s*\d+/gi, '') // Remove MINT grades
            .replace(/MINT/gi, '') // Remove MINT
            .replace(/CERT\s*#\d+/gi, '') // Remove certification numbers
            
            // Remove descriptive words that don't fit the formula
            .replace(/BEAUTIFUL/gi, '')
            .replace(/GORGEOUS/gi, '')
            .replace(/STUNNING/gi, '')
            .replace(/MINT\s*CONDITION/gi, '')
            .replace(/CASE\s*HIT/gi, '') // Remove case hit
            .replace(/HOT\s*NUMBERS/gi, '') // Remove hot numbers
            .replace(/ELECTRIC\s*ETCH/gi, '') // Remove electric etch
            .replace(/VITREOUS/gi, '') // Remove vitreous
            .replace(/ICE\s*PRIZM/gi, '') // Remove ice prizm
            .replace(/BOMB\s*SQUAD/gi, '') // Remove bomb squad
            .replace(/ON\s*DECK/gi, '') // Remove on deck
            .replace(/POP\.\s*\d+/gi, '') // Remove POP numbers with periods
            .replace(/POP\s*\d+/gi, '') // Remove POP numbers
            
            // Remove common card terms that don't help search
            .replace(/\bRC\b/gi, '') // Remove RC (Rookie Card)
            .replace(/\bROOKIE\b/gi, '') // Remove ROOKIE
            .replace(/\bAUTO\b/gi, '') // Remove AUTO
            .replace(/\bAUTOGRAPH\b/gi, '') // Remove AUTOGRAPH
            .replace(/\bREFRACTOR\b/gi, '') // Remove REFRACTOR
            .replace(/\bPARALLEL\b/gi, '') // Remove PARALLEL
            .replace(/\bNUMBERED\b/gi, '') // Remove NUMBERED
            .replace(/\bSSP\b/gi, '') // Remove SSP (Super Short Print)
            .replace(/\bSP\b/gi, '') // Remove SP (Short Print)
            .replace(/\bHOF\b/gi, '') // Remove HOF (Hall of Fame)
            
            // Remove additional terms that don't help search
            .replace(/\bLA\b/gi, '') // Remove LA
            .replace(/\bDUKE\b/gi, '') // Remove DUKE
            .replace(/\bCARD\b/gi, '') // Remove CARD
            .replace(/\bPATS\b/gi, '') // Remove PATS
            .replace(/\bRATED\b/gi, '') // Remove RATED
            .replace(/\bINSTER\b/gi, '') // Remove INSTER
            .replace(/\bMVP\b/gi, '') // Remove MVP
            .replace(/\bBOX\s*SET\b/gi, '') // Remove BOX SET
            .replace(/\bMAV\b/gi, '') // Remove MAV
            .replace(/\bPITCHING\b/gi, '') // Remove PITCHING
            .replace(/\bBATTING\b/gi, '') // Remove BATTING
            
            // Remove sport names (not part of the formula)
            .replace(/\bNBA\b/gi, '') // Remove NBA
            .replace(/\bBASKETBALL\b/gi, '') // Remove BASKETBALL
            .replace(/\bFOOTBALL\b/gi, '') // Remove FOOTBALL
            .replace(/\bBASEBALL\b/gi, '') // Remove BASEBALL
            .replace(/\bHOCKEY\b/gi, '') // Remove HOCKEY
            .replace(/\bSOCCER\b/gi, '') // Remove SOCCER
            .replace(/\bNFL\b/gi, '') // Remove NFL
            .replace(/\bMLB\b/gi, '') // Remove MLB
            .replace(/\bNHL\b/gi, '') // Remove NHL
            .replace(/\bFIFA\b/gi, '') // Remove FIFA
            
            // Remove team names and cities (not part of the formula)
            .replace(/\b(LAKERS|WARRIORS|CELTICS|HEAT|KNICKS|NETS|RAPTORS|76ERS|HAWKS|HORNETS|WIZARDS|MAGIC|PACERS|BUCKS|CAVALIERS|PISTONS|ROCKETS|MAVERICKS|SPURS|GRIZZLIES|PELICANS|THUNDER|JAZZ|NUGGETS|TIMBERWOLVES|TRAIL\s*BLAZERS|KINGS|SUNS|CLIPPERS|BULLS)\b/gi, '') // Remove NBA team names
            .replace(/\b(COWBOYS|EAGLES|GIANTS|REDSKINS|COMMANDERS|BEARS|PACKERS|VIKINGS|LIONS|FALCONS|PANTHERS|SAINTS|BUCCANEERS|RAMS|49ERS|SEAHAWKS|CARDINALS|JETS|PATRIOTS|BILLS|DOLPHINS|BENGALS|BROWNS|STEELERS|RAVENS|TEXANS|COLTS|JAGUARS|TITANS|BRONCOS|CHARGERS|RAIDERS|CHIEFS)\b/gi, '') // Remove NFL team names
            .replace(/\b(YANKEES|RED\s*SOX|BLUE\s*JAYS|ORIOLES|RAYS|WHITE\s*SOX|INDIANS|GUARDIANS|TIGERS|TWINS|ROYALS|ASTROS|RANGERS|ATHLETICS|MARINERS|ANGELS|DODGERS|GIANTS|PADRES|ROCKIES|DIAMONDBACKS|BRAVES|MARLINS|METS|PHILLIES|NATIONALS|PIRATES|REDS|BREWERS|CUBS|CARDINALS)\b/gi, '') // Remove MLB team names
            .replace(/\b(CHICAGO|BOSTON|NEW\s*YORK|LOS\s*ANGELES|MIAMI|DALLAS|HOUSTON|PHOENIX|DENVER|PORTLAND|SACRAMENTO|MINNEAPOLIS|OKLAHOMA\s*CITY|SALT\s*LAKE\s*CITY|MEMPHIS|NEW\s*ORLEANS|SAN\s*ANTONIO|ORLANDO|ATLANTA|CHARLOTTE|WASHINGTON|DETROIT|CLEVELAND|INDIANAPOLIS|MILWAUKEE|PHILADELPHIA|BROOKLYN|TORONTO)\b/gi, '') // Remove city names
            
            // Remove special characters and emojis (but keep hyphens, periods, #, and /)
            .replace(/[^\w\s\-\.#\/]/g, '')
            
            // Remove standalone hyphens but preserve year ranges (like 1994-95)
            .replace(/(?<!\d)\s*-\s*(?!\d)/g, ' ') // Replace " - " with space, but not between numbers
            .replace(/^\s*-\s*/, '') // Remove leading hyphen
            .replace(/\s*-\s*$/, '') // Remove trailing hyphen
            
            // Normalize spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    detectSportFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // WWE/Wrestling detection
        if (titleLower.includes('wwe') || titleLower.includes('wrestling') || titleLower.includes('wrestler')) {
            return 'Wrestling';
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
        
        // Card game detection - be more specific to avoid false matches
        if (titleLower.includes('yugioh') || titleLower.includes('yu-gi-oh')) {
            return 'Yu-Gi-Oh';
        }
        if (titleLower.includes('magic the gathering') || titleLower.includes('mtg') || 
            (titleLower.includes('magic') && !titleLower.includes('orlando magic'))) {
            return 'Magic';
        }
        
        // Default to Unknown for troubleshooting
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
            'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers'
        ];
        
        // Position terms
        const basketballPositions = [
            'point guard', 'shooting guard', 'small forward', 'power forward', 'center', 'pg', 'sg', 'sf', 'pf', 'c'
        ];
        
        // Player names (current and recent players)
        const basketballPlayers = [
            'lebron james', 'stephen curry', 'kevin durant', 'giannis antetokounmpo', 'nikola jokic', 'joel embiid',
            'luka doncic', 'jayson tatum', 'jimmy butler', 'damian lillard', 'donovan mitchell', 'devin booker',
            'anthony davis', 'kawhi leonard', 'paul george', 'russell westbrook', 'chris paul', 'james harden',
            'victor wembanyama', 'che holmgren', 'paolo banchero', 'jabari smith', 'keegan murray', 'bennedict mathurin',
            'stephon castle', 'reed sheppard', 'rob dillingham', 'zach edey', 'kyle filipowski', 'tyler kolek'
        ];
        
        // Sport terms
        const basketballTerms = ['basketball', 'nba', 'college basketball', 'ncaa basketball'];
        
        return basketballTeams.some(team => titleLower.includes(team)) ||
               basketballPositions.some(pos => titleLower.includes(pos)) ||
               basketballPlayers.some(player => titleLower.includes(player)) ||
               basketballTerms.some(term => titleLower.includes(term));
    }

    hasBaseballIndicators(titleLower) {
        // Team names
        const baseballTeams = [
            'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins',
            'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies',
            'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'cardinals'
        ];
        
        // Position terms
        const baseballPositions = [
            'pitcher', 'catcher', 'first base', 'second base', 'third base', 'shortstop', 'left field', 'center field', 'right field',
            'designated hitter', 'dh', 'p', 'c', '1b', '2b', '3b', 'ss', 'lf', 'cf', 'rf'
        ];
        
        // Player names (current and recent players)
        const baseballPlayers = [
            'mike trout', 'aaron judge', 'shohei ohtani', 'ronald acuna', 'mookie betts', 'freddie freeman',
            'juan soto', 'fernando tatis', 'vladimir guerrero', 'yordan alvarez', 'kyle tucker', 'jose altuve',
            'carlos correa', 'francisco lindor', 'trea turner', 'marcus semien', 'corey seager', 'adolis garcia',
            'paul goldschmidt', 'nolan arenado', 'pete alonso', 'jazz chisholm', 'wander franco', 'eloy jimenez'
        ];
        
        // Sport terms
        const baseballTerms = ['baseball', 'mlb', 'major league', 'minor league'];
        
        return baseballTeams.some(team => titleLower.includes(team)) ||
               baseballPositions.some(pos => titleLower.includes(pos)) ||
               baseballPlayers.some(player => titleLower.includes(player)) ||
               baseballTerms.some(term => titleLower.includes(term));
    }

    async updateSummaryTitles() {
        console.log('🔄 Updating summary titles with new cleaning rules...');
        
        try {
            const cards = await this.getAllCards();
            console.log(`📊 Found ${cards.length} cards to update`);
            
            let updatedCount = 0;
            let sportUpdatedCount = 0;
            
            for (const card of cards) {
                const newSummaryTitle = this.cleanSummaryTitle(card.title);
                const newSport = this.detectSportFromKeywords(card.title);
                
                let needsUpdate = false;
                let updateFields = [];
                let updateValues = [];
                
                // Check if summary title needs update
                if (newSummaryTitle !== card.summary_title) {
                    updateFields.push('summary_title = ?');
                    updateValues.push(newSummaryTitle);
                    needsUpdate = true;
                }
                
                // Check if sport needs update (especially for WWE detection)
                if (newSport !== card.sport) {
                    updateFields.push('sport = ?');
                    updateValues.push(newSport);
                    needsUpdate = true;
                    sportUpdatedCount++;
                }
                
                if (needsUpdate) {
                    updateValues.push(card.id);
                    const updateQuery = `
                        UPDATE cards 
                        SET ${updateFields.join(', ')}
                        WHERE id = ?
                    `;
                    
                    await this.runQuery(updateQuery, updateValues);
                    updatedCount++;
                    
                    if (updatedCount % 10 === 0) {
                        console.log(`✅ Updated ${updatedCount} cards...`);
                    }
                }
            }
            
            console.log(`✅ Summary title update complete!`);
            console.log(`📊 Total cards updated: ${updatedCount}`);
            console.log(`🏆 Sports updated: ${sportUpdatedCount}`);
            
        } catch (error) {
            console.error('❌ Error updating summary titles:', error);
            throw error;
        }
    }

    async getAllCards() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id, title, summary_title, sport FROM cards', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close(() => {
                console.log('✅ Database connection closed');
                resolve();
            });
        });
    }
}

async function main() {
    const updater = new SummaryTitleUpdater();
    
    try {
        await updater.connect();
        await updater.updateSummaryTitles();
    } catch (error) {
        console.error('❌ Error in main:', error);
        process.exit(1);
    } finally {
        await updater.close();
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('✅ Summary title update script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Summary title update script failed:', error);
            process.exit(1);
        });
}

module.exports = { SummaryTitleUpdater };
