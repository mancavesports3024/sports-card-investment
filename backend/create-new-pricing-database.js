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

    /**
     * Improve card title using CardBase API
     * @param {string} searchQuery - Search query for CardBase
     * @param {string} originalTitle - Original title for safety comparison (optional)
     * @returns {Object} Improved card information
     */
    async improveCardTitleWithCardBase(searchQuery, originalTitle = null) {
        try {
            const { CardBaseService } = require('./services/cardbaseService.js');
            const cardbaseService = new CardBaseService();
            
            console.log(`🔍 Improving title with CardBase: "${searchQuery}"`);
            
            const result = await cardbaseService.searchCard(searchQuery);
            const cardInfo = cardbaseService.extractCardInfo(result);
            
            // Use originalTitle for safety check if provided, otherwise use searchQuery
            const titleForComparison = originalTitle || searchQuery;
            const improvedTitle = cardbaseService.generateImprovedTitle(cardInfo, titleForComparison);
            
            return {
                originalTitle: titleForComparison,
                improvedTitle: improvedTitle,
                cardbaseInfo: cardInfo,
                success: !!cardInfo
            };
            
        } catch (error) {
            console.error('❌ Error improving title with CardBase:', error.message);
            return {
                originalTitle: originalTitle || searchQuery,
                improvedTitle: originalTitle || searchQuery, // Fallback to original
                cardbaseInfo: null,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get cards that might need title improvement
     * @param {number} limit - Number of cards to get
     * @param {number} offset - Offset for pagination
     * @returns {Array} Cards that might need improvement
     */
    async getCardsForTitleImprovement(limit = 10, offset = 0) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summary_title 
                FROM cards 
                WHERE summary_title IS NULL OR summary_title = '' OR summary_title = title
                   OR summary_title LIKE '%PSA%' OR summary_title LIKE '%GEM%' OR summary_title LIKE '%MINT%'
                   OR summary_title LIKE '%RC%' OR summary_title LIKE '%Rookie%'
                   OR summary_title LIKE '%Duke%' OR summary_title LIKE '%Mavericks%'
                   OR summary_title LIKE '%Liverpool%' OR summary_title LIKE '%FC%'
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            this.pricingDb.all(query, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Update a card's title
     * @param {number} cardId - Card ID
     * @param {string} newTitle - New title
     */
    async updateCardTitle(cardId, newTitle) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cards 
                SET summary_title = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            this.pricingDb.run(query, [newTitle, cardId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✅ Updated card ${cardId} with new title: "${newTitle}"`);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Find a card by its original title
     * @param {string} title - The original title to search for
     * @returns {Object|null} Card object or null if not found
     */
    async findCardByTitle(title) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summary_title 
                FROM cards 
                WHERE title = ? OR title LIKE ?
                LIMIT 1
            `;
            
            this.pricingDb.get(query, [title, `%${title}%`], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Get cards with specific issues in summary titles
     * @param {number} limit - Number of cards to get
     * @param {number} offset - Offset for pagination
     * @returns {Array} Cards with issues
     */
    async getCardsWithTitleIssues(limit = 10, offset = 0) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summary_title 
                FROM cards 
                WHERE summary_title LIKE '%PSA%' 
                   OR summary_title LIKE '%GEM%' 
                   OR summary_title LIKE '%MINT%'
                   OR summary_title LIKE '%RC%' 
                   OR summary_title LIKE '%Rookie%'
                   OR summary_title LIKE '%Duke%' 
                   OR summary_title LIKE '%Mavericks%'
                   OR summary_title LIKE '%Liverpool%' 
                   OR summary_title LIKE '%FC%'
                   OR summary_title LIKE '%🔥%'
                   OR summary_title LIKE '%💎%'
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            this.pricingDb.all(query, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get a card by ID with all fields
     * @param {number} cardId - Card ID
     * @returns {Object} Card data
     */
    async getCardById(cardId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, title, summary_title, year, card_set, card_type, 
                       player_name, card_number, print_run, is_rookie, is_autograph,
                       sport, condition, grade, created_at, last_updated AS updated_at
                FROM cards 
                WHERE id = ?
            `;
            
            this.pricingDb.get(query, [cardId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Update card fields
     * @param {number} cardId - Card ID
     * @param {Object} fields - Fields to update
     */
    async updateCardFields(cardId, fields) {
        return new Promise((resolve, reject) => {
            const updateFields = [];
            const values = [];
            
            // Build dynamic update query
            Object.keys(fields).forEach(key => {
                if (fields[key] !== undefined && fields[key] !== null) {
                    updateFields.push(`${key} = ?`);
                    values.push(fields[key]);
                }
            });
            
            if (updateFields.length === 0) {
                resolve(0);
                return;
            }
            
            updateFields.push('last_updated = ?');
            values.push(new Date().toISOString());
            values.push(cardId);
            
            const query = `UPDATE cards SET ${updateFields.join(', ')} WHERE id = ?`;
            
            this.pricingDb.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✅ Updated card ${cardId} fields: ${Object.keys(fields).join(', ')}`);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Generate summary title from card data
     * @param {Object} card - Card data
     * @returns {string} Generated summary title
     */
    async generateSummaryTitle(card) {
        const parts = [];
        
        // Add year
        if (card.year) {
            parts.push(card.year);
        }
        
        // Add card set
        if (card.card_set) {
            parts.push(card.card_set);
        }
        
        // Add card type (but skip "Base")
        if (card.card_type && card.card_type.toLowerCase() !== 'base') {
            parts.push(card.card_type);
        }
        
        // Add player name
        if (card.player_name) {
            parts.push(card.player_name);
        }
        
        // Add autograph indicator
        if (card.is_autograph) {
            parts.push('auto');
        }
        
        // Add card number
        if (card.card_number) {
            // Check if card_number already has # prefix to avoid double #
            const cardNumber = card.card_number.startsWith('#') ? card.card_number : `#${card.card_number}`;
            parts.push(cardNumber);
        }
        
        // Add print run
        if (card.print_run) {
            parts.push(card.print_run);
        }
        
        return parts.join(' ');
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
                print_run TEXT,
                is_rookie BOOLEAN DEFAULT 0,
                is_autograph BOOLEAN DEFAULT 0
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
    async detectSportFromComprehensive(title, playerName = null) {
        // First try ESPN v2 API for player-based sport detection
        try {
            // Use provided player name or extract from title
            const playerToUse = playerName || this.extractPlayerName(title);
            if (playerToUse) {
                const espnSport = await this.espnDetector.detectSportFromPlayer(playerToUse);
                if (espnSport && espnSport !== 'Unknown') {
                    console.log(`✅ ESPN v2 API detected sport for ${playerToUse}: ${espnSport}`);
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
        if (this.hasBaseballIndicators(titleLower) || titleLower.includes('bowman')) {
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
        
        // UFC/MMA detection
        if (titleLower.includes('ufc') || titleLower.includes('mma') || titleLower.includes('mixed martial arts') ||
            titleLower.includes('octagon') || titleLower.includes('fighter') || titleLower.includes('fighting') ||
            titleLower.includes('khamzat chimaev') || titleLower.includes('valentina shevchenko') || titleLower.includes('michael morales') ||
            titleLower.includes('conor mcgregor') || titleLower.includes('khabib nurmagomedov') || titleLower.includes('jon jones') ||
            titleLower.includes('amanda nunes') || titleLower.includes('rose namajunas') || titleLower.includes('weili zhang')) {
            return 'UFC';
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
            'luka doncic', 'ja morant', 'zion williamson', 'lamelo ball', 'cade cunningham',
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
            'paul skenes', 'gg jackson', 'junior caminero', 'jackson chourio', 'jordan lawlar',
            'wyatt flores', 'felnin celesten', 'luther burden', 'caitlin clark', 'sabrina ionescu',
            'stephon castle', 'cooper flagg'
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
            
            // Extract component fields using improved logic - EXTRACT CARD TYPE FIRST
            const cardSet = this.extractCardSet(cardData.title);
            const cardType = this.extractCardType(cardData.title);
            const cardNumber = this.extractCardNumber(cardData.title);
            
            // Extract player name AFTER card type to avoid card types in player names
            let playerName = null;
            try {
                // Remove card type from title before extracting player name
                let titleForPlayerExtraction = cardData.title;
                if (cardType && cardType.toLowerCase() !== 'base') {
                    // Remove the card type from the title to prevent it from being included in player name
                    const cardTypeRegex = new RegExp(`\\b${cardType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                    titleForPlayerExtraction = titleForPlayerExtraction.replace(cardTypeRegex, '');
                }
                
                // Use the improved player name extraction method
                playerName = this.extractPlayerName(titleForPlayerExtraction);
                console.log(`🎯 Extracted player name: "${playerName}" from "${titleForPlayerExtraction}" (card type "${cardType}" removed)`);
            } catch (playerError) {
                console.warn(`⚠️ Player name extraction failed: ${playerError.message}`);
            }
            
            // Extract rookie and autograph attributes
            const isRookie = this.isRookieCard(cardData.title);
            const isAutograph = this.isAutographCard(cardData.title);
            
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
            
            // Add card set (cleaned of sport names)
            if (cardSet) {
                if (summaryTitle) summaryTitle += ' ';
                const cleanedCardSet = this.cleanSportNamesFromCardSet(cardSet);
                summaryTitle += cleanedCardSet;
            }
            
            // Add card type (colors, parallels, etc.) - but exclude "Base" (comes BEFORE player)
            const normalizedCardType = cardType ? this.normalizeCardType(cardType, cardSet) : null;
            if (normalizedCardType && normalizedCardType.toLowerCase() !== 'base') {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += normalizedCardType;
            }

            // Add player name (but not if it's already in the card set)
            if (playerName && cardSet && !cardSet.toLowerCase().includes(playerName.toLowerCase())) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += this.capitalizePlayerName(playerName);
            } else if (playerName && !cardSet) {
                if (summaryTitle) summaryTitle += ' ';
                summaryTitle += this.capitalizePlayerName(playerName);
            }
            
            // Add "auto" if it's an autograph
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
        
        // Remove unwanted terms from final summary title
        const unwantedTerms = [
            'psa', 'gem', 'mint', 'rc', 'rookie', 'yg', 'ssp', 'holo', 'velocity', 'notoriety',
            'mvp', 'hof', 'nfl', 'debut', 'card', 'rated', '1st', 'first', 'university',
            'rams', 'vikings', 'browns', 'chiefs', 'giants', 'ny giants', 'eagles', 'cowboys', 'falcons', 'panthers'
        ];
        
        unwantedTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            summaryTitle = summaryTitle.replace(regex, '');
        });
        
        // Clean up extra spaces again
        summaryTitle = summaryTitle.replace(/\s+/g, ' ').trim();
            
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
            
            // Detect sport using comprehensive database with already extracted player name
            let sport = await this.detectSportFromComprehensive(cardData.title, playerName);
            
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
                    source, ebay_item_id, image_url, player_name, card_set, card_number, print_run,
                    is_rookie, is_autograph
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                printRun || null, // Add the extracted print run
                isRookie ? 1 : 0, // Add rookie flag
                isAutograph ? 1 : 0 // Add autograph flag
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
        const teamNames = ['a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'giants', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs', 'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'suns', 'clippers', 'bulls', 'chiefs', 'ny giants', 'mvp', 'hof', 'nfl'];
        
        // Remove team names from title for card set extraction
        let cleanTitle = titleLower;
        teamNames.forEach(team => {
            cleanTitle = cleanTitle.replace(new RegExp(`\\b${team}\\b`, 'g'), '');
        });
        // Normalize separators like hyphens between brand and set (e.g., "Bowman - Chrome" -> "Bowman Chrome")
        cleanTitle = cleanTitle.replace(/\s*-\s*/g, ' ');
        
        // Check for specific card sets in order of specificity (most specific first)
        
        // Panini sets with full names first
        if (cleanTitle.includes('panini prizm dp') || cleanTitle.includes('prizm dp')) {
            return 'Panini Prizm DP';
        }
        if (cleanTitle.includes('panini prizm monopoly wnba') || cleanTitle.includes('prizm monopoly wnba')) {
            return 'Panini Prizm Monopoly WNBA';
        }
        if (cleanTitle.includes('panini prizm wnba')) {
            return 'Panini Prizm WNBA';
        }
        if (cleanTitle.includes('panini instant wnba')) {
            return 'Panini Instant WNBA';
        }
        if (cleanTitle.includes('panini chronicles') || cleanTitle.includes('chronicles')) {
            return 'Panini Chronicles';
        }
        if (cleanTitle.includes('panini prizm')) {
            return 'Panini Prizm';
        }
        if (cleanTitle.includes('panini select')) {
            return 'Panini Select';
        }
        if (cleanTitle.includes('panini mosaic')) {
            return 'Panini Mosaic';
        }
        if (cleanTitle.includes('panini donruss optic')) {
            return 'Panini Donruss Optic';
        }
        if (cleanTitle.includes('donruss optic preview')) {
            return 'Donruss Optic Preview';
        }
        if (cleanTitle.includes('donruss optic')) {
            return 'Donruss Optic';
        }
        if (cleanTitle.includes('panini absolute')) {
            return 'Panini Absolute';
        }
        if (cleanTitle.includes('panini zenith')) {
            return 'Panini Zenith';
        }
        if (cleanTitle.includes('panini diamond kings') || cleanTitle.includes('diamond kings')) {
            return 'Panini Diamond Kings';
        }
        if (cleanTitle.includes('panini origins')) {
            return 'Panini Origins';
        }
        if (cleanTitle.includes('panini one and one')) {
            return 'Panini One and One';
        }
        if (cleanTitle.includes('panini instant')) {
            return 'Panini Instant';
        }
        if (cleanTitle.includes('panini contenders')) {
            return 'Panini Contenders';
        }
        if (cleanTitle.includes('panini immaculate')) {
            return 'Panini Immaculate';
        }
        if (cleanTitle.includes('panini national treasures')) {
            return 'Panini National Treasures';
        }
        if (cleanTitle.includes('panini spectra')) {
            return 'Panini Spectra';
        }
        if (cleanTitle.includes('panini crown royale')) {
            return 'Panini Crown Royale';
        }
        if (cleanTitle.includes('panini limited')) {
            return 'Panini Limited';
        }
        if (cleanTitle.includes('panini threads')) {
            return 'Panini Threads';
        }
        if (cleanTitle.includes('panini certified')) {
            return 'Panini Certified';
        }
        if (cleanTitle.includes('panini triple threads')) {
            return 'Panini Triple Threads';
        }
        if (cleanTitle.includes('panini tribute')) {
            return 'Panini Tribute';
        }
        if (cleanTitle.includes('panini rookies & stars')) {
            return 'Panini Rookies & Stars';
        }
        if (cleanTitle.includes('panini elite')) {
            return 'Panini Elite';
        }
        if (cleanTitle.includes('panini prestige')) {
            return 'Panini Prestige';
        }
        
        // Topps sets with full names first (most specific first)
        if (cleanTitle.includes('topps chrome update')) {
            return 'Topps Chrome Update';
        }
        if ((cleanTitle.includes('topps stadium club') && cleanTitle.includes('chrome')) ||
            cleanTitle.includes('stadium club chrome')) {
            return 'Topps Stadium Club Chrome';
        }
        if (cleanTitle.includes('topps stadium club')) {
            return 'Topps Stadium Club';
        }
        if (cleanTitle.includes('topps gallery')) {
            return 'Topps Gallery';
        }
        if (cleanTitle.includes('topps finest')) {
            return 'Topps Finest';
        }
        if (cleanTitle.includes('finest')) {
            return 'Finest';
        }
        if ((cleanTitle.includes('topps heritage') && cleanTitle.includes('chrome')) ||
            cleanTitle.includes('heritage chrome')) {
            return 'Topps Heritage Chrome';
        }
        if (cleanTitle.includes('topps heritage')) {
            return 'Topps Heritage';
        }
        if (cleanTitle.includes('topps archives')) {
            return 'Topps Archives';
        }
        if (cleanTitle.includes('topps update')) {
            return 'Topps Update';
        }
        if (cleanTitle.includes('topps allen & ginter')) {
            return 'Topps Allen & Ginter';
        }
        if (cleanTitle.includes('topps gypsy queen')) {
            return 'Topps Gypsy Queen';
        }
        if ((cleanTitle.includes('topps cosmic') && cleanTitle.includes('chrome')) ||
            cleanTitle.includes('cosmic chrome')) {
            return 'Topps Cosmic Chrome';
        }
        if ((cleanTitle.includes('topps') && cleanTitle.includes('ufc') && cleanTitle.includes('chrome')) ||
            cleanTitle.includes('ufc chrome')) {
            return 'Topps UFC Chrome';
        }
        // UEFA Club Competitions Chrome (place before generic Topps/Chrome)
        if ((cleanTitle.includes('topps') && (cleanTitle.includes('uefa cc') || cleanTitle.includes('uefa club'))) && cleanTitle.includes('chrome')) {
            return 'Topps UEFA Club Competitions Chrome';
        }
        // Sapphire card sets (premium editions) - place before generic Topps Chrome
        if (cleanTitle.includes('topps chrome football sapphire')) {
            return 'Topps Chrome Football Sapphire';
        }
        if (cleanTitle.includes('topps chrome baseball sapphire')) {
            return 'Topps Chrome Baseball Sapphire';
        }
        if (cleanTitle.includes('topps chrome sapphire')) {
            return 'Topps Chrome Sapphire';
        }
        // Handle cases where there are other words between "chrome" and "sapphire" (like UCL)
        if (cleanTitle.includes('topps chrome') && cleanTitle.includes('sapphire')) {
            return 'Topps Chrome Sapphire';
        }
        if (cleanTitle.includes('topps chrome')) {
            return 'Topps Chrome';
        }
        // Fallback: any Topps + Chrome
        if (cleanTitle.includes('topps') && cleanTitle.includes('chrome')) {
            return 'Topps Chrome';
        }
        if (cleanTitle.includes('topps bowman')) {
            return 'Bowman';
        }
        if (cleanTitle.includes('topps now') || (cleanTitle.includes('topps') && cleanTitle.includes('now'))) {
            return 'Topps Now';
        }
        if (cleanTitle.includes('topps')) {
            return 'Topps';
        }
        
        // Upper Deck sets
        if (cleanTitle.includes('upper deck young guns')) {
            return 'Upper Deck Young Guns';
        }
        if (cleanTitle.includes('upper deck synergy')) {
            return 'Upper Deck Synergy';
        }
        if (cleanTitle.includes('upper deck')) {
            return 'Upper Deck';
        }
        
        // Other specific sets (only if not already matched by more specific patterns above)
        // Note: "Autographs" is removed from card_set - it's handled as an attribute, not a set
        if ((cleanTitle.includes('bowman chrome') && cleanTitle.includes('u 1st')) || 
            cleanTitle.includes('bowman chrome u 1st') || 
            cleanTitle.includes('bowman chrome u1st')) {
            return 'Bowman Chrome U 1st';
        }
        // Bowman Chrome U (University) base
        if (cleanTitle.includes('bowman chrome u ') ||
            cleanTitle.endsWith('bowman chrome u') ||
            (cleanTitle.includes('bowman university') && cleanTitle.includes('chrome')) ||
            cleanTitle.includes('bowman university chrome') ||
            cleanTitle.includes('bowman u chrome')) {
            return 'Bowman Chrome U';
        }
        if (cleanTitle.includes('bowman chrome draft') || (cleanTitle.includes('bowman draft') && cleanTitle.includes('chrome'))) {
            return 'Bowman Chrome Draft';
        }
        // Sapphire card sets (premium editions)
        if (cleanTitle.includes('topps chrome football sapphire')) {
            return 'Topps Chrome Football Sapphire';
        }
        if (cleanTitle.includes('topps chrome baseball sapphire')) {
            return 'Topps Chrome Baseball Sapphire';
        }
        if (cleanTitle.includes('topps chrome sapphire')) {
            return 'Topps Chrome Sapphire';
        }
        // Handle cases where there are other words between "chrome" and "sapphire" (like UCL)
        if (cleanTitle.includes('topps chrome') && cleanTitle.includes('sapphire')) {
            return 'Topps Chrome Sapphire';
        }
        if (cleanTitle.includes('bowman chrome sapphire') ||
            (cleanTitle.includes('bowman') && cleanTitle.includes('sapphire') && cleanTitle.includes('chrome'))) {
            return 'Bowman Chrome Sapphire';
        }
        if (cleanTitle.includes('sapphire edition')) {
            return 'Sapphire Edition';
        }
        if (cleanTitle.includes('sapphire') && !cleanTitle.includes('chrome')) {
            return 'Sapphire';
        }
        if (cleanTitle.includes('bowman chrome')) {
            return 'Bowman Chrome';
        }
        // Fallback: any Bowman + Chrome (avoid Sapphire-only sets)
        if (cleanTitle.includes('bowman') && cleanTitle.includes('chrome') && !cleanTitle.includes('sapphire')) {
            if (cleanTitle.includes('draft')) {
                return 'Bowman Draft Chrome';
            }
            // University case without explicit U keyword handled above
            return 'Bowman Chrome';
        }
        // UEFA Club Competitions Chrome
        if ((cleanTitle.includes('uefa cc') || cleanTitle.includes('uefa club')) && cleanTitle.includes('chrome')) {
            return 'Topps UEFA Club Competitions Chrome';
        }
        if (cleanTitle.includes('bowman draft chrome') || cleanTitle.includes('draft chrome')) {
            return 'Bowman Draft Chrome';
        }
        if (cleanTitle.includes('bowman draft')) {
            return 'Bowman Draft';
        }
        if (cleanTitle.includes('slania stamps') || cleanTitle.includes('slania')) {
            return 'Slania Stamps';
        }
        if (cleanTitle.includes('collector\'s choice') || cleanTitle.includes('collectors choice')) {
            return 'Collector\'s Choice';
        }
        if (cleanTitle.includes('kellogg')) {
            return 'Kellogg\'s';
        }
        if (cleanTitle.includes('o-pee-chee') || cleanTitle.includes('o pee chee')) {
            return 'O-Pee-Chee';
        }
        if (cleanTitle.includes('fleer metal')) {
            return 'Fleer Metal';
        }
        if (cleanTitle.includes('fleer tradition')) {
            return 'Fleer Tradition';
        }
        if (cleanTitle.includes('fleer')) {
            return 'Fleer';
        }
        if (cleanTitle.includes('skybox')) {
            return 'Skybox';
        }
        if (cleanTitle.includes('usa basketball')) {
            return 'USA Basketball';
        }
        if (cleanTitle.includes('flawless')) {
            return 'Flawless';
        }
        if (cleanTitle.includes('absolute')) {
            return 'Absolute';
        }
        if (cleanTitle.includes('spectra')) {
            return 'Spectra';
        }
        if (cleanTitle.includes('national treasures')) {
            return 'National Treasures';
        }
        if (cleanTitle.includes('zenith') && !cleanTitle.includes('panini zenith')) {
            return 'Zenith';
        }
        if (cleanTitle.includes('diamond kings') && !cleanTitle.includes('panini diamond kings')) {
            return 'Diamond Kings';
        }
        if (cleanTitle.includes('one and one') && !cleanTitle.includes('panini one and one')) {
            return 'One and One';
        }
        // Generic set names (only if not already matched by more specific patterns above)
        if (cleanTitle.includes('phoenix') && !cleanTitle.includes('panini phoenix')) {
            return 'Phoenix';
        }
        if (cleanTitle.includes('score')) {
            return 'Score';
        }
        if (cleanTitle.includes('update') && !cleanTitle.includes('topps update') && !cleanTitle.includes('chrome update')) {
            return 'Update';
        }
        if (cleanTitle.includes('chrome update') && !cleanTitle.includes('topps chrome update')) {
            return 'Chrome Update';
        }
        if (cleanTitle.includes('allen & ginter') || cleanTitle.includes('allen and ginter')) {
            return 'Allen & Ginter';
        }
        if (cleanTitle.includes('gypsy queen') && !cleanTitle.includes('topps gypsy queen')) {
            return 'Gypsy Queen';
        }
        if (cleanTitle.includes('tribute') && !cleanTitle.includes('panini tribute')) {
            return 'Tribute';
        }
        if (cleanTitle.includes('crown royale') && !cleanTitle.includes('panini crown royale')) {
            return 'Crown Royale';
        }
        if (cleanTitle.includes('limited') && !cleanTitle.includes('panini limited')) {
            return 'Limited';
        }
        if (cleanTitle.includes('threads') && !cleanTitle.includes('panini threads')) {
            return 'Threads';
        }
        if (cleanTitle.includes('certified') && !cleanTitle.includes('panini certified')) {
            return 'Certified';
        }
        if (cleanTitle.includes('triple threads') && !cleanTitle.includes('panini triple threads')) {
            return 'Triple Threads';
        }
        if (cleanTitle.includes('rookies & stars') || cleanTitle.includes('rookies and stars')) {
            return 'Rookies & Stars';
        }
        if (cleanTitle.includes('elite') && !cleanTitle.includes('panini elite')) {
            return 'Elite';
        }
        if (cleanTitle.includes('prestige') && !cleanTitle.includes('panini prestige')) {
            return 'Prestige';
        }
        if (cleanTitle.includes('young guns') && !cleanTitle.includes('upper deck young guns')) {
            return 'Young Guns';
        }
        if (cleanTitle.includes('synergy') && !cleanTitle.includes('upper deck synergy')) {
            return 'Synergy';
        }
        if (cleanTitle.includes('obsidian') && !cleanTitle.includes('panini obsidian')) {
            return 'Panini Obsidian';
        }
        if (cleanTitle.includes('select') && !cleanTitle.includes('panini select')) {
            return 'Panini Select';
        }
        if (cleanTitle.includes('mosaic') && !cleanTitle.includes('panini mosaic')) {
            return 'Panini Mosaic';
        }
        if (cleanTitle.includes('donruss') && !cleanTitle.includes('panini donruss')) {
            return 'Panini Donruss';
        }
        if (cleanTitle.includes('optic') && !cleanTitle.includes('panini donruss optic')) {
            return 'Panini Donruss Optic';
        }
        if (cleanTitle.includes('prizm') && !cleanTitle.includes('panini prizm')) {
            return 'Panini Prizm';
        }
        if (cleanTitle.includes('bowman') && !cleanTitle.includes('topps bowman') && !cleanTitle.includes('bowman chrome')) {
            return 'Bowman';
        }
        if (cleanTitle.includes('chrome') && !cleanTitle.includes('topps chrome')) {
            return 'Topps Chrome';
        }
        
        return null;
    }

    extractCardType(title) {
        const titleLower = title.toLowerCase();
        
        // Enhanced card type patterns with better prioritization and new types
        const cardTypePatterns = [
            
            // Special parallel types (highest priority)
            { pattern: /\b(superfractor)\b/gi, name: 'Superfractor' },
            { pattern: /\b(redemption)\b/gi, name: 'Redemption' },
            { pattern: /\b(1\/1|one of one)\b/gi, name: '1/1' },
            { pattern: /\b(ssp|super short print)\b/gi, name: 'SSP' },
            { pattern: /\b(sp|short print)\b/gi, name: 'SP' },
            
            // Modern special refractors (high priority)
            { pattern: /\b(logofractor|logo fractor)\b/gi, name: 'LogoFractor' },
            { pattern: /\b(pulsar refractor)\b/gi, name: 'Pulsar Refractor' },
            { pattern: /\b(aqua wave)\b/gi, name: 'Aqua Wave' },
            { pattern: /\b(sky blue refractor)\b/gi, name: 'Sky Blue Refractor' },
            { pattern: /\b(ultra violet)\b/gi, name: 'Ultra Violet' },
            { pattern: /\b(formula 1)\b/gi, name: 'Formula 1' },
            { pattern: /\b(stratospheric stars)\b/gi, name: 'Stratospheric Stars' },
            { pattern: /\b(future stars)\b/gi, name: 'Future Stars' },
            { pattern: /\b(all stars)\b/gi, name: 'All Stars' },
            { pattern: /\b(main event)\b/gi, name: 'Main Event' },
            // Skybox Apex insert
            { pattern: /\b(apex allies)\b/gi, name: 'Apex Allies' },
            
            // Missing card type patterns (high priority)
            { pattern: /\b(storm chasers)\b/gi, name: 'Storm Chasers' },
            { pattern: /\b(disco prizm)\b/gi, name: 'Disco Prizm' },
            { pattern: /\b(sublime)\b/gi, name: 'Sublime' },
            { pattern: /\b(zone busters refractor)\b/gi, name: 'Zone Busters Refractor' },
            { pattern: /\b(aqua geometric)\b/gi, name: 'Aqua Geometric' },
            { pattern: /\b(king snake)\b/gi, name: 'King Snake' },
            { pattern: /\b(radiating rookies)\b/gi, name: 'Radiating Rookies' },
            { pattern: /\b(orange lazer)\b/gi, name: 'Orange Lazer' },
            { pattern: /\b(rainbow foil)\b/gi, name: 'Rainbow Foil' },
            { pattern: /\b(prospect profiles mini)\b/gi, name: 'Prospect Profiles Mini' },
            { pattern: /\b(invicta)\b/gi, name: 'Invicta' },
            
            // 2023 Panini Prizm Football Parallels (high priority)
            { pattern: /\b(black and red checker prizms)\b/gi, name: 'Black and Red Checker Prizms' },
            { pattern: /\b(black and white checker prizms)\b/gi, name: 'Black and White Checker Prizms' },
            { pattern: /\b(disco prizms)\b/gi, name: 'Disco Prizms' },
            { pattern: /\b(green ice prizms)\b/gi, name: 'Green Ice Prizms' },
            { pattern: /\b(lazer prizms)\b/gi, name: 'Lazer Prizms' },
            { pattern: /\b(neon green pulsar prizms)\b/gi, name: 'Neon Green Pulsar Prizms' },
            { pattern: /\b(no huddle prizms)\b/gi, name: 'No Huddle Prizms' },
            { pattern: /\b(orange ice prizms)\b/gi, name: 'Orange Ice Prizms' },
            { pattern: /\b(press proof prizms)\b/gi, name: 'Press Proof Prizms' },
            { pattern: /\b(purple pulsar prizms)\b/gi, name: 'Purple Pulsar Prizms' },
            { pattern: /\b(red sparkle prizms)\b/gi, name: 'Red Sparkle Prizms' },
            { pattern: /\b(red, white and blue prizms)\b/gi, name: 'Red, White and Blue Prizms' },
            { pattern: /\b(snakeskin prizms)\b/gi, name: 'Snakeskin Prizms' },
            { pattern: /\b(wave green prizms)\b/gi, name: 'Wave Green Prizms' },
            { pattern: /\b(white sparkle prizms)\b/gi, name: 'White Sparkle Prizms' },
            { pattern: /\b(pandora prizms)\b/gi, name: 'Pandora Prizms' },
            { pattern: /\b(purple ice prizms)\b/gi, name: 'Purple Ice Prizms' },
            { pattern: /\b(blue wave prizms)\b/gi, name: 'Blue Wave Prizms' },
            { pattern: /\b(hyper prizms)\b/gi, name: 'Hyper Prizms' },
            { pattern: /\b(wave red prizms)\b/gi, name: 'Wave Red Prizms' },
            { pattern: /\b(wave purple prizms)\b/gi, name: 'Wave Purple Prizms' },
            { pattern: /\b(blue sparkle prizms)\b/gi, name: 'Blue Sparkle Prizms' },
            { pattern: /\b(no huddle blue prizms)\b/gi, name: 'No Huddle Blue Prizms' },
            { pattern: /\b(green scope prizms)\b/gi, name: 'Green Scope Prizms' },
            { pattern: /\b(no huddle red prizms)\b/gi, name: 'No Huddle Red Prizms' },
            { pattern: /\b(wave orange prizms)\b/gi, name: 'Wave Orange Prizms' },
            { pattern: /\b(purple power prizms)\b/gi, name: 'Purple Power Prizms' },
            { pattern: /\b(red and yellow prizms)\b/gi, name: 'Red and Yellow Prizms' },
            { pattern: /\b(no huddle purple prizms)\b/gi, name: 'No Huddle Purple Prizms' },
            { pattern: /\b(red shimmer prizms)\b/gi, name: 'Red Shimmer Prizms' },
            { pattern: /\b(blue shimmer prizms)\b/gi, name: 'Blue Shimmer Prizms' },
            { pattern: /\b(navy camo prizms)\b/gi, name: 'Navy Camo Prizms' },
            { pattern: /\b(gold sparkle prizms)\b/gi, name: 'Gold Sparkle Prizms' },
            { pattern: /\b(forest camo prizms)\b/gi, name: 'Forest Camo Prizms' },
            { pattern: /\b(no huddle pink prizms)\b/gi, name: 'No Huddle Pink Prizms' },
            { pattern: /\b(gold shimmer prizms)\b/gi, name: 'Gold Shimmer Prizms' },
            { pattern: /\b(wave gold prizms)\b/gi, name: 'Wave Gold Prizms' },
            { pattern: /\b(green sparkle prizms)\b/gi, name: 'Green Sparkle Prizms' },
            { pattern: /\b(gold vinyl prizms)\b/gi, name: 'Gold Vinyl Prizms' },
            { pattern: /\b(green shimmer prizms)\b/gi, name: 'Green Shimmer Prizms' },
            { pattern: /\b(no huddle neon green prizms)\b/gi, name: 'No Huddle Neon Green Prizms' },
            { pattern: /\b(white knight prizms)\b/gi, name: 'White Knight Prizms' },
            { pattern: /\b(black finite prizms)\b/gi, name: 'Black Finite Prizms' },
            { pattern: /\b(black shimmer prizms)\b/gi, name: 'Black Shimmer Prizms' },
            { pattern: /\b(stars black prizms)\b/gi, name: 'Stars Black Prizms' },
            
            // Color + Prizm combinations (prioritize these)
            { pattern: /\b(gold prizm)\b/gi, name: 'Gold Prizm' },
            { pattern: /\b(silver prizm)\b/gi, name: 'Silver Prizm' },
            { pattern: /\b(black prizm)\b/gi, name: 'Black Prizm' },
            { pattern: /\b(green prizm)\b/gi, name: 'Green Prizm' },
            { pattern: /\b(blue prizm)\b/gi, name: 'Blue Prizm' },
            { pattern: /\b(red prizm)\b/gi, name: 'Red Prizm' },
            { pattern: /\b(yellow prizm)\b/gi, name: 'Yellow Prizm' },
            { pattern: /\b(orange prizm)\b/gi, name: 'Orange Prizm' },
            { pattern: /\b(purple prizm)\b/gi, name: 'Purple Prizm' },
            { pattern: /\b(pink prizm)\b/gi, name: 'Pink Prizm' },
            { pattern: /\b(bronze prizm)\b/gi, name: 'Bronze Prizm' },
            { pattern: /\b(white prizm)\b/gi, name: 'White Prizm' },
            { pattern: /\b(teal prizm)\b/gi, name: 'Teal Prizm' },
            { pattern: /\b(neon green prizm)\b/gi, name: 'Neon Green Prizm' },
            { pattern: /\b(camo pink prizm)\b/gi, name: 'Camo Pink Prizm' },
            { pattern: /\b(red white & blue prizm)\b/gi, name: 'Red White & Blue Prizm' },
            { pattern: /\b(red white and blue prizm)\b/gi, name: 'Red White & Blue Prizm' },
            
            // Special Prizm variants
            { pattern: /\b(holo prizm)\b/gi, name: 'Holo Prizm' },
            { pattern: /\b(cracked ice prizm)\b/gi, name: 'Cracked Ice Prizm' },
            { pattern: /\b(illumination prizm)\b/gi, name: 'Illumination Prizm' },
            { pattern: /\b(pandora prizm)\b/gi, name: 'Pandora Prizm' },
            { pattern: /\b(logo prizm)\b/gi, name: 'Logo Prizm' },
            { pattern: /\b(variation prizm)\b/gi, name: 'Variation Prizm' },
            { pattern: /\b(velocity prizm)\b/gi, name: 'Velocity Prizm' },
            
            // Special parallel types
            { pattern: /\b(teal velocity)\b/gi, name: 'Teal Velocity' },
            { pattern: /\b(genesis)\b/gi, name: 'Genesis' },
            { pattern: /\b(fast break)\b/gi, name: 'Fast Break' },
            { pattern: /\b(downtown)\b/gi, name: 'Downtown' },
            { pattern: /\b(real one)\b/gi, name: 'Real One' },
            { pattern: /\b(rpa|rookie patch auto)\b/gi, name: 'RPA' },
            { pattern: /\b(world champion boxers)\b/gi, name: 'World Champion Boxers' },
            { pattern: /\b(clear cut)\b/gi, name: 'Clear Cut' },
            { pattern: /\b(zoom)\b/gi, name: 'Zoom' },
            
            // Select card types
            { pattern: /\b(premier level)\b/gi, name: 'Premier Level' },
            { pattern: /\b(club level)\b/gi, name: 'Club Level' },
            { pattern: /\b(field level)\b/gi, name: 'Field Level' },
            { pattern: /\b(concourses)\b/gi, name: 'Concourses' },
            { pattern: /\b(premier)\b/gi, name: 'Premier' },
            { pattern: /\b(club)\b/gi, name: 'Club' },
            { pattern: /\b(level)\b/gi, name: 'Level' },
            
            // Special insert types
            { pattern: /\b(allies)\b/gi, name: 'Allies' },
            { pattern: /\b(usa basketball)\b/gi, name: 'USA Basketball' },
            { pattern: /\b(rookie kings)\b/gi, name: 'Rookie Kings' },
            { pattern: /\b(rainmakers)\b/gi, name: 'Rainmakers' },
            { pattern: /\b(flashback)\b/gi, name: 'Flashback' },
            { pattern: /\b(emergent)\b/gi, name: 'Emergent' },
            { pattern: /\b(mania)\b/gi, name: 'Mania' },
            { pattern: /\b(geometric)\b/gi, name: 'Geometric' },
            { pattern: /\b(honeycomb)\b/gi, name: 'Honeycomb' },
            { pattern: /\b(pride)\b/gi, name: 'Pride' },
            { pattern: /\b(kaleidoscopic)\b/gi, name: 'Kaleidoscopic' },
            { pattern: /\b(dragon scale)\b/gi, name: 'Dragon Scale' },
            { pattern: /\b(vintage)\b/gi, name: 'Vintage' },
            { pattern: /\b(stars)\b/gi, name: 'Stars' },
            { pattern: /\b(splash)\b/gi, name: 'Splash' },
            { pattern: /\b(rising)\b/gi, name: 'Rising' },
            { pattern: /\b(best)\b/gi, name: 'Best' },
            
            // Holiday/Event parallels
            { pattern: /\b(independence day)\b/gi, name: 'Independence Day' },
            { pattern: /\b(father's day)\b/gi, name: 'Father\'s Day' },
            { pattern: /\b(mother's day)\b/gi, name: 'Mother\'s Day' },
            { pattern: /\b(memorial day)\b/gi, name: 'Memorial Day' },
            
            // Special finish types
            { pattern: /\b(camo)\b/gi, name: 'Camo' },
            { pattern: /\b(vinyl)\b/gi, name: 'Vinyl' },
            { pattern: /\b(premium set)\b/gi, name: 'Premium Set' },
            { pattern: /\b(checkerboard)\b/gi, name: 'Checkerboard' },
            { pattern: /\b(die-cut|die cut)\b/gi, name: 'Die-Cut' },
            { pattern: /\b(national landmarks)\b/gi, name: 'National Landmarks' },
            { pattern: /\b(lava lamp)\b/gi, name: 'Lava Lamp' },
            { pattern: /\b(dazzle)\b/gi, name: 'Dazzle' },
            { pattern: /\b(flash)\b/gi, name: 'Flash' },
            { pattern: /\b(fifa)\b/gi, name: 'FIFA' },
            { pattern: /\b(velocity)\b/gi, name: 'Velocity' },
            { pattern: /\b(hyper)\b/gi, name: 'Hyper' },
            { pattern: /\b(dragon)\b/gi, name: 'Dragon' },
            { pattern: /\b(laser)\b/gi, name: 'Laser' },
            { pattern: /\b(liberty)\b/gi, name: 'Liberty' },
            { pattern: /\b(marvels)\b/gi, name: 'Marvels' },
            { pattern: /\b(fire)\b/gi, name: 'Fire' },
            { pattern: /\b(firestorm)\b/gi, name: 'Firestorm' },
            { pattern: /\b(voltage)\b/gi, name: 'Voltage' },
            { pattern: /\b(career stat line)\b/gi, name: 'Career Stat Line' },

            { pattern: /\b(mojo)\b/gi, name: 'Mojo' },
            { pattern: /\b(wave)\b/gi, name: 'Wave' },
            { pattern: /\b(scope)\b/gi, name: 'Scope' },
            { pattern: /\b(shock)\b/gi, name: 'Shock' },
            { pattern: /\b(choice)\b/gi, name: 'Choice' },
            { pattern: /\b(fusion)\b/gi, name: 'Fusion' },
            { pattern: /\b(nebula)\b/gi, name: 'Nebula' },
            { pattern: /\b(swirl)\b/gi, name: 'Swirl' },
            { pattern: /\b(fluorescent)\b/gi, name: 'Fluorescent' },
            { pattern: /\b(reactive)\b/gi, name: 'Reactive' },
            { pattern: /\b(tectonic)\b/gi, name: 'Tectonic' },
            { pattern: /\b(lava)\b/gi, name: 'Lava' },
            { pattern: /\b(crystal)\b/gi, name: 'Crystal' },
            { pattern: /\b(kaleidoscope)\b/gi, name: 'Kaleidoscope' },
            { pattern: /\b(prismatic)\b/gi, name: 'Prismatic' },
            { pattern: /\b(lunar glow)\b/gi, name: 'Lunar Glow' },
            
            // Animal parallels
            { pattern: /\b(alligator)\b/gi, name: 'Alligator' },
            { pattern: /\b(butterfly)\b/gi, name: 'Butterfly' },
            { pattern: /\b(chameleon)\b/gi, name: 'Chameleon' },
            { pattern: /\b(clown fish)\b/gi, name: 'Clown Fish' },
            { pattern: /\b(deer)\b/gi, name: 'Deer' },
            { pattern: /\b(elephant)\b/gi, name: 'Elephant' },
            { pattern: /\b(giraffe)\b/gi, name: 'Giraffe' },
            { pattern: /\b(leopard)\b/gi, name: 'Leopard' },
            { pattern: /\b(parrot)\b/gi, name: 'Parrot' },
            { pattern: /\b(peacock)\b/gi, name: 'Peacock' },
            { pattern: /\b(snake)\b/gi, name: 'Snake' },
            { pattern: /\b(tiger)\b/gi, name: 'Tiger' },
            { pattern: /\b(zebra)\b/gi, name: 'Zebra' },
            { pattern: /\b(tiger eyes|snake eyes)\b/gi, name: 'Eyes' },
            
            // Additional special types
            { pattern: /\b(anniversary)\b/gi, name: 'Anniversary' },
            { pattern: /\b(border)\b/gi, name: 'Border' },
            { pattern: /\b(flip stock)\b/gi, name: 'Flip Stock' },
            { pattern: /\b(magenta)\b/gi, name: 'Magenta' },
            { pattern: /\b(mini parallels)\b/gi, name: 'Mini Parallels' },
            { pattern: /\b(pulsar)\b/gi, name: 'Pulsar' },
            { pattern: /\b(bomb squad)\b/gi, name: 'Bomb Squad' },
            { pattern: /\b(bs\d+)\b/gi, name: 'Bomb Squad' },
            { pattern: /\b(rapture)\b/gi, name: 'Rapture' },
            { pattern: /\b(notoriety)\b/gi, name: 'Notoriety' },
            { pattern: /\b(finest)\b/gi, name: 'Finest' },
            { pattern: /\b(royalty)\b/gi, name: 'Royalty' },
            { pattern: /\b(uc|update)\b/gi, name: 'Update' },
            
            // Missing card types that should be filtered from player names
            { pattern: /\b(reptilian)\b/gi, name: 'Reptilian' },
            { pattern: /\b(sunday)\b/gi, name: 'Sunday' },
            { pattern: /\b(bn391)\b/gi, name: 'BN391' },
            { pattern: /\b(edition)\b/gi, name: 'Edition' },
            { pattern: /\b(au)\b/gi, name: 'AU' },
            { pattern: /\b(insert)\b/gi, name: 'Insert' },
            { pattern: /\b(cra)\b/gi, name: 'CRA' },
            { pattern: /\b(mh)\b/gi, name: 'MH' },
            { pattern: /\b(bulls)\b/gi, name: 'Bulls' },
            { pattern: /\b(bulls)\s*$/gi, name: 'Bulls' }, // Catch Bulls at end of title
            { pattern: /\b(lakers)\b/gi, name: 'Lakers' },
            { pattern: /\b(celtics)\b/gi, name: 'Celtics' },
            { pattern: /\b(warriors)\b/gi, name: 'Warriors' },
            { pattern: /\b(heat)\b/gi, name: 'Heat' },
            { pattern: /\b(knicks)\b/gi, name: 'Knicks' },
            { pattern: /\b(nets)\b/gi, name: 'Nets' },
            { pattern: /\b(raptors)\b/gi, name: 'Raptors' },
            { pattern: /\b(76ers)\b/gi, name: '76ers' },
            { pattern: /\b(hawks)\b/gi, name: 'Hawks' },
            
            // Additional card types from 3-word player name analysis
            { pattern: /\b(huddle)\b/gi, name: 'Huddle' },
            { pattern: /\b(and)\b/gi, name: 'And' }, // From "Red White And Blue"
            { pattern: /\b(snake)\b/gi, name: 'Snake' },
            { pattern: /\b(minnesota)\b/gi, name: 'Minnesota' },
            { pattern: /\b(wings)\b/gi, name: 'Wings' },
            { pattern: /\b(portrait)\b/gi, name: 'Portrait' },
            { pattern: /\b(legend)\b/gi, name: 'Legend' },
            { pattern: /\b(marco)\b/gi, name: 'Marco' }, // From "Legend Marco Van"
            { pattern: /\b(van)\b/gi, name: 'Van' }, // From "Legend Marco Van"
            { pattern: /\b(liv)\b/gi, name: 'LIV' },
            { pattern: /\b(luck)\b/gi, name: 'Luck' },
            { pattern: /\b(lottery)\b/gi, name: 'Lottery' },
            { pattern: /\b(hoops)\b/gi, name: 'Hoops' },
            { pattern: /\b(origins)\b/gi, name: 'Origins' },
            { pattern: /\b(overdrive)\b/gi, name: 'Overdrive' },
            { pattern: /\b(pokemon)\b/gi, name: 'Pokemon' },
            { pattern: /\b(aquapolis)\b/gi, name: 'Aquapolis' },
            { pattern: /\b(japanese)\b/gi, name: 'Japanese' },
            { pattern: /\b(stormfront)\b/gi, name: 'Stormfront' },
            { pattern: /\b(sword)\b/gi, name: 'Sword' },
            { pattern: /\b(shield)\b/gi, name: 'Shield' },
            { pattern: /\b(radiant)\b/gi, name: 'Radiant' },
            { pattern: /\b(retro)\b/gi, name: 'Retro' },
            { pattern: /\b(sublime)\b/gi, name: 'Sublime' },
            { pattern: /\b(main)\b/gi, name: 'Main' },
            { pattern: /\b(event)\b/gi, name: 'Event' },
            { pattern: /\b(blast)\b/gi, name: 'Blast' },
            { pattern: /\b(cb)\b/gi, name: 'CB' },
            { pattern: /\b(national)\b/gi, name: 'National' },
            { pattern: /\b(pride)\b/gi, name: 'Pride' },
            { pattern: /\b(nil)\b/gi, name: 'NIL' },
            { pattern: /\b(opc)\b/gi, name: 'OPC' },
            { pattern: /\b(wayne)\b/gi, name: 'Wayne' }, // From "Opc Wayne Gretzky"
            { pattern: /\b(gretzky)\b/gi, name: 'Gretzky' },
            { pattern: /\b(field)\b/gi, name: 'Field' },
            { pattern: /\b(pa)\b/gi, name: 'PA' },
            { pattern: /\b(tographs)\b/gi, name: 'Tographs' }, // From "Tographs Anthony Volpe"
            { pattern: /\b(uefa)\b/gi, name: 'UEFA' },
            { pattern: /\b(women)\b/gi, name: 'Women' },
            { pattern: /\b(champions)\b/gi, name: 'Champions' },
            { pattern: /\b(uptown)\b/gi, name: 'Uptown' },
            { pattern: /\b(uptowns)\b/gi, name: 'Uptowns' },
            { pattern: /\b(rps)\b/gi, name: 'RPS' },
            
            // Topps Chrome Baseball Parallels (HIGHEST PRIORITY - add these first)
            { pattern: /\b(superfractor)\b/gi, name: 'Superfractor', priority: 3 },
            { pattern: /\b(printing plates)\b/gi, name: 'Printing Plates', priority: 3 },
            { pattern: /\b(murakami base variations)\b/gi, name: 'Murakami Base Variations', priority: 3 },
            { pattern: /\b(red geometric refractors)\b/gi, name: 'Red Geometric Refractors', priority: 3 },
            { pattern: /\b(black geometric refractors)\b/gi, name: 'Black Geometric Refractors', priority: 3 },
            { pattern: /\b(orange geometric refractors)\b/gi, name: 'Orange Geometric Refractors', priority: 3 },
            { pattern: /\b(gold geometric refractors)\b/gi, name: 'Gold Geometric Refractors', priority: 3 },
            { pattern: /\b(green geometric refractors)\b/gi, name: 'Green Geometric Refractors', priority: 3 },
            { pattern: /\b(geometric refractors)\b/gi, name: 'Geometric Refractors', priority: 3 },
            { pattern: /\b(lightboard logo base variation)\b/gi, name: 'Lightboard Logo Base Variation', priority: 3 },
            { pattern: /\b(red lava refractor)\b/gi, name: 'Red Lava Refractor', priority: 3 },
            { pattern: /\b(red wave ref)\b/gi, name: 'Red Wave Refractor', priority: 3 },
            { pattern: /\b(red wave refractor)\b/gi, name: 'Red Wave Refractor', priority: 3 },
            { pattern: /\b(red raywave refractor)\b/gi, name: 'Red Raywave Refractor', priority: 3 },
            { pattern: /\b(black lava refractor)\b/gi, name: 'Black Lava Refractor', priority: 3 },
            { pattern: /\b(black raywave refractor)\b/gi, name: 'Black Raywave Refractor', priority: 3 },
            { pattern: /\b(black refractor refractor)\b/gi, name: 'Black Refractor', priority: 3 },
            { pattern: /\b(frozenfractor)\b/gi, name: 'Frozenfractor', priority: 3 },
            { pattern: /\b(orange lava refractor)\b/gi, name: 'Orange Lava Refractor', priority: 3 },
            { pattern: /\b(orange raywave refractor)\b/gi, name: 'Orange Raywave Refractor', priority: 3 },
            { pattern: /\b(orange wave ref)\b/gi, name: 'Orange Wave Refractor', priority: 3 },
            { pattern: /\b(orange wave refractor)\b/gi, name: 'Orange Wave Refractor', priority: 3 },
            { pattern: /\b(orange wave prizm)\b/gi, name: 'Orange Wave Prizm', priority: 3 },
            { pattern: /\b(gold lava refractor)\b/gi, name: 'Gold Lava Refractor', priority: 3 },
            { pattern: /\b(gold raywave refractor)\b/gi, name: 'Gold Raywave Refractor', priority: 3 },
            { pattern: /\b(gold wave ref)\b/gi, name: 'Gold Wave Refractor', priority: 3 },
            { pattern: /\b(gold wave refractor)\b/gi, name: 'Gold Wave Refractor', priority: 3 },
            { pattern: /\b(green lava refractor)\b/gi, name: 'Green Lava Refractor', priority: 3 },
            { pattern: /\b(green raywave refractor)\b/gi, name: 'Green Raywave Refractor', priority: 3 },
            { pattern: /\b(green wave ref)\b/gi, name: 'Green Wave Refractor', priority: 3 },
            { pattern: /\b(green wave refractor)\b/gi, name: 'Green Wave Refractor', priority: 3 },
            { pattern: /\b(blue lava refractor)\b/gi, name: 'Blue Lava Refractor', priority: 3 },
            { pattern: /\b(blue raywave refractor)\b/gi, name: 'Blue Raywave Refractor', priority: 3 },
            { pattern: /\b(aqua lava refractor)\b/gi, name: 'Aqua Lava Refractor', priority: 3 },
            { pattern: /\b(aqua raywave refractor)\b/gi, name: 'Aqua Raywave Refractor', priority: 3 },
            { pattern: /\b(purple raywave refractor)\b/gi, name: 'Purple Raywave Refractor', priority: 3 },
            { pattern: /\b(raywave refractor)\b/gi, name: 'Raywave Refractor', priority: 3 },
            { pattern: /\b(negative refractor)\b/gi, name: 'Negative Refractor', priority: 3 },
            { pattern: /\b(sepia refractor)\b/gi, name: 'Sepia Refractor', priority: 3 },
            { pattern: /\b(teal refractor)\b/gi, name: 'Teal Refractor', priority: 3 },
            { pattern: /\b(purple refractor)\b/gi, name: 'Purple Refractor', priority: 3 },
            { pattern: /\b(aqua refractor)\b/gi, name: 'Aqua Refractor', priority: 3 },
            { pattern: /\b(blue refractor)\b/gi, name: 'Blue Refractor', priority: 3 },
            { pattern: /\b(green refractor)\b/gi, name: 'Green Refractor', priority: 3 },
            { pattern: /\b(gold refractor)\b/gi, name: 'Gold Refractor', priority: 3 },
            { pattern: /\b(orange refractor)\b/gi, name: 'Orange Refractor', priority: 3 },
            { pattern: /\b(black refractor)\b/gi, name: 'Black Refractor', priority: 3 },
            { pattern: /\b(red refractor)\b/gi, name: 'Red Refractor', priority: 3 },
            { pattern: /\b(x-fractor|x.factor|x factor)\b/gi, name: 'X-Fractor', priority: 3 },
            { pattern: /\b(prism refractor)\b/gi, name: 'Prism Refractor', priority: 3 },
            { pattern: /\b(topps refractor)\b/gi, name: 'Topps Refractor', priority: 3 },

            // Color + Refractor combinations (prioritize these)
            { pattern: /\b(silver refractor)\b/gi, name: 'Silver Refractor' },
            { pattern: /\b(pink refractor)\b/gi, name: 'Pink Refractor' },
            { pattern: /\b(bronze refractor)\b/gi, name: 'Bronze Refractor' },
            { pattern: /\b(white refractor)\b/gi, name: 'White Refractor' },
            { pattern: /\b(neon green refractor)\b/gi, name: 'Neon Green Refractor' },

            
            // Special color + finish combinations
            { pattern: /\b(blue ice)\b/gi, name: 'Blue Ice' },
            { pattern: /\b(green ice)\b/gi, name: 'Green Ice' },
            { pattern: /\b(pink ice)\b/gi, name: 'Pink Ice' },
            { pattern: /\b(gold ice)\b/gi, name: 'Gold Ice' },
            { pattern: /\b(blue hyper)\b/gi, name: 'Blue Hyper' },
            { pattern: /\b(green hyper)\b/gi, name: 'Green Hyper' },
            { pattern: /\b(red hyper)\b/gi, name: 'Red Hyper' },
            { pattern: /\b(blue scope)\b/gi, name: 'Blue Scope' },
            { pattern: /\b(scope blue)\b/gi, name: 'Blue Scope' },
            { pattern: /\b(blue velocity)\b/gi, name: 'Blue Velocity' },
            { pattern: /\b(green velocity)\b/gi, name: 'Green Velocity' },
            { pattern: /\b(red velocity)\b/gi, name: 'Red Velocity' },
            { pattern: /\b(blue wave)\b/gi, name: 'Blue Wave' },
            { pattern: /\b(green wave)\b/gi, name: 'Green Wave' },
            { pattern: /\b(red wave)\b/gi, name: 'Red Wave' },
            { pattern: /\b(blue optic)\b/gi, name: 'Blue Optic' },
            { pattern: /\b(optic blue)\b/gi, name: 'Blue Optic' },
            { pattern: /\b(pink optic)\b/gi, name: 'Pink Optic' },
            { pattern: /\b(optic pink)\b/gi, name: 'Pink Optic' },
            { pattern: /\b(red white blue)\b/gi, name: 'Red White & Blue' },
            { pattern: /\b(red white & blue)\b/gi, name: 'Red White & Blue' },
            { pattern: /\b(red white and blue)\b/gi, name: 'Red White & Blue' },
            { pattern: /\b(blue red white)\b/gi, name: 'Red White & Blue' },
            { pattern: /\b(red yellow)\b/gi, name: 'Red & Yellow' },
            { pattern: /\b(red & yellow)\b/gi, name: 'Red & Yellow' },
            { pattern: /\b(black red)\b/gi, name: 'Black & Red' },
            { pattern: /\b(black & red)\b/gi, name: 'Black & Red' },
            { pattern: /\b(black green)\b/gi, name: 'Black & Green' },
            { pattern: /\b(black & green)\b/gi, name: 'Black & Green' },
            { pattern: /\b(blue red)\b/gi, name: 'Blue & Red' },
            { pattern: /\b(blue & red)\b/gi, name: 'Blue & Red' },
            
            // Panini Select specific parallels - HIGHEST PRIORITY
            { pattern: /\b(black and green die-cut prizm)\b/gi, name: 'Black and Green Die-Cut Prizm', priority: 2 },
            { pattern: /\b(black and red die-cut prizm)\b/gi, name: 'Black and Red Die-Cut Prizm', priority: 2 },
            { pattern: /\b(green and yellow die-cut prizm)\b/gi, name: 'Green and Yellow Die-Cut Prizm', priority: 2 },
            { pattern: /\b(green\/yellow die-cut prizm)\b/gi, name: 'Green and Yellow Die-Cut Prizm', priority: 2 },
            { pattern: /\b(yellow\/green die-cut prizm)\b/gi, name: 'Green and Yellow Die-Cut Prizm', priority: 2 },
            { pattern: /\b(red and blue die-cut prizm)\b/gi, name: 'Red and Blue Die-Cut Prizm', priority: 2 },
            { pattern: /\b(red\/blue die-cut prizm)\b/gi, name: 'Red and Blue Die-Cut Prizm', priority: 2 },
            { pattern: /\b(blue\/red die-cut prizm)\b/gi, name: 'Red and Blue Die-Cut Prizm', priority: 2 },
            { pattern: /\b(blue and orange die-cut prizm)\b/gi, name: 'Blue and Orange Die-Cut Prizm', priority: 2 },
            { pattern: /\b(blue\/orange die-cut prizm)\b/gi, name: 'Blue and Orange Die-Cut Prizm', priority: 2 },
            { pattern: /\b(orange\/blue die-cut prizm)\b/gi, name: 'Blue and Orange Die-Cut Prizm', priority: 2 },
            { pattern: /\b(snakeskin green and black prizm)\b/gi, name: 'Snakeskin Green and Black Prizm', priority: 2 },
            { pattern: /\b(neon orange pulsar prizm)\b/gi, name: 'Neon Orange Pulsar Prizm', priority: 2 },
            { pattern: /\b(disco red prizm)\b/gi, name: 'Disco Red Prizm', priority: 2 },
            { pattern: /\b(disco blue prizm)\b/gi, name: 'Disco Blue Prizm', priority: 2 },
            { pattern: /\b(disco gold prizm)\b/gi, name: 'Disco Gold Prizm', priority: 2 },
            { pattern: /\b(disco green prizm)\b/gi, name: 'Disco Green Prizm', priority: 2 },
            { pattern: /\b(disco black prizm)\b/gi, name: 'Disco Black Prizm', priority: 2 },
            { pattern: /\b(tie-dye prizm)\b/gi, name: 'Tie-Dye Prizm', priority: 2 },
            { pattern: /\b(tie-dye die-cut prizm)\b/gi, name: 'Tie-Dye Die-Cut Prizm', priority: 2 },
            { pattern: /\b(neon green die-cut prizm)\b/gi, name: 'Neon Green Die-Cut Prizm', priority: 2 },
            { pattern: /\b(tri-color prizm)\b/gi, name: 'Tri-Color Prizm', priority: 2 },
            { pattern: /\b(orange die-cut prizm)\b/gi, name: 'Orange Die-Cut Prizm', priority: 2 },
            { pattern: /\b(copper prizm die-cut)\b/gi, name: 'Copper Prizm Die-Cut', priority: 2 },
            { pattern: /\b(white die-cut prizm)\b/gi, name: 'White Die-Cut Prizm', priority: 2 },
            { pattern: /\b(dragon scale prizm)\b/gi, name: 'Dragon Scale Prizm', priority: 2 },
            { pattern: /\b(gold die-cut prizm)\b/gi, name: 'Gold Die-Cut Prizm', priority: 2 },
            { pattern: /\b(green die-cut prizm)\b/gi, name: 'Green Die-Cut Prizm', priority: 2 },
            { pattern: /\b(black die-cut prizm)\b/gi, name: 'Black Die-Cut Prizm', priority: 2 },
            { pattern: /\b(silver die-cut prizm)\b/gi, name: 'Silver Die-Cut Prizm', priority: 2 },
            { pattern: /\b(zebra die-cut prizm)\b/gi, name: 'Zebra Die-Cut Prizm', priority: 2 },
            
            // Color combinations with slashes (e.g., "Green/Yellow" -> "Green and Yellow") - MEDIUM PRIORITY
            { pattern: /\b(green\/yellow|yellow\/green)\b/gi, name: 'Green and Yellow', priority: 1 },
            { pattern: /\b(red\/white|white\/red)\b/gi, name: 'Red and White', priority: 1 },
            { pattern: /\b(blue\/red|red\/blue)\b/gi, name: 'Blue and Red', priority: 1 },
            { pattern: /\b(black\/red|red\/black)\b/gi, name: 'Black and Red', priority: 1 },
            { pattern: /\b(black\/green|green\/black)\b/gi, name: 'Black and Green', priority: 1 },
            { pattern: /\b(blue\/green|green\/blue)\b/gi, name: 'Blue and Green', priority: 1 },
            { pattern: /\b(red\/yellow|yellow\/red)\b/gi, name: 'Red and Yellow', priority: 1 },
            { pattern: /\b(orange\/blue|blue\/orange)\b/gi, name: 'Orange and Blue', priority: 1 },
            { pattern: /\b(purple\/gold|gold\/purple)\b/gi, name: 'Purple and Gold', priority: 1 },
            { pattern: /\b(pink\/purple|purple\/pink)\b/gi, name: 'Pink and Purple', priority: 1 },
            

            // Sapphire set card types (parallels within Sapphire sets)
            { pattern: /\b(gold sapphire)\b/gi, name: 'Gold Sapphire' },
            { pattern: /\b(orange sapphire)\b/gi, name: 'Orange Sapphire' },
            { pattern: /\b(purple sapphire)\b/gi, name: 'Purple Sapphire' },
            { pattern: /\b(sapphire selections)\b/gi, name: 'Sapphire Selections' },
            { pattern: /\b(infinite sapphire)\b/gi, name: 'Infinite Sapphire' },
            { pattern: /\b(sapphire refractor)\b/gi, name: 'Sapphire Refractor' },
            { pattern: /\b(red ink)\b/gi, name: 'Red Ink' },
            { pattern: /\b(red ink auto)\b/gi, name: 'Red Ink Auto' },
            { pattern: /\b(cyan rpa)\b/gi, name: 'Cyan RPA' },
            { pattern: /\b(rpa cyan)\b/gi, name: 'Cyan RPA' },
            { pattern: /\b(light blue prizm)\b/gi, name: 'Light Blue Prizm' },
            { pattern: /\b(light blue)\b/gi, name: 'Light Blue' },
            { pattern: /\b(reactive blue)\b/gi, name: 'Reactive Blue' },
            { pattern: /\b(shimmer pink)\b/gi, name: 'Shimmer Pink' },
            { pattern: /\b(disco orange)\b/gi, name: 'Disco Orange' },
            { pattern: /\b(disco prizm orange)\b/gi, name: 'Disco Orange Prizm' },
            { pattern: /\b(shock purple)\b/gi, name: 'Shock Purple' },
            { pattern: /\b(wave red ruby)\b/gi, name: 'Wave Red Ruby' },
            { pattern: /\b(flashback silver)\b/gi, name: 'Flashback Silver' },
            { pattern: /\b(level orange prizm)\b/gi, name: 'Level Orange Prizm' },
            { pattern: /\b(level prizm)\b/gi, name: 'Level Prizm' },
            { pattern: /\b(level allen)\b/gi, name: 'Level Allen' },
            { pattern: /\b(prizm black blue)\b/gi, name: 'Prizm Black Blue' },
            { pattern: /\b(prizm black silver)\b/gi, name: 'Prizm Black Silver' },
            { pattern: /\b(prizm silver)\b/gi, name: 'Silver Prizm' },
            { pattern: /\b(prizm orange)\b/gi, name: 'Orange Prizm' },
            { pattern: /\b(red hyper prizm)\b/gi, name: 'Red Hyper Prizm' },
            { pattern: /\b(gold lava)\b/gi, name: 'Gold Lava' },
            { pattern: /\b(pride genesis prizm)\b/gi, name: 'Pride Genesis Prizm' },
            { pattern: /\b(variation silver)\b/gi, name: 'Variation Silver' },
            { pattern: /\b(emergent wave prizm green)\b/gi, name: 'Emergent Wave Green Prizm' },
            { pattern: /\b(allen prizm)\b/gi, name: 'Allen Prizm' },
            { pattern: /\b(green ice prizm)\b/gi, name: 'Green Ice Prizm' },
            { pattern: /\b(wave red optic)\b/gi, name: 'Red Wave Optic' },
            { pattern: /\b(green rookies prizm)\b/gi, name: 'Green Rookies Prizm' },
            { pattern: /\b(update green)\b/gi, name: 'Green Update' },
            { pattern: /\b(disco rookies)\b/gi, name: 'Disco Rookies' },
            { pattern: /\b(prospect silver wave refractor)\b/gi, name: 'Prospect Silver Wave Refractor' },
            { pattern: /\b(color blast black)\b/gi, name: 'Color Blast Black' },
            { pattern: /\b(no huddle flashback)\b/gi, name: 'No Huddle Flashback' },
            { pattern: /\b(mojo red prizm)\b/gi, name: 'Mojo Red Prizm' },
            { pattern: /\b(phoenix)\b/gi, name: 'Phoenix' },
            { pattern: /\b(checkerboard refractor)\b/gi, name: 'Checkerboard Refractor' },
            { pattern: /\b(scope optic blue)\b/gi, name: 'Blue Scope Optic' },
            { pattern: /\b(optic blue scope)\b/gi, name: 'Blue Scope Optic' },
            { pattern: /\b(prizmatic green)\b/gi, name: 'Prizmatic Green' },
            { pattern: /\b(prizmatic green prizm)\b/gi, name: 'Prizmatic Green Prizm' },
            { pattern: /\b(prizmatic green wave)\b/gi, name: 'Prizmatic Green Wave' },
            { pattern: /\b(fireworks green prizm)\b/gi, name: 'Fireworks Green Prizm' },
            { pattern: /\b(notoriety green)\b/gi, name: 'Notoriety Green' },
            { pattern: /\b(instant impact)\b/gi, name: 'Instant Impact' },
            { pattern: /\b(concourses)\b/gi, name: 'Concourses' },
            { pattern: /\b(concourse)\b/gi, name: 'Concourse' },
            { pattern: /\b(light blue prizm)\b/gi, name: 'Light Blue Prizm' },
            { pattern: /\b(light blue)\b/gi, name: 'Light Blue' },
            { pattern: /\b(reactive blue)\b/gi, name: 'Reactive Blue' },
            { pattern: /\b(shimmer pink)\b/gi, name: 'Shimmer Pink' },
            { pattern: /\b(disco orange)\b/gi, name: 'Disco Orange' },
            { pattern: /\b(disco prizm orange)\b/gi, name: 'Disco Orange Prizm' },
            { pattern: /\b(shock purple)\b/gi, name: 'Shock Purple' },
            { pattern: /\b(wave red ruby)\b/gi, name: 'Wave Red Ruby' },
            { pattern: /\b(flashback silver)\b/gi, name: 'Flashback Silver' },
            { pattern: /\b(level orange prizm)\b/gi, name: 'Level Orange Prizm' },
            { pattern: /\b(level prizm)\b/gi, name: 'Level Prizm' },
            { pattern: /\b(level allen)\b/gi, name: 'Level Allen' },
            { pattern: /\b(prizm black blue)\b/gi, name: 'Prizm Black Blue' },
            { pattern: /\b(prizm black silver)\b/gi, name: 'Prizm Black Silver' },
            { pattern: /\b(prizm silver)\b/gi, name: 'Silver Prizm' },
            { pattern: /\b(prizm orange)\b/gi, name: 'Orange Prizm' },
            { pattern: /\b(red hyper prizm)\b/gi, name: 'Red Hyper Prizm' },
            { pattern: /\b(gold lava)\b/gi, name: 'Gold Lava' },
            { pattern: /\b(pride genesis prizm)\b/gi, name: 'Pride Genesis Prizm' },
            { pattern: /\b(variation silver)\b/gi, name: 'Variation Silver' },
            { pattern: /\b(emergent wave prizm green)\b/gi, name: 'Emergent Wave Green Prizm' },
            { pattern: /\b(allen prizm)\b/gi, name: 'Allen Prizm' },
            { pattern: /\b(green ice prizm)\b/gi, name: 'Green Ice Prizm' },
            { pattern: /\b(wave red optic)\b/gi, name: 'Red Wave Optic' },
            { pattern: /\b(green rookies prizm)\b/gi, name: 'Green Rookies Prizm' },
            { pattern: /\b(update green)\b/gi, name: 'Green Update' },
            { pattern: /\b(disco rookies)\b/gi, name: 'Disco Rookies' },
            { pattern: /\b(prospect silver wave refractor)\b/gi, name: 'Prospect Silver Wave Refractor' },
            { pattern: /\b(color blast black)\b/gi, name: 'Color Blast Black' },
            { pattern: /\b(no huddle flashback)\b/gi, name: 'No Huddle Flashback' },
            { pattern: /\b(mojo red prizm)\b/gi, name: 'Mojo Red Prizm' },
            { pattern: /\b(phoenix)\b/gi, name: 'Phoenix' },
            { pattern: /\b(checkerboard refractor)\b/gi, name: 'Checkerboard Refractor' },
            { pattern: /\b(scope optic blue)\b/gi, name: 'Blue Scope Optic' },
            { pattern: /\b(optic blue scope)\b/gi, name: 'Blue Scope Optic' },
            { pattern: /\b(prizmatic green)\b/gi, name: 'Prizmatic Green' },
            { pattern: /\b(prizmatic green prizm)\b/gi, name: 'Prizmatic Green Prizm' },
            { pattern: /\b(prizmatic green wave)\b/gi, name: 'Prizmatic Green Wave' },
            { pattern: /\b(fireworks green prizm)\b/gi, name: 'Fireworks Green Prizm' },
            { pattern: /\b(notoriety green)\b/gi, name: 'Notoriety Green' },
            { pattern: /\b(instant impact)\b/gi, name: 'Instant Impact' },
            { pattern: /\b(concourses)\b/gi, name: 'Concourses' },
            { pattern: /\b(concourse)\b/gi, name: 'Concourse' },
            
// 2023 Topps Heritage Baseball Parallels
{ pattern: /\b(name-position\s+swap\s+variation)\b/gi, name: 'NamePosition Swap Variation' },

// 2023 Topps Heritage Baseball Parallels
{ pattern: /\b(black\s+bordered)\b/gi, name: 'Black Bordered' },
{ pattern: /\b(black\s+and\s+white\s+image\s+variation)\b/gi, name: 'Black and White Image Variation' },
{ pattern: /\b(chrome)\b/gi, name: 'Chrome' },
{ pattern: /\b(chrome\s+black\s+refractor)\b/gi, name: 'Chrome Black Refractor' },
{ pattern: /\b(chrome\s+blue\s+refractor)\b/gi, name: 'Chrome Blue Refractor' },
{ pattern: /\b(chrome\s+gold\s+refractor)\b/gi, name: 'Chrome Gold Refractor' },
{ pattern: /\b(chrome\s+green\s+refractor)\b/gi, name: 'Chrome Green Refractor' },
{ pattern: /\b(chrome\s+purple\s+refractor)\b/gi, name: 'Chrome Purple Refractor' },
{ pattern: /\b(chrome\s+red\s+refractor)\b/gi, name: 'Chrome Red Refractor' },
{ pattern: /\b(chrome\s+refractor)\b/gi, name: 'Chrome Refractor' },
{ pattern: /\b(chrome\s+superfractor)\b/gi, name: 'Chrome Superfractor' },
{ pattern: /\b(clubhouse\s+collection)\b/gi, name: 'Clubhouse Collection' },
{ pattern: /\b(clubhouse\s+collection\s+autograph)\b/gi, name: 'Clubhouse Collection Autograph' },
{ pattern: /\b(clubhouse\s+collection\s+relic)\b/gi, name: 'Clubhouse Collection Relic' },
{ pattern: /\b(flip\s+stock)\b/gi, name: 'Flip Stock' },
{ pattern: /\b(mini)\b/gi, name: 'Mini' },
{ pattern: /\b(mini\s+black)\b/gi, name: 'Mini Black' },
{ pattern: /\b(mini\s+blue)\b/gi, name: 'Mini Blue' },
{ pattern: /\b(mini\s+gold)\b/gi, name: 'Mini Gold' },
{ pattern: /\b(mini\s+green)\b/gi, name: 'Mini Green' },
{ pattern: /\b(mini\s+purple)\b/gi, name: 'Mini Purple' },
{ pattern: /\b(mini\s+red)\b/gi, name: 'Mini Red' },
{ pattern: /\b(mini\s+superfractor)\b/gi, name: 'Mini Superfractor' },
{ pattern: /\b(name-position\s+swap\s+variation)\b/gi, name: 'NamePosition Swap Variation' },
{ pattern: /\b(real\s+one\s+autograph)\b/gi, name: 'Real One Autograph' },
{ pattern: /\b(real\s+one\s+triple\s+autograph)\b/gi, name: 'Real One Triple Autograph' },

            // Basic color types (lower priority)
            { pattern: /\b(gold)\b/gi, name: 'Gold' },
            { pattern: /\b(silver)\b/gi, name: 'Silver' },
            { pattern: /\b(black)\b/gi, name: 'Black' },
            { pattern: /\b(green)\b/gi, name: 'Green' },
            { pattern: /\b(blue)\b/gi, name: 'Blue' },
            { pattern: /\b(red)\b/gi, name: 'Red' },
            { pattern: /\b(yellow)\b/gi, name: 'Yellow' },
            { pattern: /\b(orange)\b/gi, name: 'Orange' },
            { pattern: /\b(purple)\b/gi, name: 'Purple' },
            { pattern: /\b(pink)\b/gi, name: 'Pink' },
            { pattern: /\b(bronze)\b/gi, name: 'Bronze' },
            { pattern: /\b(white)\b/gi, name: 'White' },
            { pattern: /\b(teal)\b/gi, name: 'Teal' },
            { pattern: /\b(neon green)\b/gi, name: 'Neon Green' },
            
            // Basic finish types (lowest priority)
            { pattern: /\b(refractor|refractors)\b/gi, name: 'Refractor' },
            { pattern: /\b(prizm|prizmatic)\b/gi, name: 'Prizm' },
            { pattern: /\b(holo|holographic)\b/gi, name: 'Holo' },
            // Chrome pattern - temporarily disabled to prevent duplication
            // { pattern: /\b(chrome)\b/gi, name: 'Chrome' },
            { pattern: /\b(x-fractor|x.factor|x factor|x-fractors)\b/gi, name: 'X-Fractor' },
            { pattern: /\b(cracked ice)\b/gi, name: 'Cracked Ice' },
            { pattern: /\b(stained glass)\b/gi, name: 'Stained Glass' },
            
            // Base cards (lowest priority)
            { pattern: /\b(base)\b/gi, name: 'Base' }
        ];
        
        // Find all matches and build card type with priority handling
        let foundTypes = [];
        const priorityMatches = new Map(); // Map to store matches by priority
        
        for (const { pattern, name, excludeIf, priority = 0 } of cardTypePatterns) {
            const matches = titleLower.match(pattern);
            if (matches) {
                // Check if this pattern should be excluded
                if (excludeIf && excludeIf(title)) {
                    continue; // Skip this pattern
                }
                
                // Store matches by priority
                if (!priorityMatches.has(priority)) {
                    priorityMatches.set(priority, []);
                }
                priorityMatches.get(priority).push(name);
            }
        }
        
                            // Process matches by priority (highest first)
        const sortedPriorities = Array.from(priorityMatches.keys()).sort((a, b) => b - a);
        let highestPriorityFound = false;
        
        for (const priority of sortedPriorities) {
            const matches = priorityMatches.get(priority);
            
            // If we found a highest priority match, only use that and ignore all lower priorities
            if (priority >= 2 && matches.length > 0) {
                foundTypes = [matches[0]]; // Replace all previous matches
                highestPriorityFound = true;
                break; // Stop after finding highest priority match
            } else if (!highestPriorityFound) {
                // Only add lower priority matches if no highest priority was found
                foundTypes.push(...matches);
            }
        }

        // Remove duplicates and format
        const uniqueTypes = [...new Set(foundTypes)];
        let cardType = uniqueTypes.join(' ').trim();
        

        
        // Enhanced deduplication to prevent duplicates like "Chrome Chrome", "Prizm Prizm"
        const words = cardType.split(' ');
        const uniqueWords = [];
        const seenWords = new Set();
        
        for (const word of words) {
            const wordLower = word.toLowerCase();
            if (!seenWords.has(wordLower)) {
                uniqueWords.push(word);
                seenWords.add(wordLower);
            }
        }
        
        cardType = uniqueWords.join(' ');
        
        // Additional deduplication for common patterns
        cardType = cardType.replace(/\b(\w+)\s+\1\b/gi, '$1'); // Remove consecutive duplicates
        cardType = cardType.replace(/\b(\w+\s+\w+)\s+\1\b/gi, '$1'); // Remove consecutive phrase duplicates
        cardType = cardType.replace(/\b(\w+\s+\w+\s+\w+)\s+\1\b/gi, '$1'); // Remove consecutive three-word duplicates

        // Post-processing to fix common issues
        if (cardType) {
            // Special fix for Green/Yellow Die-Cut Prizm
            if (cardType.toLowerCase().includes('green and yellow prizm die-cut') && 
                cardType.toLowerCase().includes('green yellow prizm')) {
                cardType = 'Green and Yellow Die-Cut Prizm';
            }
            
            // Fix capitalization issues - convert to Title Case
            cardType = cardType.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            
            // Fix redundant combinations
            cardType = cardType.replace(/Refractor Chrome/g, 'Chrome Refractor');
            cardType = cardType.replace(/Color Prizm/g, 'Prizm');
            cardType = cardType.replace(/Color Chrome/g, 'Chrome');
            cardType = cardType.replace(/Color Hyper/g, 'Hyper');
            
            // Fix inconsistent naming
            cardType = cardType.replace(/Rookies/g, 'Rookie');
            // Remove "Autographs" from card_type - it's handled as an attribute, not a type
            cardType = cardType.replace(/\bautographs?\b/gi, '').trim();
            
            // Replace Autograph(s) -> Auto then strip solitary Auto from type since we already output 'auto' separately
            cardType = cardType.replace(/Autographs?/g, 'Auto');
            if (/^auto\b/i.test(cardType)) {
                cardType = cardType.replace(/^auto\b/i, '').trim();
            }
            
            // Remove "Edition" from card_type unless it's "1st Edition"
            if (cardType && !cardType.toLowerCase().includes('1st edition')) {
                cardType = cardType.replace(/\bedition\b/gi, '').trim();
            }
            
            // Only remove "Sapphire" from card_type if it's clearly part of a set name like "Sapphire Prizm"
            if (cardType && cardType.toLowerCase().includes('sapphire')) {
                const titleLower = title.toLowerCase();
                // Only remove if it's combined with other set indicators, not standalone
                if (titleLower.includes('sapphire prizm') || titleLower.includes('sapphire chrome')) {
                    cardType = cardType.replace(/\bsapphire\b/gi, '').trim();
                }
            }
            
            // Remove SP and SSP from card_type - they're not card types
            if (cardType) {
                cardType = cardType.replace(/\b(sp|ssp)\b/gi, '').trim();
            }
            cardType = cardType.replace(/\bSp\b/g, 'SP');
            
            // Fix specific combinations that should be standardized
            cardType = cardType.replace(/Blue Red White/g, 'Red White & Blue');
            cardType = cardType.replace(/Red White Blue/g, 'Red White & Blue');
            cardType = cardType.replace(/Red Yellow/g, 'Red & Yellow');
            cardType = cardType.replace(/Black Red/g, 'Black & Red');
            cardType = cardType.replace(/Black Green/g, 'Black & Green');
            cardType = cardType.replace(/Blue Red/g, 'Blue & Red');
            cardType = cardType.replace(/Sapphire Orange/g, 'Orange Sapphire');
            cardType = cardType.replace(/Scope Optic Blue/g, 'Blue Scope Optic');
            cardType = cardType.replace(/Optic Blue Scope/g, 'Blue Scope Optic');
            cardType = cardType.replace(/Wave Red Optic/g, 'Red Wave Optic');
            cardType = cardType.replace(/Update Green/g, 'Green Update');
            
            // Remove redundant card types that are already in the card set name
            if (cardType === 'Finest' || cardType === 'Concourse' || cardType === 'Update' || 
                cardType === 'Prizm' || cardType === 'Select' ||
                cardType === 'Heritage' || cardType === 'Diamond Kings' || cardType === 'Zenith' ||
                cardType === 'Bowman' || cardType === 'Topps' || cardType === 'Skybox') {
                return 'Base';
            }
            
            // Special handling for Chrome - only keep as card type if it's NOT part of the card set
            if (cardType === 'Chrome') {
                // Check if the title already contains "chrome" in a card set context
                const titleLower = title.toLowerCase();
                const cardSetDetected = this.extractCardSet(title);
                if ((cardSetDetected && cardSetDetected.toLowerCase().includes('chrome')) ||
                    titleLower.includes('bowman chrome') ||
                    titleLower.includes('topps chrome') ||
                    titleLower.includes('bowman u chrome') ||
                    titleLower.includes('bowman university chrome') ||
                    titleLower.includes('chrome draft') ||
                    titleLower.includes('chrome sapphire') ||
                    titleLower.includes('chrome update') ||
                    titleLower.includes('chrome u 1st') ||
                    titleLower.includes('chrome rookie autographs')) {
                    return 'Base'; // Chrome is already in the card set, don't duplicate
                }
            }
            
            // Additional check: If card type contains Chrome and title/card set contains Chrome card set patterns, remove Chrome from card type
            if (cardType && cardType.toLowerCase().includes('chrome')) {
                const titleLower = title.toLowerCase();
                const cardSetDetected = this.extractCardSet(title);
                // Check if the title or extracted card set contains Chrome in a card set context
                if ((cardSetDetected && cardSetDetected.toLowerCase().includes('chrome')) ||
                    titleLower.includes('bowman chrome') ||
                    titleLower.includes('topps chrome') ||
                    titleLower.includes('bowman u chrome') ||
                    titleLower.includes('bowman university chrome') ||
                    titleLower.includes('chrome draft') ||
                    titleLower.includes('chrome sapphire') ||
                    titleLower.includes('chrome update') ||
                    titleLower.includes('chrome u 1st') ||
                    titleLower.includes('chrome rookie autographs')) {
                    // Remove Chrome from the card type
                    const cardTypeWithoutChrome = cardType.replace(/\bchrome\b/gi, '').trim();
                    return cardTypeWithoutChrome || 'Base';
                }
            }
            
            // Special handling for Skybox - only keep as card type if it's NOT part of the card set
            if (cardType && cardType.toLowerCase().includes('skybox')) {
                const titleLower = title.toLowerCase();
                const cardSetDetected = this.extractCardSet(title);
                // Check if the title or extracted card set contains Skybox in a card set context
                if ((cardSetDetected && cardSetDetected.toLowerCase().includes('skybox')) ||
                    titleLower.includes('skybox')) {
                    // Remove Skybox from the card type
                    const cardTypeWithoutSkybox = cardType.replace(/\bskybox\b/gi, '').trim();
                    return cardTypeWithoutSkybox || 'Base';
                }
            }
            
            // Special handling for Optic - only keep as card type if it's NOT part of the card set
            if (cardType && cardType.toLowerCase().includes('optic')) {
                const titleLower = title.toLowerCase();
                const cardSetDetected = this.extractCardSet(title);
                // Check if the title or extracted card set contains Optic in a card set context
                if ((cardSetDetected && cardSetDetected.toLowerCase().includes('optic')) ||
                    titleLower.includes('donruss optic')) {
                    // Remove Optic from the card type
                    const cardTypeWithoutOptic = cardType.replace(/\boptic\b/gi, '').trim();
                    return cardTypeWithoutOptic || 'Base';
                }
            }
            
            // Remove generic terms that shouldn't be card types
            if (cardType === 'Color' || cardType === 'Chrome' || cardType === 'Prizm') {
                return 'Base';
            }
        }

        // Return "Base" for cards without special designation instead of null
        return cardType || 'Base';
    }

    // Extract player name from title (improved method using removal approach)
    extractPlayerName(title) {
        const debugOn = process.env.VERBOSE_EXTRACTION === '1' || process.env.VERBOSE_EXTRACTION === 'true';
        const steps = [];
        let cleanTitle = title;
        if (debugOn) steps.push({ step: 'start', title });
        
        // Step 0: Special handling for J.J. McCarthy - preserve "J.J." before cleaning
        const hasJJ = cleanTitle.toLowerCase().includes('j.j.') || cleanTitle.toLowerCase().includes('j j');
        if (hasJJ) {
            // Look for "J.J. McCarthy" pattern specifically
            const jjPattern = /\b(J\.?\s*J\.?\s+[A-Z][a-z]+)\b/gi;
            const jjMatches = title.match(jjPattern);
            if (jjMatches && jjMatches.length > 0) {
                const res = jjMatches[0].replace(/\s+/g, ' ').trim();
                if (debugOn) this._lastDebug = steps.concat([{ step: 'jjEarlyReturn', res }]);
                return res;
            }
        }
        
        // Step 1: Remove the card set
        const cardSet = this.extractCardSet(title);
        if (cardSet) {
            // Build a hyphen/space tolerant regex for the card set
            const tolerant = cardSet.replace(/\s+/g, '[\\s-]+');
            cleanTitle = cleanTitle.replace(new RegExp(tolerant, 'gi'), ' ');
        }
        if (debugOn) steps.push({ step: 'afterCardSet', cardSet, cleanTitle });
        
        // Step 2: Remove the card type
        const cardType = this.extractCardType(title);
        if (cardType && cardType.toLowerCase() !== 'base') {
            cleanTitle = cleanTitle.replace(new RegExp(cardType, 'gi'), ' ');
        }
        if (debugOn) steps.push({ step: 'afterCardType', cardType, cleanTitle });
        
        // Step 3: Remove the card number (be tolerant to hyphens/spaces)
        const cardNumber = this.extractCardNumber(title);
        if (cardNumber) {
            const base = cardNumber.replace('#', '');
            // Build tolerant pattern: allow optional separators between letters and digits
            const tolerantBase = base
                .replace(/[-\s]+/g, '[-\\s]*')
                .replace(/([A-Za-z]+)(\d+)/, '$1[-\\s]*$2');
            const tolerantRegex = new RegExp(tolerantBase, 'gi');
            cleanTitle = cleanTitle.replace(tolerantRegex, ' ');
            // Also remove leftover standalone letter prefixes like BDC if present
            const letterPrefixMatch = base.match(/^[A-Za-z]+/);
            if (letterPrefixMatch) {
                const prefix = letterPrefixMatch[0];
                cleanTitle = cleanTitle.replace(new RegExp(`\\b${prefix}\\b`, 'gi'), ' ');
            }
            cleanTitle = cleanTitle.replace(/#/g, ' '); // Remove any remaining # symbols
        }
        if (debugOn) steps.push({ step: 'afterCardNumber', cardNumber, cleanTitle });
        
        // Step 3.5: Remove card number patterns that might be left (like TC264, MMR-54, etc.)
        const cardNumberPatterns = [
            /\b(TC\d+)\b/gi,  // TC264, TC123, etc.
            /\b(MMR-\d+)\b/gi, // MMR-54, MMR-123, etc.
            /\b(DT\d+)\b/gi,   // DT36, DT123, etc.
            /\b(BS\d+)\b/gi,   // BS3, BS123, etc.
            /\b(SJMC)\b/gi,    // SJMC
        ];
        
        cardNumberPatterns.forEach(pattern => {
            cleanTitle = cleanTitle.replace(pattern, ' ');
        });
        if (debugOn) steps.push({ step: 'afterCardNumberPatterns', cleanTitle });
        
        // Step 4: Remove grading terms
        const gradingTerms = [
            'psa', '10', 'gem', 'mint', 'mt', 'gem mint', 'psa 10', 'psa10',
            'bgs', 'beckett', 'sgc', 'csg', 'hga', 'gma', 'graded', 'ungraded'
        ];
        gradingTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        if (debugOn) steps.push({ step: 'afterGradingTerms', cleanTitle });
        
        // Step 4.5: Remove Sapphire (simple approach - just remove it)
        cleanTitle = cleanTitle.replace(/\bsapphire\b/gi, ' ');
        if (debugOn) steps.push({ step: 'afterSapphireRemoval', cleanTitle });
        
        // Step 4.6: Remove UCL (simple approach - just remove it)
        cleanTitle = cleanTitle.replace(/\bucl\b/gi, ' ');
        if (debugOn) steps.push({ step: 'afterUCLRemoval', cleanTitle });
        
        
        
        
        
        // Step 4.5: Special handling for "LeBron" to prevent "La" removal
        // Replace "LeBron" with a placeholder before removing "La", then restore it
        cleanTitle = cleanTitle.replace(/\bLeBron\b/gi, 'LEBRON_PLACEHOLDER');
        cleanTitle = cleanTitle.replace(/\bLEBRON\b/gi, 'LEBRON_PLACEHOLDER');
        cleanTitle = cleanTitle.replace(/\blebron\b/gi, 'LEBRON_PLACEHOLDER');
        if (debugOn) steps.push({ step: 'afterLeBronPlaceholder', cleanTitle });

        // Step 4.5.5: Early detection of specific player patterns (before initials cleanup)
        // Look for "Rashee Rice" in various contexts
        const rasheeRicePattern = /\b(Rashee\s+Rice)\b/gi;
        const rasheeRiceMatch = cleanTitle.match(rasheeRicePattern);
        if (rasheeRiceMatch && rasheeRiceMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'rasheeRiceEarlyReturn', result: 'Rashee Rice' }]);
            return 'Rashee Rice';
        }

        // Look for "Malik Nabers" in various contexts
        const malikNabersPattern = /\b(Malik\s+Nabers)\b/gi;
        const malikNabersMatch = cleanTitle.match(malikNabersPattern);
        if (malikNabersMatch && malikNabersMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'malikNabersEarlyReturn', result: 'Malik Nabers' }]);
            return 'Malik Nabers';
        }

        // Step 4.6: Clean up periods in initials (Cj.s.troud -> CJ Stroud, etc.)
        // This needs to happen before other processing to prevent concatenation issues
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([A-Z])/g, '$1$2 $3'); // Cj.s.troud -> CJ Stroud
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Cj.k.ayfus -> CJ Kayfus
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Cc.l.amine -> CC Lamine
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Dp.j.axon -> DP Jaxon
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // El.j.asson -> EL Jasson
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Jr.t.ie -> JR Tie
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Ud.h.ubert -> UD Hubert
        cleanTitle = cleanTitle.replace(/([A-Z]).([A-Z]).([a-z]+)/g, '$1$2 $3'); // Ii.b.ig -> II Big
        if (debugOn) steps.push({ step: 'afterInitialsCleanup', cleanTitle });
        
        // Check for "Bo Jackson" in the original title
        if (cleanTitle.includes('Bo Jackson') || cleanTitle.includes('BO JACKSON')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'boJacksonEarlyReturn', result: 'Bo Jackson' }]);
            return 'Bo Jackson';
        }
        
        // Check for "Aaron Judge" in the original title
        if (cleanTitle.includes('Aaron Judge') || cleanTitle.includes('AARON JUDGE')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'aaronJudgeEarlyReturn', result: 'Aaron Judge' }]);
            return 'Aaron Judge';
        }
        
        // Check for "Josue De Paula" in the original title
        if (cleanTitle.includes('Josue De Paula') || cleanTitle.includes('JOSUE DE PAULA')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'josueDePaulaEarlyReturn', result: 'Josue De Paula' }]);
            return 'Josue De Paula';
        }
        
        // Check for "Jacob Misiorowski" in the original title
        if (cleanTitle.includes('Jacob Misiorowski') || cleanTitle.includes('JACOB MISIOROWSKI')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jacobMisiorowskiEarlyReturn', result: 'Jacob Misiorowski' }]);
            return 'Jacob Misiorowski';
        }
        
        // Check for "Jared McCain" in the original title
        if (cleanTitle.includes('Jared McCain') || cleanTitle.includes('JARED MCCAIN')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jaredMcCainEarlyReturn', result: 'Jared McCain' }]);
            return 'Jared McCain';
        }
        
        // Check for "Judge" in the original title (from Ohtani/Judge cards)
        if (cleanTitle.includes('Judge') && !cleanTitle.includes('Ohtani') && !cleanTitle.includes('Aaron')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'judgeEarlyReturn', result: 'Judge' }]);
            return 'Judge';
        }
        
        // Check for "Ohtani" in the original title (from Ohtani/Judge cards)
        if (cleanTitle.includes('Ohtani') && !cleanTitle.includes('Judge')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ohtaniEarlyReturn', result: 'Ohtani' }]);
            return 'Ohtani';
        }
        
        // Check for "Pete Alonso" in the original title
        if (cleanTitle.includes('Pete Alonso') || cleanTitle.includes('PETE ALONSO')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'peteAlonsoEarlyReturn', result: 'Pete Alonso' }]);
            return 'Pete Alonso';
        }
        
        // Check for "Tom Brady" in the original title
        if (cleanTitle.includes('Tom Brady') || cleanTitle.includes('TOM BRADY')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'tomBradyEarlyReturn', result: 'Tom Brady' }]);
            return 'Tom Brady';
        }
        
        // Check for "Davante Adams" in the original title
        if (cleanTitle.includes('Davante Adams') || cleanTitle.includes('DAVANTE ADAMS')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'davanteAdamsEarlyReturn', result: 'Davante Adams' }]);
            return 'Davante Adams';
        }
        
        // Step 4.5.1: Early filtering of obviously invalid player names
        // Filter out just slashes
        if (cleanTitle.trim() === '/' || cleanTitle.trim() === '\\') {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Filter out just "III" (likely a suffix)
        if (cleanTitle.trim().toLowerCase() === 'iii') {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Filter out very short names that are likely incomplete
        if (cleanTitle.trim().length <= 2) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Step 4.5.5: Very early detection of specific dual player patterns
        // Check for "Montana/Rice" before any other processing
        if (cleanTitle.includes('Montana/Rice') || cleanTitle.includes('montana/rice')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'montanaRiceEarlyReturn', result: 'Montana/Rice' }]);
            return 'Montana/Rice';
        }
        
        // Check for "Kobe Bryant/Lakers" before any other processing
        if (cleanTitle.includes('Kobe Bryant/Lakers') || cleanTitle.includes('kobe bryant/lakers')) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'kobeLakersEarlyReturn', result: 'Kobe Bryant' }]);
            return 'Kobe Bryant';
        }
        

        
        // Step 4.6: Early detection of dual player cards with "/" separator
        // Look for patterns like "Montana/Rice" or "Player1/Player2" BEFORE removing card terms
        const earlyDualPlayerPattern = /\b([A-Z][a-z]+\s*\/\s*[A-Z][a-z]+)\b/g;
        const earlyDualPlayerMatches = cleanTitle.match(earlyDualPlayerPattern);
        if (earlyDualPlayerMatches && earlyDualPlayerMatches.length > 0) {
            // Take the first match as the player name and preserve proper capitalization
            const match = earlyDualPlayerMatches[0].replace(/\s+/g, '').trim();
            return match.split('/').map(part => 
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            ).join('/');
        }
        
        // Specific pattern for "Montana/Rice" dual player card
        const montanaRicePattern = /\b(Montana\s*\/\s*Rice)\b/gi;
        const montanaRiceMatch = cleanTitle.match(montanaRicePattern);
        if (montanaRiceMatch && montanaRiceMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'montanaRiceEarlyReturn', result: 'Montana/Rice' }]);
            return 'Montana/Rice';
        }
        
        // Also look for patterns like "Kobe Bryant/Lakers" where the second part is a team
        const earlyPlayerTeamPattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+\s*\/\s*[A-Z][a-z]+)\b/g;
        const earlyPlayerTeamMatches = cleanTitle.match(earlyPlayerTeamPattern);
        if (earlyPlayerTeamMatches && earlyPlayerTeamMatches.length > 0) {
            // Take just the player part before the "/"
            const match = earlyPlayerTeamMatches[0];
            const playerPart = match.split('/')[0].trim();
            return playerPart.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
        
        // Specific pattern for "Kobe Bryant/Lakers" player/team pattern
        const kobeLakersPattern = /\b(Kobe\s+Bryant\s*\/\s*Lakers)\b/gi;
        const kobeLakersMatch = cleanTitle.match(kobeLakersPattern);
        if (kobeLakersMatch && kobeLakersMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'kobeLakersEarlyReturn', result: 'Kobe Bryant' }]);
            return 'Kobe Bryant';
        }
        
        // Step 4.7: Special handling for "LeBron James" patterns
        // Look for "LeBron James" followed by team names and extract just "LeBron James"
        const lebronLakersPattern = /\b(LeBron\s+James)\s+LA\s+Lakers\b/gi;
        const lebronLakersMatch = cleanTitle.match(lebronLakersPattern);
        if (lebronLakersMatch && lebronLakersMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lebronLakersEarlyReturn', result: 'LeBron James' }]);
            return 'LeBron James';
        }
        
        // More general pattern for "LeBron James" followed by any team
        const lebronTeamPattern = /\b(LeBron\s+James)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/gi;
        const lebronTeamMatch = cleanTitle.match(lebronTeamPattern);
        if (lebronTeamMatch && lebronTeamMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lebronTeamEarlyReturn', result: 'LeBron James' }]);
            return 'LeBron James';
        }
        
        // Pattern for "LeBron James" followed by "LA Lakers" with any case variations
        const lebronLALakersPattern = /\b(LeBron\s+James)\s+LA\s+Lakers\b/gi;
        const lebronLALakersMatch = cleanTitle.match(lebronLALakersPattern);
        if (lebronLALakersMatch && lebronLALakersMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lebronLALakersEarlyReturn', result: 'LeBron James' }]);
            return 'LeBron James';
        }
        
        // Pattern for "LeBRON JAMES" (all caps) followed by "LA Lakers"
        const lebronAllCapsPattern = /\b(LeBRON\s+JAMES)\s+LA\s+Lakers\b/gi;
        const lebronAllCapsMatch = cleanTitle.match(lebronAllCapsPattern);
        if (lebronAllCapsMatch && lebronAllCapsMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lebronAllCapsEarlyReturn', result: 'LeBron James' }]);
            return 'LeBron James';
        }
        
        // Pattern for "LeBRON JAMES" with dash separator followed by "LA Lakers"
        const lebronDashPattern = /\b(LeBRON\s+JAMES)\s*-\s*.*?LA\s+Lakers\b/gi;
        const lebronDashMatch = cleanTitle.match(lebronDashPattern);
        if (lebronDashMatch && lebronDashMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lebronDashEarlyReturn', result: 'LeBron James' }]);
            return 'LeBron James';
        }
        
        // Step 4.8: Special handling for specific player patterns
        // Look for "Caleb Williams" in various contexts
        const calebWilliamsPattern = /\b(Caleb\s+Williams)\b/gi;
        const calebWilliamsMatch = cleanTitle.match(calebWilliamsPattern);
        if (calebWilliamsMatch && calebWilliamsMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'calebWilliamsEarlyReturn', result: 'Caleb Williams' }]);
            return 'Caleb Williams';
        }
        
        // Look for "Xavier Worthy" in various contexts
        const xavierWorthyPattern = /\b(Xavier\s+Worthy)\b/gi;
        const xavierWorthyMatch = cleanTitle.match(xavierWorthyPattern);
        if (xavierWorthyMatch && xavierWorthyMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'xavierWorthyEarlyReturn', result: 'Xavier Worthy' }]);
            return 'Xavier Worthy';
        }
        
        // Look for "Cooper Flagg" in various contexts
        const cooperFlaggPattern = /\b(Cooper\s+Flagg)\b/gi;
        const cooperFlaggMatch = cleanTitle.match(cooperFlaggPattern);
        if (cooperFlaggMatch && cooperFlaggMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'cooperFlaggEarlyReturn', result: 'Cooper Flagg' }]);
            return 'Cooper Flagg';
        }
        
        // Look for "Angel Reese" in various contexts
        const angelReesePattern = /\b(Angel\s+Reese)\b/gi;
        const angelReeseMatch = cleanTitle.match(angelReesePattern);
        if (angelReeseMatch && angelReeseMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'angelReeseEarlyReturn', result: 'Angel Reese' }]);
            return 'Angel Reese';
        }
        
        // Look for "Kyrie Irving" in various contexts
        const kyrieIrvingPattern = /\b(Kyrie\s+Irving)\b/gi;
        const kyrieIrvingMatch = cleanTitle.match(kyrieIrvingPattern);
        if (kyrieIrvingMatch && kyrieIrvingMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'kyrieIrvingEarlyReturn', result: 'Kyrie Irving' }]);
            return 'Kyrie Irving';
        }
        
        // Look for "Aaron Judge" in various contexts
        const aaronJudgePattern = /\b(Aaron\s+Judge)\b/gi;
        const aaronJudgeMatch = cleanTitle.match(aaronJudgePattern);
        if (aaronJudgeMatch && aaronJudgeMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'aaronJudgeEarlyReturn', result: 'Aaron Judge' }]);
            return 'Aaron Judge';
        }
        
        // Look for "Randy Moss" in various contexts
        const randyMossPattern = /\b(Randy\s+Moss)\b/gi;
        const randyMossMatch = cleanTitle.match(randyMossPattern);
        if (randyMossMatch && randyMossMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'randyMossEarlyReturn', result: 'Randy Moss' }]);
            return 'Randy Moss';
        }
        
        // Look for "Stephen Curry" in various contexts
        const stephenCurryPattern = /\b(Stephen\s+Curry)\b/gi;
        const stephenCurryMatch = cleanTitle.match(stephenCurryPattern);
        if (stephenCurryMatch && stephenCurryMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'stephenCurryEarlyReturn', result: 'Stephen Curry' }]);
            return 'Stephen Curry';
        }
        
        // Look for "Jayson Tatum" in various contexts
        const jaysonTatumPattern = /\b(Jayson\s+Tatum)\b/gi;
        const jaysonTatumMatch = cleanTitle.match(jaysonTatumPattern);
        if (jaysonTatumMatch && jaysonTatumMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jaysonTatumEarlyReturn', result: 'Jayson Tatum' }]);
            return 'Jayson Tatum';
        }
        
        // Look for "Travis Kelce" in various contexts
        const travisKelcePattern = /\b(Travis\s+Kelce)\b/gi;
        const travisKelceMatch = cleanTitle.match(travisKelcePattern);
        if (travisKelceMatch && travisKelceMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'travisKelceEarlyReturn', result: 'Travis Kelce' }]);
            return 'Travis Kelce';
        }
        
        // Look for "Tony Ferguson" in various contexts
        const tonyFergusonPattern = /\b(Tony\s+Ferguson)\b/gi;
        const tonyFergusonMatch = cleanTitle.match(tonyFergusonPattern);
        if (tonyFergusonMatch && tonyFergusonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'tonyFergusonEarlyReturn', result: 'Tony Ferguson' }]);
            return 'Tony Ferguson';
        }
        
        // Look for "Luis Aparicio" in various contexts
        const luisAparicioPattern = /\b(Luis\s+Aparicio)\b/gi;
        const luisAparicioMatch = cleanTitle.match(luisAparicioPattern);
        if (luisAparicioMatch && luisAparicioMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'luisAparicioEarlyReturn', result: 'Luis Aparicio' }]);
            return 'Luis Aparicio';
        }
        
        // Look for "Jesus Made" in various contexts
        const jesusMadePattern = /\b(Jesus\s+Made)\b/gi;
        const jesusMadeMatch = cleanTitle.match(jesusMadePattern);
        if (jesusMadeMatch && jesusMadeMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jesusMadeEarlyReturn', result: 'Jesus Made' }]);
            return 'Jesus Made';
        }
        
        // Look for "Anthony Edwards" in various contexts
        const anthonyEdwardsPattern = /\b(Anthony\s+Edwards)\b/gi;
        const anthonyEdwardsMatch = cleanTitle.match(anthonyEdwardsPattern);
        if (anthonyEdwardsMatch && anthonyEdwardsMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'anthonyEdwardsEarlyReturn', result: 'Anthony Edwards' }]);
            return 'Anthony Edwards';
        }
        
        // Look for "Tua Tagovailoa" in various contexts
        const tuaTagovailoaPattern = /\b(Tua\s+Tagovailoa)\b/gi;
        const tuaTagovailoaMatch = cleanTitle.match(tuaTagovailoaPattern);
        if (tuaTagovailoaMatch && tuaTagovailoaMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'tuaTagovailoaEarlyReturn', result: 'Tua Tagovailoa' }]);
            return 'Tua Tagovailoa';
        }
        
        // Look for "Keon Coleman" in various contexts
        const keonColemanPattern = /\b(Keon\s+Coleman)\b/gi;
        const keonColemanMatch = cleanTitle.match(keonColemanPattern);
        if (keonColemanMatch && keonColemanMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'keonColemanEarlyReturn', result: 'Keon Coleman' }]);
            return 'Keon Coleman';
        }
        
        // Look for "Deni Avdija" in various contexts
        const deniAvdijaPattern = /\b(Deni\s+Avdija)\b/gi;
        const deniAvdijaMatch = cleanTitle.match(deniAvdijaPattern);
        if (deniAvdijaMatch && deniAvdijaMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'deniAvdijaEarlyReturn', result: 'Deni Avdija' }]);
            return 'Deni Avdija';
        }
        
        // Look for "Tyson Bagent" in various contexts
        const tysonBagentPattern = /\b(Tyson\s+Bagent)\b/gi;
        const tysonBagentMatch = cleanTitle.match(tysonBagentPattern);
        if (tysonBagentMatch && tysonBagentMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'tysonBagentEarlyReturn', result: 'Tyson Bagent' }]);
            return 'Tyson Bagent';
        }
        
        // Look for "Breece Hall" in various contexts
        const breeseHallPattern = /\b(Breece\s+Hall)\b/gi;
        const breeseHallMatch = cleanTitle.match(breeseHallPattern);
        if (breeseHallMatch && breeseHallMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'breeseHallEarlyReturn', result: 'Breece Hall' }]);
            return 'Breece Hall';
        }
        
        // Look for "Cal Raleigh" in various contexts (Raleigh is both a city and player name)
        const calRaleighPattern = /\b(Cal\s+Raleigh)\b/gi;
        const calRaleighMatch = cleanTitle.match(calRaleighPattern);
        if (calRaleighMatch && calRaleighMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'calRaleighEarlyReturn', result: 'Cal Raleigh' }]);
            return 'Cal Raleigh';
        }
        
        // Look for "Cooper Kupp" in various contexts (Cooper is also a car manufacturer)
        const cooperKuppPattern = /\b(Cooper\s+Kupp)\b/gi;
        const cooperKuppMatch = cleanTitle.match(cooperKuppPattern);
        if (cooperKuppMatch && cooperKuppMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'cooperKuppEarlyReturn', result: 'Cooper Kupp' }]);
            return 'Cooper Kupp';
        }
        
        // Look for "Christian Watson" in various contexts
        const christianWatsonPattern = /\b(Christian\s+Watson)\b/gi;
        const christianWatsonMatch = cleanTitle.match(christianWatsonPattern);
        if (christianWatsonMatch && christianWatsonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'christianWatsonEarlyReturn', result: 'Christian Watson' }]);
            return 'Christian Watson';
        }
        
        // Look for "Lewis Hamilton" in various contexts
        const lewisHamiltonPattern = /\b(Lewis\s+Hamilton)\b/gi;
        const lewisHamiltonMatch = cleanTitle.match(lewisHamiltonPattern);
        if (lewisHamiltonMatch && lewisHamiltonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'lewisHamiltonEarlyReturn', result: 'Lewis Hamilton' }]);
            return 'Lewis Hamilton';
        }
        
        // Look for "Xavier Worthy" in various contexts (handles "Worthy" → "Xavier Worthy")
        // Note: This pattern already exists earlier in the file
        
        // Look for "Ausar Thompson" in various contexts (handles incomplete "Ausar Thompso")
        const ausarThompsonPattern = /\b(Ausar\s+Thompson)\b/gi;
        const ausarThompsonMatch = cleanTitle.match(ausarThompsonPattern);
        if (ausarThompsonMatch && ausarThompsonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ausarThompsonEarlyReturn', result: 'Ausar Thompson' }]);
            return 'Ausar Thompson';
        }
        
        // Step 4.9: Filter out obviously invalid player names first
        // Filter out just slashes
        if (cleanTitle.trim() === '/' || cleanTitle.trim() === '\\') {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Filter out just "III" (likely a suffix)
        if (cleanTitle.trim().toLowerCase() === 'iii') {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Filter out very short names that are likely incomplete
        if (cleanTitle.trim().length <= 2) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'invalidPlayerName', result: null }]);
            return null;
        }
        
        // Step 4.10: Additional specific player patterns from analysis
        // Look for "Purdy/Deebo" dual player card
        const purdyDeeboPattern = /\b(Purdy\s*\/\s*Deebo)\b/gi;
        const purdyDeeboMatch = cleanTitle.match(purdyDeeboPattern);
        if (purdyDeeboMatch && purdyDeeboMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'purdyDeeboEarlyReturn', result: 'Purdy/Deebo' }]);
            return 'Purdy/Deebo';
        }
        
        // Look for "Ohtani/Judge" dual player card
        const ohtaniJudgePattern = /\b(Ohtani\s*\/\s*Judge)\b/gi;
        const ohtaniJudgeMatch = cleanTitle.match(ohtaniJudgePattern);
        if (ohtaniJudgeMatch && ohtaniJudgeMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ohtaniJudgeEarlyReturn', result: 'Ohtani/Judge' }]);
            return 'Ohtani/Judge';
        }
        
        // Look for "East/West" (this might be a card type, not a player)
        const eastWestPattern = /\b(East\s*\/\s*West)\b/gi;
        const eastWestMatch = cleanTitle.match(eastWestPattern);
        if (eastWestMatch && eastWestMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'eastWestEarlyReturn', result: null }]);
            return null; // This is likely a card type, not a player
        }
        
        // Look for "/pitch" - this is likely a card type, not a player
        const pitchPattern = /\b\/pitch\b/gi;
        const pitchMatch = cleanTitle.match(pitchPattern);
        if (pitchMatch && pitchMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'pitchEarlyReturn', result: null }]);
            return null; // This is likely a card type, not a player
        }
        
        // Look for "Pitching/no" - this is likely a card type, not a player
        const pitchingNoPattern = /\b(Pitching\s*\/\s*no)\b/gi;
        const pitchingNoMatch = cleanTitle.match(pitchingNoPattern);
        if (pitchingNoMatch && pitchingNoMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'pitchingNoEarlyReturn', result: null }]);
            return null; // This is likely a card type, not a player
        }
        
        // Look for "Baseball/football" - this is likely a card type, not a player
        const baseballFootballPattern = /\b(Baseball\s*\/\s*football)\b/gi;
        const baseballFootballMatch = cleanTitle.match(baseballFootballPattern);
        if (baseballFootballMatch && baseballFootballMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'baseballFootballEarlyReturn', result: null }]);
            return null; // This is likely a card type, not a player
        }
        
        // Look for "Wyatt Langford" (remove the Q0902 part)
        const wyattLangfordPattern = /\b(Wyatt\s+Langford)\b/gi;
        const wyattLangfordMatch = cleanTitle.match(wyattLangfordPattern);
        if (wyattLangfordMatch && wyattLangfordMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'wyattLangfordEarlyReturn', result: 'Wyatt Langford' }]);
            return 'Wyatt Langford';
        }
        
        // Look for "Vladimir Guerrero" (remove Heritage)
        const vladimirGuerreroPattern = /\b(Vladimir\s+Guerrero)\b/gi;
        const vladimirGuerreroMatch = cleanTitle.match(vladimirGuerreroPattern);
        if (vladimirGuerreroMatch && vladimirGuerreroMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'vladimirGuerreroEarlyReturn', result: 'Vladimir Guerrero' }]);
            return 'Vladimir Guerrero';
        }
        
        // Look for "Victor Wembanyama" (remove Supernatural)
        const victorWembanyamaPattern = /\b(Victor\s+Wembanyama)\b/gi;
        const victorWembanyamaMatch = cleanTitle.match(victorWembanyamaPattern);
        if (victorWembanyamaMatch && victorWembanyamaMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'victorWembanyamaEarlyReturn', result: 'Victor Wembanyama' }]);
            return 'Victor Wembanyama';
        }
        
        // Look for "Ryan" - this might be incomplete, but let's handle it
        const ryanPattern = /\b(Ryan)\b/gi;
        const ryanMatch = cleanTitle.match(ryanPattern);
        if (ryanMatch && ryanMatch.length > 0) {
            // Check if there's more context to make it a full name
            const fullNameMatch = cleanTitle.match(/\b(Ryan\s+[A-Z][a-z]+)\b/gi);
            if (fullNameMatch && fullNameMatch.length > 0) {
                if (debugOn) this._lastDebug = steps.concat([{ step: 'ryanEarlyReturn', result: fullNameMatch[0] }]);
                return fullNameMatch[0];
            }
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ryanEarlyReturn', result: 'Ryan' }]);
            return 'Ryan'; // Keep as is for now
        }
        
        // Look for "Tom" - this might be incomplete, but let's handle it
        const tomPattern = /\b(Tom)\b/gi;
        const tomMatch = cleanTitle.match(tomPattern);
        if (tomMatch && tomMatch.length > 0) {
            // Check if there's more context to make it a full name
            const fullNameMatch = cleanTitle.match(/\b(Tom\s+[A-Z][a-z]+)\b/gi);
            if (fullNameMatch && fullNameMatch.length > 0) {
                if (debugOn) this._lastDebug = steps.concat([{ step: 'tomEarlyReturn', result: fullNameMatch[0] }]);
                return fullNameMatch[0];
            }
            if (debugOn) this._lastDebug = steps.concat([{ step: 'tomEarlyReturn', result: 'Tom' }]);
            return 'Tom'; // Keep as is for now
        }
        
        // Look for "J.J. McCarthy" with periods (this is a valid player name)
        const jjMccarthyPattern = /\b(J\.J\.\s+McCarthy)\b/gi;
        const jjMccarthyMatch = cleanTitle.match(jjMccarthyPattern);
        if (jjMccarthyMatch && jjMccarthyMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'jjMccarthyEarlyReturn', result: 'J.J. McCarthy' }]);
            return 'J.J. McCarthy';
        }
        
                        // Look for "Mccarthy" without "J.J." - assume it's "J.J. McCarthy" for consistency
                const mccarthyPattern = /\b(Mccarthy)\b/gi;
                const mccarthyMatch = cleanTitle.match(mccarthyPattern);
                if (mccarthyMatch && mccarthyMatch.length > 0) {
                    if (debugOn) this._lastDebug = steps.concat([{ step: 'mccarthyEarlyReturn', result: 'J.J. McCarthy' }]);
                    return 'J.J. McCarthy';
                }
                
                // Fix Roman numeral issues (Ii -> II, Iv -> IV)
                const romanNumeralPattern = /\b([A-Z][a-z]+)\s+(Ii|Iv)\b/gi;
                const romanMatch = cleanTitle.match(romanNumeralPattern);
                if (romanMatch && romanMatch.length > 0) {
                    const match = romanMatch[0];
                    if (match.includes('Ii')) {
                        if (debugOn) this._lastDebug = steps.concat([{ step: 'romanNumeralIssue', result: match.replace('Ii', 'II') }]);
                        return match.replace('Ii', 'II');
                    } else if (match.includes('Iv')) {
                        if (debugOn) this._lastDebug = steps.concat([{ step: 'romanNumeralIssue', result: match.replace('Iv', 'IV') }]);
                        return match.replace('Iv', 'IV');
                    }
                }
                
                // Fix initial spacing issues (J J -> J.J.)
                const initialSpacingPattern = /\b([A-Z])\s+([A-Z])\s+([A-Z][a-z]+)\b/gi;
                const initialSpacingMatch = cleanTitle.match(initialSpacingPattern);
                if (initialSpacingMatch && initialSpacingMatch.length > 0) {
                    const match = initialSpacingMatch[0];
                    const fixedMatch = match.replace(/([A-Z])\s+([A-Z])/, '$1.$2.');
                    // Special case for "J.J. Mccarthy" -> "J.J. McCarthy"
                    if (fixedMatch.toLowerCase().includes('j.j. mccarthy')) {
                        if (debugOn) this._lastDebug = steps.concat([{ step: 'initialSpacingIssue', result: fixedMatch }]);
                        return fixedMatch;
                    }
                    if (debugOn) this._lastDebug = steps.concat([{ step: 'initialSpacingIssue', result: fixedMatch }]);
                    return fixedMatch;
                }
        
        // Look for "Joe Milton III" - extract just "Joe Milton"
        const joeMiltonPattern = /\b(Joe\s+Milton)\s+III\b/gi;
        const joeMiltonMatch = cleanTitle.match(joeMiltonPattern);
        if (joeMiltonMatch && joeMiltonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'joeMiltonEarlyReturn', result: 'Joe Milton' }]);
            return 'Joe Milton';
        }
        
        // Look for "Ryan O'Hearn" - extract full name
        const ryanOHearnPattern = /\b(Ryan\s+O'Hearn)\b/gi;
        const ryanOHearnMatch = cleanTitle.match(ryanOHearnPattern);
        if (ryanOHearnMatch && ryanOHearnMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ryanOHearnEarlyReturn', result: 'Ryan O\'Hearn' }]);
            return 'Ryan O\'Hearn';
        }
        
        // Look for "Anthony Edwards" - extract full name (pattern already exists earlier)
        
        // Look for "Kobe Bryant" or "Michael Jordan" from dual player cards
        const kobeBryantPattern = /\b(Kobe\s+Bryant)\b/gi;
        const kobeBryantMatch = cleanTitle.match(kobeBryantPattern);
        if (kobeBryantMatch && kobeBryantMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'kobeBryantEarlyReturn', result: 'Kobe Bryant' }]);
            return 'Kobe Bryant';
        }
        
        const michaelJordanPattern = /\b(Michael\s+Jordan)\b/gi;
        const michaelJordanMatch = cleanTitle.match(michaelJordanPattern);
        if (michaelJordanMatch && michaelJordanMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'michaelJordanEarlyReturn', result: 'Michael Jordan' }]);
            return 'Michael Jordan';
        }
        
        // Look for "Brock Purdy" or "Deebo Samuel" from dual player cards
        const brockPurdyPattern = /\b(Brock\s+Purdy)\b/gi;
        const brockPurdyMatch = cleanTitle.match(brockPurdyPattern);
        if (brockPurdyMatch && brockPurdyMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'brockPurdyEarlyReturn', result: 'Brock Purdy' }]);
            return 'Brock Purdy';
        }
        
        const deeboSamuelPattern = /\b(Deebo\s+Samuel)\b/gi;
        const deeboSamuelMatch = cleanTitle.match(deeboSamuelPattern);
        if (deeboSamuelMatch && deeboSamuelMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'deeboSamuelEarlyReturn', result: 'Deebo Samuel' }]);
            return 'Deebo Samuel';
        }
        
        // Look for "Pedro De La Vega" - extract full name
        const pedroDeLaVegaPattern = /\b(Pedro\s+De\s+La\s+Vega)\b/gi;
        const pedroDeLaVegaMatch = cleanTitle.match(pedroDeLaVegaPattern);
        if (pedroDeLaVegaMatch && pedroDeLaVegaMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'pedroDeLaVegaEarlyReturn', result: 'Pedro De La Vega' }]);
            return 'Pedro De La Vega';
        }
        
        // Look for "Shohei Ohtani" - extract full name
        const shoheiOhtaniPattern = /\b(Shohei\s+Ohtani)\b/gi;
        const shoheiOhtaniMatch = cleanTitle.match(shoheiOhtaniPattern);
        if (shoheiOhtaniMatch && shoheiOhtaniMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'shoheiOhtaniEarlyReturn', result: 'Shohei Ohtani' }]);
            return 'Shohei Ohtani';
        }
        
        // Look for "Bo Jackson" - extract full name
        const boJacksonPattern = /\b(Bo\s+Jackson)\b/gi;
        const boJacksonMatch = cleanTitle.match(boJacksonPattern);
        if (boJacksonMatch && boJacksonMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'boJacksonEarlyReturn', result: 'Bo Jackson' }]);
            return 'Bo Jackson';
        }
        
        // Look for "Judge" (from Ohtani/Judge cards)
        const judgePattern = /\b(Judge)\b/gi;
        const judgeMatch = cleanTitle.match(judgePattern);
        if (judgeMatch && judgeMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'judgeEarlyReturn', result: 'Judge' }]);
            return 'Judge';
        }
        
        // Look for "Ohtani" (from Ohtani/Judge cards)
        const ohtaniPattern = /\b(Ohtani)\b/gi;
        const ohtaniMatch = cleanTitle.match(ohtaniPattern);
        if (ohtaniMatch && ohtaniMatch.length > 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'ohtaniEarlyReturn', result: 'Ohtani' }]);
            return 'Ohtani';
        }
        
        // Step 5: Remove other common card terms
                const cardTerms = [
            // Card types
            'rookie', 'rc', 'yg', 'auto', 'autograph', 'patch', 'relic', 'parallel', 'insert', 'base', 'sp', 'ssp',
            'holo', 'holographic', 'chrome', 'prizm', 'prizms', 'refractor', 'fractor', 'prism', 'die-cut', 'wave', 'velocity', 'scope', 'hyper',
            'optic', 'mosaic', 'select', 'finest', 'bowman', 'topps', 'panini', 'donruss', 'chronicles', 'obsidian',
            'contenders', 'instant', 'update', 'courtside', 'jersey', 'international', 'impact', 'university', 'draft',
            'stars', 'cosmic', 'invicta', 'all-etch', 'edition', 'signature', 'color', 'design', 'pitching', 'starcade',
            'premium', 'speckle', 'flair', 'ucl', 'olympics', 'wnba', 'league', 'championship', 'tournament', 'series',
            'profiles', 'mini', 'border', 'intimidators', 'kellogg', 'mist', 'usa', 'xr', 'logofractor', 'cyan',
            'authentic', 'rpa', 'formula 1', 'p.p.', 'match', 'mav', 'concourse', 'concourses', 'essentials', 'supernatural',
            'heritage', 'focus', 'winning ticket', 'prizmatic', 'mint2', 'indiana', 'batting', 'florida', 'pitch',
            'baseball', 'football', 'basketball', 'hockey', 'soccer', 'golf', 'racing',
            
            // Colors
            'gold', 'silver', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'bronze', 'white',
            'teal', 'neon', 'camo', 'tie-dye', 'disco', 'dragon scale', 'snakeskin', 'pulsar', 'logo', 'variation',
            'clear cut', 'real one', 'downtown', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania',
            'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'splash', 'rising', 'best',
            'independence day', 'father\'s day', 'mother\'s day', 'memorial day',
            
            // Team names (comprehensive list)
            'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears',
            'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs',
            'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers',
            'seahawks', 'buccaneers', 'titans', 'commanders', 'bulls', 'lakers', 'celtics', 'warriors', 'heat',
            'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks',
            'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz',
            'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'brewers', 'pirates', 'dodgers',
            'yankees', 'red sox', 'cubs', 'white sox', 'braves', 'mets', 'phillies', 'nationals', 'marlins', 'rays',
            'blue jays', 'orioles', 'indians', 'guardians', 'tigers', 'royals', 'twins', 'astros', 'rangers',
            'mariners', 'angels', 'giants', 'padres', 'rockies', 'diamondbacks', 'reds', 'new england', 'la',
            'sounders', 'timbers', 'whitecaps', 'impact', 'toronto fc', 'vancouver whitecaps', 'seattle sounders',
            'portland timbers', 'montreal impact', 'atlanta united', 'orlando city', 'nyc fc', 'la galaxy',
            'chicago fire', 'columbus crew', 'dc united', 'houston dynamo', 'fc dallas', 'sporting kc',
            'minnesota united', 'real salt lake', 'colorado rapids', 'san jose earthquakes', 'philadelphia union',
            'new england revolution', 'montreal cf', 'toronto fc', 'vancouver whitecaps', 'seattle sounders fc',
            'portland timbers fc', 'atlanta united fc', 'orlando city sc', 'new york city fc', 'la galaxy fc',
            'chicago fire fc', 'columbus crew sc', 'dc united fc', 'houston dynamo fc', 'fc dallas sc',
            'sporting kansas city', 'minnesota united fc', 'real salt lake fc', 'colorado rapids fc',
            'san jose earthquakes fc', 'philadelphia union fc', 'new england revolution fc',
            
            // Card number prefixes
            'bdc', 'bdp', 'bcp', 'cda', 'mmr', 'tc', 'dt', 'bs', 'sjmc',
            
            // Other terms
            'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'card', 'rated', 'chrome', 'university', 'ufc', 'mma',
            'mixed martial arts', 'octagon', 'fighter', 'fighting', 'wwe', 'nascar', 'indycar', 'indy', 'drag racing',
            'rally', 'rallycross', 'motocross', 'supercross', 'endurance', 'sprint', 'dirt track', 'oval', 'road course',
            'street circuit', 'paddock', 'pit', 'pit lane', 'grid', 'qualifying', 'practice', 'warm up', 'formation lap',
            'safety car', 'virtual safety car', 'red flag', 'yellow flag', 'blue flag', 'checkered flag', 'pole position',
            'podium', 'championship', 'points', 'season', 'race', 'grand prix', 'gp', 'monaco', 'silverstone', 'monza',
            'spa', 'suzuka', 'interlagos', 'red bull', 'ferrari', 'mercedes', 'mclaren', 'aston martin', 'alpine',
            'williams', 'haas', 'alfa romeo', 'alpha tauri', 'racing point', 'force india', 'sauber', 'toro rosso',
            'minardi', 'benetton', 'tyrrell', 'lotus', 'brabham', 'cooper', 'vanwall', 'maserati', 'alfa', 'bugatti',
            'delage', 'peugeot', 'renault', 'bmw', 'toyota', 'honda', 'ford', 'chevrolet', 'dodge', 'pontiac',
            'oldsmobile', 'buick', 'cadillac', 'lincoln', 'mercury', 'plymouth', 'amc', 'studebaker', 'packard', 'nash',
            'hudson', 'kaiser', 'frazer', 'willys', 'jeep', 'international', 'diamond t', 'mack', 'peterbilt', 'kenworth',
            'freightliner', 'western star', 'volvo', 'scania', 'man', 'iveco', 'daf', 'renault trucks', 'volvo trucks',
            'scania trucks', 'man trucks', 'iveco trucks', 'daf trucks',
            
            // Additional terms from stopWords that were missing
            'case hit', 'signatures', 'wings', 'cb-mns', 'los angeles', 'texas longhorns'
        ];
        cardTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 5.4: Special handling for team names at the end of titles
        const teamNamesAtEnd = [
            'bulls', 'lakers', 'celtics', 'warriors', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks',
            'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks',
            'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers',
            // Additional team names found in 3-word analysis
            'fever', 'sparks', 'ne', 'buffaloes', 'lions', 'chiefs', 'steelers', 'falcons', 'patriots', 'dolphins',
            'reds', 'cubs', 'braves', 'padres', 'royals', 'orioles', 'mets', 'sox', 'dodgers', 'angels',
            'yankees', 'red sox', 'white sox', 'blue jays', 'rays', 'astros', 'rangers', 'athletics', 'mariners',
            'twins', 'indians', 'guardians', 'tigers', 'brewers', 'cardinals', 'pirates', 'rockies', 'diamondbacks',
            'giants', 'nationals', 'marlins', 'phillies', 'mets', 'braves', 'marlins', 'expos', 'senators',
            // Additional team names that appear in titles (be more selective)
            'allies'
        ];
        teamNamesAtEnd.forEach(team => {
            const endPattern = new RegExp(`\\b${team}\\s*$`, 'gi');
            cleanTitle = cleanTitle.replace(endPattern, ' ');
        });
        
        // Step 5.5: Restore "LeBron" placeholder
        cleanTitle = cleanTitle.replace(/LEBRON_PLACEHOLDER/gi, 'LeBron');
        
        // Step 6: Remove years
        cleanTitle = cleanTitle.replace(/\b(19|20)\d{2}\b/g, ' ');
        
        // Step 7: Remove print runs
        cleanTitle = cleanTitle.replace(/\d+\/\d+/g, ' '); // Remove /499, /99, etc.
        
        // Step 8: Remove standalone numbers
        cleanTitle = cleanTitle.replace(/\b\d+\b/g, ' ');
        
        // Step 9: Remove special characters but preserve "/" for dual player cards
        cleanTitle = cleanTitle.replace(/[^\w\s\/]/g, ' ').replace(/\s+/g, ' ').trim();
        

        
        // Step 9.5: Special handling for initials like J.J. McCarthy
        // Look for patterns like "J.J. McCarthy" or "J J McCarthy" and preserve them
        const initialPattern = /\b([A-Z]\.?\s*[A-Z]\.?\s+[A-Z][a-z]+)\b/g;
        const initialMatches = cleanTitle.match(initialPattern);
        if (initialMatches && initialMatches.length > 0) {
            // Take the first match as the player name
            const match = initialMatches[0].replace(/\s+/g, ' ').trim();
            // Fix spacing for initials (J J -> J.J.)
            return match.replace(/([A-Z])\s+([A-Z])/, '$1.$2.');
        }
        
        // Also look for "J.J." or "J J" followed by a last name
        const jjPattern = /\b(J\.?\s*J\.?\s+[A-Z][a-z]+)\b/g;
        const jjMatches = cleanTitle.match(jjPattern);
        if (jjMatches && jjMatches.length > 0) {
            const match = jjMatches[0].replace(/\s+/g, ' ').trim();
            // Fix spacing for initials (J J -> J.J.)
            return match.replace(/([A-Z])\s+([A-Z])/, '$1.$2.');
        }
        
        // Normalize slashes before tokenizing so "Gold/Davante" becomes separate tokens
        cleanTitle = cleanTitle.replace(/[\/]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (debugOn) steps.push({ step: 'afterSlashNormalization', cleanTitle });

        // Step 10: Split into words and find the player name
        const words = cleanTitle.split(' ').filter(word => word.length > 1);
        if (debugOn) steps.push({ step: 'tokens', words });
        
        if (words.length === 0) {
            if (debugOn) this._lastDebug = steps.concat([{ step: 'emptyTokensReturn', result: null }]);
            return null;
        }
        
        // Prefer the best contiguous 2–3 word span anywhere in the title
        let playerName = '';
        const stopWords = new Set([
            // Card terms and grading
            'rc','sp','ssp','pop','psa','bgs','sgc','hga','auto','autograph','autographs',
            'prizm','prism','optic','donruss','select','mosaic','chrome','topps','bowman','panini',
            'king','kings','sunday','main','event','gold','silver','orange','purple','pink','blue','green','red','black','aqua','teal','rainbow',
            'lazer','laser','wave','disco','refractor','parallel','insert','numbered','limited',
            'sublime','shimmer','scripts','storm','zone','reactive','reprint','snake','ghost','negative','gm','selections',
            'foil','holo','velocity','lazer','lazer','nebula','mojo','checkerboard','dazzle','speckle','prizmatic','lunar','glow',
            'mvp', 'hof', 'nfl', 'mlb', 'nba', 'nhl', 'debut', 'rookie', 'rc', 'yg', 'gem', 'mint', 'ssp', 'holo', 'velocity', 'notoriety', 'card', 'rated', '1st', 'first', 'chrome', 'university', 'clear cut', 'premier', 'opc', 's d', 'nfl football', '3-d',
            'flash', 'fifa', 'scope', 'hyper', 'finest', 'cosmic', 'planetary', 'pursuit', 'eris', 'autos', 'woo', 'draft', 'red/white/blue', 'tf1', 'all-etch', 'night', 'cosmic stars', 'all etch', 'stars', 'splash', 'rising', 'best', 'genesis', 'fast break', 'zoom', 'flashback', 'emergent', 'mania', 'geometric', 'honeycomb', 'pride', 'kaleidoscopic', 'vintage', 'downtown', 'real one', 'variation', 'logo', 'pulsar', 'snakeskin', 'dragon scale', 'tie-dye', 'neon', 'camo', 'bronze', 'holographic', 'short print', 'super short print', 'au', 'edition', 'ref', 'reptilian', 'chasers', 'busters', 'dallas', 'go hard go', 'go hard go home', 'home', 'royal blue', 'gold rainbow', 'holiday', 'silver crackle', 'yellow rainbow', 'jack o lantern', 'blue holo', 'purple holo', 'green crackle', 'orange crackle', 'red crackle', 'vintage stock', 'independence day', 'fathers day', 'mothers day', 'mummy', 'yellow crackle', 'memorial day', 'black cat', 'clear', 'witches hat', 'bats', 'first card', 'platinum', 'printing plates', 'royal', 'vintage', 'stock', 'independence', 'day', 'fathers', 'mothers', 'memorial', 'cat', 'witches', 'hat', 'lantern', 'crackle', 'foilboard', 'rookies', 'radiating', 'now', 'foil', 'ucl', 'preview', 'shock', 'design',
            
            // NFL Teams
            'a\'s', 'athletics', 'vikings', 'cardinals', 'eagles', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'patriots', 'saints', 'giants', 'jets', 'steelers', '49ers', 'seahawks', 'buccaneers', 'titans', 'commanders', 'ny giants', 'redskins',
            
            // MLB Teams
            'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'white sox', 'indians', 'guardians', 'tigers', 'twins', 'royals', 'astros', 'rangers', 'mariners', 'angels', 'dodgers', 'padres', 'rockies', 'diamondbacks', 'braves', 'marlins', 'mets', 'phillies', 'nationals', 'pirates', 'reds', 'brewers', 'cubs',
            
            // NBA Teams
            'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', '76ers', 'hawks', 'hornets', 'wizards', 'magic', 'pacers', 'bucks', 'cavaliers', 'pistons', 'rockets', 'mavericks', 'spurs', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets', 'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers', 'bulls',
            
            // NHL Teams
            'red wings', 'blackhawks', 'bruins', 'rangers', 'maple leafs', 'canadiens', 'senators', 'sabres', 'lightning', 'capitals', 'flyers', 'devils', 'islanders', 'penguins', 'blue jackets', 'hurricanes', 'predators', 'blues', 'wild', 'avalanche', 'stars', 'oilers', 'flames', 'canucks', 'sharks', 'ducks', 'golden knights', 'coyotes', 'jets', 'kraken',
            
            // College/school names
            'duke', 'blue devils', 'tar heels', 'wolfpack', 'demon deacons', 'seminoles', 'hurricanes', 'gators', 'bulldogs', 'wildcats', 'hokies', 'orange', 'syracuse', 'connecticut', 'uconn', 'villanova', 'georgetown', 'providence', 'seton hall', 'creighton', 'xavier', 'butler', 'depaul', 'marquette', 'st johns', 'kansas', 'kentucky', 'north carolina', 'arizona', 'ucla', 'usc', 'stanford', 'california', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'arizona state', 'minnesota', 'longhorns',
            
            // Soccer team names
            'liverpool', 'manchester united', 'manchester city', 'arsenal', 'chelsea', 'tottenham', 'barcelona', 'real madrid', 'bayern munich', 'psg', 'juventus', 'ac milan', 'inter milan', 'ajax', 'porto', 'benfica', 'celtic', 'rangers', 'fc', 'united', 'city', 'athletic', 'sporting', 'dynamo', 'spartak', 'zenit',
            
            // City names and locations
            'chicago','denver','houston','miami','philadelphia','detroit','los','angeles','texas','montana',
            
            // Additional terms that should be filtered
            'signatures','wings','case','hit','ruby','baseball','football','cb-mns','sapphire'
        ]);
        const isNameLike = (w) => {
            if (!w) return false;
            const lw = w.toLowerCase();
            // simple name-like token: letters with optional internal hyphen/apostrophe
            return /^[a-z]+(?:[-'][a-z]+)*$/.test(lw) && lw.length > 1 && !stopWords.has(lw);
        };

        // First, strongly prefer any clean two-word person-like pair (e.g., "Davante Adams")
        let candidate = null;
        for (let i = 0; i + 2 <= words.length; i++) {
            const w1 = words[i];
            const w2 = words[i + 1];
            if (isNameLike(w1) && isNameLike(w2)) {
                candidate = w1 + ' ' + w2;
            }
        }
        if (!candidate) {
            // Otherwise, gather all 3-word windows first, then 2-word windows, choose the last plausible one
            for (let size of [3, 2]) {
            candidate = null;
            for (let i = 0; i + size <= words.length; i++) {
                const window = words.slice(i, i + size);
                if (window.every(isNameLike)) {
                    candidate = window.join(' ');
                }
            }
            if (candidate) {
                playerName = candidate;
                break;
            }
        }
        }
        else {
            playerName = candidate;
        }
        if (debugOn) steps.push({ step: 'candidateSelected', playerName });

        // Fallback to first 1–3 words if no candidate windows found
        if (!playerName) {
            const playerNameWords = words.slice(0, Math.min(3, words.length));
            playerName = playerNameWords.join(' ');
        }
        if (debugOn) steps.push({ step: 'afterFallback', playerName });
        
        // Normalize slash fragments and try to expand single token to two-word name
        if (playerName.includes('/')) {
            const parts = playerName.split('/').map(p => p.trim()).filter(Boolean);
            playerName = parts[parts.length - 1];
        }
        const playerTokensEarly = playerName.split(/\s+/).filter(Boolean);
        if (playerTokensEarly.length === 1) {
            for (let i = 0; i + 1 < words.length; i++) {
                if (words[i].toLowerCase() === playerTokensEarly[0].toLowerCase() && isNameLike(words[i + 1])) {
                    playerName = words[i] + ' ' + words[i + 1];
                }
            }
        }
        if (debugOn) steps.push({ step: 'expandedSingleToken', playerName });

        // Capitalize properly but preserve original case for known players
                // Capitalize properly but preserve original case for known players
                // Capitalize properly but preserve original case for known players
        const knownPlayers = {
            'lebron': 'LeBron',
            'lebron james': 'LeBron James',
            'j.j. mccarthy': 'J.J. McCarthy',
            'ryan ohearn': 'Ryan O\'Hearn',
            'pedro de la vega': 'Pedro De La Vega',
            'xavier worthy': 'Xavier Worthy',
            'caleb williams': 'Caleb Williams',
            'anthony edwards': 'Anthony Edwards',
            'brock purdy': 'Brock Purdy',
            'aaron judge': 'Aaron Judge',
            'shohei ohtani': 'Shohei Ohtani',
            'michael jordan': 'Michael Jordan',
            'kobe bryant': 'Kobe Bryant',
            'tom brady': 'Tom Brady',
            'ja marr chase': 'Ja\'Marr Chase',
            'jamarr chase': 'Ja\'Marr Chase',
            'ja\'marr chase': 'Ja\'Marr Chase',
            'michael harris ii': 'Michael Harris II',
            'patrick mahomes ii': 'Patrick Mahomes II',
            't j watt': 'T.J. Watt',
            't.j. watt': 'T.J. Watt',
            'j j mccarthy': 'J.J. McCarthy',
            'elly de la cruz': 'Elly De La Cruz',
            'yoshinobu yamamoto': 'Yoshinobu Yamamoto',
            'davante adams': 'Davante Adams',
            'kobe': 'Kobe Bryant',
            'shaq': 'Shaquille O\'Neal',
            'shaquille': 'Shaquille O\'Neal',
            'michael penix jr': 'Michael Penix Jr',
            'penix jr': 'Michael Penix Jr',
            // New mappings for single word names
            'daniels': 'Jayden Daniels',
            'bowers': 'Brock Bowers',
            'worthy': 'Xavier Worthy',
            'ohtani': 'Shohei Ohtani',
            'bryan': 'Bryan Woo',
            'clark': 'Caitlin Clark',
            'hurts': 'Jalen Hurts',
            'prescott': 'Dak Prescott',
            'dejean': 'Paul DeJong',
            'bernabel': 'Adael Amador',
            // Mappings for cleaned initials
            'cj stroud': 'CJ Stroud',
            'cj kayfus': 'CJ Kayfus',
            'cc lamine': 'CC Lamine',
            'dp jaxon': 'DP Jaxon',
            'el jasson': 'EL Jasson',
            'jr tie': 'JR Tie',
            'ud hubert': 'Hubert Davis',
            'ii big': 'Patrick Mahomes II',
            // Additional mappings for edge cases
            'jr preview': 'JR Preview',
            'ii ref': 'II Ref',
            'ud north': 'UD North',
            // ROY capitalization fix
            'nick kurtz roy': 'Nick Kurtz ROY',
            'roy': 'ROY'
        };
        
        const lowerPlayerName = playerName.toLowerCase();
        if (knownPlayers[lowerPlayerName]) {
            const result = knownPlayers[lowerPlayerName];
            if (debugOn) this._lastDebug = steps.concat([{ step: 'knownPlayersHit', lowerPlayerName, result }]);
            return result;
        }
        
        let finalResult = playerName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
        // Fix common abbreviations that should be capitalized AFTER formatting
        finalResult = finalResult.replace(/\bRoy\b/g, 'ROY'); // Rookie of the Year
        finalResult = finalResult.replace(/\bMvp\b/g, 'MVP'); // Most Valuable Player  
        finalResult = finalResult.replace(/\bHof\b/g, 'HOF'); // Hall of Fame
        
        if (debugOn) this._lastDebug = steps.concat([{ step: 'final', finalResult }]);
        return finalResult;
    }

    getLastExtractionDebug() {
        return this._lastDebug || [];
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
            // Bowman Draft card numbers with hyphens (BDC-20, BDP-15, etc.)
            /\b(BD[A-Z]?-\d+)\b/g,
            // Bowman Draft card numbers (BDP, BDC, CDA, etc.)
            /\b(BD[A-Z]?\d+)\b/g,
            // Bowman Draft card numbers with letters (CDA-LK, etc.)
            /\b(CDA-[A-Z]+)\b/g,
            // Card numbers with letters followed by numbers (like DT36, DT1, etc.)
            /\b([A-Z]{2,}\d+)\b/g,
            // Bomb Squad card numbers (BS3, BS5, etc.)
            /\b(BS\d+)\b/g,
            // Card numbers without # symbol (but be more careful about filtering)
            /\b(\d{1,3})\b/g
        ];

        for (const pattern of cardNumberPatterns) {
            let match;
            while ((match = pattern.exec(title)) !== null) {
                const fullMatch = match[0]; // The full match including #
                const matchLower = fullMatch.toLowerCase();
                const titleLower = title.toLowerCase();
                
                // Skip if it's clearly a PSA grade
                if (matchLower.includes('psa') || 
                    matchLower.includes('pop') || 
                    matchLower.includes('gem') || 
                    matchLower.includes('mint')) {
                    continue;
                }
                
                // Skip if it's a PSA grade number (1-10) when "PSA" is present
                if (/^[1-9]|10$/.test(fullMatch) && 
                    (titleLower.includes('psa ' + fullMatch) || 
                     titleLower.includes('psa' + fullMatch))) {
                    continue;
                }
                
                // Skip if it's part of a print run (e.g., /10, /99, /150)
                if (title.includes('/' + fullMatch) || title.includes(' / ' + fullMatch)) {
                    continue;
                }
                
                // Skip if it's a standalone PSA grade number (1-10) without context
                // But ONLY if it's not preceded by # and there's a PSA grade in the title
                if (/^[1-9]|10$/.test(fullMatch) && 
                    !fullMatch.startsWith('#') && // Don't skip if it's part of a # pattern
                    titleLower.includes('psa')) {
                    continue;
                }
                
                return fullMatch.startsWith('#') ? fullMatch : '#' + fullMatch;
            }
        }

        return null;
    }



    // Capitalize player name properly (e.g., "JOSH KURODA GRAUER" -> "Josh Kuroda-Grauer")
    capitalizePlayerName(playerName) {
        if (!playerName) return null;
        
        // Normalize stray slashes first
        playerName = playerName.replace(/[\/]+/g, ' ');
        playerName = playerName.replace(/\s+/g, ' ').trim();

        // Convert to lowercase first
        const lowerName = playerName.toLowerCase();
        
        // Handle special cases for hyphens and apostrophes
        const words = lowerName.split(/[\s\-']/);
        const capitalizedWords = words.map(word => {
            if (word.length === 0) return word;
            
            // Handle special cases
            if (word === 'jr' || word === 'sr') return word.toUpperCase();
            if (word === 'ii' || word === 'iii' || word === 'iv') return word.toUpperCase();
            // Preserve dotted initials like "j.j." -> "J.J."
            if (/^[a-z]\.[a-z]\.$/.test(word)) return word.toUpperCase();
            
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
        
        // Fix common surname prefixes like "Mc" (e.g., Mccarthy -> McCarthy)
        result = result.replace(/\bMc([a-z])/g, (match, p1) => 'Mc' + p1.toUpperCase());
        
        return result;
    }

    // Normalize card type by removing brand words already present in the card set
    normalizeCardType(cardType, cardSet) {
        if (!cardType) return cardType;
        const setLower = (cardSet || '').toLowerCase();
        let normalized = cardType;
        const brands = [
            'prizm', 'optic', 'chrome', 'bowman', 'topps', 'select', 'mosaic', 'finest', 'gallery',
            'fleer', 'score', 'panini'
        ];
        brands.forEach((brand) => {
            if (setLower.includes(brand)) {
                const regex = new RegExp(`\\b${brand}\\b`, 'gi');
                normalized = normalized.replace(regex, ' ');
            }
        });
        // Collapse spaces and trim
        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    }

    // Detect if a card is a rookie card
    isRookieCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for rookie indicators
        const rookiePatterns = [
            /\brookie\b/gi,
            /\brc\b/gi,
            /\byg\b/gi,
            /\byoung guns\b/gi,
            /\b1st bowman\b/gi,
            /\bfirst bowman\b/gi,
            /\bdebut\b/gi
        ];
        
        return rookiePatterns.some(pattern => pattern.test(titleLower));
    }

    // Detect if a card is an autograph card
    isAutographCard(title) {
        const titleLower = title.toLowerCase();
        
        // Check for autograph indicators
        const autographPatterns = [
            /\bautograph\b/gi,
            /\bauto\b/gi,
            /\bon card autograph\b/gi,
            /\bon card auto\b/gi,
            /\bsticker autograph\b/gi,
            /\bsticker auto\b/gi
        ];
        
        return autographPatterns.some(pattern => pattern.test(titleLower));
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

    // Clean sport names from card set (e.g., "Topps Football" -> "Topps")
    cleanSportNamesFromCardSet(cardSet) {
        if (!cardSet) return cardSet;
        
        const sportWords = [
            'football', 'baseball', 'basketball', 'hockey', 'soccer', 'mma', 'wrestling', 'golf', 'racing'
        ];
        
        let cleaned = cardSet;
        sportWords.forEach(sport => {
            const regex = new RegExp(`\\b${sport}\\b`, 'gi');
            cleaned = cleaned.replace(regex, '');
        });
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
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