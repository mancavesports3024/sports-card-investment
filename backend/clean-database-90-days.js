require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_comprehensive_database.json');
const CLEAN_DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const CLEAN_SUMMARY_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_summary.json');

function cleanDatabaseTo90Days() {
  try {
    console.log('🧹 Cleaning Database to Last 90 Days Only');
    console.log('==========================================\n');
    
    // Load the comprehensive database
    const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
    const allItems = data.items;
    
    console.log(`📊 Original Database: ${allItems.length} items`);
    
    // Calculate 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    console.log(`📅 Filtering to items sold after: ${ninetyDaysAgo.toLocaleDateString()}`);
    
    // Filter items to only those sold in the last 90 days
    const recentItems = allItems.filter(item => {
      const soldDate = new Date(item.soldDate);
      return soldDate >= ninetyDaysAgo;
    });
    
    console.log(`✅ Recent Items (Last 90 Days): ${recentItems.length} items`);
    console.log(`🗑️  Items Removed: ${allItems.length - recentItems.length} items`);
    
    // Create new database structure
    const cleanDatabase = {
      items: recentItems,
      metadata: {
        ...data.metadata,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalItems: recentItems.length,
        filterApplied: 'Last 90 days only',
        originalDatabaseSize: allItems.length,
        itemsRemoved: allItems.length - recentItems.length,
        cutoffDate: ninetyDaysAgo.toISOString()
      }
    };
    
    // Save cleaned database
    fs.writeFileSync(CLEAN_DATABASE_FILE, JSON.stringify(cleanDatabase, null, 2));
    console.log(`💾 Cleaned database saved: ${CLEAN_DATABASE_FILE}`);
    
    // Create summary statistics
    const summary = createSummary(cleanDatabase);
    fs.writeFileSync(CLEAN_SUMMARY_FILE, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary saved: ${CLEAN_SUMMARY_FILE}`);
    
    // Display some statistics
    console.log('\n📈 Recent 90 Days Statistics:');
    console.log('==============================\n');
    
    if (recentItems.length > 0) {
      const prices = recentItems.map(item => parseFloat(item.price.value)).filter(p => !isNaN(p));
      const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      const minPrice = Math.min(...prices).toFixed(2);
      const maxPrice = Math.max(...prices).toFixed(2);
      
      console.log(`💰 Price Statistics:`);
      console.log(`   Average Price: $${avgPrice}`);
      console.log(`   Price Range: $${minPrice} - $${maxPrice}`);
      console.log(`   Total Items: ${recentItems.length}`);
      
      // Show date range of recent items
      const recentDates = recentItems.map(item => new Date(item.soldDate));
      const oldestRecent = new Date(Math.min(...recentDates));
      const newestRecent = new Date(Math.max(...recentDates));
      
      console.log(`\n📅 Recent Date Range:`);
      console.log(`   Oldest: ${oldestRecent.toLocaleDateString()}`);
      console.log(`   Newest: ${newestRecent.toLocaleDateString()}`);
      
      // Show some sample recent items
      console.log('\n📋 Sample Recent Items (Last 10):');
      const sortedByDate = recentItems
        .map(item => ({ ...item, date: new Date(item.soldDate) }))
        .sort((a, b) => b.date - a.date)
        .slice(0, 10);
      
      sortedByDate.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.title}`);
        console.log(`   💰 Price: $${item.price.value}`);
        console.log(`   📅 Sold: ${item.date.toLocaleDateString()}`);
        console.log(`   🏈 Category: ${item.searchCategory}`);
      });
    } else {
      console.log('⚠️ No items found in the last 90 days');
    }
    
    console.log('\n✅ Database cleaning completed successfully!');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error.message);
  }
}

// Create summary statistics (reusing from the main database builder)
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
  
  return summary;
}

// Helper functions (reused from main database builder)
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

function calculatePlayerStats(items) {
  const playerCounts = {};
  const topPlayers = [
    'Paul Skenes', 'Shohei Ohtani', 'Aaron Judge', 'Elly De La Cruz', 'Jackson Holliday', 'Bobby Witt Jr.',
    'Mike Trout', 'Ronald Acuña Jr.', 'Juan Soto', 'Fernando Tatis Jr.',
    'LeBron James', 'Michael Jordan', 'Kobe Bryant', 'Stephen Curry', 'Giannis Antetokounmpo', 'Luka Doncic',
    'Tom Brady', 'Patrick Mahomes', 'Josh Allen', 'Joe Burrow', 'Justin Herbert',
    'Connor McDavid', 'Sidney Crosby', 'Alexander Ovechkin', 'Nathan MacKinnon',
    'Charizard', 'Pikachu', 'Blastoise', 'Venusaur'
  ];
  
  topPlayers.forEach(player => {
    playerCounts[player] = items.filter(item => 
      item.title.toLowerCase().includes(player.toLowerCase())
    ).length;
  });
  
  return playerCounts;
}

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

function calculateSourceStats(items) {
  const sourceCounts = {};
  items.forEach(item => {
    const source = item.source || 'unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  return sourceCounts;
}

function extractYearFromTitle(title) {
  const yearMatch = title.match(/(20\d{2})/);
  return yearMatch ? yearMatch[1] : null;
}

// Run the cleaning
cleanDatabaseTo90Days(); 