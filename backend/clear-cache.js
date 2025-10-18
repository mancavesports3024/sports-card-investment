const { createClient } = require('redis');

async function clearCache() {
  try {
    console.log('🔄 Connecting to Redis...');
    
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await redis.connect();
    
    console.log('🗑️ Clearing all search cache...');
    
    // Clear all search-related cache keys
    const searchKeys = await redis.keys('search:*');
    if (searchKeys.length > 0) {
      await redis.del(...searchKeys);
      console.log(`✅ Cleared ${searchKeys.length} search cache entries`);
    } else {
      console.log('ℹ️ No search cache entries found');
    }
    
    // Clear all live listing cache keys
    const liveKeys = await redis.keys('live:*');
    if (liveKeys.length > 0) {
      await redis.del(...liveKeys);
      console.log(`✅ Cleared ${liveKeys.length} live listing cache entries`);
    } else {
      console.log('ℹ️ No live listing cache entries found');
    }
    
    // Clear all analysis cache keys
    const analysisKeys = await redis.keys('analysis:*');
    if (analysisKeys.length > 0) {
      await redis.del(...analysisKeys);
      console.log(`✅ Cleared ${analysisKeys.length} analysis cache entries`);
    } else {
      console.log('ℹ️ No analysis cache entries found');
    }
    
    console.log('🎉 Cache clearing completed successfully!');
    
    await redis.disconnect();
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearCache();
}

module.exports = { clearCache };
