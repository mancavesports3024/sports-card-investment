const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');
const { detectSport } = require('./ultimate-multi-sport-filtering-system');

class SportFixer {
  constructor() {
    this.updater = new FastSQLitePriceUpdater();
    this.fixes = 0;
    this.analyzed = 0;
  }

  async connect() {
    await this.updater.connect();
  }

  // Enhanced sport detection with better logic
  detectSportEnhanced(cardTitle) {
    const title = cardTitle.toLowerCase().trim();
    
    // Basketball indicators (most specific first)
    const basketballKeywords = [
      'basketball', 'nba', 'hoops', 'panini basketball', 'topps basketball',
      // Star players
      'lebron james', 'stephen curry', 'kevin durant', 'giannis', 'luka doncic',
      'zion williamson', 'ja morant', 'victor wembanyama', 'jayson tatum',
      'devin booker', 'anthony edwards', 'jalen brunson', 'paolo banchero',
      // Teams
      'lakers', 'warriors', 'celtics', 'bulls', 'knicks', 'heat', 'spurs',
      'suns', 'nuggets', 'clippers', 'nets', 'bucks', 'sixers', 'mavericks',
      // Basketball-specific terms
      'slam dunk', 'fast break', 'donruss basketball', 'select basketball'
    ];
    
    // Football indicators
    const footballKeywords = [
      'football', 'nfl', 'panini football', 'topps football',
      // Star players
      'tom brady', 'patrick mahomes', 'josh allen', 'aaron rodgers',
      'joe burrow', 'trevor lawrence', 'dak prescott', 'brock purdy',
      'c.j. stroud', 'bryce young', 'anthony richardson', 'bo nix',
      // Teams
      'chiefs', 'patriots', 'cowboys', '49ers', 'niners', 'broncos',
      'bills', 'bengals', 'ravens', 'steelers', 'packers', 'vikings',
      // Football-specific terms
      'rookie card', 'donruss football', 'select football', 'contenders football'
    ];
    
    // Baseball indicators
    const baseballKeywords = [
      'baseball', 'mlb', 'topps baseball', 'bowman baseball',
      // Star players
      'mike trout', 'shohei ohtani', 'aaron judge', 'ronald acuna',
      'fernando tatis', 'mookie betts', 'francisco lindor', 'juan soto',
      // Teams
      'yankees', 'dodgers', 'red sox', 'cubs', 'giants', 'braves',
      'astros', 'padres', 'mets', 'phillies', 'cardinals', 'rangers',
      // Baseball-specific brands/terms
      'topps chrome', 'bowman chrome', 'heritage', 'gypsy queen',
      'allen ginter', 'stadium club', 'finest'
    ];
    
    // Pokemon indicators
    const pokemonKeywords = [
      'pokemon', 'pikachu', 'charizard', 'blastoise', 'venusaur', 'mewtwo',
      'mew', 'lugia', 'ho-oh', 'rayquaza', 'dialga', 'palkia', 'giratina',
      'arceus', 'reshiram', 'zekrom', 'kyurem', 'xerneas', 'yveltal',
      'zygarde', 'solgaleo', 'lunala', 'necrozma', 'zacian', 'zamazenta',
      'eternatus', 'koraidon', 'miraidon',
      // Pokemon-specific terms
      'holo rare', 'reverse holo', 'secret rare', 'ultra rare', 'rainbow rare',
      'full art', 'alternate art', 'vmax', 'vstar', 'gx', 'ex',
      'first edition', '1st edition', 'shadowless', 'base set', 'jungle',
      'fossil', 'team rocket', 'neo genesis', 'gym heroes',
      'black star promo', 'staff promo', 'worlds', 'championship'
    ];

    // Check each sport with keyword matching
    for (const keyword of basketballKeywords) {
      if (title.includes(keyword)) {
        return 'basketball';
      }
    }
    
    for (const keyword of footballKeywords) {
      if (title.includes(keyword)) {
        return 'football';
      }
    }
    
    for (const keyword of baseballKeywords) {
      if (title.includes(keyword)) {
        return 'baseball';
      }
    }
    
    for (const keyword of pokemonKeywords) {
      if (title.includes(keyword)) {
        return 'pokemon';
      }
    }
    
    return 'unknown';
  }

