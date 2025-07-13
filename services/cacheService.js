const { createClient } = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour default
    this.searchTTL = 1800; // 30 minutes for search results
    this.liveListingsTTL = 300; // 5 minutes for live listings
    this.priceAnalysisTTL = 7200; // 2 hours for price analysis
  }

  async connect() {
    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      if (process.env.REDIS_URL) {
        this.client = createClient({ url: process.env.REDIS_URL });
        
        this.client.on('error', (err) => {
          console.error('❌ Cache Redis error:', err);
          this.isConnected = false;
        });
        
        this.client.on('connect', () => {
          console.log('✅ Cache Redis connected');
          this.isConnected = true;
        });
        
        this.client.on('ready', () => {
          console.log('✅ Cache Redis ready');
          this.isConnected = true;
        });

        await this.client.connect();
        return this.client;
      } else {
        console.log('⚠️  No REDIS_URL, using in-memory cache fallback');
        this.client = new Map();
        this.isConnected = true;
        return this.client;
      }
    } catch (error) {
      console.error('❌ Cache connection failed, using in-memory fallback:', error.message);
      this.client = new Map();
      this.isConnected = true;
      return this.client;
    }
  }

  async get(key) {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        // In-memory fallback
        const item = this.client.get(key);
        if (item && item.expiry > Date.now()) {
          return item.value;
        } else if (item) {
          this.client.delete(key);
        }
        return null;
      } else {
        // Redis
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      }
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        // In-memory fallback
        this.client.set(key, {
          value,
          expiry: Date.now() + (ttl * 1000)
        });
      } else {
        // Redis
        await this.client.setEx(key, ttl, JSON.stringify(value));
      }
      
      console.log(`💾 Cached: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  async delete(key) {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        this.client.delete(key);
      } else {
        await this.client.del(key);
      }
      
      console.log(`🗑️  Deleted cache: ${key}`);
    } catch (error) {
      console.error('❌ Cache delete error:', error);
    }
  }

  async deletePattern(pattern) {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        // In-memory pattern deletion
        for (const key of this.client.keys()) {
          if (key.includes(pattern)) {
            this.client.delete(key);
          }
        }
      } else {
        // Redis pattern deletion
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }
      
      console.log(`🗑️  Deleted cache pattern: ${pattern}`);
    } catch (error) {
      console.error('❌ Cache delete pattern error:', error);
    }
  }

  async exists(key) {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        const item = this.client.get(key);
        return item && item.expiry > Date.now();
      } else {
        return await this.client.exists(key);
      }
    } catch (error) {
      console.error('❌ Cache exists error:', error);
      return false;
    }
  }

  // Cache key generators
  generateSearchKey(searchQuery, filters = {}) {
    const filterString = Object.keys(filters).length > 0 
      ? JSON.stringify(filters) 
      : '';
    return `search:${Buffer.from(searchQuery + filterString).toString('base64')}`;
  }

  generateLiveListingsKey(searchQuery, category, saleType) {
    return `live:${Buffer.from(`${searchQuery}:${category}:${saleType || 'all'}`).toString('base64')}`;
  }

  generatePriceAnalysisKey(searchQuery) {
    return `analysis:${Buffer.from(searchQuery).toString('base64')}`;
  }

  generateUserHistoryKey(userId) {
    return `history:${userId}`;
  }

  // Cache warming functions
  async warmSearchCache(searchQuery, filters = {}) {
    const key = this.generateSearchKey(searchQuery, filters);
    const exists = await this.exists(key);
    
    if (!exists) {
      console.log(`🔥 Warming cache for: ${searchQuery}`);
      // This will be called by the search service
    }
  }

  // Cache statistics
  async getStats() {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        
        for (const [key, item] of this.client.entries()) {
          if (item.expiry > now) {
            validEntries++;
          } else {
            expiredEntries++;
            this.client.delete(key);
          }
        }
        
        return {
          type: 'memory',
          totalEntries: validEntries + expiredEntries,
          validEntries,
          expiredEntries
        };
      } else {
        const info = await this.client.info('memory');
        const keyspace = await this.client.info('keyspace');
        
        return {
          type: 'redis',
          info: info,
          keyspace: keyspace
        };
      }
    } catch (error) {
      console.error('❌ Cache stats error:', error);
      return { type: 'error', message: error.message };
    }
  }

  // Cache cleanup
  async cleanup() {
    try {
      await this.connect();
      
      if (this.client instanceof Map) {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, item] of this.client.entries()) {
          if (item.expiry <= now) {
            this.client.delete(key);
            cleaned++;
          }
        }
        
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
      } else {
        // Redis handles expiration automatically
        console.log('🧹 Redis handles expiration automatically');
      }
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService; 