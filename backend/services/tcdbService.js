const axios = require('axios');
const cheerio = require('cheerio');

// TCDB base URLs
const TCDB_BASE_URL = 'https://www.tcdb.com';
const TCDB_SPORTS_URLS = {
  Baseball: 'https://www.tcdb.com/ViewAll.cfm/sp/Baseball',
  Basketball: 'https://www.tcdb.com/ViewAll.cfm/sp/Basketball',
  Boxing: 'https://www.tcdb.com/ViewAll.cfm/sp/Boxing',
  Cricket: 'https://www.tcdb.com/ViewAll.cfm/sp/Cricket',
  Football: 'https://www.tcdb.com/ViewAll.cfm/sp/Football',
  Gaming: 'https://www.tcdb.com/ViewAll.cfm/sp/Gaming',
  Golf: 'https://www.tcdb.com/ViewAll.cfm/sp/Golf',
  Hockey: 'https://www.tcdb.com/ViewAll.cfm/sp/Hockey',
  'Misc Sports': 'https://www.tcdb.com/ViewAll.cfm/sp/Misc%20Sports',
  MMA: 'https://www.tcdb.com/ViewAll.cfm/sp/MMA',
  'Multi-Sport': 'https://www.tcdb.com/ViewAll.cfm/sp/Multi-Sport',
  'Non-Sport': 'https://www.tcdb.com/ViewAll.cfm/sp/Non-Sport',
  Racing: 'https://www.tcdb.com/ViewAll.cfm/sp/Racing',
  Soccer: 'https://www.tcdb.com/ViewAll.cfm/sp/Soccer',
  Tennis: 'https://www.tcdb.com/ViewAll.cfm/sp/Tennis',
  Wrestling: 'https://www.tcdb.com/ViewAll.cfm/sp/Wrestling'
};

// Rate limiting - increased to be more respectful
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests

// User agent rotation - more diverse and realistic
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0'
];

// Track failed requests to avoid repeated failures
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

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
  const brands = [
    // Traditional sports brands
    'Topps', 'Bowman', 'Panini', 'Upper Deck', 'Fleer', 'Donruss', 'Score', 'Stadium Club', 'Gallery', 'Heritage', 'Chrome', 'Update', 'Series',
    // Gaming brands
    'Pokemon', 'Magic', 'YuGiOh', 'Wizards of the Coast', 'Konami', 'Nintendo',
    // Non-sport brands
    'Topps', 'Upper Deck', 'Fleer', 'Donruss', 'Panini', 'Leaf', 'Press Pass', 'Rittenhouse',
    // Other brands
    'Pinnacle', 'Skybox', 'Pacific', 'Playoff', 'SP', 'Finest', 'Flair', 'Stadium Club'
  ];
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
    // Check if we've had too many consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`⚠️ TCDB temporarily disabled due to ${consecutiveFailures} consecutive failures`);
      return [];
    }

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
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.tcdb.com/',
        'Cache-Control': 'no-cache'
      },
      timeout: 20000,
      maxRedirects: 5
    });

    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status}: Failed to fetch TCDB data`);
    }

    // Reset consecutive failures on success
    consecutiveFailures = 0;

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
    consecutiveFailures++;
    console.error(`❌ TCDB scraping error for ${sport}:`, error.message);
    
    // Log specific error details for debugging
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response Headers:`, error.response.headers);
    }
    
    // If we get a 403, log it specifically
    if (error.response && error.response.status === 403) {
      console.error(`🚫 TCDB blocked our request (403 Forbidden) - this may be temporary`);
    }
    
    return [];
  }
}

