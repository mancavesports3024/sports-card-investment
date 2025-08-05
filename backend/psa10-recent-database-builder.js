require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Database configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const PSA10_SUMMARY_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_summary.json');

// Search configurations for different sports and categories
const SEARCH_CONFIGS = [
  { keywords: 'PSA 10', description: 'All PSA 10 cards' },
  { keywords: 'PSA 10 baseball', description: 'PSA 10 Baseball cards' },
  { keywords: 'PSA 10 football', description: 'PSA 10 Football cards' },
  { keywords: 'PSA 10 basketball', description: 'PSA 10 Basketball cards' },
  { keywords: 'PSA 10 hockey', description: 'PSA 10 Hockey cards' },
  { keywords: 'PSA 10 soccer', description: 'PSA 10 Soccer cards' },
  { keywords: 'PSA 10 pokemon', description: 'PSA 10 Pokemon cards' },
  { keywords: 'PSA 10 magic', description: 'PSA 10 Magic cards' },
  { keywords: 'PSA 10 yugioh', description: 'PSA 10 Yu-Gi-Oh cards' },
  { keywords: 'PSA 10 rookie', description: 'PSA 10 Rookie cards' },
  { keywords: 'PSA 10 auto', description: 'PSA 10 Autograph cards' },
  { keywords: 'PSA 10 patch', description: 'PSA 10 Patch cards' },
  { keywords: 'PSA 10 numbered', description: 'PSA 10 Numbered cards' },
  { keywords: 'PSA 10 refractor', description: 'PSA 10 Refractor cards' },
  { keywords: 'PSA 10 chrome', description: 'PSA 10 Chrome cards' }
];

// Ensure database directory exists
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Calculate 90 days ago
function getNinetyDaysAgo() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return ninetyDaysAgo;
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
      sources: ['130point'],
      searchConfigs: SEARCH_CONFIGS.map(config => config.description),
      filterApplied: 'Last 90 days only',
      cutoffDate: getNinetyDaysAgo().toISOString()
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
    filterApplied: database.metadata.filterApplied,
    cutoffDate: database.metadata.cutoffDate,
    priceStats: calculatePriceStats(database.items),
    yearStats: calculateYearStats(database.items),
    sportStats: calculateSportStats(database.items),
    playerStats: calculatePlayerStats(database.items),
    setStats: calculateSetStats(database.items),
    categoryStats: calculateCategoryStats(database.items),
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
      '1000-5000': prices.filter(p => p >= 1000 && p < 5000).length,
      over5000: prices.filter(p => p >= 5000).length
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

// Calculate sport statistics
function calculateSportStats(items) {
  const sportCounts = {};
  const sports = ['baseball', 'football', 'basketball', 'hockey', 'soccer', 'pokemon', 'magic', 'yugioh'];
  
  sports.forEach(sport => {
    sportCounts[sport] = items.filter(item => 
      item.title.toLowerCase().includes(sport.toLowerCase())
    ).length;
  });
  
  return sportCounts;
}

// Calculate player statistics
function calculatePlayerStats(items) {
  const playerCounts = {};
  const topPlayers = [
    // Baseball
    'Paul Skenes', 'Shohei Ohtani', 'Aaron Judge', 'Elly De La Cruz', 'Jackson Holliday', 'Bobby Witt Jr.',
    'Mike Trout', 'Ronald Acuña Jr.', 'Juan Soto', 'Fernando Tatis Jr.',
    // Basketball
    'LeBron James', 'Michael Jordan', 'Kobe Bryant', 'Stephen Curry', 'Giannis Antetokounmpo', 'Luka Doncic',
    // Football
    'Tom Brady', 'Patrick Mahomes', 'Josh Allen', 'Joe Burrow', 'Justin Herbert',
    // Hockey
    'Connor McDavid', 'Sidney Crosby', 'Alexander Ovechkin', 'Nathan MacKinnon',
    // Pokemon
    'Charizard', 'Pikachu', 'Blastoise', 'Venusaur'
  ];
  
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
  const sets = [
    'Bowman', 'Topps', 'Chrome', 'Series', 'Update', 'Finest', 'Sapphire',
    'Panini', 'Prizm', 'Select', 'Donruss', 'Leaf', 'Upper Deck',
    'Pokemon', 'Magic', 'Yu-Gi-Oh', 'Fleer', 'Score', 'Stadium Club'
  ];
  
  sets.forEach(set => {
    setCounts[set] = items.filter(item => 
      item.title.toLowerCase().includes(set.toLowerCase())
    ).length;
  });
  
  return setCounts;
}

