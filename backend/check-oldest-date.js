require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Load the comprehensive database
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_comprehensive_database.json');

function findDateRange() {
  try {
    const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
    const items = data.items;
    
    console.log('📅 PSA 10 Database Date Analysis');
    console.log('================================\n');
    
    // Convert all sold dates to Date objects and find min/max
    const dates = items.map(item => new Date(item.soldDate)).filter(date => !isNaN(date.getTime()));
    
    if (dates.length === 0) {
      console.log('❌ No valid dates found in database');
      return;
    }
    
    const oldestDate = new Date(Math.min(...dates));
    const newestDate = new Date(Math.max(...dates));
    
    console.log(`📊 Total Items: ${items.length}`);
    console.log(`📅 Items with Valid Dates: ${dates.length}`);
    console.log(`\n🕒 Date Range:`);
    console.log(`   Oldest Sale: ${oldestDate.toLocaleDateString()} (${oldestDate.toISOString()})`);
    console.log(`   Newest Sale: ${newestDate.toLocaleDateString()} (${newestDate.toISOString()})`);
    console.log(`   Date Span: ${Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24))} days`);
    
    // Show some examples of the oldest items
    console.log('\n📋 Oldest Sales (First 10):');
    const sortedByDate = items
      .map(item => ({ ...item, date: new Date(item.soldDate) }))
      .filter(item => !isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date)
      .slice(0, 10);
    
    sortedByDate.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   💰 Price: $${item.price.value}`);
      console.log(`   📅 Sold: ${item.date.toLocaleDateString()}`);
      console.log(`   🏈 Category: ${item.searchCategory}`);
    });
    
    // Show some examples of the newest items
    console.log('\n📋 Newest Sales (Last 10):');
    const sortedByDateDesc = items
      .map(item => ({ ...item, date: new Date(item.soldDate) }))
      .filter(item => !isNaN(item.date.getTime()))
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);
    
    sortedByDateDesc.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   💰 Price: $${item.price.value}`);
      console.log(`   📅 Sold: ${item.date.toLocaleDateString()}`);
      console.log(`   🏈 Category: ${item.searchCategory}`);
    });
    
  } catch (error) {
    console.error('❌ Error reading database:', error.message);
  }
}

findDateRange(); 