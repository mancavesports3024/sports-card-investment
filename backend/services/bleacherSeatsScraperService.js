const axios = require('axios');
const cheerio = require('cheerio');

class BleacherSeatsScraperService {
  constructor() {
    this.baseUrl = 'https://bleacherseatscollectibles.com/release-calendar/';
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async scrapeReleaseCalendar() {
    try {
      console.log('🔍 Scraping Bleacher Seats Collectibles release calendar...');
      
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: Failed to fetch release calendar`);
      }

      const $ = cheerio.load(response.data);
      const releases = [];

      // Get all text content and split by lines
      const bodyText = $('body').text();
      const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let currentMonth = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line is a month header
        const monthMatch = line.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i);
        if (monthMatch) {
          currentMonth = monthMatch[1];
          continue;
        }
        
        // Check if this line contains a release date pattern
        const releaseMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+)$/);
        if (releaseMatch && currentMonth) {
          const [, dateStr, title] = releaseMatch;
          const [month, day, year] = dateStr.split('/');
          
          // Convert 2-digit year to 4-digit
          const fullYear = year.length === 2 ? `20${year}` : year;
          
          // Determine brand from title
          const brand = this.extractBrand(title);
          
          releases.push({
            title: title.trim(),
            releaseDate: `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
            brand: brand,
            source: 'Bleacher Seats Collectibles',
            status: this.determineStatus(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
          });
        }
      }

      console.log(`✅ Successfully scraped ${releases.length} releases from Bleacher Seats Collectibles`);
      return releases;

    } catch (error) {
      console.error('❌ Error scraping Bleacher Seats Collectibles:', error.message);
      throw error;
    }
  }

  getMonthIndex(monthName) {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    return months.indexOf(monthName.toLowerCase());
  }

  isMonthHeader(text) {
    const monthPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i;
    return monthPattern.test(text.trim());
  }

  extractBrand(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('panini')) return 'Panini';
    if (titleLower.includes('topps')) return 'Topps';
    if (titleLower.includes('upper deck')) return 'Upper Deck';
    if (titleLower.includes('bowman')) return 'Bowman';
    if (titleLower.includes('pokemon')) return 'Pokemon';
    if (titleLower.includes('yugioh')) return 'Yu-Gi-Oh';
    if (titleLower.includes('leaf')) return 'Leaf';
    if (titleLower.includes('onyx')) return 'Onyx';
    
    return 'Other';
  }

  determineStatus(releaseDate) {
    const today = new Date();
    const release = new Date(releaseDate);
    const diffTime = release.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Released';
    } else if (diffDays <= 30) {
      return 'Upcoming';
    } else {
      return 'Announced';
    }
  }

  async getLatestReleases() {
    try {
      const releases = await this.scrapeReleaseCalendar();
      
      // Filter for releases in the next 6 months
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      return releases.filter(release => {
        const releaseDate = new Date(release.releaseDate);
        return releaseDate <= sixMonthsFromNow;
      });
      
    } catch (error) {
      console.error('❌ Error getting latest releases:', error.message);
      throw error;
    }
  }
}

module.exports = new BleacherSeatsScraperService(); 