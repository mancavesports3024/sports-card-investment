require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create backup of current database
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `psa10_database_backup_${timestamp}.json`);
  
  try {
    fs.copyFileSync(DATABASE_FILE, backupFile);
    console.log(`💾 Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
    return null;
  }
}

// Load existing database
function loadDatabase() {
  try {
    const data = fs.readFileSync(DATABASE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading database:', error.message);
    return null;
  }
}

// Save database
function saveDatabase(data) {
  try {
    data.metadata.lastUpdated = new Date().toISOString();
    data.metadata.totalItems = data.items.length;
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Database saved: ${data.items.length} items`);
  } catch (error) {
    console.error('❌ Error saving database:', error.message);
  }
}

// Get items older than X days
function getOldItems(data, daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return data.items.filter(item => {
    const soldDate = new Date(item.soldDate);
    return soldDate < cutoffDate;
  });
}

// Update existing items with fresh data
async function updateExistingItems(data, daysToUpdate = 7) {
  console.log(`🔄 Updating items older than ${daysToUpdate} days...`);
  
  const oldItems = getOldItems(data, daysToUpdate);
  console.log(`📊 Found ${oldItems.length} items to update`);
  
  let updatedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < oldItems.length; i++) {
    const item = oldItems[i];
    
    try {
      console.log(`\n📈 Updating item ${i + 1}/${oldItems.length}: ${item.summaryTitle}`);
      
      // Search for the same card with recent sales
      const searchQuery = `${item.summaryTitle} PSA 10`;
      const results = await search130point(searchQuery, 10);
      
      if (results && results.length > 0) {
        // Find the most recent sale
        const recentSales = results
          .map(sale => ({
            ...sale,
            soldDate: new Date(sale.soldDate)
          }))
          .sort((a, b) => b.soldDate - a.soldDate);
        
        const mostRecent = recentSales[0];
        
        // Update if we found a more recent sale
        if (new Date(mostRecent.soldDate) > new Date(item.soldDate)) {
          console.log(`   ✅ Found newer sale: $${mostRecent.price.value} (${mostRecent.soldDate.toLocaleDateString()})`);
          
          // Update item data
          item.price = mostRecent.price;
          item.soldDate = mostRecent.soldDate;
          item.itemWebUrl = mostRecent.itemWebUrl;
          item.imageUrl = mostRecent.imageUrl;
          item.lastUpdated = new Date().toISOString();
          
          updatedCount++;
        } else {
          console.log(`   ⏭️  No newer sales found`);
        }
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`   ❌ Error updating item: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Update Summary:`);
  console.log(`   Items checked: ${oldItems.length}`);
  console.log(`   Items updated: ${updatedCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  return updatedCount;
}

// Add new items from recent searches
async function addNewItems(data, itemsPerSearch = 100) {
  console.log(`🆕 Adding new items from recent searches...`);
  
  const searchTerms = [
    'PSA 10',
    'PSA 10 baseball',
    'PSA 10 football', 
    'PSA 10 basketball',
    'PSA 10 hockey',
    'PSA 10 soccer',
    'PSA 10 pokemon',
    'PSA 10 magic',
    'PSA 10 rookie',
    'PSA 10 auto'
  ];
  
  const existingIds = new Set(data.items.map(item => item.id));
  let newItemsAdded = 0;
  
  for (const searchTerm of searchTerms) {
    try {
      console.log(`\n🔍 Searching for new items: "${searchTerm}"`);
      
      const results = await search130point(searchTerm, itemsPerSearch);
      
      if (results && results.length > 0) {
        let addedFromSearch = 0;
        
        for (const result of results) {
          if (!existingIds.has(result.id)) {
            // Add new item to database
            const newItem = {
              ...result,
              collectedAt: new Date().toISOString(),
              source: '130point',
              searchTerm: searchTerm,
              searchCategory: searchTerm
            };
            
            data.items.push(newItem);
            existingIds.add(result.id);
            addedFromSearch++;
            newItemsAdded++;
          }
        }
        
        console.log(`   ✅ Added ${addedFromSearch} new items from "${searchTerm}"`);
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error searching "${searchTerm}": ${error.message}`);
    }
  }
  
  console.log(`\n📊 New Items Summary:`);
  console.log(`   Total new items added: ${newItemsAdded}`);
  
  return newItemsAdded;
}

