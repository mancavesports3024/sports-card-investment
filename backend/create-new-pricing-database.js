const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class NewPricingDatabase {
    constructor() {
        // Use the new database for Railway deployment
        this.pricingDbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.comprehensiveDbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
        this.pricingDb = null;
        this.comprehensiveDb = null;
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
                ebay_item_id TEXT,
                image_url TEXT,
                search_term TEXT,
                source TEXT DEFAULT '130point_auto',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_title ON cards(title)',
            'CREATE INDEX IF NOT EXISTS idx_summary_title ON cards(summary_title)',
            'CREATE INDEX IF NOT EXISTS idx_sport ON cards(sport)',
            'CREATE INDEX IF NOT EXISTS idx_year ON cards(year)',
            'CREATE INDEX IF NOT EXISTS idx_brand ON cards(brand)',
            'CREATE INDEX IF NOT EXISTS idx_created_at ON cards(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_last_updated ON cards(last_updated)'
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

    // Enhanced sport detection using comprehensive database and keyword analysis
    async detectSportFromComprehensive(title) {
        console.log(`🔍 Detecting sport for: "${title}"`);
        
        // First try to find a match in the comprehensive database
        if (this.comprehensiveDb) {
            try {
                const cleanTitle = this.cleanSummaryTitle(title).toLowerCase();
                console.log(`🧹 Cleaned title: "${cleanTitle}"`);
                
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
                    console.log(`🏈 Found sport match in comprehensive DB: ${result.sport} for "${cleanTitle}"`);
                    return result.sport;
                } else {
                    console.log(`❌ No comprehensive DB match found for "${cleanTitle}"`);
                }
            } catch (error) {
                console.warn('⚠️ Error querying comprehensive database:', error.message);
            }
        } else {
            console.log('ℹ️ No comprehensive database available');
        }
        
        // Fall back to keyword detection
        const keywordSport = this.detectSportFromKeywords(title);
        console.log(`🔤 Keyword detection result: ${keywordSport}`);
        return keywordSport;
    }

    detectSportFromKeywords(title) {
        const titleLower = title.toLowerCase();
        
        // Pokemon detection
        if (titleLower.includes('pokemon') || titleLower.includes('pikachu') || titleLower.includes('charizard') || 
            titleLower.includes('moltres') || titleLower.includes('zapdos') || titleLower.includes('articuno') ||
            titleLower.includes('gx') || titleLower.includes('sm210')) {
            return 'Pokemon';
        }
        
        // Sports detection - check for team names and positions first
        if (titleLower.includes('bears') || titleLower.includes('packers') || titleLower.includes('cowboys') || 
            titleLower.includes('patriots') || titleLower.includes('steelers') || titleLower.includes('49ers') ||
            titleLower.includes('football') || titleLower.includes('nfl') || titleLower.includes('qb') || 
            titleLower.includes('quarterback') || titleLower.includes('running back') || titleLower.includes('wide receiver') ||
            titleLower.includes('tight end') || titleLower.includes('defensive') || titleLower.includes('linebacker') ||
            titleLower.includes('caleb williams') || titleLower.includes('drake maye') || titleLower.includes('bo nix')) {
            return 'Football';
        }
        if (titleLower.includes('lakers') || titleLower.includes('celtics') || titleLower.includes('bulls') ||
            titleLower.includes('warriors') || titleLower.includes('heat') || titleLower.includes('knicks') ||
            titleLower.includes('basketball') || titleLower.includes('nba') || titleLower.includes('point guard') || 
            titleLower.includes('shooting guard') || titleLower.includes('small forward') || titleLower.includes('power forward') ||
            titleLower.includes('center') || titleLower.includes('forward') || titleLower.includes('guard') ||
            titleLower.includes('shaquille o\'neal') || titleLower.includes('shaq') || titleLower.includes('victor wembanyama') ||
            titleLower.includes('orlando magic') || titleLower.includes('magic team')) {
            return 'Basketball';
        }
        if (titleLower.includes('dodgers') || titleLower.includes('yankees') || titleLower.includes('red sox') ||
            titleLower.includes('cubs') || titleLower.includes('giants') || titleLower.includes('cardinals') ||
            titleLower.includes('baseball') || titleLower.includes('mlb') || titleLower.includes('pitcher') || 
            titleLower.includes('hitter') || titleLower.includes('outfielder') || titleLower.includes('infielder') ||
            titleLower.includes('catcher') || titleLower.includes('shortstop') || titleLower.includes('first base') ||
            titleLower.includes('second base') || titleLower.includes('third base') ||
            titleLower.includes('shohei ohtani') || titleLower.includes('gunnar henderson') || titleLower.includes('elly de la cruz')) {
            return 'Baseball';
        }
        if (titleLower.includes('blackhawks') || titleLower.includes('bruins') || titleLower.includes('rangers') ||
            titleLower.includes('hockey') || titleLower.includes('nhl') || titleLower.includes('goalie') ||
            titleLower.includes('goaltender') || titleLower.includes('defenseman') || titleLower.includes('forward') ||
            titleLower.includes('auston matthews')) {
            return 'Hockey';
        }
        if (titleLower.includes('soccer') || titleLower.includes('fifa') || titleLower.includes('premier league') ||
            titleLower.includes('manchester') || titleLower.includes('barcelona') || titleLower.includes('real madrid')) {
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
        
        return 'Unknown';
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

    async addCard(cardData) {
        try {
            // Detect sport using comprehensive database
            const sport = await this.detectSportFromComprehensive(cardData.title);
            
            // Extract year from title
            const yearMatch = cardData.title.match(/(19|20)\d{2}/);
            const year = yearMatch ? parseInt(yearMatch[0]) : null;
            
            // Extract brand and set info
            const brandInfo = this.extractBrandAndSet(cardData.title);
            
            const query = `
                INSERT INTO cards (
                    title, summary_title, sport, year, brand, set_name, 
                    card_type, condition, grade, psa10_price, search_term, 
                    source, ebay_item_id, image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                cardData.title,
                this.cleanSummaryTitle(cardData.title),
                sport,
                year,
                brandInfo.brand,
                brandInfo.setName,
                this.detectCardType(cardData.title),
                'Raw',
                'PSA 10',
                cardData.price?.value || cardData.price,
                cardData.searchTerm || 'auto_search',
                cardData.source || '130point_auto',
                cardData.ebayItemId || null,
                cardData.imageUrl || null
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

    async close() {
        if (this.pricingDb) {
            this.pricingDb.close();
            console.log('✅ New pricing database connection closed');
        }
        if (this.comprehensiveDb) {
            this.comprehensiveDb.close();
            console.log('✅ Comprehensive database connection closed');
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
