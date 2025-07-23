# Data Persistence Setup Guide

## 🚨 Issue: Saved Searches Lost After Backend Redeploy

### Problem
Your saved searches are disappearing after backend redeploys because:
- Search history is stored in a local JSON file (`backend/data/search_history.json`)
- Railway deployments reset the local file system
- No persistent storage is configured

### Solution: Implement Persistent Storage

## 🚀 Quick Fix Options

### Option 1: Railway Volumes (Recommended)

Railway provides persistent volumes that survive deployments.

#### Step 1: Update Railway Configuration
The `railway.json` file has been updated with volume configuration:

```json
{
  "volumes": [
    {
      "name": "data",
      "mountPath": "/app/data"
    }
  ]
}
```

#### Step 2: Set Environment Variable
In your Railway dashboard, add this environment variable:
```
DATA_DIR=/app/data
```

#### Step 3: Deploy
Push your changes to trigger a new deployment with volume support.

### Option 2: Environment Variable Configuration

If volumes don't work, use environment variables to specify a persistent data path.

#### Step 1: Set Environment Variable
In Railway dashboard, add:
```
DATA_DIR=/tmp/data
```

#### Step 2: Deploy and Test
The service will automatically use the new data directory.

## 📋 Detailed Setup Instructions

### Step 1: Backup Existing Data

Before making changes, backup your current search history:

```bash
# Run the migration script locally
cd backend
npm run backup
```

This will create a backup in `backend/backups/` with timestamp.

### Step 2: Configure Railway Volumes

1. **Update railway.json** (already done)
2. **Deploy to Railway**
3. **Verify volume mounting**

### Step 3: Set Environment Variables

In Railway dashboard, add these environment variables:

```
DATA_DIR=/app/data
NODE_ENV=production
```

### Step 4: Test Data Persistence

1. **Create some test searches**
2. **Trigger a redeploy**
3. **Verify searches persist**

## 🔧 Migration Script

A migration script has been created to help with data management:

### Usage

```bash
# Run migration locally
npm run migrate

# Or directly
node migrate-data.js
```

### What the Script Does

1. **Creates necessary directories**
2. **Backs up existing data**
3. **Validates data structure**
4. **Provides migration status**

## 📊 Monitoring Data Persistence

### Check Data Directory

```bash
# Check if data directory exists
ls -la /app/data

# Check search history file
cat /app/data/search_history.json
```

### Monitor Logs

Look for these log messages:
```
📁 Search history file location: /app/data/search_history.json
📁 Data directory: /app/data
✅ Data directory ensured: /app/data
```

### API Endpoints

Test these endpoints to verify data persistence:

```bash
# Get search history
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.railway.app/api/search-history

# Save a test search
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"searchQuery":"test card"}' \
  https://your-railway-app.railway.app/api/search-history
```

## 🚨 Troubleshooting

### Issue: Data Still Not Persisting

**Symptoms:**
- Searches disappear after redeploy
- Data directory not found in logs
- Permission errors

**Solutions:**

1. **Check Volume Configuration**
   ```bash
   # Verify volume is mounted
   df -h
   ```

2. **Check Environment Variables**
   ```bash
   # Verify DATA_DIR is set
   echo $DATA_DIR
   ```

3. **Check File Permissions**
   ```bash
   # Check data directory permissions
   ls -la /app/data
   ```

### Issue: Migration Script Fails

**Symptoms:**
- Migration script errors
- Backup not created
- Directory creation fails

**Solutions:**

1. **Run with Debug Logging**
   ```bash
   DEBUG=* node migrate-data.js
   ```

2. **Check File System**
   ```bash
   # Check available space
   df -h
   
   # Check write permissions
   touch /app/data/test.txt
   ```

3. **Manual Backup**
   ```bash
   # Manually backup existing data
   cp backend/data/search_history.json backend/backups/manual_backup.json
   ```

### Issue: Search History API Errors

**Symptoms:**
- 500 errors on search history endpoints
- Empty search results
- Authentication issues

**Solutions:**

1. **Check Service Logs**
   ```bash
   # Check for errors in search history service
   tail -f logs/app.log | grep searchHistory
   ```

2. **Verify File Access**
   ```bash
   # Test file read/write
   node -e "
   const fs = require('fs');
   const path = require('path');
   const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
   console.log('Data dir:', dataDir);
   console.log('Exists:', fs.existsSync(dataDir));
   "
   ```

3. **Reset Data File**
   ```bash
   # Create fresh data file
   echo '[]' > /app/data/search_history.json
   ```

## 🔄 Alternative Solutions

### Option 3: Database Migration

For better scalability, consider migrating to a proper database:

1. **PostgreSQL on Railway**
   - Add PostgreSQL service to Railway
   - Update search history service to use database
   - Migrate existing data

2. **MongoDB Atlas**
   - Free tier available
   - Easy integration with Node.js
   - Automatic backups

3. **SQLite with Volume**
   - Lightweight database
   - File-based but with better structure
   - Use with Railway volumes

### Option 4: Cloud Storage

Use cloud storage for data persistence:

1. **AWS S3**
   - Store search history as JSON files
   - Automatic backups
   - High availability

2. **Google Cloud Storage**
   - Similar to S3
   - Good integration with Google services

3. **Railway Storage**
   - Railway's built-in storage solution
   - Simple API
   - Automatic persistence

## 📈 Performance Considerations

### File Size Limits

- **Current**: JSON file with all searches
- **Limit**: ~10MB for reasonable performance
- **Solution**: Implement pagination and cleanup

### Data Cleanup

Add automatic cleanup to prevent file bloat:

```javascript
// Keep only last 100 searches per user
const MAX_SEARCHES_PER_USER = 100;

// Cleanup old searches
async function cleanupOldSearches() {
  const history = await loadSearchHistory();
  const cleaned = history.filter(search => {
    const age = Date.now() - new Date(search.timestamp).getTime();
    return age < 30 * 24 * 60 * 60 * 1000; // 30 days
  });
  await saveSearchHistory(cleaned);
}
```

### Backup Strategy

Implement regular backups:

```javascript
// Daily backup
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(async () => {
  await backupSearchHistory();
}, BACKUP_INTERVAL);
```

## ✅ Success Checklist

After implementing the solution, verify:

- [ ] **Volume mounted correctly**
- [ ] **Environment variables set**
- [ ] **Data directory created**
- [ ] **Search history persists after redeploy**
- [ ] **API endpoints working**
- [ ] **Backup created**
- [ ] **Logs show correct data path**
- [ ] **No permission errors**

## 🆘 Support

If you continue to have issues:

1. **Check Railway logs** for error messages
2. **Verify volume configuration** in Railway dashboard
3. **Test with simple file operations**
4. **Contact Railway support** if volume issues persist

---

**Note**: The migration script and volume configuration should resolve the data persistence issue. Monitor the logs after deployment to ensure everything is working correctly. 