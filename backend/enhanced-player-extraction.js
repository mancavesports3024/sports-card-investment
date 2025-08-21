const NewPricingDatabase = require('./create-new-pricing-database.js');

class EnhancedPlayerExtraction {
    constructor() {
        this.db = new NewPricingDatabase();
        
        // Enhanced filtering lists based on ESPN API failures
        this.sportTerms = [
            // Wrestling
            'wwe', 'wwf', 'wrestling', 'wrestler', 'aew', 'impact', 'tna',
            
            // Racing
            'formula', 'f1', 'formula 1', 'nascar', 'indycar', 'racing', 'grand prix',
            
            // Basketball
            'wnba', 'nba', 'basketball', 'college basketball',
            
            // Football
            'nfl', 'football', 'college football', 'xfl', 'usfl',
            
            // Baseball
            'mlb', 'baseball', 'minor league', 'major league',
            
            // Hockey
            'nhl', 'hockey', 'ahl',
            
            // Soccer
            'soccer', 'fifa', 'premier league', 'mls', 'ucl', 'uefa',
            
            // Golf
            'pga', 'liv golf', 'golf',
            
            // UFC/MMA
            'ufc', 'mma', 'mixed martial arts', 'fighting',
            
            // Pokemon
            'pokemon', 'pokémon'
        ];
        
        this.cardTypes = [
            // Panini card types
            'prizm', 'mosaic', 'optic', 'select', 'finest', 'chrome', 'sapphire',
            'update', 'refractor', 'rated', 'retro', 'choice', 'wave', 'scope',
            'pulsar', 'genesis', 'firestorm', 'emergent', 'essentials', 'uptown',
            'uptowns', 'logo', 'lightboard', 'planetary', 'pursuit', 'mars',
            'premium', 'box', 'set', 'pitch', 'prodigies', 'image', 'clear',
            'cut', 'premier', 'young', 'guns', 'star', 'starquest', 'tint',
            'pandora', 'allies', 'apex', 'on', 'iconic', 'knows', 'classic',
            'events', 'edition', 'cc', 'mint2', 'kellogg', 'atl', 'colorado',
            'picks', 'sky', 'winning ticket', 'focus', 'stadium', 'checkerboard',
            'radiant', 'supernatural', 'royalty', 'hoops', 'concourse', 'huddle',
            'design', 'color', 'premium box set', 'tectonic', 'euro', 'heritage',
            'collection', 'composite', 'japanese', 'aquapolis', 'sword shield',
            'hacksaw', 'color blast', 'david robinson', 'tyreek hill', 'pitching',
            'speckle', 'miami', 'montana rice', 'ohtani judge', 'ja marr chase',
            'booker', 'arda guler', 'kris draper', 'walter payton', 'josh adamczewski',
            'vladi guerrero', 'club', 'esteban ocon', 'big', 'de von achane',
            'nix denver', 'warming bernabel', 'aaron judge catching', 'liv brooks koepka',
            'kris draper detroit', 'spencer rattler explosive', 'drake maye new',
            'victor wembanyama supernatural', 'shedeur sanders buffaloes', 'x2001 helmet heroes',
            'ladd mcconkey vision', 'overdrive nikola jokic', 'heritage vladimir guerrero',
            'collection francisco lindor', 'wyatt langford q0902', 'composite tom brady',
            'pokemon japanese stormfront', 'pokemon aquapolis tyranitar', 'pokemon sword shield',
            'wwe hacksaw jim', 'nabers color blast', 'royalty victor wembanyama',
            'hoops david robinson', 'concourse josh allen', 'concourse tyreek hill',
            'pitching shohei ohtani', 'jacob misiorowski speckle', 'huddle miami',
            'julio rodriguez design', 'wwe roman reigns', 'nix color', 'walter payton chicago',
            'montana rice', 'ohtani judge', 'ja marr chase', 'premium box set',
            'booker tectonic', 'kobe bryant michael', 'euro arda guler', 'kris draper detroit',
            'premium box set', 'kris draper detroit'
        ];
        
        this.cityTeamTerms = [
            // Major cities
            'chicago', 'detroit', 'miami', 'denver', 'buffalo', 'new york', 'los angeles',
            'boston', 'dallas', 'houston', 'phoenix', 'portland', 'sacramento', 'minneapolis',
            'oklahoma city', 'salt lake city', 'memphis', 'new orleans', 'san antonio',
            'orlando', 'atlanta', 'charlotte', 'washington', 'cleveland', 'indianapolis',
            'milwaukee', 'philadelphia', 'brooklyn', 'toronto', 'montreal', 'vancouver',
            'calgary', 'edmonton', 'winnipeg', 'ottawa', 'quebec', 'seattle', 'las vegas',
            'nashville', 'columbus', 'pittsburgh', 'st louis', 'kansas city', 'cincinnati',
            'baltimore', 'jacksonville', 'tampa bay', 'carolina', 'arizona', 'tennessee',
            'buffaloes', 'colorado', 'atlanta', 'colorado'
        ];
        
        this.cardDescriptions = [
            'pitching', 'catching', 'hitting', 'batting', 'fielding', 'running',
            'throwing', 'swinging', 'dunking', 'shooting', 'passing', 'rushing',
            'tackling', 'blocking', 'kicking', 'scoring', 'defending', 'attacking',
            'goalie', 'goaltender', 'defenseman', 'forward', 'center', 'guard',
            'quarterback', 'running back', 'wide receiver', 'tight end', 'linebacker',
            'cornerback', 'safety', 'pitcher', 'catcher', 'shortstop', 'first base',
            'second base', 'third base', 'outfielder', 'infielder', 'designated hitter',
            'dh', 'rookie', 'rc', 'veteran', 'all star', 'mvp', 'champion', 'winner',
            'supernatural', 'radiant', 'royalty', 'focus', 'stadium', 'checkerboard',
            'color blast', 'tectonic', 'speckle', 'explosive', 'new', 'vision',
            'overdrive', 'heritage', 'collection', 'composite', 'japanese', 'stormfront',
            'aquapolis', 'sword shield', 'helmet heroes', 'buffaloes', 'q0902'
        ];
        
        this.alphanumericCodes = [
            // Card number patterns
            'q0902', 'x2001', 'cda', 'bdc', 'bdp', 'bcp', 'roh', 'cpanr', 'cpank', 'cpanp',
            'uv15', 'dt36', 'ce14', 'sg5', 'mj9', 'bdc13', 'rs-sga', 'cra-aj', 'cra-aj',
            'rs sga', 'mmr', 'tc', 'dt', 'bs', 'sjmc'
        ];
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    enhancedExtractPlayerName(title) {
        // Use the original extraction as a base
        let playerName = this.db.extractPlayerName(title);
        
        if (!playerName) {
            return null;
        }
        
        // Only apply very specific fixes to known problematic patterns
        let cleanPlayerName = playerName;
        let needsUpdate = false;
        
        // Remove sport terms from the beginning ONLY
        const sportPrefixes = [
            /^wwe\s+/gi,
            /^wwf\s+/gi,
            /^formula\s+/gi,
            /^f1\s+/gi,
            /^wnba\s+/gi,
            /^nba\s+/gi,
            /^nfl\s+/gi,
            /^mlb\s+/gi,
            /^nhl\s+/gi,
            /^soccer\s+/gi,
            /^fifa\s+/gi,
            /^pga\s+/gi,
            /^ufc\s+/gi,
            /^mma\s+/gi,
            /^pokemon\s+/gi,
            /^pokémon\s+/gi
        ];
        
        sportPrefixes.forEach(pattern => {
            if (pattern.test(cleanPlayerName)) {
                cleanPlayerName = cleanPlayerName.replace(pattern, '');
                needsUpdate = true;
            }
        });
        
        // Remove city names from the end ONLY
        const citySuffixes = [
            /\s+chicago$/gi,
            /\s+detroit$/gi,
            /\s+denver$/gi,
            /\s+miami$/gi,
            /\s+new york$/gi,
            /\s+los angeles$/gi,
            /\s+boston$/gi,
            /\s+dallas$/gi,
            /\s+houston$/gi,
            /\s+phoenix$/gi,
            /\s+portland$/gi,
            /\s+sacramento$/gi,
            /\s+minneapolis$/gi,
            /\s+oklahoma city$/gi,
            /\s+salt lake city$/gi,
            /\s+memphis$/gi,
            /\s+new orleans$/gi,
            /\s+san antonio$/gi,
            /\s+orlando$/gi,
            /\s+atlanta$/gi,
            /\s+charlotte$/gi,
            /\s+washington$/gi,
            /\s+cleveland$/gi,
            /\s+indianapolis$/gi,
            /\s+milwaukee$/gi,
            /\s+philadelphia$/gi,
            /\s+brooklyn$/gi,
            /\s+toronto$/gi,
            /\s+montreal$/gi,
            /\s+vancouver$/gi,
            /\s+calgary$/gi,
            /\s+edmonton$/gi,
            /\s+winnipeg$/gi,
            /\s+ottawa$/gi,
            /\s+quebec$/gi,
            /\s+seattle$/gi,
            /\s+las vegas$/gi,
            /\s+nashville$/gi,
            /\s+columbus$/gi,
            /\s+pittsburgh$/gi,
            /\s+st louis$/gi,
            /\s+kansas city$/gi,
            /\s+cincinnati$/gi,
            /\s+baltimore$/gi,
            /\s+jacksonville$/gi,
            /\s+tampa bay$/gi,
            /\s+carolina$/gi,
            /\s+arizona$/gi,
            /\s+tennessee$/gi,
            /\s+colorado$/gi
        ];
        
        citySuffixes.forEach(pattern => {
            if (pattern.test(cleanPlayerName)) {
                cleanPlayerName = cleanPlayerName.replace(pattern, '');
                needsUpdate = true;
            }
        });
        
        // Remove specific problematic terms from the end
        const problematicSuffixes = [
            /\s+supernatural$/gi,
            /\s+pitching$/gi,
            /\s+catching$/gi,
            /\s+new$/gi,
            /\s+color$/gi,
            /\s+design$/gi,
            /\s+vision$/gi,
            /\s+explosive$/gi,
            /\s+buffaloes$/gi,
            /\s+usa$/gi,
            /\s+tom$/gi,
            /\s+lewis$/gi,
            /\s+big$/gi,
            /\s+club$/gi,
            /\s+nix$/gi,
            /\s+liv$/gi,
            /\s+euro$/gi,
            /\s+warming$/gi,
            /\s+x2001$/gi,
            /\s+q0902$/gi,
            /\s+montana rice$/gi,
            /\s+ohtani judge$/gi,
            /\s+ja marr chase$/gi,
            /\s+booker$/gi,
            /\s+arda guler$/gi,
            /\s+esteban ocon$/gi,
            /\s+de von achane$/gi,
            /\s+spencer rattler$/gi,
            /\s+drake maye$/gi,
            /\s+shedeur sanders$/gi,
            /\s+ladd mcconkey$/gi,
            /\s+nikola jokic$/gi,
            /\s+vladimir guerrero$/gi,
            /\s+francisco lindor$/gi,
            /\s+wyatt langford$/gi,
            /\s+tom brady$/gi,
            /\s+tyranitar$/gi,
            /\s+hacksaw jim$/gi,
            /\s+nabers$/gi,
            /\s+victor wembanyama$/gi,
            /\s+david robinson$/gi,
            /\s+jacob misiorowski$/gi,
            /\s+julio rodriguez$/gi,
            /\s+roman reigns$/gi,
            /\s+kobe bryant michael$/gi,
            /\s+kris draper$/gi,
            /\s+walter payton$/gi,
            /\s+josh adamczewski$/gi,
            /\s+vladi guerrero$/gi,
            /\s+brooks koepka$/gi,
            /\s+bernabel$/gi,
            /\s+aaron judge catching$/gi,
            /\s+tyreek hill$/gi,
            /\s+shohei ohtani$/gi,
            /\s+charizard$/gi,
            /\s+barry sanders$/gi,
            /\s+cameron brink$/gi,
            /\s+bo nix$/gi
        ];
        
        problematicSuffixes.forEach(pattern => {
            if (pattern.test(cleanPlayerName)) {
                cleanPlayerName = cleanPlayerName.replace(pattern, '');
                needsUpdate = true;
            }
        });
        
        // Clean up extra spaces
        cleanPlayerName = cleanPlayerName.replace(/\s+/g, ' ').trim();
        
        // Only return the cleaned version if it's different and still valid
        if (needsUpdate && cleanPlayerName.length > 0) {
            return this.db.capitalizePlayerName(cleanPlayerName);
        }
        
        // Return original if no changes needed
        return playerName;
    }

    async testEnhancedExtraction() {
        console.log('🧪 Testing enhanced player name extraction...\n');
        
        const testCases = [
            'Wwe Bianca Belair',
            'Formula Logofractor Lewis',
            'John Paxson Chicago',
            'Winning Ticket Tom',
            'Kobe Bryant Michael',
            'Josh Allen Supernatural',
            'Victor Wembanyama Supernatural',
            'Shohei Ohtani Pitching',
            'Radiant Charizard Pokemon',
            'Kris Draper Detroit',
            'Walter Payton Chicago',
            'Checkerboard Shohei Ohtani',
            'Stadium Barry Sanders',
            'Focus Kobe Bryant',
            'Wnba Cameron Brink',
            'Euro Arda Guler',
            'De Von Achane',
            'Nix Denver',
            'Liv Brooks Koepka',
            'Warming Bernabel Speckle',
            'Aaron Judge Catching',
            'Spencer Rattler Explosive',
            'Drake Maye New',
            'Shedeur Sanders Buffaloes',
            'X2001 Helmet Heroes',
            'Ladd Mcconkey Vision',
            'Overdrive Nikola Jokic',
            'Heritage Vladimir Guerrero',
            'Collection Francisco Lindor',
            'Wyatt Langford Q0902',
            'Composite Tom Brady',
            'Pokemon Japanese Stormfront',
            'Pokemon Aquapolis Tyranitar',
            'Wwe Hacksaw Jim',
            'Nabers Color Blast',
            'Royalty Victor Wembanyama',
            'Hoops David Robinson',
            'Concourse Josh Allen',
            'Pitching Shohei Ohtani',
            'Jacob Misiorowski Speckle',
            'Huddle Miami',
            'Julio Rodriguez Design',
            'Wwe Roman Reigns',
            'Nix Color',
            'Montana Rice',
            'Ohtani Judge',
            'Ja Marr Chase',
            'Premium Box Set',
            'Booker Tectonic',
            'Kobe Bryant Michael',
            'Kris Draper Detroit'
        ];
        
        for (const testCase of testCases) {
            const original = this.db.extractPlayerName(testCase);
            const enhanced = this.enhancedExtractPlayerName(testCase);
            
            console.log(`Original: "${testCase}" → "${original}"`);
            console.log(`Enhanced: "${testCase}" → "${enhanced}"`);
            console.log('---');
        }
    }

    async updatePlayerNamesWithEnhancedExtraction() {
        console.log('🔄 Updating player names with enhanced extraction...\n');
        
        try {
            // Get all cards
            const cards = await this.db.allQuery(`
                SELECT id, title, player_name 
                FROM cards 
                ORDER BY id DESC
            `);
            
            console.log(`📊 Found ${cards.length} cards to process`);
            
            let updatedCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;
            
            for (const card of cards) {
                try {
                    const originalPlayerName = card.player_name;
                    const enhancedPlayerName = this.enhancedExtractPlayerName(card.title);
                    
                    if (enhancedPlayerName && enhancedPlayerName !== originalPlayerName) {
                        await this.db.runQuery(`
                            UPDATE cards 
                            SET player_name = ?, last_updated = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `, [enhancedPlayerName, card.id]);
                        
                        console.log(`✅ Updated: "${originalPlayerName}" → "${enhancedPlayerName}"`);
                        updatedCount++;
                    } else {
                        unchangedCount++;
                    }
                    
                    // Add a small delay
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.error(`❌ Error processing card ${card.id}:`, error.message);
                    errorCount++;
                }
            }
            
            console.log('\n📊 Enhanced Player Name Update Summary');
            console.log('=====================================');
            console.log(`✅ Cards updated: ${updatedCount}`);
            console.log(`⏭️ Cards unchanged: ${unchangedCount}`);
            console.log(`❌ Errors: ${errorCount}`);
            console.log(`📈 Total processed: ${updatedCount + unchangedCount + errorCount}`);
            
        } catch (error) {
            console.error('❌ Error updating player names:', error);
            throw error;
        }
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }
}

// Add to Express routes
function addEnhancedPlayerExtractionRoutes(app) {
    // Test enhanced extraction
    app.post('/api/admin/test-enhanced-player-extraction', async (req, res) => {
        try {
            console.log('🧪 Testing enhanced player extraction...');
            
            const extractor = new EnhancedPlayerExtraction();
            await extractor.connect();
            await extractor.testEnhancedExtraction();
            await extractor.close();

            res.json({
                success: true,
                message: 'Enhanced player extraction test completed',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error testing enhanced player extraction:', error);
            res.status(500).json({
                success: false,
                message: 'Error testing enhanced player extraction',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Update player names with enhanced extraction
    app.post('/api/admin/update-player-names-enhanced', async (req, res) => {
        try {
            console.log('🔄 Updating player names with enhanced extraction...');
            
            const extractor = new EnhancedPlayerExtraction();
            await extractor.connect();
            await extractor.updatePlayerNamesWithEnhancedExtraction();
            await extractor.close();

            res.json({
                success: true,
                message: 'Enhanced player name update completed successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error updating player names with enhanced extraction:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating player names with enhanced extraction',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

module.exports = { EnhancedPlayerExtraction, addEnhancedPlayerExtractionRoutes };
