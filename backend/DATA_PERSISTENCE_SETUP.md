# Data Persistence Setup Guide

## 🚨 Issue: Saved Searches Lost After Backend Redeploy

### Problem
Your saved searches were disappearing after backend redeploys because:
- Search history was stored in a local JSON file (`backend/data/search_history.json`)
- Railway deployments reset the local file system
- No persistent storage was configured

### Solution: Redis-Based Persistent Storage ✅

**Status**: ✅ **FIXED** - Implemented Redis-based search history storage

## 🚀 Solution Implemented: Redis-Based Storage

### Why Redis is Better
- ✅ **Persistent across deployments** - Data survives container restarts
- ✅ **High performance** - Fast read/write operations
- ✅ **Automatic expiration** - TTL-based cleanup
- ✅ **Scalable** - Can handle multiple users efficiently
- ✅ **Already configured** - You already have Redis set up

### What Was Changed

#### 1. **Search History Service** (`backend/services/searchHistoryService.js`)
- **Replaced file-based storage** with Redis-based storage
- **Added automatic TTL** (30 days for search history)
- **Implemented user-specific storage** with proper key management
- **Added fallback handling** for when Redis is unavailable

#### 2. **Redis Key Structure**
```javascript
// User's search history list (sorted set)
search_history:${userId}

// Individual search details (string)
search:${userId}:${searchId}
```

#### 3. **Features Added**
- **Automatic cleanup** - Keeps only last 50 searches per user
- **TTL management** - 30-day expiration for old searches
- **Statistics endpoint** - Admin can view usage stats
- **Better error handling** - Graceful fallbacks

## 📋 Current Configuration

### Redis Setup
Your Redis is already configured with:
- **Environment Variable**: `REDIS_URL` (set in Railway)
- **Connection**: Automatic connection management
- **Fallback**: In-memory storage if Redis unavailable

### Search History Features
- **Storage**: Redis with 30-day TTL
- **Limit**: 50 searches per user (automatic cleanup)
- **Performance**: Fast retrieval with sorted sets
- **Persistence**: Survives all deployments

## 🔧 API Endpoints

### User Endpoints
```bash
# Get user's search history
GET /api/search-history
Authorization: Bearer <token>

# Save a new search
POST /api/search-history
Authorization: Bearer <token>
Content-Type: application/json
{
  "searchQuery": "Mike Trout 2011 Topps Update",
  "results": {...},
  "priceAnalysis": {...}
}

# Delete a specific search
DELETE /api/search-history/:id
Authorization: Bearer <token>

# Clear all user searches
DELETE /api/search-history
Authorization: Bearer <token>
```

### Admin Endpoints
```bash
# Get search history statistics
GET /api/search-history/stats
Authorization: Bearer <token>

# Get all users' search history
GET /api/search-history/admin/all
Authorization: Bearer <token>
```

## 📊 Monitoring and Statistics

### Redis Health Check
```bash
# Test Redis connection
GET /api/redis-test

# Get cache statistics
GET /api/cache/stats
```

### Search History Stats
The new `/api/search-history/stats` endpoint provides:
- Total number of users
- Total number of searches
- Per-user search counts
- System health information

## 🚨 Troubleshooting

### Issue: Searches Still Not Persisting

**Symptoms:**
- Searches disappear after redeploy
- Redis connection errors in logs
- Empty search results

**Solutions:**

1. **Check Redis Connection**
   ```bash
   # Test Redis endpoint
   curl https://your-railway-app.railway.app/api/redis-test
   ```

2. **Verify Environment Variables**
   - Ensure `REDIS_URL` is set in Railway dashboard
   - Check that Redis service is running

3. **Check Logs**
   Look for these messages:
   ```
   ✅ Search History Redis connected
   ✅ Search History Redis ready
   💾 Saved search for user: user@example.com
   ```

### Issue: Redis Connection Fails

**Symptoms:**
- Redis connection errors
- Fallback to in-memory storage warnings
- Data loss on restart

**Solutions:**

1. **Check Railway Redis Service**
   - Verify Redis service is provisioned
   - Check service status in Railway dashboard

2. **Verify REDIS_URL**
   - Ensure environment variable is set correctly
   - Check URL format: `redis://username:password@host:port`

3. **Test Connection**
   ```bash
   # Test from Railway console
   redis-cli -u $REDIS_URL ping
   ```

### Issue: Performance Problems

**Symptoms:**
- Slow search history loading
- High Redis memory usage
- Timeout errors

**Solutions:**

1. **Monitor Redis Memory**
   ```bash
   # Check Redis info
   GET /api/cache/stats
   ```

2. **Clean Up Old Data**
   - Redis automatically expires data after 30 days
   - Manual cleanup available via admin endpoints

3. **Optimize Queries**
   - Searches are limited to 50 per user
   - Sorted sets provide fast retrieval

## ✅ Success Checklist

After implementing the Redis solution, verify:

- [ ] **Redis connection working** - `/api/redis-test` returns success
- [ ] **Search history persists** - Searches survive redeploys
- [ ] **User authentication working** - Saved searches are user-specific
- [ ] **Admin endpoints accessible** - Statistics and admin functions work
- [ ] **No file-based storage** - No more `search_history.json` dependency
- [ ] **Automatic cleanup working** - Old searches expire properly
- [ ] **Performance acceptable** - Fast search history loading

## 🔄 Migration from File-Based Storage

### Automatic Migration
The new Redis-based system will automatically:
- Start fresh with Redis storage
- No manual migration needed
- Old file-based data will be ignored

### Manual Migration (if needed)
If you need to migrate existing file-based data:

1. **Backup existing data**
   ```bash
   # Download current search history
   curl -H "Authorization: Bearer <token>" \
     https://your-railway-app.railway.app/api/search-history/admin/all
   ```

2. **Import to Redis** (if needed)
   - Use the admin endpoints to recreate searches
   - Or implement a one-time migration script

## 📈 Performance Benefits

### Before (File-Based)
- ❌ Data lost on redeploy
- ❌ Slow file I/O operations
- ❌ No user isolation
- ❌ Manual cleanup required
- ❌ Single point of failure

### After (Redis-Based)
- ✅ Persistent across deployments
- ✅ Fast Redis operations
- ✅ User-specific storage
- ✅ Automatic TTL cleanup
- ✅ High availability
- ✅ Scalable architecture

## 🆘 Support

If you continue to have issues:

1. **Check Railway logs** for Redis connection errors
2. **Verify Redis service** is running in Railway dashboard
3. **Test Redis connection** using `/api/redis-test`
4. **Monitor search history** using admin endpoints
5. **Contact Railway support** if Redis service issues persist

---

**Note**: The Redis-based solution is much more robust and suitable for production use. Your saved searches will now persist across all deployments and provide better performance and scalability. 