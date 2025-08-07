const fs = require('fs');
const path = require('path');

const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const TEST_DATASET_FILE = path.join(__dirname, 'data', 'test_psa10_dataset.json');

async function createTestDataset() {
  console.log('📊 Creating test dataset from existing database...');
  
  try {
    // Read the file as text
    const fileContent = fs.readFileSync(DATABASE_FILE, 'utf8');
    console.log('📖 Read database file');
    
    // Extract individual items using regex
    const itemMatches = fileContent.match(/\{[^}]*"title"[^}]*\}/g);
    
    if (!itemMatches) {
      console.error('❌ No items found in database');
      return;
    }
    
    console.log(`📦 Found ${itemMatches.length} potential items`);
    
    const validItems = [];
    let processedCount = 0;
    
    for (const itemStr of itemMatches) {
      try {
        // Clean up the item string
        let cleanItem = itemStr
          .replace(/(\s+)([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":')
          .replace(/:\s*([^",\{\}\[\]\d][^,\{\}\[\]]*[^",\{\}\[\]\s])\s*([,\}\]])/g, ': "$1"$2')
          .replace(/,(\s*[}\]])/g, '$1');
        
        const item = JSON.parse(cleanItem);
        
        // Only include items with title and price
        if (item.title && item.price && item.price.value) {
          validItems.push(item);
        }
        
        processedCount++;
        if (processedCount % 1000 === 0) {
          console.log(`📊 Processed ${processedCount}/${itemMatches.length} items...`);
        }
        
      } catch (itemError) {
        // Skip malformed items
        continue;
      }
    }
    
    console.log(`✅ Found ${validItems.length} valid items`);
    
    // Take a sample for testing
    const testSample = validItems.slice(0, 10);
    
    const testDataset = {
      items: testSample,
      metadata: {
        created: new Date().toISOString(),
        totalItems: testSample.length,
        source: 'extracted from psa10_recent_90_days_database.json',
        description: 'Test dataset for good buy finder'
      }
    };
    
    // Save the test dataset
    fs.writeFileSync(TEST_DATASET_FILE, JSON.stringify(testDataset, null, 2));
    console.log(`💾 Saved ${testSample.length} items to test dataset`);
    
    // Show sample items
    console.log('\n📋 Sample items in test dataset:');
    testSample.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   Price: $${item.price.value}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error creating test dataset:', error.message);
  }
}

if (require.main === module) {
  createTestDataset().catch(console.error);
}

module.exports = { createTestDataset }; 