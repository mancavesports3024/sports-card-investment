# Release Calendar Database Migration Plan

## 📋 Overview
Migrate the release calendar from hardcoded JavaScript arrays to a PostgreSQL database with automatic updates and management capabilities.

## 🎯 Goals
1. **Store releases in PostgreSQL database** (using existing Railway PostgreSQL)
2. **Automatic updates** from Bleacher Seats scraper
3. **Manual management** via API endpoints
4. **Backward compatibility** during migration
5. **Admin interface** for easy management (future enhancement)

---

## 📊 Phase 1: Database Schema Design

### Table: `releases`
```sql
CREATE TABLE releases (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    brand VARCHAR(100),
    sport VARCHAR(50),
    release_date DATE NOT NULL,
    year VARCHAR(4),
    description TEXT,
    retail_price VARCHAR(50) DEFAULT 'TBD',
    hobby_price VARCHAR(50) DEFAULT 'TBD',
    source VARCHAR(100) DEFAULT 'Manual',
    status VARCHAR(20) DEFAULT 'Announced', -- Announced, Upcoming, Released
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100), -- For tracking who added it
    is_active BOOLEAN DEFAULT TRUE, -- For soft deletes
    
    -- Indexes for performance
    INDEX idx_release_date (release_date),
    INDEX idx_sport (sport),
    INDEX idx_brand (brand),
    INDEX idx_year (year),
    INDEX idx_status (status),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(title, release_date)
);
```

