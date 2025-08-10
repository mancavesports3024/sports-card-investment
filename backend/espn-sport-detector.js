const axios = require('axios');
const cheerio = require('cheerio');

/**
 * ESPN Sport Detector - DEPRECATED
 * 
 * This approach was attempted but found to be unreliable because:
 * 1. ESPN search returns generic navigation pages, not actual search results
 * 2. All searches return the same navigation links (NFL, NBA, MLB, etc.)
 * 3. No player-specific sport information is available in the search results
 * 
 * The EnhancedSportDetector with comprehensive keyword lists is more reliable
 * and should be used instead.
 */

class ESPNSportDetector {
    constructor() {
        this.baseUrl = 'https://www.espn.com';
        this.searchUrl = 'https://www.espn.com/search';
    }

    async detectSportFromPlayer(playerName) {
        try {
            console.log(`🔍 Searching ESPN for: ${playerName}`);
            
            // Clean the player name for search
            const searchQuery = playerName.trim();
            
            // Use the new search approach with specific headers
            const response = await axios.get(this.searchUrl, {
                params: {
                    q: searchQuery
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://www.espn.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Debug: Log some of the response content
            console.log(`📄 Response status: ${response.status}`);
            console.log(`📄 Response URL: ${response.config.url}`);
            console.log(`📄 Page title: ${$('title').text()}`);
            
            // Debug: Log some links found
            const links = $('a[href*="/"]').map((i, el) => $(el).attr('href')).get();
            console.log(`📄 Found ${links.length} links`);
            console.log(`📄 Sample links:`, links.slice(0, 5));
            
            // Look for sport indicators in the search results
            const sport = this.extractSportFromPage($, playerName);
            
            console.log(`✅ ESPN result for ${playerName}: ${sport}`);
            return sport;
            
        } catch (error) {
            console.error(`❌ Error searching ESPN for ${playerName}:`, error.message);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Headers:`, error.response.headers);
            }
            return 'Unknown';
        }
    }

    extractSportFromPage($, playerName) {
        // Look for sport-specific URLs and content
        const pageText = $.text().toLowerCase();
        const pageHtml = $.html().toLowerCase();
        
        // Check for sport-specific URLs in the page
        const links = $('a[href*="/"]').map((i, el) => $(el).attr('href')).get();
        
        // Look for specific player links that contain sport information
        const playerLinks = links.filter(link => 
            link && link.includes(playerName.toLowerCase().replace(' ', '-'))
        );
        
        // Check player-specific links first
        for (const link of playerLinks) {
            if (link.includes('/nfl/') || link.includes('/college-football/')) {
                return 'Football';
            }
            if (link.includes('/nba/') || link.includes('/college-basketball/')) {
                return 'Basketball';
            }
            if (link.includes('/mlb/')) {
                return 'Baseball';
            }
            if (link.includes('/nhl/')) {
                return 'Hockey';
            }
            if (link.includes('/f1/') || link.includes('/racing/')) {
                return 'Racing';
            }
            if (link.includes('/soccer/')) {
                return 'Soccer';
            }
        }
        
        // Fallback to general sport detection in content
        if (this.containsSportIndicators(pageText, pageHtml, links, 'football', ['nfl', 'college football', 'qb', 'quarterback', 'running back', 'wide receiver'])) {
            return 'Football';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'basketball', ['nba', 'college basketball', 'point guard', 'shooting guard', 'small forward', 'power forward', 'center'])) {
            return 'Basketball';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'baseball', ['mlb', 'pitcher', 'hitter', 'outfielder', 'infielder', 'catcher'])) {
            return 'Baseball';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'hockey', ['nhl', 'goalie', 'goaltender', 'defenseman'])) {
            return 'Hockey';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'racing', ['f1', 'formula 1', 'nascar', 'indycar'])) {
            return 'Racing';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'soccer', ['fifa', 'premier league', 'mls'])) {
            return 'Soccer';
        }
        
        if (this.containsSportIndicators(pageText, pageHtml, links, 'pokemon', ['pokemon', 'pikachu', 'charizard'])) {
            return 'Pokemon';
        }
        
        return 'Unknown';
    }

    containsSportIndicators(pageText, pageHtml, links, sportKeyword, sportTerms) {
        // Check if any sport-specific terms are found
        const hasSportTerms = sportTerms.some(term => 
            pageText.includes(term) || pageHtml.includes(term)
        );
        
        // Check if any links contain sport-specific paths
        const hasSportLinks = links.some(link => 
            link && (link.includes(`/${sportKeyword}/`) || 
                    sportTerms.some(term => link.includes(`/${term}/`)))
        );
        
        return hasSportTerms || hasSportLinks;
    }

    async testPlayer(playerName) {
        const sport = await this.detectSportFromPlayer(playerName);
        console.log(`\n🎯 Test Result:`);
        console.log(`   Player: ${playerName}`);
        console.log(`   Sport: ${sport}`);
        return sport;
    }
}

// Test the ESPN sport detector
async function testESPNDetector() {
    const detector = new ESPNSportDetector();
    
    const testPlayers = [
        'Bo Nix',
        'Stephon Castle', 
        'Victor Wembanyama',
        'Drake Maye',
        'Rome Odunze',
        'Lando Norris',
        'Justin Herbert'
    ];
    
    console.log('🧪 Testing ESPN Sport Detector (New Method)\n');
    console.log('⚠️  NOTE: This approach is unreliable - ESPN search returns generic navigation pages\n');
    
    for (const player of testPlayers) {
        await detector.testPlayer(player);
        console.log('---');
        // Add a small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

if (require.main === module) {
    testESPNDetector().then(() => {
        console.log('\n✅ ESPN testing complete');
        console.log('\n💡 Recommendation: Use EnhancedSportDetector instead for reliable sport detection');
        process.exit(0);
    }).catch(error => {
        console.error('❌ ESPN testing failed:', error);
        process.exit(1);
    });
}

module.exports = { ESPNSportDetector };
