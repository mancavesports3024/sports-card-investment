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
        let cleanTitle = title;
        
        // Step 1: Remove sport terms
        this.sportTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 2: Remove card types
        this.cardTypes.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 3: Remove city/team terms
        this.cityTeamTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 4: Remove card descriptions
        this.cardDescriptions.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 5: Remove alphanumeric codes
        this.alphanumericCodes.forEach(code => {
            const regex = new RegExp(`\\b${code}\\b`, 'gi');
            cleanTitle = cleanTitle.replace(regex, ' ');
        });
        
        // Step 6: Remove card number patterns
        const cardNumberPatterns = [
            /\b(TC\d+)\b/gi,  // TC264, TC123, etc.
            /\b(MMR-\d+)\b/gi, // MMR-54, MMR-123, etc.
            /\b(DT\d+)\b/gi,   // DT36, DT123, etc.
            /\b(BS\d+)\b/gi,   // BS3, BS123, etc.
            /\b(SJMC)\b/gi,    // SJMC
            /\b([A-Z]{2,5}\d{1,4})\b/gi, // General alphanumeric codes
            /\b([A-Z]{2,4}-[A-Z]{1,4})\b/gi, // Codes like RS-SGA
        ];
        
        cardNumberPatterns.forEach(pattern => {
            cleanTitle = cleanTitle.replace(pattern, ' ');
        });
        
        // Step 7: Clean up extra spaces and normalize
        cleanTitle = cleanTitle
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[^a-zA-Z]*/, '') // Remove leading non-letters
            .replace(/[^a-zA-Z]*$/, ''); // Remove trailing non-letters
        
        // Step 8: Extract the first 2-3 words as potential player name
        const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
        
        // Take first 2-3 words, but be smart about it
        let playerName = '';
        if (words.length >= 3) {
            // Check if third word looks like a name (not a number, not too short)
            if (words[2].length >= 2 && !/\d/.test(words[2])) {
                playerName = words.slice(0, 3).join(' ');
            } else {
                playerName = words.slice(0, 2).join(' ');
            }
        } else if (words.length === 2) {
            playerName = words.join(' ');
        } else if (words.length === 1) {
            playerName = words[0];
        }
        
        // Step 9: Final cleanup
        playerName = this.db.capitalizePlayerName(playerName);
        
        return playerName || null;
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