### Table: `release_sources` (for tracking scraped vs manual)
```sql
CREATE TABLE release_sources (
    id SERIAL PRIMARY KEY,
    release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE,
    source_name VARCHAR(100) NOT NULL, -- 'Bleacher Seats', 'Manual', etc.
    source_url TEXT,
    last_scraped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔧 Phase 2: Database Service Layer

### New File: `backend/services/releaseDatabaseService.js`
**Purpose**: Handle all database operations for releases

**Key Methods**:
- `connectDatabase()` - Connect to Railway PostgreSQL
- `createTables()` - Initialize database schema
- `migrateExistingReleases()` - Import hardcoded releases
- `getAllReleases()` - Fetch all active releases
- `getReleasesByDateRange(startDate, endDate)` - Filter by date
- `getReleasesBySport(sport)` - Filter by sport
- `addRelease(releaseData)` - Add new release
- `updateRelease(id, releaseData)` - Update existing release
- `deleteRelease(id)` - Soft delete (set is_active = false)
- `syncScrapedReleases(scrapedReleases)` - Merge scraped data
- `markAsReleased(releaseDate)` - Auto-update status for past dates

---

## 🔄 Phase 3: Update ReleaseInfoService

### Modify: `backend/services/releaseInfoService.js`

**Changes**:
1. Replace `getComprehensiveReleases()` to read from database
2. Keep `getMergedReleases()` but merge database + scraped data
3. Add automatic status updates based on release date
4. Maintain caching for performance

**New Flow**:
```javascript
async getReleaseData() {
  // 1. Check cache
  // 2. Fetch from database
  // 3. Merge with scraped releases
  // 4. Update statuses automatically
  // 5. Cache result
  // 6. Return merged data
}
```

---

## 🛠️ Phase 4: API Endpoints

### New File: `backend/routes/releases.js`

**Endpoints**:

#### GET `/api/releases`
- Get all releases (with filters: sport, year, status, date range)
- Query params: `?sport=Baseball&year=2025&status=Upcoming`

#### GET `/api/releases/:id`
- Get single release by ID

#### POST `/api/releases`
- Add new release (requires authentication)
- Body: `{ title, brand, sport, releaseDate, year, description, retailPrice, hobbyPrice }`

#### PUT `/api/releases/:id`
- Update existing release (requires authentication)

#### DELETE `/api/releases/:id`
- Soft delete release (requires authentication)

#### POST `/api/releases/migrate`
- One-time migration endpoint to import hardcoded data
- Protected endpoint

#### POST `/api/releases/sync`
- Manually trigger sync with Bleacher Seats scraper
- Protected endpoint

#### GET `/api/releases/upcoming`
- Get upcoming releases (next 30 days)

#### GET `/api/releases/recent`
- Get recently released items (last 30 days)

---

## 🤖 Phase 5: Automatic Updates

### Scheduled Jobs

#### 1. **Daily Status Update Job**
- Run daily at midnight
- Update `status` field for all releases:
  - Past dates → "Released"
  - Next 30 days → "Upcoming"
  - Beyond 30 days → "Announced"

#### 2. **Weekly Scraper Sync**
- Run weekly (e.g., Sunday at 2 AM)
- Scrape Bleacher Seats
- Merge new releases into database
- Skip duplicates (based on title + date)

#### 3. **Cleanup Job** (Optional)
- Run monthly
- Archive old releases (older than 1 year)
- Or mark as inactive

### Implementation Options:
- **Option A**: Railway Cron Jobs (if available)
- **Option B**: Node-cron library with background worker
- **Option C**: External cron service (cron-job.org, etc.)

---

## 📦 Phase 6: Migration Script

### New File: `backend/scripts/migrate-releases-to-database.js`

**Purpose**: One-time migration of hardcoded releases to database

**Steps**:
1. Connect to database
2. Create tables if they don't exist
3. Read all releases from `getComprehensiveReleases()`
4. Insert into database (skip duplicates)
5. Log migration results
6. Verify data integrity

**Run Command**:
```bash
node backend/scripts/migrate-releases-to-database.js
```

---

## 🔐 Phase 7: Authentication & Authorization

### Admin Endpoints Protection
- Use existing authentication middleware
- Only authenticated admin users can:
  - Add releases
  - Update releases
  - Delete releases
  - Trigger migrations/syncs

### Public Endpoints
- GET endpoints are public (read-only)
- No authentication required for viewing releases

---

## 🧪 Phase 8: Testing & Validation

### Test Cases:
1. ✅ Database connection works
2. ✅ Tables created successfully
3. ✅ Migration imports all existing releases
4. ✅ CRUD operations work correctly
5. ✅ Scraper sync merges correctly
6. ✅ Status updates automatically
7. ✅ Duplicate prevention works
8. ✅ Backward compatibility maintained
9. ✅ Performance is acceptable (with caching)

---

## 📅 Implementation Timeline

### Week 1: Database Setup
- [ ] Create database schema
- [ ] Build `releaseDatabaseService.js`
- [ ] Create migration script
- [ ] Test database operations

### Week 2: Service Integration
- [ ] Update `releaseInfoService.js` to use database
- [ ] Implement automatic status updates
- [ ] Add caching layer
- [ ] Test backward compatibility

### Week 3: API & Automation
- [ ] Create API endpoints
- [ ] Add authentication
- [ ] Set up scheduled jobs
- [ ] Test scraper sync

### Week 4: Migration & Deployment
- [ ] Run migration script
- [ ] Verify data integrity
- [ ] Deploy to Railway
- [ ] Monitor for issues
- [ ] Remove hardcoded data (after verification)

---

## 🚀 Deployment Steps

1. **Create database tables** on Railway PostgreSQL
2. **Run migration script** to import existing releases
3. **Deploy updated code** to Railway
4. **Set up scheduled jobs** for automatic updates
5. **Monitor logs** for first few days
6. **Remove hardcoded releases** after confirming everything works

---

## 🔄 Rollback Plan

If issues occur:
1. Keep hardcoded releases as fallback
2. Add feature flag to switch between database and hardcoded
3. Can quickly revert to old code if needed
4. Database data remains intact for future use

---

## 📈 Future Enhancements

1. **Admin UI**: Web interface for managing releases
2. **Bulk Import**: CSV/Excel import functionality
3. **Release Notifications**: Email/SMS alerts for upcoming releases
4. **Analytics**: Track most viewed releases, popular sports, etc.
5. **Multi-source Scraping**: Add more scrapers beyond Bleacher Seats
6. **Release Details**: Add more fields (images, links, pre-order info)
7. **User Subscriptions**: Let users subscribe to specific sports/brands

---

## 🛡️ Error Handling

- **Database connection failures**: Fallback to cached data or hardcoded releases
- **Scraper failures**: Log error but continue with database releases
- **Duplicate detection**: Skip duplicates gracefully
- **Invalid data**: Validate before inserting, log errors
- **Migration failures**: Rollback transaction, keep existing data

---

## 📝 Notes

- Uses existing Railway PostgreSQL (DATABASE_URL)
- Maintains backward compatibility during transition
- Caching layer prevents database overload
- Soft deletes preserve data history
- Unique constraints prevent duplicate entries
- Automatic status updates keep data current