// Calculate category statistics
function calculateCategoryStats(items) {
  const categoryCounts = {};
  const categories = ['rookie', 'auto', 'autograph', 'patch', 'numbered', 'refractor', 'parallel', 'insert'];
  
  categories.forEach(category => {
    categoryCounts[category] = items.filter(item => 
      item.title.toLowerCase().includes(category.toLowerCase())
    ).length;
  });
  
  return categoryCounts;
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

// Filter items to only those sold in the last 90 days
function filterToRecentItems(items) {
  const ninetyDaysAgo = getNinetyDaysAgo();
  return items.filter(item => {
    const soldDate = new Date(item.soldDate);
    return soldDate >= ninetyDaysAgo;
  });
}

// Collect data from 130point.com for multiple search terms
async function collectRecentPSA10Data(targetItemsPerSearch = 1000) {
  console.log('🔍 PSA 10 Recent Database Builder (Last 90 Days Only)');
  console.log('====================================================\n');
  
  const database = loadDatabase();
  const existingIds = new Set(database.items.map(item => item.id));
  const ninetyDaysAgo = getNinetyDaysAgo();
  
  console.log(`📊 Starting collection (${SEARCH_CONFIGS.length} search terms, ${targetItemsPerSearch} items each)`);
  console.log(`📊 Existing items: ${database.items.length}`);
  console.log(`📅 Only keeping items sold after: ${ninetyDaysAgo.toLocaleDateString()}`);
  
  const newItems = [];
  let totalSearches = 0;
  let successfulSearches = 0;
  let totalItemsCollected = 0;
  let totalItemsFiltered = 0;
  
  for (const config of SEARCH_CONFIGS) {
    totalSearches++;
    console.log(`\n📈 Search ${totalSearches}/${SEARCH_CONFIGS.length}: "${config.keywords}"`);
    console.log(`   Description: ${config.description}`);
    
    try {
      const items = await search130point(config.keywords, targetItemsPerSearch);
      totalItemsCollected += items.length;
      
      // Filter to only recent items
      const recentItems = filterToRecentItems(items);
      totalItemsFiltered += recentItems.length;
      
      let addedCount = 0;
      recentItems.forEach(item => {
        if (!existingIds.has(item.id)) {
          newItems.push({
            ...item,
            collectedAt: new Date().toISOString(),
            source: '130point',
            searchTerm: config.keywords,
            searchCategory: config.description
          });
          existingIds.add(item.id);
          addedCount++;
        }
      });
      
      console.log(`   ✅ Found: ${items.length} items, Recent: ${recentItems.length}, Added: ${addedCount} new items`);
      successfulSearches++;
      
      // Small delay between searches to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Add new items to database
  if (newItems.length > 0) {
    database.items.push(...newItems);
    database.items = deduplicateItems(database.items);
    
    console.log(`\n📊 Collection Summary:`);
    console.log(`   Successful searches: ${successfulSearches}/${totalSearches}`);
    console.log(`   Total items collected: ${totalItemsCollected}`);
    console.log(`   Items in last 90 days: ${totalItemsFiltered}`);
    console.log(`   New items added: ${newItems.length}`);
    console.log(`   Total items in database: ${database.items.length}`);
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
    const targetItemsPerSearch = process.argv[2] ? parseInt(process.argv[2]) : 1000;
    const database = await collectRecentPSA10Data(targetItemsPerSearch);
    
    console.log('\n🎉 Recent database collection completed!');
    console.log(`📁 Database file: ${PSA10_DATABASE_FILE}`);
    console.log(`📊 Summary file: ${PSA10_SUMMARY_FILE}`);
    console.log(`📈 Total items: ${database.items.length}`);
    console.log(`🔍 Search terms used: ${SEARCH_CONFIGS.length}`);
    console.log(`📅 Filter: Last 90 days only`);
    
  } catch (error) {
    console.error('❌ Database collection failed:', error.message);
  }
}

// Export functions for use in other modules
module.exports = {
  collectRecentPSA10Data,
  loadDatabase,
  saveDatabase,
  createSummary,
  filterToRecentItems
};

// Run if called directly
if (require.main === module) {
  main();
} 