// Remove items older than 90 days
function removeOldItems(data, daysToKeep = 90) {
  console.log(`🗑️  Removing items older than ${daysToKeep} days...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const originalCount = data.items.length;
  data.items = data.items.filter(item => {
    const soldDate = new Date(item.soldDate);
    return soldDate >= cutoffDate;
  });
  
  const removedCount = originalCount - data.items.length;
  console.log(`   Removed ${removedCount} old items`);
  console.log(`   Remaining items: ${data.items.length}`);
  
  return removedCount;
}

// Main database update function
async function updateDatabase(options = {}) {
  const {
    updateExisting = true,
    addNew = true,
    removeOld = true,
    daysToUpdate = 7,
    daysToKeep = 90,
    itemsPerSearch = 100
  } = options;
  
  try {
    console.log('🔄 Starting Database Update');
    console.log('==========================\n');
    
    // Create backup
    const backupFile = createBackup();
    if (!backupFile) {
      console.log('❌ Failed to create backup, aborting update');
      return;
    }
    
    // Load database
    const data = loadDatabase();
    if (!data) {
      console.log('❌ Failed to load database, aborting update');
      return;
    }
    
    console.log(`📊 Current database: ${data.items.length} items`);
    
    let totalUpdated = 0;
    let totalNew = 0;
    let totalRemoved = 0;
    
    // Update existing items
    if (updateExisting) {
      totalUpdated = await updateExistingItems(data, daysToUpdate);
    }
    
    // Add new items
    if (addNew) {
      totalNew = await addNewItems(data, itemsPerSearch);
    }
    
    // Remove old items
    if (removeOld) {
      totalRemoved = removeOldItems(data, daysToKeep);
    }
    
    // Save updated database
    saveDatabase(data);
    
    console.log('\n✅ Database Update Completed!');
    console.log('=============================');
    console.log(`📊 Final database size: ${data.items.length} items`);
    console.log(`🔄 Items updated: ${totalUpdated}`);
    console.log(`🆕 New items added: ${totalNew}`);
    console.log(`🗑️  Old items removed: ${totalRemoved}`);
    console.log(`💾 Backup saved: ${backupFile}`);
    
  } catch (error) {
    console.error('❌ Database update failed:', error.message);
  }
}

// Quick update (just add new items)
async function quickUpdate() {
  console.log('⚡ Quick Update - Adding New Items Only');
  console.log('=======================================\n');
  
  await updateDatabase({
    updateExisting: false,
    addNew: true,
    removeOld: false,
    itemsPerSearch: 50
  });
}

// Full update (everything)
async function fullUpdate() {
  console.log('🔄 Full Update - Complete Database Refresh');
  console.log('==========================================\n');
  
  await updateDatabase({
    updateExisting: true,
    addNew: true,
    removeOld: true,
    daysToUpdate: 7,
    daysToKeep: 90,
    itemsPerSearch: 100
  });
}

// Export functions
module.exports = {
  updateDatabase,
  quickUpdate,
  fullUpdate,
  createBackup,
  loadDatabase,
  saveDatabase
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickUpdate();
  } else if (args.includes('--full') || args.includes('-f')) {
    fullUpdate();
  } else {
    console.log('Usage:');
    console.log('  node database-updater.js --quick  # Quick update (new items only)');
    console.log('  node database-updater.js --full   # Full update (everything)');
    console.log('  node database-updater.js          # Default update');
    
    // Run default update
    updateDatabase();
  }
} 