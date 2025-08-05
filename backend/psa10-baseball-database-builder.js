require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');
const { scrapeEbaySales } = require('./services/ebayScraperService');
const { searchSoldItems } = require('./services/ebayService');

// Database configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_baseball_database.json');
const PSA10_SUMMARY_FILE = path.join(DATABASE_DIR, 'psa10_baseball_summary.json');

// Search parameters from the URL
const SEARCH_CONFIG = {
  keywords: 'PSA 10 baseball',
  category: '261328', // Sports Trading Cards
  sport: 'Baseball',
  seasons: ['2024-25', '2025', '2024', '2023-24', '2023', '2022-23', '2022'],
  soldOnly: true,
  completedOnly: true,
  location: '98' // US only
};

// Ensure database directory exists
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Load existing database
function loadDatabase() {
  try {
    if (fs.existsSync(PSA10_DATABASE_FILE)) {
      const data = fs.readFileSync(PSA10_DATABASE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('⚠️ Error loading existing database:', error.message);
  }
  return {
    items: [],
    metadata: {
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalItems: 0,
      sources: [],
      searchConfig: SEARCH_CONFIG
    }
  };
}

// Save database
function saveDatabase(database) {
  try {
    database.metadata.lastUpdated = new Date().toISOString();
    database.metadata.totalItems = database.items.length;
    
    fs.writeFileSync(PSA10_DATABASE_FILE, JSON.stringify(database, null, 2));
    console.log(`✅ Database saved: ${database.items.length} items`);
    
    // Create summary
    createSummary(database);
    
  } catch (error) {
    console.error('❌ Error saving database:', error.message);
  }
}

// Create summary statistics
function createSummary(database) {
  const summary = {
    totalItems: database.items.length,
    lastUpdated: database.metadata.lastUpdated,
    priceStats: calculatePriceStats(database.items),
    yearStats: calculateYearStats(database.items),
    playerStats: calculatePlayerStats(database.items),
    setStats: calculateSetStats(database.items),
    sourceStats: calculateSourceStats(database.items)
  };
  
  fs.writeFileSync(PSA10_SUMMARY_FILE, JSON.stringify(summary, null, 2));
  console.log('✅ Summary created');
}

// Calculate price statistics
function calculatePriceStats(items) {
  const prices = items.map(item => parseFloat(item.price.value)).filter(p => !isNaN(p));
  
  if (prices.length === 0) return { count: 0 };
  
  return {
    count: prices.length,
    average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
    median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)].toFixed(2),
    min: Math.min(...prices).toFixed(2),
    max: Math.max(...prices).toFixed(2),
    priceRanges: {
      under50: prices.filter(p => p < 50).length,
      '50-100': prices.filter(p => p >= 50 && p < 100).length,
      '100-250': prices.filter(p => p >= 100 && p < 250).length,
      '250-500': prices.filter(p => p >= 250 && p < 500).length,
      '500-1000': prices.filter(p => p >= 500 && p < 1000).length,
      over1000: prices.filter(p => p >= 1000).length
    }
  };
}

// Calculate year statistics
function calculateYearStats(items) {
  const yearCounts = {};
  items.forEach(item => {
    const year = extractYearFromTitle(item.title);
    if (year) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });
  return yearCounts;
}

// Calculate player statistics
function calculatePlayerStats(items) {
  const playerCounts = {};
  const topPlayers = ['Paul Skenes', 'Shohei Ohtani', 'Aaron Judge', 'Elly De La Cruz', 'Jackson Holliday', 'Bobby Witt Jr.'];
  
  topPlayers.forEach(player => {
    playerCounts[player] = items.filter(item => 
      item.title.toLowerCase().includes(player.toLowerCase())
    ).length;
  });
  
  return playerCounts;
}

// Calculate set statistics
function calculateSetStats(items) {
  const setCounts = {};
  const sets = ['Bowman', 'Topps', 'Chrome', 'Series', 'Update', 'Finest', 'Sapphire'];
  
  sets.forEach(set => {
    setCounts[set] = items.filter(item => 
      item.title.toLowerCase().includes(set.toLowerCase())
    ).length;
  });
  
  return setCounts;
}

