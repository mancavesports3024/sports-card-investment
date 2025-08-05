require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_comprehensive_database.json');
const SUMMARY_FILE = path.join(__dirname, 'data', 'psa10_comprehensive_summary.json');

// Load database
function loadDatabase() {
  try {
    if (fs.existsSync(DATABASE_FILE)) {
      return JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading database:', error.message);
  }
  return null;
}

// Load summary
function loadSummary() {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      return JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading summary:', error.message);
  }
  return null;
}

// Display comprehensive database overview
function displayOverview(database, summary) {
  console.log('📊 PSA 10 Comprehensive Database Overview');
  console.log('=========================================\n');
  
  console.log(`📈 Total Items: ${summary.totalItems}`);
  console.log(`🕒 Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}`);
  console.log(`📁 Database Size: ${(fs.statSync(DATABASE_FILE).size / 1024).toFixed(2)} KB`);
  
  console.log('\n💰 Price Statistics:');
  console.log(`   Average Price: $${summary.priceStats.average}`);
  console.log(`   Median Price: $${summary.priceStats.median}`);
  console.log(`   Price Range: $${summary.priceStats.min} - $${summary.priceStats.max}`);
  
  console.log('\n📊 Price Distribution:');
  Object.entries(summary.priceStats.priceRanges).forEach(([range, count]) => {
    const percentage = ((count / summary.totalItems) * 100).toFixed(1);
    console.log(`   $${range}: ${count} items (${percentage}%)`);
  });
  
  console.log('\n📅 Year Distribution:');
  Object.entries(summary.yearStats).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([year, count]) => {
    const percentage = ((count / summary.totalItems) * 100).toFixed(1);
    console.log(`   ${year}: ${count} items (${percentage}%)`);
  });
  
  console.log('\n🏈 Sport Distribution:');
  Object.entries(summary.sportStats).sort((a, b) => b[1] - a[1]).forEach(([sport, count]) => {
    if (count > 0) {
      const percentage = ((count / summary.totalItems) * 100).toFixed(1);
      console.log(`   ${sport}: ${count} items (${percentage}%)`);
    }
  });
  
  console.log('\n🎯 Top Players:');
  Object.entries(summary.playerStats).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([player, count]) => {
    if (count > 0) {
      console.log(`   ${player}: ${count} items`);
    }
  });
  
  console.log('\n🏷️  Top Sets:');
  Object.entries(summary.setStats).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([set, count]) => {
    if (count > 0) {
      const percentage = ((count / summary.totalItems) * 100).toFixed(1);
      console.log(`   ${set}: ${count} items (${percentage}%)`);
    }
  });
  
  console.log('\n🏆 Top Categories:');
  Object.entries(summary.categoryStats).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
    if (count > 0) {
      const percentage = ((count / summary.totalItems) * 100).toFixed(1);
      console.log(`   ${category}: ${count} items (${percentage}%)`);
    }
  });
}

// Display recent sales
function displayRecentSales(database, limit = 10) {
  console.log(`\n🕒 Recent Sales (Last ${limit}):`);
  console.log('================================\n');
  
  const recentItems = database.items
    .sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate))
    .slice(0, limit);
  
  recentItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   💰 Price: $${item.price.value}`);
    console.log(`   📅 Sold: ${new Date(item.soldDate).toLocaleDateString()}`);
    console.log(`   🏷️  Type: ${item.saleType}`);
    console.log(`   🏈 Category: ${item.searchCategory}`);
    console.log(`   🔗 URL: ${item.itemWebUrl}`);
    console.log('');
  });
}

// Display highest value sales
function displayHighestValueSales(database, limit = 10) {
  console.log(`\n💎 Highest Value Sales (Top ${limit}):`);
  console.log('=====================================\n');
  
  const highValueItems = database.items
    .sort((a, b) => parseFloat(b.price.value) - parseFloat(a.price.value))
    .slice(0, limit);
  
  highValueItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   💰 Price: $${item.price.value}`);
    console.log(`   📅 Sold: ${new Date(item.soldDate).toLocaleDateString()}`);
    console.log(`   🏷️  Type: ${item.saleType}`);
    console.log(`   🏈 Category: ${item.searchCategory}`);
    console.log(`   🔗 URL: ${item.itemWebUrl}`);
    console.log('');
  });
}

// Display sport-specific analysis
function displaySportAnalysis(database, summary) {
  console.log('\n🏈 Sport-Specific Analysis:');
  console.log('===========================\n');
  
  const sports = ['baseball', 'football', 'basketball', 'hockey', 'soccer', 'pokemon', 'magic', 'yugioh'];
  
  sports.forEach(sport => {
    const sportItems = database.items.filter(item => 
      item.title.toLowerCase().includes(sport.toLowerCase())
    );
    
    if (sportItems.length > 0) {
      const prices = sportItems.map(item => parseFloat(item.price.value)).filter(p => !isNaN(p));
      const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      const maxPrice = Math.max(...prices).toFixed(2);
      const minPrice = Math.min(...prices).toFixed(2);
      
      console.log(`${sport.toUpperCase()}:`);
      console.log(`   Items: ${sportItems.length}`);
      console.log(`   Average Price: $${avgPrice}`);
      console.log(`   Price Range: $${minPrice} - $${maxPrice}`);
      console.log('');
    }
  });
}