  async findWrongSports() {
    console.log('🔍 Analyzing sport classifications...\n');
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, title, summaryTitle, sport, lastUpdated
        FROM cards 
        WHERE sport IS NOT NULL
        ORDER BY id
      `;
      
      this.updater.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const wrongSports = [];
          
          rows.forEach(card => {
            this.analyzed++;
            const currentSport = card.sport;
            const detectedSport = this.detectSportEnhanced(card.title);
            
            // Only flag if we have high confidence in detection and it's different
            if (detectedSport !== 'unknown' && detectedSport !== currentSport) {
              wrongSports.push({
                id: card.id,
                title: card.title,
                currentSport,
                detectedSport,
                confidence: this.getConfidenceScore(card.title, detectedSport)
              });
            }
          });
          
          resolve(wrongSports);
        }
      });
    });
  }

  getConfidenceScore(title, sport) {
    const titleLower = title.toLowerCase();
    let score = 0;
    
    // High confidence indicators
    if (titleLower.includes(sport)) score += 50;
    if (titleLower.includes(`${sport} card`)) score += 30;
    if (titleLower.includes(`panini ${sport}`)) score += 40;
    if (titleLower.includes(`topps ${sport}`)) score += 40;
    
    // Sport-specific high confidence terms
    if (sport === 'basketball' && (titleLower.includes('nba') || titleLower.includes('hoops'))) score += 40;
    if (sport === 'football' && titleLower.includes('nfl')) score += 40;
    if (sport === 'baseball' && (titleLower.includes('mlb') || titleLower.includes('bowman'))) score += 40;
    if (sport === 'pokemon' && (titleLower.includes('holo') || titleLower.includes('charizard'))) score += 40;
    
    // Player name matches
    const playerNames = this.getTopPlayersForSport(sport);
    for (const player of playerNames) {
      if (titleLower.includes(player.toLowerCase())) {
        score += 35;
        break;
      }
    }
    
    return Math.min(score, 100);
  }

  getTopPlayersForSport(sport) {
    const players = {
      basketball: ['lebron james', 'stephen curry', 'kevin durant', 'giannis', 'luka doncic'],
      football: ['tom brady', 'patrick mahomes', 'josh allen', 'aaron rodgers', 'joe burrow'],
      baseball: ['mike trout', 'shohei ohtani', 'aaron judge', 'ronald acuna', 'fernando tatis'],
      pokemon: ['pikachu', 'charizard', 'mewtwo', 'lugia', 'rayquaza']
    };
    
    return players[sport] || [];
  }

  async fixWrongSports(dryRun = true, minConfidence = 70) {
    const wrongSports = await this.findWrongSports();
    
    console.log(`📊 Analysis Results:`);
    console.log(`   Total cards analyzed: ${this.analyzed}`);
    console.log(`   Wrong sports found: ${wrongSports.length}`);
    console.log('');
    
    // Group by sport changes
    const changes = {};
    wrongSports.forEach(item => {
      const key = `${item.currentSport} → ${item.detectedSport}`;
      if (!changes[key]) changes[key] = [];
      changes[key].push(item);
    });
    
    console.log('🔄 Sport Changes Needed:');
    for (const [change, items] of Object.entries(changes)) {
      console.log(`   ${change}: ${items.length} cards`);
    }
    console.log('');
    
    // Show high confidence examples
    const highConfidence = wrongSports.filter(item => item.confidence >= minConfidence);
    console.log(`✅ High Confidence Fixes (${minConfidence}%+): ${highConfidence.length} cards`);
    
    if (highConfidence.length > 0) {
      console.log('\n📋 Examples to fix:');
      highConfidence.slice(0, 10).forEach((item, i) => {
        console.log(`${i + 1}. ${item.currentSport} → ${item.detectedSport} (${item.confidence}%)`);
        console.log(`   Title: ${item.title.substring(0, 80)}...`);
        console.log('');
      });
    }
    
    if (!dryRun && highConfidence.length > 0) {
      console.log(`🛠️ Applying ${highConfidence.length} sport fixes...`);
      
      for (const item of highConfidence) {
        await this.updateCardSport(item.id, item.detectedSport);
        this.fixes++;
      }
      
      console.log(`✅ Applied ${this.fixes} sport fixes!`);
    } else {
      console.log('🔍 Dry run complete. Use fixWrongSports(false) to apply changes.');
    }
    
    return {
      analyzed: this.analyzed,
      wrongSports: wrongSports.length,
      highConfidence: highConfidence.length,
      fixed: this.fixes
    };
  }

  async updateCardSport(cardId, newSport) {
    return new Promise((resolve, reject) => {
      const query = `UPDATE cards SET sport = ? WHERE id = ?`;
      
      this.updater.db.run(query, [newSport, cardId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // API method for admin interface
  async analyzeSportsForApi() {
    const wrongSports = await this.findWrongSports();
    
    // Group by current sport
    const sportStats = {};
    wrongSports.forEach(item => {
      if (!sportStats[item.currentSport]) {
        sportStats[item.currentSport] = {
          total: 0,
          corrections: {}
        };
      }
      sportStats[item.currentSport].total++;
      
      if (!sportStats[item.currentSport].corrections[item.detectedSport]) {
        sportStats[item.currentSport].corrections[item.detectedSport] = 0;
      }
      sportStats[item.currentSport].corrections[item.detectedSport]++;
    });
    
    const highConfidence = wrongSports.filter(item => item.confidence >= 70);
    
    return {
      summary: {
        analyzed: this.analyzed,
        wrongSports: wrongSports.length,
        highConfidence: highConfidence.length,
        readyToFix: highConfidence.length
      },
      sportStats,
      examples: highConfidence.slice(0, 20).map(item => ({
        id: item.id,
        title: item.title.substring(0, 100),
        currentSport: item.currentSport,
        suggestedSport: item.detectedSport,
        confidence: item.confidence
      }))
    };
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new SportFixer();
  
  fixer.connect()
    .then(() => fixer.fixWrongSports(true, 70)) // Dry run with 70% confidence
    .then((results) => {
      console.log('\n🎯 Sport Fix Summary:');
      console.log(`   Cards analyzed: ${results.analyzed}`);
      console.log(`   Wrong sports detected: ${results.wrongSports}`);
      console.log(`   High confidence fixes: ${results.highConfidence}`);
      console.log(`   Fixes applied: ${results.fixed}`);
      
      fixer.updater.db.close();
      console.log('\n✅ Sport analysis complete!');
    })
    .catch(error => {
      console.error('❌ Sport fix failed:', error);
      process.exit(1);
    });
}

module.exports = SportFixer;