// Calculate source statistics
function calculateSourceStats(items) {
  const sourceCounts = {};
  items.forEach(item => {
    const source = item.source || 'unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  return sourceCounts;
}

// Extract year from title
function extractYearFromTitle(title) {
  const yearMatch = title.match(/(20\d{2})/);
  return yearMatch ? yearMatch[1] : null;
}

// Deduplicate items
function deduplicateItems(items) {
  const seen = new Set();
  const unique = [];
  
  items.forEach(item => {
    // Create a unique key based on title and price
    const key = `${item.title.toLowerCase()}_${item.price.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  });
  
  return unique;
}

// Collect data from multiple sources
async function collectPSA10Data(targetItems = 100) {
  console.log('🔍 PSA 10 Baseball Database Builder');
  console.log('====================================\n');
  
  const database = loadDatabase();
  const existingIds = new Set(database.items.map(item => item.id));
  
  console.log(`📊 Starting collection (target: ${targetItems} items)`);
  console.log(`📊 Existing items: ${database.items.length}`);
  
  const newItems = [];
  
  // Source 1: 130point.com
  try {
    console.log('\n📈 Collecting from 130point.com...');
    const point130Items = await search130point(SEARCH_CONFIG.keywords, Math.min(50, targetItems));
    
    point130Items.forEach(item => {
      if (!existingIds.has(item.id)) {
        newItems.push({
          ...item,
          collectedAt: new Date().toISOString(),
          source: '130point'
        });
        existingIds.add(item.id);
      }
    });
    
    console.log(`✅ 130point: ${point130Items.length} items found`);
  } catch (error) {
    console.log(`❌ 130point error: ${error.message}`);
  }
  
  // Source 2: eBay Scraper
  try {
    console.log('\n📈 Collecting from eBay scraper...');
    const ebayItems = await scrapeEbaySales(SEARCH_CONFIG.keywords, Math.min(50, targetItems - newItems.length));
    
    ebayItems.forEach(item => {
      if (!existingIds.has(item.id)) {
        newItems.push({
          ...item,
          collectedAt: new Date().toISOString(),
          source: 'ebay_scraper'
        });
        existingIds.add(item.id);
      }
    });
    
    console.log(`✅ eBay Scraper: ${ebayItems.length} items found`);
  } catch (error) {
    console.log(`❌ eBay Scraper error: ${error.message}`);
  }
  
  // Source 3: eBay API (Marketplace Insights)
  try {
    console.log('\n📈 Collecting from eBay API...');
    const apiItems = await searchSoldItems({
      keywords: SEARCH_CONFIG.keywords,
      numSales: Math.min(50, targetItems - newItems.length),
      excludeGraded: false
    });
    
    apiItems.forEach(item => {
      if (!existingIds.has(item.id)) {
        newItems.push({
          ...item,
          collectedAt: new Date().toISOString(),
          source: 'ebay_api'
        });
        existingIds.add(item.id);
      }
    });
    
    console.log(`✅ eBay API: ${apiItems.length} items found`);
  } catch (error) {
    console.log(`❌ eBay API error: ${error.message}`);
  }
  
  // Add new items to database
  if (newItems.length > 0) {
    database.items.push(...newItems);
    database.items = deduplicateItems(database.items);
    
    console.log(`\n📊 Collection Summary:`);
    console.log(`   New items: ${newItems.length}`);
    console.log(`   Total items: ${database.items.length}`);
    console.log(`   Unique items: ${database.items.length}`);
    
    // Save database
    saveDatabase(database);
  } else {
    console.log('\n⚠️ No new items found');
  }
  
  return database;
}

// Main execution
async function main() {
  try {
    const targetItems = process.argv[2] ? parseInt(process.argv[2]) : 100;
    const database = await collectPSA10Data(targetItems);
    
    console.log('\n🎉 Database collection completed!');
    console.log(`📁 Database file: ${PSA10_DATABASE_FILE}`);
    console.log(`📊 Summary file: ${PSA10_SUMMARY_FILE}`);
    console.log(`📈 Total items: ${database.items.length}`);
    
  } catch (error) {
    console.error('❌ Database collection failed:', error.message);
  }
}

// Export functions for use in other modules
module.exports = {
  collectPSA10Data,
  loadDatabase,
  saveDatabase,
  createSummary
};

// Run if called directly
if (require.main === module) {
  main();
} 