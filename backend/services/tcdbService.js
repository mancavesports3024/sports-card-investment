const axios = require('axios');
const cheerio = require('cheerio');

// TCDB base URLs
const TCDB_BASE_URL = 'https://www.tcdb.com';
const TCDB_SPORTS_URLS = {
  Baseball: 'https://www.tcdb.com/ViewAll.cfm/sp/Baseball',
  Basketball: 'https://www.tcdb.com/ViewAll.cfm/sp/Basketball',
  Football: 'https://www.tcdb.com/ViewAll.cfm/sp/Football',
  Hockey: 'https://www.tcdb.com/ViewAll.cfm/sp/Hockey',
  Pokemon: 'https://www.tcdb.com/ViewAll.cfm/sp/Pokemon',
  Magic: 'https://www.tcdb.com/ViewAll.cfm/sp/Magic',
  YuGiOh: 'https://www.tcdb.com/ViewAll.cfm/sp/YuGiOh'
};

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

// User agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to extract year from set name
function extractYearFromSetName(setName) {
  const yearMatch = setName.match(/(\d{4})/);
  return yearMatch ? yearMatch[1] : null;
}

// Helper function to extract brand from set name
function extractBrandFromSetName(setName) {
  const brands = ['Topps', 'Bowman', 'Panini', 'Upper Deck', 'Fleer', 'Donruss', 'Score', 'Stadium Club', 'Gallery', 'Heritage', 'Chrome', 'Update', 'Series', 'Pokemon', 'Magic', 'YuGiOh'];
  const lowerSetName = setName.toLowerCase();
  
  for (const brand of brands) {
    if (lowerSetName.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return 'Unknown';
}

// Main function to scrape TCDB for card sets
async function scrapeTCDBSets(sport = 'Baseball', limit = 50) {
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before TCDB request`);
      await delay(waitTime);
    }
    lastRequestTime = Date.now();

    const sportUrl = TCDB_SPORTS_URLS[sport];
    if (!sportUrl) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    console.log(`🔍 Scraping TCDB for ${sport} sets: ${sportUrl}`);

    const response = await axios.get(sportUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status}: Failed to fetch TCDB data`);
    }

    const $ = cheerio.load(response.data);
    const sets = [];

    // Look for set links in the page
    // TCDB typically has links like: <a href="ViewSet.cfm/sid/12345">Set Name</a>
    $('a[href*="ViewSet.cfm"]').each((index, element) => {
      if (sets.length >= limit) return false; // Stop if we have enough sets

      const $element = $(element);
      const setText = $element.text().trim();
      const href = $element.attr('href');

      if (setText && href && setText.length > 3) {
        const year = extractYearFromSetName(setText);
        const brand = extractBrandFromSetName(setText);
        
        sets.push({
          name: setText,
          brand: brand,
          category: sport,
          years: year ? [year] : [],
          tcdbUrl: `${TCDB_BASE_URL}/${href}`,
          source: 'TCDB'
        });
      }
    });

    console.log(`✅ Scraped ${sets.length} ${sport} sets from TCDB`);
    return sets;

  } catch (error) {
    console.error(`❌ TCDB scraping error for ${sport}:`, error.message);
    return [];
  }
}

// Function to search TCDB for specific sets
async function searchTCDBSets(query, sport = null, limit = 20) {
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await delay(waitTime);
    }
    lastRequestTime = Date.now();

    console.log(`🔍 Searching TCDB for: "${query}"`);

    // Build search URL
    const searchUrl = `${TCDB_BASE_URL}/Search.cfm`;
    const searchParams = new URLSearchParams({
      'Search': query,
      'Type': 'Set'
    });

    const response = await axios.get(`${searchUrl}?${searchParams.toString()}`, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    });

    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status}: Failed to search TCDB`);
    }

    const $ = cheerio.load(response.data);
    const sets = [];

    // Look for search results
    $('a[href*="ViewSet.cfm"]').each((index, element) => {
      if (sets.length >= limit) return false;

      const $element = $(element);
      const setText = $element.text().trim();
      const href = $element.attr('href');

      if (setText && href && setText.length > 3) {
        const year = extractYearFromSetName(setText);
        const brand = extractBrandFromSetName(setText);
        const detectedSport = sport || detectSportFromSet(setText);
        
        sets.push({
          name: setText,
          brand: brand,
          category: detectedSport,
          years: year ? [year] : [],
          tcdbUrl: `${TCDB_BASE_URL}/${href}`,
          source: 'TCDB'
        });
      }
    });

    console.log(`✅ Found ${sets.length} sets matching "${query}" on TCDB`);
    return sets;

  } catch (error) {
    console.error(`❌ TCDB search error:`, error.message);
    return [];
  }
}

// Helper function to detect sport from set name
function detectSportFromSet(setName) {
  const lowerSetName = setName.toLowerCase();
  
  if (lowerSetName.includes('pokemon') || lowerSetName.includes('charizard') || lowerSetName.includes('pikachu')) {
    return 'Pokemon';
  }
  if (lowerSetName.includes('magic') || lowerSetName.includes('mtg')) {
    return 'Magic';
  }
  if (lowerSetName.includes('yugioh') || lowerSetName.includes('yu-gi-oh')) {
    return 'YuGiOh';
  }
  if (lowerSetName.includes('hockey') || lowerSetName.includes('nhl') || lowerSetName.includes('young guns')) {
    return 'Hockey';
  }
  if (lowerSetName.includes('basketball') || lowerSetName.includes('nba') || lowerSetName.includes('prizm')) {
    return 'Basketball';
  }
  if (lowerSetName.includes('football') || lowerSetName.includes('nfl')) {
    return 'Football';
  }
  
  // Default to Baseball for most trading card sets
  return 'Baseball';
}

// Function to get popular sets from TCDB
async function getPopularTCDBSets(limit = 30) {
  try {
    const allSets = [];
    
    // Scrape popular sports
    const sports = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Pokemon'];
    
    for (const sport of sports) {
      try {
        const sets = await scrapeTCDBSets(sport, Math.ceil(limit / sports.length));
        allSets.push(...sets);
        
        // Add delay between sports to be respectful
        await delay(2000);
      } catch (error) {
        console.error(`Failed to scrape ${sport} sets:`, error.message);
      }
    }

    // Sort by year (newest first) and limit results
    const sortedSets = allSets
      .sort((a, b) => {
        const yearA = parseInt(a.years[0] || '0');
        const yearB = parseInt(b.years[0] || '0');
        return yearB - yearA;
      })
      .slice(0, limit);

    console.log(`✅ Retrieved ${sortedSets.length} popular sets from TCDB`);
    return sortedSets;

  } catch (error) {
    console.error('❌ Error getting popular TCDB sets:', error.message);
    return [];
  }
}

// Function to check TCDB availability
async function checkTCDBStatus() {
  try {
    console.log('🔍 Checking TCDB availability...');
    
    const response = await axios.get('https://www.tcdb.com', {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      timeout: 10000
    });
    
    return {
      success: response.status === 200,
      status: response.status,
      message: response.status === 200 ? 'TCDB is accessible' : `HTTP ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'TCDB is not accessible',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  scrapeTCDBSets,
  searchTCDBSets,
  getPopularTCDBSets,
  checkTCDBStatus
}; 