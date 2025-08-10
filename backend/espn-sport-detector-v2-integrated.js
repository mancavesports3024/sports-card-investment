const axios = require('axios');

/**
 * ESPN Sport Detector v2 - Integrated Version
 * 
 * Uses the ESPN v2 API endpoint: site.web.api.espn.com/apis/search/v2
 * This is much more reliable and comprehensive than previous versions
 */

class ESPNSportDetectorV2Integrated {
    constructor() {
        this.baseUrl = 'https://site.web.api.espn.com/apis/search/v2';
        this.cache = new Map(); // Simple in-memory cache
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    async detectSportFromPlayer(playerName) {
        try {
            // Check cache first
            const cacheKey = playerName.toLowerCase().trim();
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log(`📋 Using cached result for ${playerName}: ${cached.sport}`);
                return cached.sport;
            }

            console.log(`🔍 Searching ESPN v2 API for: ${playerName}`);
            
            const response = await axios.get(this.baseUrl, {
                params: {
                    limit: 100,
                    query: playerName
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
            
            if (!data.results || data.results.length === 0) {
                console.log(`❌ No results found for ${playerName}`);
                this.cacheResult(cacheKey, 'Unknown');
                return 'Unknown';
            }

            // Look for player results
            const playerResults = data.results.find(result => result.type === 'player');
            if (!playerResults || !playerResults.contents || playerResults.contents.length === 0) {
                console.log(`❌ No player results found for ${playerName}`);
                this.cacheResult(cacheKey, 'Unknown');
                return 'Unknown';
            }

            // Find the best match
            const bestMatch = this.findBestMatch(playerResults.contents, playerName);
            if (!bestMatch) {
                console.log(`❌ No good match found for ${playerName}`);
                this.cacheResult(cacheKey, 'Unknown');
                return 'Unknown';
            }

            const sport = this.mapLeagueToSport(bestMatch.defaultLeagueSlug);
            console.log(`✅ Found match: ${bestMatch.displayName} - Sport: ${sport} (League: ${bestMatch.defaultLeagueSlug})`);
            
            this.cacheResult(cacheKey, sport);
            return sport;
            
        } catch (error) {
            console.error(`❌ Error searching ESPN v2 API for ${playerName}:`, error.message);
            return 'Unknown';
        }
    }

    findBestMatch(players, searchName) {
        const searchNameLower = searchName.toLowerCase();
        
        // First, look for exact matches
        const exactMatches = players.filter(player => 
            player.displayName && 
            player.displayName.toLowerCase() === searchNameLower
        );
        
        if (exactMatches.length > 0) {
            return exactMatches[0]; // Return the first exact match
        }

        // Then, look for partial matches
        const partialMatches = players.filter(player => 
            player.displayName && 
            player.displayName.toLowerCase().includes(searchNameLower)
        );
        
        if (partialMatches.length > 0) {
            return partialMatches[0]; // Return the first partial match
        }

        // Finally, return the first player if no good match found
        return players[0];
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
            'eng.5': 'Soccer',
            
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

    cacheResult(key, sport) {
        this.cache.set(key, {
            sport: sport,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
        console.log('🗑️ ESPN sport detection cache cleared');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.entries()).map(([key, value]) => ({
                player: key,
                sport: value.sport,
                cachedAt: new Date(value.timestamp).toISOString()
            }))
        };
    }

    async testPlayer(playerName) {
        console.log(`\n🎯 Testing ESPN v2 API for: ${playerName}`);
        console.log('=' .repeat(50));
        
        const sport = await this.detectSportFromPlayer(playerName);
        
        console.log(`🎯 Result: ${playerName} -> ${sport}`);
        return sport;
    }
}

// Test the integrated ESPN v2 API
async function testIntegratedESPNDetector() {
    const detector = new ESPNSportDetectorV2Integrated();
    
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
    
    console.log('🧪 Testing Integrated ESPN v2 API\n');
    
    for (const player of testPlayers) {
        await detector.testPlayer(player);
        console.log('---');
        // Add a small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Test cache functionality
    console.log('\n🔄 Testing cache functionality...');
    await detector.testPlayer('LeBron James'); // Should use cache
    await detector.testPlayer('Mike Trout'); // Should use cache
    
    console.log('\n📊 Cache stats:');
    console.log(detector.getCacheStats());
}

if (require.main === module) {
    testIntegratedESPNDetector().then(() => {
        console.log('\n✅ Integrated ESPN v2 API testing complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Integrated ESPN v2 API testing failed:', error);
        process.exit(1);
    });
}

module.exports = { ESPNSportDetectorV2Integrated };
