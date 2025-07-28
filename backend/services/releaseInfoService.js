const axios = require('axios');
const cheerio = require('cheerio');
const cacheService = require('./cacheService');

class ReleaseInfoService {
  constructor() {
    this.baseUrl = 'https://www.blowoutforums.com';
    this.cacheTimeout = 3600; // 1 hour cache
  }

  async getBlowoutForumsReleases() {
    const cacheKey = 'blowout_forums_releases';
    
    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log('📋 Using cached Blowout Forums release data');
      return cached;
    }

    try {
      console.log('🔄 Fetching release information from Blowout Forums...');
      
      // Fetch the main release thread
      const response = await axios.get('https://www.blowoutforums.com/showthread.php?t=803', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const releases = [];

      // Parse forum posts for release information
      $('.postcontent').each((index, element) => {
        const postText = $(element).text();
        
        // Look for release patterns in the text
        const releaseMatches = this.extractReleaseInfo(postText);
        releases.push(...releaseMatches);
      });

      // Clean and format the releases
      const formattedReleases = this.formatReleases(releases);
      
      // Cache the results
      await cacheService.set(cacheKey, formattedReleases, this.cacheTimeout);
      
      console.log(`✅ Found ${formattedReleases.length} releases from Blowout Forums`);
      return formattedReleases;

    } catch (error) {
      console.error('❌ Error fetching Blowout Forums releases:', error.message);
      
      // Return fallback data if scraping fails
      return this.getFallbackReleases();
    }
  }

  extractReleaseInfo(text) {
    const releases = [];
    
    // Common release patterns
    const patterns = [
      // Pattern: "2025 Topps Series One Baseball - January 15, 2025"
      /(\d{4})\s+(Topps|Panini|Bowman|Upper Deck|Donruss|Fleer|Score)\s+([^-]+?)\s*-\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
      
      // Pattern: "Topps 2025 Series One - Jan 15"
      /(Topps|Panini|Bowman|Upper Deck|Donruss|Fleer|Score)\s+(\d{4})\s+([^-]+?)\s*-\s*([A-Za-z]{3}\s+\d{1,2})/gi,
      
      // Pattern: "Release Date: January 15, 2025"
      /Release\s+Date:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
      
      // Pattern: "Coming: January 2025"
      /Coming:\s*([A-Za-z]+\s+\d{4})/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        releases.push({
          raw: match[0],
          matches: match.slice(1)
        });
      }
    });

    return releases;
  }

  formatReleases(rawReleases) {
    const formatted = [];
    const seen = new Set();

    rawReleases.forEach(release => {
      try {
        const formattedRelease = this.parseReleaseData(release);
        
        if (formattedRelease && !seen.has(formattedRelease.title)) {
          seen.add(formattedRelease.title);
          formatted.push(formattedRelease);
        }
      } catch (error) {
        console.log('⚠️ Error parsing release:', release.raw);
      }
    });

    return formatted;
  }

  parseReleaseData(release) {
    const { raw, matches } = release;
    
    // Try to extract information from the raw text
    let title = '';
    let brand = '';
    let sport = '';
    let releaseDate = '';
    let year = '';

    // Extract year
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      year = yearMatch[1];
    }

    // Extract brand
    const brandMatch = raw.match(/\b(Topps|Panini|Bowman|Upper Deck|Donruss|Fleer|Score)\b/i);
    if (brandMatch) {
      brand = brandMatch[1];
    }

    // Extract date
    const dateMatch = raw.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|[A-Za-z]{3}\s+\d{1,2})/);
    if (dateMatch) {
      releaseDate = dateMatch[1];
    }

    // Determine sport based on keywords
    if (raw.toLowerCase().includes('baseball') || raw.toLowerCase().includes('mlb')) {
      sport = 'Baseball';
    } else if (raw.toLowerCase().includes('basketball') || raw.toLowerCase().includes('nba')) {
      sport = 'Basketball';
    } else if (raw.toLowerCase().includes('football') || raw.toLowerCase().includes('nfl')) {
      sport = 'Football';
    } else if (raw.toLowerCase().includes('hockey') || raw.toLowerCase().includes('nhl')) {
      sport = 'Hockey';
    } else {
      sport = 'Trading Cards';
    }

    // Create title
    title = raw.trim();

    return {
      title,
      brand,
      sport,
      releaseDate,
      year,
      source: 'Blowout Forums',
      status: this.determineStatus(releaseDate),
      description: `Release information from Blowout Forums: ${raw}`,
      retailPrice: 'TBD',
      hobbyPrice: 'TBD'
    };
  }

  determineStatus(releaseDate) {
    if (!releaseDate) return 'Unknown';
    
    try {
      const release = new Date(releaseDate);
      const now = new Date();
      
      if (release < now) {
        return 'Released';
      } else if (release.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) { // 30 days
        return 'Upcoming';
      } else {
        return 'Announced';
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  getFallbackReleases() {
    return [
      {
        title: '2025 Topps Series One Baseball',
        brand: 'Topps',
        sport: 'Baseball',
        releaseDate: 'January 15, 2025',
        year: '2025',
        source: 'Fallback Data',
        status: 'Released',
        description: 'The flagship baseball card set featuring current MLB players and rookies',
        retailPrice: '$4.99',
        hobbyPrice: '$89.99'
      },
      {
        title: '2024-25 Panini Prizm Basketball',
        brand: 'Panini',
        sport: 'Basketball',
        releaseDate: 'January 22, 2025',
        year: '2025',
        source: 'Fallback Data',
        status: 'Released',
        description: 'Premium basketball cards with stunning Prizm technology',
        retailPrice: '$9.99',
        hobbyPrice: '$299.99'
      }
    ];
  }

  async getAllReleases() {
    try {
      const [blowoutReleases, fallbackReleases] = await Promise.allSettled([
        this.getBlowoutForumsReleases(),
        Promise.resolve(this.getFallbackReleases())
      ]);

      let allReleases = [];

      // Add Blowout Forums releases if successful
      if (blowoutReleases.status === 'fulfilled' && blowoutReleases.value.length > 0) {
        allReleases.push(...blowoutReleases.value);
      }

      // Add fallback releases if we don't have enough data
      if (allReleases.length < 5 && fallbackReleases.status === 'fulfilled') {
        allReleases.push(...fallbackReleases.value);
      }

      // Sort by release date
      allReleases.sort((a, b) => {
        const dateA = new Date(a.releaseDate || 0);
        const dateB = new Date(b.releaseDate || 0);
        return dateB - dateA; // Most recent first
      });

      return allReleases;

    } catch (error) {
      console.error('❌ Error getting all releases:', error.message);
      return this.getFallbackReleases();
    }
  }
}

module.exports = new ReleaseInfoService(); 