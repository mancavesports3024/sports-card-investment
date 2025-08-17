const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { ESPNSportDetectorV2Integrated } = require('./espn-sport-detector-v2-integrated.js');
const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

// FORCE RAILWAY REDEPLOY - Updated sport detection logic deployed
class NewPricingDatabase {
    constructor() {
        // Use Railway volume mount path if available (production), otherwise use local path
        this.pricingDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db')
            : path.join(__dirname, 'data', 'new-scorecard.db');
        this.comprehensiveDbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH 
            ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'comprehensive-card-database.db')
            : path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.pricingDb = null;
        this.comprehensiveDb = null;
        
        // Initialize ESPN sport detector
        this.espnDetector = new ESPNSportDetectorV2Integrated();
        
        // Initialize database-driven standardized title generator
        this.titleGenerator = new DatabaseDrivenStandardizedTitleGenerator();
        this.titleGeneratorInitialized = false;
    }

    async connect() {
        // Connect to new pricing database
        return new Promise((resolve, reject) => {
            this.pricingDb = new sqlite3.Database(this.pricingDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('❌ Error creating new pricing database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to new pricing database');
                    this.pricingDb.run('PRAGMA busy_timeout = 30000');
                    
                    // Create tables if they don't exist
                    this.createTables().then(() => {
                        // Connect to comprehensive database if it exists
                        if (fs.existsSync(this.comprehensiveDbPath)) {
                            this.comprehensiveDb = new sqlite3.Database(this.comprehensiveDbPath, sqlite3.OPEN_READONLY, (err) => {
                                if (err) {
                                    console.warn('⚠️ Warning: Could not connect to comprehensive database:', err.message);
                                } else {
                                    console.log('✅ Connected to comprehensive database');
                                }
                                resolve();
                            });
                        } else {
                            console.log('ℹ️ Comprehensive database not found, using keyword detection only');
                            resolve();
                        }
                    }).catch(reject);
                }
            });
        });
    }

    async createTables() {
        console.log('📋 Creating new pricing database tables...');
        
        const createCardsTable = `
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                summary_title TEXT,
                player_name TEXT,
                sport TEXT,
                year INTEGER,
                brand TEXT,
                set_name TEXT,
                card_type TEXT,
                condition TEXT DEFAULT 'Raw',
                grade TEXT,
                raw_average_price DECIMAL(10,2),
                psa9_average_price DECIMAL(10,2),
                psa10_price DECIMAL(10,2),
                psa10_average_price DECIMAL(10,2),
                multiplier DECIMAL(10,2),
                ebay_item_id TEXT,
                image_url TEXT,
                search_term TEXT,
                source TEXT DEFAULT '130point_auto',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                card_set TEXT,
                card_number TEXT,
                print_run TEXT
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_title ON cards(title)',
            'CREATE INDEX IF NOT EXISTS idx_summary_title ON cards(summary_title)',
            'CREATE INDEX IF NOT EXISTS idx_player_name ON cards(player_name)',
            'CREATE INDEX IF NOT EXISTS idx_sport ON cards(sport)',
            'CREATE INDEX IF NOT EXISTS idx_year ON cards(year)',
            'CREATE INDEX IF NOT EXISTS idx_brand ON cards(brand)',
            'CREATE INDEX IF NOT EXISTS idx_created_at ON cards(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_last_updated ON cards(last_updated)',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_ebay_item_id ON cards(ebay_item_id) WHERE ebay_item_id IS NOT NULL'
        ];

        try {
            await this.runQuery(createCardsTable);
            
            for (const indexQuery of createIndexes) {
                await this.runQuery(indexQuery);
            }
            
            console.log('✅ New pricing database tables created successfully');
        } catch (error) {
            console.error('❌ Error creating tables:', error);
            throw error;
        }
    }

    // Initialize the database-driven standardized title generator
    async initializeTitleGenerator() {
        if (this.titleGeneratorInitialized) {
            return;
        }
        
        try {
            console.log('🧠 Initializing database-driven standardized title generator...');
            await this.titleGenerator.connect();
            await this.titleGenerator.learnFromDatabase();
            this.titleGeneratorInitialized = true;
            console.log('✅ Title generator initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing title generator:', error);
            // Don't throw - fall back to simple cleaning if needed
        }
    }

    // Enhanced sport detection using ESPN v2 API, comprehensive database, and keyword analysis
    async detectSportFromComprehensive(title) {
        // First try ESPN v2 API for player-based sport detection
        try {
            // Use the title generator's player extraction for better results
            const playerName = this.titleGenerator.extractPlayer(title);
            if (playerName) {
                const espnSport = await this.espnDetector.detectSportFromPlayer(playerName);
                if (espnSport && espnSport !== 'Unknown') {
                    console.log(`✅ ESPN v2 API detected sport for ${playerName}: ${espnSport}`);
                    return espnSport;
                }
            }
        } catch (error) {
            console.log(`⚠️ ESPN v2 API failed for ${title}: ${error.message}`);
        }
        
        // Second try to find a match in the comprehensive database
        if (this.comprehensiveDb) {
            try {
                const cleanTitle = this.cleanSummaryTitle(title).toLowerCase();
                
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
        }
        
        // Fall back to keyword detection
        const keywordSport = this.detectSportFromKeywords(title);
        return keywordSport;
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
        
        // Golf detection
        if (titleLower.includes('golf') || titleLower.includes('liv golf') || titleLower.includes('pga') || 
            titleLower.includes('tiger woods') || titleLower.includes('rory mcilroy') || titleLower.includes('brooks koepka') ||
            titleLower.includes('jon rahm') || titleLower.includes('scottie scheffler') || titleLower.includes('jordan spieth') ||
            titleLower.includes('justin thomas') || titleLower.includes('collin morikawa') || titleLower.includes('viktor hovland') ||
            titleLower.includes('masters') || titleLower.includes('us open') || titleLower.includes('pga championship') ||
            titleLower.includes('open championship') || titleLower.includes('ryder cup') || titleLower.includes('presidents cup')) {
            return 'Golf';
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
            'caitlin clark', 'brock purdy', 'rj barrett', 'sabrina ionescu', 'stephon castle', 'cooper flagg'
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

    cleanTitleForSearch(title) {
        return title
            .toLowerCase()
            .replace(/psa\s*\d+/gi, '') // Remove PSA grades
            .replace(/gem\s*mt/gi, '') // Remove GEM MT
            .replace(/mint\s*\d+/gi, '') // Remove MINT grades
            .replace(/rookie/gi, '') // Remove rookie
            .replace(/rc/gi, '') // Remove RC
            .replace(/auto/gi, '') // Remove auto
            .replace(/autograph/gi, '') // Remove autograph
            .replace(/refractor/gi, '') // Remove refractor
            .replace(/parallel/gi, '') // Remove parallel
            .replace(/numbered/gi, '') // Remove numbered
            // Keep card numbers (#123) and print runs (/25, /499) - these are important identifiers
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
    }

    cleanSummaryTitle(title) {
        // First, check if the original title has autograph indicators
        const originalTitleLower = title.toLowerCase();
        const hasAutographIndicator = originalTitleLower.includes('autograph') || 
                                     originalTitleLower.includes('autographs') || 
                                     originalTitleLower.includes('auto') ||
                                     originalTitleLower.includes('signed');
        
        // Do the normal cleaning
        let cleanedTitle = title
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
            .replace(/\bAUTOGRAPHS\b/gi, 'auto') // Change AUTOGRAPHS to auto
            .replace(/\bAUTOGRAPH\b/gi, 'auto') // Change AUTOGRAPH to auto
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
            .replace(/\bNEW\s*ENGLAND\b/gi, '') // Remove NEW ENGLAND
            .replace(/\bCOLOR\s*MATCH\b/gi, '') // Remove COLOR MATCH
            .replace(/\b76ERS\b/gi, '') // Remove 76ERS
            .replace(/\bERS\b/gi, '') // Remove ERS
            .replace(/\bGRADED\b/gi, '') // Remove GRADED
            .replace(/\bPITCHING\b/gi, '') // Remove PITCHING
            .replace(/\bBATTING\b/gi, '') // Remove BATTING
            .replace(/\bRPA\b/gi, '') // Remove RPA
            .replace(/\bPATCH\b/gi, '') // Remove PATCH
            .replace(/\bDUAL\b/gi, '') // Remove DUAL
            .replace(/\bSWATCH\b/gi, '') // Remove SWATCH
            .replace(/\bEDITION\b/gi, '') // Remove EDITION (but keep 1st Edition)
            .replace(/\bDEBUT\b/gi, '') // Remove DEBUT
            
            // Preserve important terms that should not be removed
            .replace(/1ST\s+EDITION/gi, '1ST_EDITION') // Temporarily protect 1st Edition
            
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
            .replace(/\b(RED\s*WINGS|BLACKHAWKS|BRUINS|RANGERS|MAPLE\s*LEAFS|CANADIENS|SENATORS|SABRES|PANTHERS|LIGHTNING|CAPITALS|FLYERS|DEVILS|ISLANDERS|PENGUINS|BLUE\s*JACKETS|HURRICANES|PREDATORS|BLUES|WILD|AVALANCHE|STARS|OILERS|FLAMES|CANUCKS|SHARKS|DUCKS|GOLDEN\s*KNIGHTS|KINGS|COYOTES|JETS|KRAKEN)\b/gi, '') // Remove NHL team names
            .replace(/\b(CHICAGO|BOSTON|NEW\s*YORK|LOS\s*ANGELES|MIAMI|DALLAS|HOUSTON|PHOENIX|DENVER|PORTLAND|SACRAMENTO|MINNEAPOLIS|OKLAHOMA\s*CITY|SALT\s*LAKE\s*CITY|MEMPHIS|NEW\s*ORLEANS|SAN\s*ANTONIO|ORLANDO|ATLANTA|CHARLOTTE|WASHINGTON|DETROIT|CLEVELAND|INDIANAPOLIS|MILWAUKEE|PHILADELPHIA|BROOKLYN|TORONTO)\b/gi, '') // Remove city names
            
            // Remove periods (but keep hyphens, #, and /)
            .replace(/\./g, '')
            
            // Remove special characters and emojis (but keep hyphens, #, and /)
            .replace(/[^\w\s\-#\/]/g, '')
            
            // Remove standalone hyphens but preserve year ranges (like 1994-95) and card numbers (like #TRC-BYG)
            .replace(/(?<!\d)(?<!#\w*)\s*-\s*(?!\d)/g, ' ') // Replace " - " with space, but not between numbers or after #
            .replace(/^\s*-\s*/, '') // Remove leading hyphen
            .replace(/\s*-\s*$/, '') // Remove trailing hyphen
            
            // Normalize spaces
            .replace(/\s+/g, ' ')
            
            // Restore protected terms
            .replace(/1ST_EDITION/gi, '1st Edition')
            
            .trim();
        
        // Check if the cleaned title has "auto" - if not but original had autograph indicators, add it
        if (hasAutographIndicator && !cleanedTitle.toLowerCase().includes('auto')) {
            // Find a good place to insert "auto" - typically after the set name or before the card number
            const words = cleanedTitle.split(' ');
            let insertIndex = words.length; // Default to end
            
            // Look for card number patterns to insert before them
            for (let i = 0; i < words.length; i++) {
                if (words[i].startsWith('#') || /^\d+$/.test(words[i])) {
                    insertIndex = i;
                    break;
                }
            }
            
            // Insert "auto" at the determined position
            words.splice(insertIndex, 0, 'auto');
            cleanedTitle = words.join(' ');
        }
        
        return cleanedTitle;
    }

    async addCard(cardData) {
        try {
            // Ensure database is connected
            if (!this.pricingDb) {
                await this.connect();
            }
            
            // Validate required data
            if (!cardData.title || cardData.title.trim() === '') {
                throw new Error('Card title is required');
            }
            
            // Truncate title if too long (SQLite TEXT limit is ~1GB, but let's be reasonable)
            const title = cardData.title.length > 1000 ? cardData.title.substring(0, 1000) : cardData.title;
            
            // Initialize title generator if not already done
            await this.initializeTitleGenerator();
            
            // Extract player name using the improved logic
            let playerName = null;
            try {
                playerName = this.titleGenerator.extractPlayer(cardData.title);
                console.log(`🎯 Extracted player name: "${playerName}" from "${cardData.title}"`);
            } catch (playerError) {
                console.warn(`⚠️ Player name extraction failed: ${playerError.message}`);
            }
            
            // Extract year from title - try multiple patterns
            let year = null;
            
            // Try to extract year from title
            const yearMatch = cardData.title.match(/(19|20)\d{2}/);
            if (yearMatch) {
                year = parseInt(yearMatch[0]);
            }
            
            // If no year found, try to extract from search term or use a default
            if (!year && cardData.searchTerm) {
                const searchYearMatch = cardData.searchTerm.match(/(19|20)\d{2}/);
                if (searchYearMatch) {
                    year = parseInt(searchYearMatch[0]);
                }
            }
            
            // If still no year, use current year as fallback for modern cards
            if (!year) {
                year = new Date().getFullYear();
                console.log(`⚠️ No year found in title "${cardData.title}", using current year ${year} as fallback`);
            }
            
            // Extract component fields using improved logic
            const cardSet = this.extractCardSet(cardData.title);
            const cardType = this.extractCardType(cardData.title);
            const cardNumber = this.extractCardNumber(cardData.title);
            
            // Extract print run (typically looks like /##)
            let printRun = null;
            const printRunMatch = cardData.title.match(/\/(\d+)/);
            if (printRunMatch) {
                printRun = '/' + printRunMatch[1];
            }
            
            // Build summary title from components
            let summaryTitle = '';
            
            // Check if it's an autograph card
            const isAuto = cardData.title.toLowerCase().includes('auto');
            
            // Start with year
            if (year) {
                summaryTitle += year;
            }
            
            // Add card set
            if (cardSet) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += cardSet;
            }
            
            // Add player name (but not if it's already in the card set)
            if (playerName && cardSet && !cardSet.toLowerCase().includes(playerName.toLowerCase())) {
                if (summaryTitle) summaryTitle += ' ';
                // Filter out team names from player name
                const cleanPlayerName = this.filterTeamNamesFromPlayer(playerName);
                summaryTitle += this.capitalizePlayerName(cleanPlayerName);
            } else if (playerName && !cardSet) {
                if (summaryTitle) summaryTitle += ' ';
                // Filter out team names from player name
                const cleanPlayerName = this.filterTeamNamesFromPlayer(playerName);
                summaryTitle += this.capitalizePlayerName(cleanPlayerName);
            }
            
            // Add card type (colors, parallels, etc.) - but exclude "Base"
            if (cardType && cardType.toLowerCase() !== 'base') {
                if (summaryTitle) summaryTitle += ' ';
                // Properly capitalize card type (e.g., "REFRACTOR" -> "Refractor")
                const capitalizedCardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
                summaryTitle += capitalizedCardType;
            }
            
            // Add "auto" after card type if it's an autograph
            if (isAuto) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += 'auto';
            }
            
            // Add card number
            if (cardNumber) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += cardNumber;
            }
            
            // Add print run
            if (printRun) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += printRun;
            }
            
            // Clean up any commas from the summary title
            summaryTitle = summaryTitle.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Fallback to old method if no components were extracted
            if (!summaryTitle.trim()) {
                try {
                    summaryTitle = this.titleGenerator.generateStandardizedTitle(cardData.title, playerName);
                    console.log(`🎯 Generated standardized title (fallback): "${cardData.title}" → "${summaryTitle}"`);
                } catch (titleError) {
                    console.warn(`⚠️ Standardized title generation failed, falling back to simple cleaning: ${titleError.message}`);
                    summaryTitle = this.cleanSummaryTitle(cardData.title);
                }
            } else {
                console.log(`🎯 Generated component-based title: "${cardData.title}" → "${summaryTitle.trim()}"`);
            }
            
            // Detect sport using comprehensive database
            let sport = await this.detectSportFromComprehensive(cardData.title);
            
            // If sport detection fails, try using the title generator's player extraction
            if (!sport || sport === 'Unknown') {
                try {
                    const playerName = this.titleGenerator.extractPlayer(cardData.title);
                    if (playerName) {
                        console.log(`🎯 Using title generator player extraction for sport detection: "${playerName}"`);
                        // Try ESPN API with the extracted player name
                        const espnSport = await this.espnDetector.detectSportFromPlayer(playerName);
                        if (espnSport && espnSport !== 'Unknown') {
                            sport = espnSport;
                            console.log(`✅ ESPN API detected sport for ${playerName}: ${sport}`);
                        }
                    }
                } catch (playerError) {
                    console.log(`⚠️ Title generator player extraction failed: ${playerError.message}`);
                }
            }
            
            // Ensure sport is not null or empty
            if (!sport || sport.trim() === '') {
                sport = 'Unknown';
                console.log(`⚠️ Sport detection failed for "${cardData.title}", using "Unknown"`);
            }
            
            // Extract brand and set info
            const brandInfo = this.extractBrandAndSet(cardData.title);
            
            // Ensure brand and set are not null
            const brand = brandInfo.brand || 'Unknown';
            const setName = brandInfo.setName || 'Unknown';
            
            // Validate data before insertion to prevent constraint violations
            if (!title || title.trim() === '') {
                throw new Error('Title cannot be empty');
            }
            
            if (!summaryTitle || summaryTitle.trim() === '') {
                summaryTitle = title; // Fallback to original title
            }
            
            // Ensure year is a valid integer
            if (year && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
                console.warn(`⚠️ Invalid year ${year} for card "${title}", using current year`);
                year = new Date().getFullYear();
            }
            
            const query = `
                INSERT INTO cards (
                    title, summary_title, sport, year, brand, set_name, 
                    card_type, condition, grade, psa10_price, psa10_average_price, multiplier, search_term, 
                    source, ebay_item_id, image_url, player_name, card_set, card_number, print_run
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            // Ensure all parameters are properly formatted
            const params = [
                title, // Use truncated title
                summaryTitle,
                sport || 'Unknown',
                year || null,
                brand || 'Unknown',
                setName || 'Unknown',
                cardType || 'Base', // Use extracted cardType instead of detectCardType
                'Raw',
                'PSA 10',
                cardData.price?.value || cardData.price || null,
                null, // psa10_average_price will be calculated later
                null, // multiplier will be calculated when raw prices are added
                cardData.searchTerm || 'auto_search',
                cardData.source || '130point_auto',
                cardData.ebayItemId || null,
                cardData.imageUrl || null,
                playerName || null, // Add the extracted player name
                cardSet || null, // Add the extracted card set
                cardNumber || null, // Add the extracted card number
                printRun || null // Add the extracted print run
            ];
            
            const result = await this.runQuery(query, params);
            return result.lastID;
            
        } catch (error) {
            console.error('❌ Error adding card:', error);
            throw error;
        }
    }

    extractBrandAndSet(title) {
        const titleLower = title.toLowerCase();
        
        // Topps brands
        if (titleLower.includes('topps chrome')) return { brand: 'Topps', setName: 'Chrome' };
        if (titleLower.includes('topps heritage')) return { brand: 'Topps', setName: 'Heritage' };
        if (titleLower.includes('topps stadium club')) return { brand: 'Topps', setName: 'Stadium Club' };
        if (titleLower.includes('topps allen & ginter')) return { brand: 'Topps', setName: 'Allen & Ginter' };
        if (titleLower.includes('topps gypsy queen')) return { brand: 'Topps', setName: 'Gypsy Queen' };
        if (titleLower.includes('topps finest')) return { brand: 'Topps', setName: 'Finest' };
        if (titleLower.includes('topps fire')) return { brand: 'Topps', setName: 'Fire' };
        if (titleLower.includes('topps opening day')) return { brand: 'Topps', setName: 'Opening Day' };
        if (titleLower.includes('topps big league')) return { brand: 'Topps', setName: 'Big League' };
        if (titleLower.includes('topps')) return { brand: 'Topps', setName: 'Base' };
        
        // Panini brands
        if (titleLower.includes('panini prizm wnba')) return { brand: 'Panini', setName: 'Prizm WNBA' };
        if (titleLower.includes('panini instant wnba')) return { brand: 'Panini', setName: 'Instant WNBA' };
        if (titleLower.includes('prizm monopoly wnba')) return { brand: 'Panini', setName: 'Prizm Monopoly WNBA' };
        if (titleLower.includes('panini prizm')) return { brand: 'Panini', setName: 'Prizm' };
        if (titleLower.includes('panini select')) return { brand: 'Panini', setName: 'Select' };
        if (titleLower.includes('panini mosaic')) return { brand: 'Panini', setName: 'Mosaic' };
        if (titleLower.includes('panini optic')) return { brand: 'Panini', setName: 'Optic' };
        if (titleLower.includes('panini immaculate')) return { brand: 'Panini', setName: 'Immaculate' };
        if (titleLower.includes('panini national treasures')) return { brand: 'Panini', setName: 'National Treasures' };
        if (titleLower.includes('panini flawless')) return { brand: 'Panini', setName: 'Flawless' };
        if (titleLower.includes('panini obsidian')) return { brand: 'Panini', setName: 'Obsidian' };
        if (titleLower.includes('panini')) return { brand: 'Panini', setName: 'Base' };
        
        // Donruss
        if (titleLower.includes('donruss optic')) return { brand: 'Donruss', setName: 'Optic' };
        if (titleLower.includes('donruss')) return { brand: 'Donruss', setName: 'Base' };
        
        // Bowman
        if (titleLower.includes('bowman chrome')) return { brand: 'Bowman', setName: 'Chrome' };
        if (titleLower.includes('bowman')) return { brand: 'Bowman', setName: 'Base' };
        
        return { brand: 'Unknown', setName: 'Unknown' };
    }

    detectCardType(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('rookie') || titleLower.includes('rc')) return 'Rookie';
        if (titleLower.includes('auto') || titleLower.includes('autograph')) return 'Autograph';
        if (titleLower.includes('jersey') || titleLower.includes('patch')) return 'Relic';
        if (titleLower.includes('refractor')) return 'Refractor';
        if (titleLower.includes('parallel')) return 'Parallel';
        
        return 'Base';
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
        
        console.log(`🔍 Processing words from title: "${title}"`);
        console.log(`🔍 Words to process: [${words.join(', ')}]`);
        
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
                console.log(`🔍 Filtered out card term: "${word}" (known card term)`);
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
                    
                    const results = await this.getComprehensiveQuery(query, [
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
                            console.log(`🔍 Filtered out card term: "${word}" (found card-related entries in database)`);
                            continue;
                        } else {
                            console.log(`🔍 Keeping "${word}" (appears to be a player name, not a card term)`);
                        }
                    }
                } catch (error) {
                    // If database query fails, keep the word (safer to include than exclude)
                    console.log(`⚠️ Database query failed for word "${word}": ${error.message}`);
                }
            }
            
            // Also filter out common team names
            const teamNames = ['cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'vikings', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'athletics', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls'];
            
            if (teamNames.includes(word.toLowerCase())) {
                console.log(`🔍 Filtered out team name: "${word}"`);
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
                console.log(`✅ Extracted player name: "${potentialName}" from filtered words: [${filteredWords.join(', ')}]`);
                return potentialName;
            }
        }
        
        console.log(`❌ No valid player name found. Filtered words: [${filteredWords.join(', ')}]`);
        return null;
    }

    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.pricingDb.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.pricingDb.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async allQuery(sql, params = []) {
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

    // Query methods for comprehensive database
    async runComprehensiveQuery(sql, params = []) {
        if (!this.comprehensiveDb) {
            throw new Error('Comprehensive database not connected');
        }
        
        return new Promise((resolve, reject) => {
            this.comprehensiveDb.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getComprehensiveQuery(sql, params = []) {
        if (!this.comprehensiveDb) {
            throw new Error('Comprehensive database not connected');
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

    async allComprehensiveQuery(sql, params = []) {
        if (!this.comprehensiveDb) {
            throw new Error('Comprehensive database not connected');
        }
        
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

    async getDatabaseStats() {
        const stats = await this.getQuery('SELECT COUNT(*) as total FROM cards');
        const withPrices = await this.getQuery(`
            SELECT COUNT(*) as count FROM cards 
            WHERE raw_average_price IS NOT NULL OR psa9_average_price IS NOT NULL OR psa10_price IS NOT NULL
        `);
        
        return {
            total: stats.total,
            withPrices: withPrices.count,
            missingPrices: stats.total - withPrices.count
        };
    }

    // Enhanced component extraction methods
    extractCardSet(title) {
        const titleLower = title.toLowerCase();
        
        // Filter out team names first
        const teamNames = ['a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls'];
        
        // Remove team names from title for card set extraction
        let cleanTitle = titleLower;
        teamNames.forEach(team => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${team}\\b`, 'g'), '');
        });
        
        // Fix specific missing card sets
        if (cleanTitle.includes('obsidian') && !cleanTitle.includes('panini obsidian')) {
            return 'Panini Obsidian';
        }
        if (cleanTitle.includes('synergy') && !cleanTitle.includes('upper deck synergy')) {
            return 'Upper Deck Synergy';
        }
        if (cleanTitle.includes('slania stamps') || cleanTitle.includes('slania')) {
            return 'Slania Stamps';
        }
        if (cleanTitle.includes('panini prizm dp') || cleanTitle.includes('prizm dp')) {
            return 'Panini Prizm DP';
        }
        if (cleanTitle.includes('panini prizm')) {
            return 'Panini Prizm';
        }
        if (cleanTitle.includes('prizm') && !cleanTitle.includes('panini prizm')) {
            return 'Panini Prizm';
        }
        if (cleanTitle.includes('panini select')) {
            return 'Panini Select';
        }
        if (cleanTitle.includes('select') && !cleanTitle.includes('panini select')) {
            return 'Panini Select';
        }
        if (cleanTitle.includes('panini mosaic')) {
            return 'Panini Mosaic';
        }
        if (cleanTitle.includes('mosaic') && !cleanTitle.includes('panini mosaic')) {
            return 'Panini Mosaic';
        }
        if (cleanTitle.includes('panini donruss')) {
            return 'Panini Donruss';
        }
        if (cleanTitle.includes('donruss') && !cleanTitle.includes('panini donruss')) {
            return 'Panini Donruss';
        }
        if (cleanTitle.includes('panini donruss optic')) {
            return 'Panini Donruss Optic';
        }
        if (cleanTitle.includes('optic') && !cleanTitle.includes('panini donruss optic')) {
            return 'Panini Donruss Optic';
        }
        if (cleanTitle.includes('topps bowman')) {
            return 'Bowman';
        }
        if (cleanTitle.includes('bowman') && !cleanTitle.includes('topps bowman')) {
            return 'Bowman';
        }
        if (cleanTitle.includes('topps chrome')) {
            return 'Topps Chrome';
        }
        if (cleanTitle.includes('chrome') && !cleanTitle.includes('topps chrome')) {
            return 'Topps Chrome';
        }
        if (cleanTitle.includes('topps finest')) {
            return 'Topps Finest';
        }
        if (cleanTitle.includes('finest') && !cleanTitle.includes('topps finest')) {
            return 'Topps Finest';
        }
        if (cleanTitle.includes('topps heritage')) {
            return 'Topps Heritage';
        }
        if (cleanTitle.includes('heritage') && !cleanTitle.includes('topps heritage')) {
            return 'Topps Heritage';
        }
        
        return null;
    }

    extractCardType(title) {
        const titleLower = title.toLowerCase();
        
                                     // Filter out terms that shouldn't be card types
                             const filteredTitle = titleLower
                                 .replace(/\brookie\b/g, '') // Remove "rookie" from card type detection
                                 .replace(/\brc\b/g, '') // Remove "rc" from card type detection
                                 .replace(/\bauto\b/g, '') // Remove "auto" from card type detection
                                 .replace(/\bautograph\b/g, '') // Remove "autograph" from card type detection
                                 .replace(/\bgraded\b/g, '') // Remove "graded" from card type detection
                                 .replace(/\bungraded\b/g, '') // Remove "ungraded" from card type detection
                                 .replace(/\bpop\b/g, '') // Remove "pop" from card type detection
                                 .replace(/\bpopulation\b/g, ''); // Remove "population" from card type detection
        
        // Enhanced color/parallel patterns
        const colorPatterns = [
            // Basic colors (including those with slashes)
            { pattern: /(?:^|\s|\/)(red|blue|green|yellow|orange|purple|pink|gold|silver|bronze|black|white)(?:\s|$|\/)/gi, name: 'Color' },
            // Refractors
            { pattern: /\b(refractor|refractors)\b/gi, name: 'Refractor' },
            // Prizm variants
            { pattern: /\b(prizm|prizmatic)\b/gi, name: 'Prizm' },
            // Holo variants
            { pattern: /\b(holo|holographic)\b/gi, name: 'Holo' },
            // Chrome variants
            { pattern: /\b(chrome)\b/gi, name: 'Chrome' },
            // X-Fractor
            { pattern: /\b(x-fractor|x-fractors)\b/gi, name: 'X-Fractor' },
            // Cracked Ice
            { pattern: /\b(cracked ice)\b/gi, name: 'Cracked Ice' },
            // Stained Glass
            { pattern: /\b(stained glass)\b/gi, name: 'Stained Glass' },
            // World Champion Boxers
            { pattern: /\b(world champion boxers)\b/gi, name: 'World Champion Boxers' },
            // Fast Break
            { pattern: /\b(fast break)\b/gi, name: 'Fast Break' },
            // Genesis
            { pattern: /\b(genesis)\b/gi, name: 'Genesis' },
            // Premier Level
            { pattern: /\b(premier level)\b/gi, name: 'Premier Level' },
            // Premier
            { pattern: /\b(premier)\b/gi, name: 'Premier' },
            // Level
            { pattern: /\b(level)\b/gi, name: 'Level' },
            // Club
            { pattern: /\b(club)\b/gi, name: 'Club' },
            // Flashback
            { pattern: /\b(flashback)\b/gi, name: 'Flashback' },
            // Emergent
            { pattern: /\b(emergent)\b/gi, name: 'Emergent' },
            // Real One
            { pattern: /\b(real one)\b/gi, name: 'Real One' },
            // RPA
            { pattern: /\b(rpa)\b/gi, name: 'RPA' },
            // Mania
            { pattern: /\b(mania)\b/gi, name: 'Mania' },
            // WWE variants
            { pattern: /\b(wwe)\b/gi, name: 'WWE' },
            // Geometric
            { pattern: /\b(geometric)\b/gi, name: 'Geometric' },
            // Honeycomb
            { pattern: /\b(honeycomb)\b/gi, name: 'Honeycomb' },
            // Pride
            { pattern: /\b(pride)\b/gi, name: 'Pride' },
            // Kaleidoscopic
            { pattern: /\b(kaleidoscopic)\b/gi, name: 'Kaleidoscopic' },
            // Scale variants
            { pattern: /\b(dragon scale)\b/gi, name: 'Dragon Scale' },
            // Vintage
            { pattern: /\b(vintage)\b/gi, name: 'Vintage' },
            // Stars
            { pattern: /\b(stars)\b/gi, name: 'Stars' },
            // Independence Day
            { pattern: /\b(independence day)\b/gi, name: 'Independence Day' },
            // Father's Day
            { pattern: /\b(father's day)\b/gi, name: 'Father\'s Day' },
            // Mother's Day
            { pattern: /\b(mother's day)\b/gi, name: 'Mother\'s Day' },
            // Memorial Day
            { pattern: /\b(memorial day)\b/gi, name: 'Memorial Day' },
            // Camo
            { pattern: /\b(camo)\b/gi, name: 'Camo' },
            // Vinyl
            { pattern: /\b(vinyl)\b/gi, name: 'Vinyl' },
            // Premium Set
            { pattern: /\b(premium set)\b/gi, name: 'Premium Set' },
            // Checkerboard
            { pattern: /\b(checkerboard)\b/gi, name: 'Checkerboard' },
            // Die-cut (match both forms but treat as single type)
            { pattern: /\b(die-cut|die cut)\b/gi, name: 'Die-Cut' },
            // National Landmarks
            { pattern: /\b(national landmarks)\b/gi, name: 'National Landmarks' },
            // Lava Lamp
            { pattern: /\b(lava lamp)\b/gi, name: 'Lava Lamp' },
            // Dazzle
            { pattern: /\b(dazzle)\b/gi, name: 'Dazzle' },
            // Velocity
            { pattern: /\b(velocity)\b/gi, name: 'Velocity' },
            // Hyper
            { pattern: /\b(hyper)\b/gi, name: 'Hyper' },
            // Dragon
            { pattern: /\b(dragon)\b/gi, name: 'Dragon' },
            // Laser
            { pattern: /\b(laser)\b/gi, name: 'Laser' },
            // Liberty
            { pattern: /\b(liberty)\b/gi, name: 'Liberty' },
            // Marvels
            { pattern: /\b(marvels)\b/gi, name: 'Marvels' },
            // Fire
            { pattern: /\b(fire)\b/gi, name: 'Fire' },
            // Voltage
            { pattern: /\b(voltage)\b/gi, name: 'Voltage' },
            // Career Stat Line
            { pattern: /\b(career stat line)\b/gi, name: 'Career Stat Line' },
                                             // Downtown
                                 { pattern: /\b(downtown)\b/gi, name: 'Downtown' },
                                 // Base (for base cards)
                                 { pattern: /\b(base)\b/gi, name: 'Base' }
                             ];

        // Find all matches and build card type
        const foundTypes = [];
        for (const { pattern, name } of colorPatterns) {
            const matches = filteredTitle.match(pattern);
            if (matches) {
                // Use the standardized name instead of the actual matches to avoid duplicates
                foundTypes.push(name);
            }
        }

        // Remove duplicates and format
        const uniqueTypes = [...new Set(foundTypes)];
        const cardType = uniqueTypes.join(' ').trim();

        return cardType || null;
    }

    extractCardNumber(title) {
        // Look for card number patterns in the title
        const cardNumberPatterns = [
            // Standard card numbers like #123
            /#(\d+)/g,
            // Card numbers with letters like #BDC-168, #CDA-LK
            /#([A-Za-z]+[-\dA-Za-z]+)/g,
            // Card numbers with letters like #17hh
            /#(\d+[A-Za-z]+)/g,
            // Bowman Draft card numbers (BDP, BDC, CDA, etc.)
            /\b(BD[A-Z]?\d+)\b/g,
            // Card numbers with letters followed by numbers (like DT36, DT1, etc.)
            /\b([A-Z]{2,}\d+)\b/g,
            // Card numbers without # symbol
            /\b(\d{1,3})\b/g
        ];

        for (const pattern of cardNumberPatterns) {
            const matches = title.match(pattern);
            if (matches) {
                // Filter out PSA grades and print runs
                for (const match of matches) {
                    const matchLower = match.toLowerCase();
                    if (!matchLower.includes('psa') && 
                        !matchLower.includes('pop') && 
                        !matchLower.includes('gem') && 
                        !matchLower.includes('mint') &&
                        !title.includes('/' + match)) {
                        return match.startsWith('#') ? match : '#' + match;
                    }
                }
            }
        }

        return null;
    }

    // Filter out team names from player name
    filterTeamNamesFromPlayer(playerName) {
        if (!playerName) return null;
        
        // List of team names to filter out
        const teamNames = [
            'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls'
        ];
        
        let cleanName = playerName;
        
        // Remove team names from player name
        teamNames.forEach(team => {
            const regex = new RegExp(`\\b${team}\\b`, 'gi');
            cleanName = cleanName.replace(regex, '');
        });
        
        // Clean up extra spaces
        cleanName = cleanName.replace(/\s+/g, ' ').trim();
        
        return cleanName;
    }

    // Capitalize player name properly (e.g., "JOSH KURODA GRAUER" -> "Josh Kuroda-Grauer")
    capitalizePlayerName(playerName) {
        if (!playerName) return null;
        
        // Convert to lowercase first
        const lowerName = playerName.toLowerCase();
        
        // Handle special cases for hyphens and apostrophes
        const words = lowerName.split(/[\s\-']/);
        const capitalizedWords = words.map(word => {
            if (word.length === 0) return word;
            
            // Handle special cases
            if (word === 'jr' || word === 'sr') return word.toUpperCase();
            if (word === 'ii' || word === 'iii' || word === 'iv') return word.toUpperCase();
            
            // Capitalize first letter
            return word.charAt(0).toUpperCase() + word.slice(1);
        });
        
        // Reconstruct with proper separators
        let result = capitalizedWords.join(' ');
        
        // Restore hyphens and apostrophes
        const originalName = playerName;
        const hyphenPositions = [];
        const apostrophePositions = [];
        
        // Find positions of hyphens and apostrophes in original name
        for (let i = 0; i < originalName.length; i++) {
            if (originalName[i] === '-') hyphenPositions.push(i);
            if (originalName[i] === "'") apostrophePositions.push(i);
        }
        
        // Restore hyphens
        for (const pos of hyphenPositions) {
            const beforeHyphen = originalName.substring(0, pos).trim();
            const afterHyphen = originalName.substring(pos + 1).trim();
            
            // Find the corresponding words in our result
            const resultWords = result.split(' ');
            const beforeWords = beforeHyphen.split(/[\s\-']/);
            const afterWords = afterHyphen.split(/[\s\-']/);
            
            // Find where to insert the hyphen
            let beforeIndex = -1;
            let afterIndex = -1;
            
            for (let i = 0; i < resultWords.length; i++) {
                if (beforeWords.includes(resultWords[i].toLowerCase())) {
                    beforeIndex = i;
                }
                if (afterWords.includes(resultWords[i].toLowerCase())) {
                    afterIndex = i;
                }
            }
            
            if (beforeIndex !== -1 && afterIndex !== -1 && afterIndex === beforeIndex + 1) {
                resultWords[beforeIndex] = resultWords[beforeIndex] + '-' + resultWords[afterIndex];
                resultWords.splice(afterIndex, 1);
                result = resultWords.join(' ');
            }
        }
        
        // Restore apostrophes
        for (const pos of apostrophePositions) {
            const beforeApostrophe = originalName.substring(0, pos).trim();
            const afterApostrophe = originalName.substring(pos + 1).trim();
            
            // Find the corresponding words in our result
            const resultWords = result.split(' ');
            const beforeWords = beforeApostrophe.split(/[\s\-']/);
            const afterWords = afterApostrophe.split(/[\s\-']/);
            
            // Find where to insert the apostrophe
            let beforeIndex = -1;
            let afterIndex = -1;
            
            for (let i = 0; i < resultWords.length; i++) {
                if (beforeWords.includes(resultWords[i].toLowerCase())) {
                    beforeIndex = i;
                }
                if (afterWords.includes(resultWords[i].toLowerCase())) {
                    afterIndex = i;
                }
            }
            
            if (beforeIndex !== -1 && afterIndex !== -1 && afterIndex === beforeIndex + 1) {
                resultWords[beforeIndex] = resultWords[beforeIndex] + "'" + resultWords[afterIndex];
                resultWords.splice(afterIndex, 1);
                result = resultWords.join(' ');
            }
        }
        
        return result;
    }

    async close() {
        if (this.pricingDb) {
            this.pricingDb.close();
            console.log('✅ New pricing database connection closed');
        }
        if (this.comprehensiveDb) {
            this.comprehensiveDb.close();
            console.log('✅ Comprehensive database connection closed');
        }
        if (this.titleGenerator && this.titleGenerator.db) {
            this.titleGenerator.db.close();
            console.log('✅ Title generator database connection closed');
        }
    }
}

// Main execution
async function main() {
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        await db.createTables();
        
        const stats = await db.getDatabaseStats();
        console.log('\n📊 New Pricing Database Created Successfully!');
        console.log('==============================================');
        console.log(`Total cards: ${stats.total}`);
        console.log(`With prices: ${stats.withPrices}`);
        console.log(`Missing prices: ${stats.missingPrices}`);
        console.log('\n✅ Ready to start fresh with keyword-based sport detection!');
        
    } catch (error) {
        console.error('❌ Error creating new pricing database:', error);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = NewPricingDatabase;