// Function to search TCDB for specific sets
async function searchTCDBSets(query, sport = null, limit = 20) {
  try {
    // Check if we've had too many consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`⚠️ TCDB temporarily disabled due to ${consecutiveFailures} consecutive failures`);
      return [];
    }

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
        'Connection': 'keep-alive',
        'Referer': 'https://www.tcdb.com/',
        'Cache-Control': 'no-cache'
      },
      timeout: 20000,
      maxRedirects: 5
    });

    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status}: Failed to search TCDB`);
    }

    // Reset consecutive failures on success
    consecutiveFailures = 0;

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
    consecutiveFailures++;
    console.error(`❌ TCDB search error:`, error.message);
    
    // Log specific error details for debugging
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response Headers:`, error.response.headers);
    }
    
    // If we get a 403, log it specifically
    if (error.response && error.response.status === 403) {
      console.error(`🚫 TCDB blocked our search request (403 Forbidden) - this may be temporary`);
    }
    
    return [];
  }
}

// Helper function to detect sport from set name
function detectSportFromSet(setName) {
  const lowerSetName = setName.toLowerCase();
  
  // Gaming/Non-Sport categories
  if (lowerSetName.includes('pokemon') || lowerSetName.includes('charizard') || lowerSetName.includes('pikachu')) {
    return 'Gaming';
  }
  if (lowerSetName.includes('magic') || lowerSetName.includes('mtg')) {
    return 'Gaming';
  }
  if (lowerSetName.includes('yugioh') || lowerSetName.includes('yu-gi-oh')) {
    return 'Gaming';
  }
  if (lowerSetName.includes('star wars') || lowerSetName.includes('marvel') || lowerSetName.includes('dc') || lowerSetName.includes('disney')) {
    return 'Non-Sport';
  }
  
  // Traditional sports
  if (lowerSetName.includes('hockey') || lowerSetName.includes('nhl') || lowerSetName.includes('young guns')) {
    return 'Hockey';
  }
  if (lowerSetName.includes('basketball') || lowerSetName.includes('nba') || lowerSetName.includes('prizm')) {
    return 'Basketball';
  }
  if (lowerSetName.includes('football') || lowerSetName.includes('nfl')) {
    return 'Football';
  }
  if (lowerSetName.includes('soccer') || lowerSetName.includes('fifa') || lowerSetName.includes('mls')) {
    return 'Soccer';
  }
  if (lowerSetName.includes('tennis')) {
    return 'Tennis';
  }
  if (lowerSetName.includes('golf')) {
    return 'Golf';
  }
  if (lowerSetName.includes('boxing')) {
    return 'Boxing';
  }
  if (lowerSetName.includes('mma') || lowerSetName.includes('ufc')) {
    return 'MMA';
  }
  if (lowerSetName.includes('wrestling') || lowerSetName.includes('wwe')) {
    return 'Wrestling';
  }
  if (lowerSetName.includes('racing') || lowerSetName.includes('nascar') || lowerSetName.includes('f1')) {
    return 'Racing';
  }
  if (lowerSetName.includes('cricket')) {
    return 'Cricket';
  }
  
  // Default to Baseball for most trading card sets
  return 'Baseball';
}

// Function to get popular sets from TCDB
async function getPopularTCDBSets(limit = 30) {
  try {
    const allSets = [];
    
    // Scrape popular sports (focus on the most popular ones to avoid too many requests)
    const popularSports = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Gaming', 'Non-Sport'];
    
    for (const sport of popularSports) {
      try {
        const sets = await scrapeTCDBSets(sport, Math.ceil(limit / popularSports.length));
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
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    });
    
    // Reset consecutive failures if we can reach TCDB
    consecutiveFailures = 0;
    
    return {
      success: response.status === 200,
      status: response.status,
      message: response.status === 200 ? 'TCDB is accessible' : `HTTP ${response.status}`,
      consecutiveFailures: consecutiveFailures,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'TCDB is not accessible',
      consecutiveFailures: consecutiveFailures,
      timestamp: new Date().toISOString()
    };
  }
}

// Function to reset failure counter (useful for testing)
function resetTCDBFailures() {
  consecutiveFailures = 0;
  console.log('🔄 TCDB failure counter reset');
}

module.exports = {
  scrapeTCDBSets,
  searchTCDBSets,
  getPopularTCDBSets,
  checkTCDBStatus,
  resetTCDBFailures
}; 