const fs = require('fs');
const path = require('path');

const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const BACKUP_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database_backup.json');

async function fixDatabaseJson() {
  console.log('🔧 Fixing malformed JSON in database file...');
  
  try {
    // Create backup
    if (fs.existsSync(DATABASE_FILE)) {
      fs.copyFileSync(DATABASE_FILE, BACKUP_FILE);
      console.log('💾 Created backup of original file');
    }
    
    // Read the file as text
    const fileContent = fs.readFileSync(DATABASE_FILE, 'utf8');
    console.log('📖 Read database file');
    
    // Fix common JSON issues
    let fixedContent = fileContent;
    
    // Fix unquoted property names
    fixedContent = fixedContent.replace(/(\s+)([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":');
    
    // Fix unquoted string values
    fixedContent = fixedContent.replace(/:\s*([^",\{\}\[\]\d][^,\{\}\[\]]*[^",\{\}\[\]\s])\s*([,\}\]])/g, ': "$1"$2');
    
    // Fix trailing commas
    fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1');
    
    // Try to parse the fixed JSON
    try {
      const parsed = JSON.parse(fixedContent);
      console.log('✅ JSON is now valid');
      
      // Write the fixed content back
      fs.writeFileSync(DATABASE_FILE, JSON.stringify(parsed, null, 2));
      console.log('💾 Fixed database file saved');
      
      console.log(`📊 Database contains ${parsed.items ? parsed.items.length : 0} items`);
      
    } catch (parseError) {
      console.error('❌ Still cannot parse JSON after fixes:', parseError.message);
      
      // Try a more aggressive approach - extract just the items array
      const itemsMatch = fileContent.match(/"items":\s*\[([\s\S]*?)\]/);
      if (itemsMatch) {
        console.log('🔧 Attempting to extract items array...');
        
        // Create a minimal valid JSON structure
        const minimalJson = {
          items: [],
          metadata: {
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalItems: 0
          }
        };
        
        // Try to parse individual items
        const itemMatches = fileContent.match(/\{[^}]*"title"[^}]*\}/g);
        if (itemMatches) {
          console.log(`📦 Found ${itemMatches.length} potential items`);
          
          for (const itemStr of itemMatches) {
            try {
              // Clean up the item string
              let cleanItem = itemStr
                .replace(/(\s+)([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":')
                .replace(/:\s*([^",\{\}\[\]\d][^,\{\}\[\]]*[^",\{\}\[\]\s])\s*([,\}\]])/g, ': "$1"$2');
              
              const item = JSON.parse(cleanItem);
              if (item.title && item.price) {
                minimalJson.items.push(item);
              }
            } catch (itemError) {
              // Skip malformed items
              continue;
            }
          }
          
          minimalJson.metadata.totalItems = minimalJson.items.length;
          
          // Save the minimal valid JSON
          fs.writeFileSync(DATABASE_FILE, JSON.stringify(minimalJson, null, 2));
          console.log(`💾 Saved ${minimalJson.items.length} valid items to database`);
          
        } else {
          console.error('❌ Could not extract any items from the file');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing database:', error.message);
  }
}

if (require.main === module) {
  fixDatabaseJson().catch(console.error);
}

module.exports = { fixDatabaseJson }; 