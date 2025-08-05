require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');

// Calculate average price from search results
function calculateAveragePrice(items) {
  if (!items || items.length === 0) return null;
  
  const prices = items
    .map(item => parseFloat(item.price.value))
    .filter(price => !isNaN(price) && price > 0);
  
  if (prices.length === 0) return null;
  
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  return Math.round(average * 100) / 100; // Round to 2 decimal places
}

// Search for PSA 9 prices
async function searchPSA9Prices(summaryTitle) {
  try {
    // Create search query: summary title + "PSA 9"
    const searchQuery = `${summaryTitle} PSA 9`;
    console.log(`   🔍 Searching PSA 9: "${searchQuery}"`);
    
    const results = await search130point(searchQuery, 50);
    
    if (results && results.length > 0) {
      const avgPrice = calculateAveragePrice(results);
      console.log(`   ✅ PSA 9 found: ${results.length} sales, avg: $${avgPrice}`);
      return avgPrice;
    } else {
      console.log(`   ⚠️  No PSA 9 sales found`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ PSA 9 search error: ${error.message}`);
    return null;
  }
}

// Search for raw (ungraded) prices
async function searchRawPrices(summaryTitle) {
  try {
    // Remove any grading indicators and search for raw cards
    let searchQuery = summaryTitle;
    
    // Remove common grading terms
    searchQuery = searchQuery.replace(/\b(PSA|SGC|BGS|CGC|CSG|HGA|TAG)\s+\d+\b/gi, '');
    searchQuery = searchQuery.replace(/\b(GEM|MINT|NM-MT|NM|EX-MT|EX|VG-EX|VG|GOOD|PR)\b/gi, '');
    searchQuery = searchQuery.replace(/\b(AUTHENTIC|AUTH|ALTERED|MK|MC)\b/gi, '');
    
    // Clean up extra spaces
    searchQuery = searchQuery.replace(/\s+/g, ' ').trim();
    
    // Add "raw" to the search
    searchQuery = `${searchQuery} raw`;
    
    console.log(`   🔍 Searching Raw: "${searchQuery}"`);
    
    const results = await search130point(searchQuery, 50);
    
    if (results && results.length > 0) {
      const avgPrice = calculateAveragePrice(results);
      console.log(`   ✅ Raw found: ${results.length} sales, avg: $${avgPrice}`);
      return avgPrice;
    } else {
      // Try alternative search without "raw"
      const altQuery = summaryTitle.replace(/\b(PSA|SGC|BGS|CGC|CSG|HGA|TAG)\s+\d+\b/gi, '');
      console.log(`   🔍 Trying alt search: "${altQuery}"`);
      
      const altResults = await search130point(altQuery, 50);
      
      if (altResults && altResults.length > 0) {
        const avgPrice = calculateAveragePrice(altResults);
        console.log(`   ✅ Alt search found: ${altResults.length} sales, avg: $${avgPrice}`);
        return avgPrice;
      } else {
        console.log(`   ⚠️  No raw sales found`);
        return null;
      }
    }
  } catch (error) {
    console.log(`   ❌ Raw search error: ${error.message}`);
    return null;
  }
}

// Add price comparisons to recent items
async function addPriceComparisonsToRecent() {
  try {
    console.log('💰 Adding Price Comparisons to Recent Items (Last 1,000)');
    console.log('======================================================\n');
    
    // Load the database
    const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
    const items = data.items;
    
    // Get the most recent 1,000 items (by sold date)
    const recentItems = items
      .sort((a, b) => new Date(b.soldDate) - new Date(a.soldDate))
      .slice(0, 1000);
    
    console.log(`📊 Processing ${recentItems.length} most recent items...`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let psa9Found = 0;
    let rawFound = 0;
    
    // Process items in batches to save progress
    const batchSize = 25; // Smaller batches for faster progress
    const totalBatches = Math.ceil(recentItems.length / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const startIndex = batch * batchSize;
      const endIndex = Math.min(startIndex + batchSize, recentItems.length);
      const batchItems = recentItems.slice(startIndex, endIndex);
      
      console.log(`\n📦 Processing Batch ${batch + 1}/${totalBatches} (Items ${startIndex + 1}-${endIndex})`);
      
      for (let i = 0; i < batchItems.length; i++) {
        const item = batchItems[i];
        processedCount++;
        
        if (item.summaryTitle) {
          console.log(`\n📈 Item ${processedCount}/${recentItems.length}: ${item.summaryTitle}`);
          
          // Search for PSA 9 prices
          const psa9Price = await searchPSA9Prices(item.summaryTitle);
          
          // Search for raw prices
          const rawPrice = await searchRawPrices(item.summaryTitle);
          
          // Add prices to item
          if (psa9Price !== null) {
            item.psa9AveragePrice = psa9Price;
            psa9Found++;
          }
          
          if (rawPrice !== null) {
            item.rawAveragePrice = rawPrice;
            rawFound++;
          }
          
          if (psa9Price !== null || rawPrice !== null) {
            updatedCount++;
          }
          
          // Add current PSA 10 price for comparison
          item.psa10Price = parseFloat(item.price.value);
          
          // Calculate price differences
          if (psa9Price !== null && item.psa10Price) {
            item.psa10vsPsa9Difference = Math.round((item.psa10Price - psa9Price) * 100) / 100;
            item.psa10vsPsa9Percentage = Math.round(((item.psa10Price - psa9Price) / psa9Price * 100) * 100) / 100;
          }
          
          if (rawPrice !== null && item.psa10Price) {
            item.psa10vsRawDifference = Math.round((item.psa10Price - rawPrice) * 100) / 100;
            item.psa10vsRawPercentage = Math.round(((item.psa10Price - rawPrice) / rawPrice * 100) * 100) / 100;
          }
          
          // Small delay between searches
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      // Save progress after each batch
      console.log(`\n💾 Saving progress after batch ${batch + 1}...`);
      data.metadata.lastUpdated = new Date().toISOString();
      data.metadata.recentPriceComparisons = {
        lastBatch: batch + 1,
        itemsWithPSA9Prices: psa9Found,
        itemsWithRawPrices: rawFound,
        itemsUpdated: updatedCount
      };
      fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
      
      console.log(`📊 Batch ${batch + 1} completed: ${processedCount}/${recentItems.length} items processed`);
      console.log(`   PSA 9 prices found: ${psa9Found}`);
      console.log(`   Raw prices found: ${rawFound}`);
      console.log(`   Items updated: ${updatedCount}`);
    }
    
    // Update metadata
    data.metadata.lastUpdated = new Date().toISOString();
    data.metadata.recentPriceComparisonsCompleted = true;
    data.metadata.itemsWithPSA9Prices = psa9Found;
    data.metadata.itemsWithRawPrices = rawFound;
    data.metadata.itemsUpdated = updatedCount;
    
    // Save updated database
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Price comparisons added successfully!`);
    console.log(`📊 Total items processed: ${processedCount}`);
    console.log(`💰 PSA 9 prices found: ${psa9Found}`);
    console.log(`💰 Raw prices found: ${rawFound}`);
    console.log(`📝 Items updated: ${updatedCount}`);
    
    // Show some examples
    console.log('\n📋 Sample Items with Price Comparisons:');
    console.log('========================================\n');
    
    const sampleItems = recentItems.filter(item => item.psa9AveragePrice || item.rawAveragePrice).slice(0, 10);
    sampleItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.summaryTitle}`);
      console.log(`   PSA 10: $${item.psa10Price}`);
      if (item.psa9AveragePrice) {
        console.log(`   PSA 9: $${item.psa9AveragePrice} (${item.psa10vsPsa9Difference > 0 ? '+' : ''}$${item.psa10vsPsa9Difference}, ${item.psa10vsPsa9Percentage > 0 ? '+' : ''}${item.psa10vsPsa9Percentage}%)`);
      }
      if (item.rawAveragePrice) {
        console.log(`   Raw: $${item.rawAveragePrice} (${item.psa10vsRawDifference > 0 ? '+' : ''}$${item.psa10vsRawDifference}, ${item.psa10vsRawPercentage > 0 ? '+' : ''}${item.psa10vsRawPercentage}%)`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error processing database:', error.message);
  }
}

// Run the script
addPriceComparisonsToRecent(); 