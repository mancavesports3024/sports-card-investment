const axios = require('axios');

/**
 * ESPN Sport Detector - Working Version
 * 
 * Uses the ESPN API endpoint: site.web.api.espn.com/apis/common/v3/search
 * with type: 'player' parameter for accurate player searches
 */

class ESPNSportDetectorWorking {
    constructor() {
        this.baseUrl = 'https://site.web.api.espn.com/apis/common/v3/search';
    }

    async detectSportFromPlayer(playerName) {
        try {
            console.log(`🔍 Searching ESPN API for: ${playerName}`);
            
            const response = await axios.get(this.baseUrl, {
                params: {
                    q: playerName,
                    limit: 20,
                    type: 'player'  // This is the key parameter!
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.espn.com/',
                    'Origin': 'https://www.espn.com'
                },
                timeout: 10000
            });

            const data = response.data;
            
            if (!data.items || data.items.length === 0) {
                console.log(`❌ No results found for ${playerName}`);
                return 'Unknown';
            }

            // Look for exact player matches first
            const exactMatches = data.items.filter(item => 
                item.type === 'player' && 
                item.displayName && 
                item.displayName.toLowerCase() === playerName.toLowerCase()
            );

            if (exactMatches.length > 0) {
                const player = exactMatches[0];
                const sport = this.mapLeagueToSport(player.league);
                console.log(`✅ Exact match: ${player.displayName} - Sport: ${sport} (League: ${player.league})`);
                return sport;
            }

            // Look for partial player matches
            const partialMatches = data.items.filter(item => 
                item.type === 'player' && 
                item.displayName && 
                item.displayName.toLowerCase().includes(playerName.toLowerCase())
            );

            if (partialMatches.length > 0) {
                const player = partialMatches[0];
                const sport = this.mapLeagueToSport(player.league);
                console.log(`✅ Partial match: ${player.displayName} - Sport: ${sport} (League: ${player.league})`);
                return sport;
            }

            console.log(`❌ No relevant results found for ${playerName}`);
            return 'Unknown';
            
        } catch (error) {
            console.error(`❌ Error searching ESPN API for ${playerName}:`, error.message);
            return 'Unknown';
        }
    }

    mapLeagueToSport(league) {
        if (!league) return 'Unknown';
        
        const leagueMap = {
            // Football
            'nfl': 'Football',
            'college-football': 'Football',
            'xfl': 'Football',
            'usfl': 'Football',
            
            // Basketball
            'nba': 'Basketball',
            'college-basketball': 'Basketball',
            'wnba': 'Basketball',
            'g-league': 'Basketball',
            
            // Baseball
            'mlb': 'Baseball',
            'minor-league-baseball': 'Baseball',
            
            // Hockey
            'nhl': 'Hockey',
            'ahl': 'Hockey',
            
            // Racing
            'f1': 'Racing',
            'nascar': 'Racing',
            'indycar': 'Racing',
            
            // Soccer
            'soccer': 'Soccer',
            'mls': 'Soccer',
            'premier-league': 'Soccer',
            'afc.cupq': 'Soccer',
            
            // Golf
            'pga': 'Golf',
            
            // Other sports
            'tennis': 'Tennis',
            'boxing': 'Boxing',
            'mma': 'MMA',
            'ufc': 'MMA'
        };
        
        return leagueMap[league] || 'Unknown';
    }

    async testPlayer(playerName) {
        console.log(`\n🎯 Testing ESPN API for: ${playerName}`);
        console.log('=' .repeat(50));
        
        const sport = await this.detectSportFromPlayer(playerName);
        
        console.log(`🎯 Result: ${playerName} -> ${sport}`);
        return sport;
    }
}

// Test the working ESPN API
async function testWorkingESPNDetector() {
    const detector = new ESPNSportDetectorWorking();
    
    const testPlayers = [
        'Bo Nix',
        'Stephon Castle', 
        'Victor Wembanyama',
        'Drake Maye',
        'Rome Odunze',
        'Lando Norris',
        'Justin Herbert',
        'LeBron James',
        'Mike Trout',
        'Aaron Rodgers',
        'Aaron Judge'
    ];
    
    console.log('🧪 Testing Working ESPN API\n');
    
    for (const player of testPlayers) {
        await detector.testPlayer(player);
        console.log('---');
        // Add a small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

if (require.main === module) {
    testWorkingESPNDetector().then(() => {
        console.log('\n✅ Working ESPN API testing complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Working ESPN API testing failed:', error);
        process.exit(1);
    });
}

module.exports = { ESPNSportDetectorWorking };

