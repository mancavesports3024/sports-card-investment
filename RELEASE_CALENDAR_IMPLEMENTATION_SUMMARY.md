# Release Calendar Database Implementation - Summary

## ✅ Implementation Complete

The release calendar database migration has been successfully implemented! All components are in place and ready to use.

## 📁 Files Created

### Core Services
1. **`backend/services/releaseDatabaseService.js`**
   - Database connection and operations
   - CRUD operations for releases
   - Status management
   - Scraper sync functionality

2. **`backend/services/releaseScheduledJobs.js`**
   - Scheduled job functions
   - Status updates
   - Weekly scraper sync
   - Cleanup jobs

### Routes
3. **`backend/routes/releases.js`**
   - RESTful API endpoints
   - Public read endpoints
   - Admin write endpoints
   - Job trigger endpoints

### Scripts
4. **`backend/scripts/migrate-releases-to-database.js`**
   - One-time migration script
   - Imports hardcoded releases to database

### Updated Files
5. **`backend/services/releaseInfoService.js`**
   - Updated to use database (with fallback to hardcoded)
   - Merges database + scraped releases

6. **`backend/index.js`**
   - Added `/api/releases` route registration

## 🚀 Next Steps

### 1. Initialize Database Tables
Run this once to create the database schema:
```bash
node -e "require('./backend/services/releaseDatabaseService').createTables().then(() => process.exit(0))"
```

### 2. Run Migration
Import existing hardcoded releases to database:
```bash
node backend/scripts/migrate-releases-to-database.js
```

Or via API (requires admin auth):
```bash
POST /api/releases/migrate
```

### 3. Set Up Scheduled Jobs

#### Option A: Railway Cron Jobs (Recommended)
Add these cron jobs in Railway:
- **Daily Status Update**: `0 0 * * *` (midnight daily)
  - Endpoint: `POST /api/releases/jobs/update-statuses`
  
- **Weekly Scraper Sync**: `0 2 * * 0` (Sunday 2 AM)
  - Endpoint: `POST /api/releases/jobs/sync`

#### Option B: External Cron Service
Use services like cron-job.org to call:
- `https://your-railway-url.railway.app/api/releases/jobs/update-statuses`
- `https://your-railway-url.railway.app/api/releases/jobs/sync`

#### Option C: Node-cron (if running continuously)
Add to `backend/index.js`:
```javascript
const cron = require('node-cron');
const releaseScheduledJobs = require('./services/releaseScheduledJobs');

// Daily status update at midnight
cron.schedule('0 0 * * *', async () => {
    await releaseScheduledJobs.updateReleaseStatuses();
});

// Weekly sync on Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
    await releaseScheduledJobs.syncScrapedReleases();
});
```

## 📋 API Endpoints

### Public Endpoints (No Auth Required)
- `GET /api/releases` - Get all releases (with filters)
- `GET /api/releases/:id` - Get single release
- `GET /api/releases/upcoming` - Get upcoming releases
- `GET /api/releases/recent` - Get recent releases

### Admin Endpoints (Auth Required)
- `POST /api/releases` - Add new release
- `PUT /api/releases/:id` - Update release
- `DELETE /api/releases/:id` - Delete release
- `POST /api/releases/migrate` - Run migration
- `POST /api/releases/sync` - Manual scraper sync
- `POST /api/releases/jobs/update-statuses` - Trigger status update
- `POST /api/releases/jobs/sync` - Trigger sync job
- `POST /api/releases/jobs/cleanup` - Trigger cleanup
- `POST /api/releases/jobs/run-all` - Run all jobs

## 🔧 Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (already set in Railway)
- `USE_RELEASE_DATABASE` - Set to `false` to disable database and use hardcoded data (default: `true`)

## 🔄 Migration Strategy

The system is designed with backward compatibility:
1. **Phase 1**: Database is optional - falls back to hardcoded data if database fails
2. **Phase 2**: After migration and verification, database becomes primary
3. **Phase 3**: Hardcoded data can be removed (optional)

## ✅ Features Implemented

- ✅ PostgreSQL database schema
- ✅ CRUD operations
- ✅ Automatic status updates (Released/Upcoming/Announced)
- ✅ Scraper sync integration
- ✅ Duplicate prevention
- ✅ Caching layer
- ✅ API endpoints
- ✅ Scheduled jobs
- ✅ Migration script
- ✅ Backward compatibility

## 🧪 Testing

Test the implementation:

1. **Check database connection:**
   ```bash
   node -e "require('./backend/services/releaseDatabaseService').connectDatabase().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e))"
   ```

2. **Test API endpoints:**
   ```bash
   curl https://your-railway-url.railway.app/api/releases
   ```

3. **Run migration:**
   ```bash
   node backend/scripts/migrate-releases-to-database.js
   ```

## 📊 Database Schema

### `releases` Table
- `id` (SERIAL PRIMARY KEY)
- `title` (VARCHAR(500))
- `brand` (VARCHAR(100))
- `sport` (VARCHAR(50))
- `release_date` (DATE)
- `year` (VARCHAR(4))
- `description` (TEXT)
- `retail_price` (VARCHAR(50))
- `hobby_price` (VARCHAR(50))
- `source` (VARCHAR(100))
- `status` (VARCHAR(20))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (VARCHAR(100))
- `is_active` (BOOLEAN)

### `release_sources` Table
- `id` (SERIAL PRIMARY KEY)
- `release_id` (INTEGER, FK)
- `source_name` (VARCHAR(100))
- `source_url` (TEXT)
- `last_scraped_at` (TIMESTAMP)

## 🎯 Status Logic

- **Released**: `release_date < today`
- **Upcoming**: `today <= release_date <= 30 days`
- **Announced**: `release_date > 30 days`

Statuses are automatically updated daily via scheduled job.

## 🔐 Authentication

The `isAdmin` middleware in `routes/releases.js` needs to be implemented based on your authentication system. Currently it's a placeholder that checks for `req.user`.

## 📝 Notes

- The system maintains backward compatibility with hardcoded releases
- Caching is used to improve performance
- Duplicate prevention based on `(title, release_date)` unique constraint
- Soft deletes (is_active = false) preserve data history
- All timestamps are automatically managed

