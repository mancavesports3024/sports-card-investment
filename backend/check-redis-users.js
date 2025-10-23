const { createClient } = require('redis');

async function checkRedisUsers() {
  const client = createClient({ url: process.env.REDIS_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to Redis');
    
    // Get all search history keys
    const historyKeys = await client.keys('search_history:*');
    console.log(`📋 Found ${historyKeys.length} search history keys:`);
    
    for (const key of historyKeys) {
      const userId = key.replace('search_history:', '');
      const count = await client.zCard(key);
      console.log(`  - ${userId}: ${count} searches`);
    }
    
    // Get all search keys
    const searchKeys = await client.keys('search:*');
    console.log(`\n📋 Found ${searchKeys.length} individual search keys`);
    
    // Group by user
    const userGroups = {};
    for (const key of searchKeys) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        const userId = parts[1];
        if (!userGroups[userId]) userGroups[userId] = 0;
        userGroups[userId]++;
      }
    }
    
    console.log('\n👥 Users with searches:');
    for (const [userId, count] of Object.entries(userGroups)) {
      console.log(`  - ${userId}: ${count} searches`);
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await client.disconnect();
  }
}

checkRedisUsers();

