const { createClient } = require('redis');

async function migrateSavedSearches() {
  const client = createClient({ url: process.env.REDIS_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to Redis');
    
    // Get all keys that match the old default user pattern
    const defaultUserKeys = await client.keys('search:default:*');
    console.log(`📋 Found ${defaultUserKeys.length} searches under 'default' user`);
    
    if (defaultUserKeys.length === 0) {
      console.log('ℹ️ No searches found under default user');
      return;
    }
    
    // Get your actual user ID (replace with your email)
    const yourEmail = 'cgcardsfan2011@gmail.com';
    const yourUserId = yourEmail; // Using email as user ID
    
    console.log(`🔄 Migrating searches to user: ${yourUserId}`);
    
    let migratedCount = 0;
    
    for (const key of defaultUserKeys) {
      try {
        // Get the search data
        const searchData = await client.get(key);
        if (!searchData) continue;
        
        const search = JSON.parse(searchData);
        
        // Create new key for your user
        const newKey = key.replace('search:default:', `search:${yourUserId}:`);
        
        // Save under your user ID
        await client.setEx(newKey, 30 * 24 * 60 * 60, searchData); // 30 days TTL
        
        // Add to your user's search history list
        const userHistoryKey = `search_history:${yourUserId}`;
        const searchId = key.split(':').pop();
        await client.zAdd(userHistoryKey, {
          score: Date.now(),
          value: searchId
        });
        
        // Set TTL for user's search history
        await client.expire(userHistoryKey, 30 * 24 * 60 * 60);
        
        migratedCount++;
        console.log(`✅ Migrated: ${search.query}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate ${key}:`, error.message);
      }
    }
    
    console.log(`🎉 Successfully migrated ${migratedCount} searches to your account!`);
    
    // Clean up old default user searches (optional)
    if (migratedCount > 0) {
      console.log('🧹 Cleaning up old default user searches...');
      for (const key of defaultUserKeys) {
        await client.del(key);
      }
      await client.del('search_history:default');
      console.log('✅ Cleanup completed');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.disconnect();
  }
}

// Run the migration
migrateSavedSearches();