// Display category analysis
function displayCategoryAnalysis(database, summary) {
  console.log('\n🏆 Category Analysis:');
  console.log('====================\n');
  
  const categories = ['rookie', 'auto', 'autograph', 'patch', 'numbered', 'refractor', 'parallel', 'insert'];
  
  categories.forEach(category => {
    const categoryItems = database.items.filter(item => 
      item.title.toLowerCase().includes(category.toLowerCase())
    );
    
    if (categoryItems.length > 0) {
      const prices = categoryItems.map(item => parseFloat(item.price.value)).filter(p => !isNaN(p));
      const avgPrice = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      const maxPrice = Math.max(...prices).toFixed(2);
      const minPrice = Math.min(...prices).toFixed(2);
      
      console.log(`${category.toUpperCase()}:`);
      console.log(`   Items: ${categoryItems.length}`);
      console.log(`   Average Price: $${avgPrice}`);
      console.log(`   Price Range: $${minPrice} - $${maxPrice}`);
      console.log('');
    }
  });
}

// Search database
function searchDatabase(database, query) {
  console.log(`\n🔍 Search Results for: "${query}"`);
  console.log('================================\n');
  
  const results = database.items.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  );
  
  if (results.length === 0) {
    console.log('No results found.');
    return;
  }
  
  console.log(`Found ${results.length} items:\n`);
  
  results.slice(0, 10).forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   💰 Price: $${item.price.value}`);
    console.log(`   📅 Sold: ${new Date(item.soldDate).toLocaleDateString()}`);
    console.log(`   🏷️  Type: ${item.saleType}`);
    console.log(`   🏈 Category: ${item.searchCategory}`);
    console.log('');
  });
  
  if (results.length > 10) {
    console.log(`... and ${results.length - 10} more items`);
  }
}

// Analyze trends
function analyzeTrends(database) {
  console.log('\n📈 Market Trends Analysis');
  console.log('=========================\n');
  
  // Group by month
  const monthlyData = {};
  database.items.forEach(item => {
    const date = new Date(item.soldDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, totalValue: 0, items: [] };
    }
    
    monthlyData[monthKey].count++;
    monthlyData[monthKey].totalValue += parseFloat(item.price.value);
    monthlyData[monthKey].items.push(item);
  });
  
  // Sort by month
  const sortedMonths = Object.keys(monthlyData).sort();
  
  console.log('📊 Monthly Sales Volume:');
  sortedMonths.forEach(month => {
    const data = monthlyData[month];
    const avgPrice = (data.totalValue / data.count).toFixed(2);
    console.log(`   ${month}: ${data.count} sales, avg $${avgPrice}`);
  });
  
  // Price trend analysis
  const recentItems = database.items
    .sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate))
    .slice(0, 50);
  
  const recentAvg = recentItems.reduce((sum, item) => sum + parseFloat(item.price.value), 0) / recentItems.length;
  const olderItems = database.items
    .sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate))
    .slice(50, 100);
  
  const olderAvg = olderItems.reduce((sum, item) => sum + parseFloat(item.price.value), 0) / olderItems.length;
  
  console.log('\n📈 Price Trend:');
  console.log(`   Recent 50 items avg: $${recentAvg.toFixed(2)}`);
  console.log(`   Previous 50 items avg: $${olderAvg.toFixed(2)}`);
  
  const trend = recentAvg > olderAvg ? '↗️ Rising' : recentAvg < olderAvg ? '↘️ Falling' : '→ Stable';
  console.log(`   Trend: ${trend}`);
}

// Main function
function main() {
  const database = loadDatabase();
  const summary = loadSummary();
  
  if (!database || !summary) {
    console.error('❌ Could not load database files');
    return;
  }
  
  // Display overview
  displayOverview(database, summary);
  
  // Display recent sales
  displayRecentSales(database, 5);
  
  // Display highest value sales
  displayHighestValueSales(database, 5);
  
  // Display sport analysis
  displaySportAnalysis(database, summary);
  
  // Display category analysis
  displayCategoryAnalysis(database, summary);
  
  // Analyze trends
  analyzeTrends(database);
  
  // Search examples
  console.log('\n🔍 Quick Searches:');
  console.log('==================\n');
  
  const searchTerms = ['Paul Skenes', 'Shohei Ohtani', 'LeBron James', 'Patrick Mahomes', 'Charizard', 'Kobe Bryant'];
  searchTerms.forEach(term => {
    const results = database.items.filter(item => 
      item.title.toLowerCase().includes(term.toLowerCase())
    );
    console.log(`${term}: ${results.length} items`);
  });
}

// Export functions
module.exports = {
  loadDatabase,
  loadSummary,
  displayOverview,
  displayRecentSales,
  displayHighestValueSales,
  displaySportAnalysis,
  displayCategoryAnalysis,
  searchDatabase,
  analyzeTrends
};

// Run if called directly
if (require.main === module) {
  main();
} 