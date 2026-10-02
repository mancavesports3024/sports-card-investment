# Production Deployment Checklist - PR #9

**IMPORTANT**: Do NOT deploy until ALL steps are completed in order.

---

## Pre-Deployment Verification

### 1. Verify Current Production Schema

**Check existing releases table**:
```bash
psql "$DATABASE_URL" -c "\d releases"
```

**Expected columns that should ALREADY exist**:
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

**Columns that will be ADDED by migration**:
- `source_url` (TEXT)
- `date_status` (VARCHAR(20))
- `last_verified_at` (TIMESTAMP)
- `last_verified_by` (VARCHAR(100))
- `verification_notes` (TEXT)

**Check for conflicts**:
```bash
# If any of the new columns already exist, migration will fail
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'releases' AND column_name IN ('source_url', 'date_status', 'last_verified_at', 'last_verified_by', 'verification_notes')"
```

**Expected result**: Empty (0 rows) - if any columns exist, DO NOT proceed with migration.

---

## Deployment Steps (EXACT ORDER)

### Step 1: Set Environment Variables

**Railway Dashboard** → Environment Variables:

```bash
ADMIN_EMAILS="your-email@example.com,another-admin@example.com"
```

**Critical**:
- Use comma-separated list
- Include ALL emails that need admin access
- Use actual email addresses from Google OAuth
- No spaces around commas (they'll be trimmed automatically)
- Lowercase recommended but not required (normalized in code)

**Verify**:
```bash
# In Railway logs after deploy, should see:
# ✓ ADMIN_EMAILS configured with N email(s)
```

---

### Step 2: Run Database Migration

**From local machine with DATABASE_URL**:

```bash
# Get DATABASE_URL from Railway dashboard
export DATABASE_URL="postgresql://..."

# Verify connection
psql "$DATABASE_URL" -c "SELECT version();"

# Run migration (idempotent - safe to re-run)
psql "$DATABASE_URL" -f backend/migrations/001_add_release_verification_fields.sql

# Verify migration succeeded
psql "$DATABASE_URL" -c "\d releases" | grep -E "source_url|date_status|last_verified"
```

**Expected output**:
```
source_url              | text                        |           |          | 
date_status             | character varying(20)       |           |          | estimated
last_verified_at        | timestamp without time zone |           |          | 
last_verified_by        | character varying(100)      |           |          | system
verification_notes      | text                        |           |          | 
```

**If migration fails**:
- Check for column conflicts (Step 1 verification)
- Check PostgreSQL version compatibility
- Check DATABASE_URL permissions (needs ALTER TABLE)
- Contact database admin if permission denied

---

### Step 3: Deploy Code

**Merge PR #9 to base branch**:
```bash
# After all pre-deployment steps complete
git checkout improve/clarify-brand-blog-search
git merge cursor/improve-release-calendar-9a1e --no-ff
git push origin improve/clarify-brand-blog-search
```

**Railway auto-deploys** from configured branch.

**Vercel deployment**: Will trigger automatically.

---

### Step 4: Verify Deployment

#### 4.1 Check Environment Variables

**Test admin access** (should FAIL if not configured):
```bash
curl https://your-site.com/api/releases/unverified \
  -H "Cookie: your-session-cookie"

# Expected if ADMIN_EMAILS not set:
# {"success":false,"error":"Admin access not configured..."}
```

#### 4.2 Test Authentication Flow

**1. Sign in with Google OAuth**:
```
Visit: https://your-site.com/
Click: Sign In
Verify: Email matches one in ADMIN_EMAILS
```

**2. Test admin endpoints** (with Chrome DevTools to get session cookie):

```bash
# Get session cookie from browser DevTools → Application → Cookies

# Test unverified endpoint (requires admin)
curl https://your-site.com/api/releases/unverified \
  -H "Cookie: connect.sid=<your-session-cookie>"

# Expected (if authorized):
# {"success":true,"count":N,"releases":[...]}

# Expected (if not authorized):
# {"success":false,"error":"Admin access required"}
```

#### 4.3 Test Release Addition

**Use CLI tool** (from Railway shell or local with DATABASE_URL):

```bash
# Railway: Connect to app shell
railway run node backend/scripts/add-release.js

# Local with DATABASE_URL:
export DATABASE_URL="postgresql://..."
node backend/scripts/add-release.js
```

**Follow prompts** to add a test release.

**Verify** it appears:
```bash
curl https://your-site.com/api/releases | grep "Test Release"
```

#### 4.4 Test Frontend Display

**Visit release calendar**:
```
https://your-site.com/news?tab=releases
```

**Verify**:
- Releases display
- Date status indicators show (estimated/tbd)
- No JavaScript errors in console

---

## CLI Tool Access Methods

### Method 1: Railway Shell (Recommended for production updates)

```bash
# From local machine with Railway CLI
railway link
railway run node backend/scripts/add-release.js
```

**Limitations**:
- Requires Railway CLI installed locally
- Requires project access
- Interactive - can't be automated

### Method 2: Local with DATABASE_URL (For bulk updates)

```bash
# Get DATABASE_URL from Railway dashboard
export DATABASE_URL="postgresql://..."

# Run script locally
node backend/scripts/add-release.js
```

**Limitations**:
- DATABASE_URL contains production credentials
- Must be kept secure
- Direct database access bypasses app-level security

### Method 3: API via Authenticated Requests (For automation)

```bash
# Get session cookie after Google OAuth login
curl -X POST https://your-site.com/api/releases/manual-add \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=<session-cookie>" \
  -d '{
    "title": "2027 Topps Series 1",
    "releaseDate": "2027-02-15",
    "brand": "Topps",
    "sport": "Baseball",
    "sourceUrl": "https://example.com/source",
    "dateStatus": "estimated"
  }'
```

**Limitations**:
- Session cookies expire
- Must maintain OAuth session
- More complex for routine use

### Method 4: Future Web Admin UI (Not yet implemented)

**Recommended next step**: Build a web-based admin UI for release management.

**Benefits**:
- No CLI access needed
- Proper authentication via OAuth
- User-friendly for non-technical users
- Can include validation and preview

---

## Rollback Plan

### If deployment fails

**1. Code rollback**:
```bash
git revert <merge-commit-sha>
git push
```

**2. Database rollback** (if needed):

⚠️ **WARNING**: No automatic rollback SQL provided.

**Manual rollback**:
```sql
-- Only if absolutely necessary
ALTER TABLE releases DROP COLUMN IF EXISTS source_url;
ALTER TABLE releases DROP COLUMN IF EXISTS date_status;
ALTER TABLE releases DROP COLUMN IF EXISTS last_verified_at;
ALTER TABLE releases DROP COLUMN IF EXISTS last_verified_by;
ALTER TABLE releases DROP COLUMN IF EXISTS verification_notes;
DROP INDEX IF EXISTS idx_date_status;
DROP INDEX IF EXISTS idx_last_verified_at;
```

**Note**: Rollback will LOSE all verification metadata entered after deployment.

---

## Post-Deployment

### 1. Populate Initial Data

**Add upcoming releases** using CLI tool or API.

**Recommended sources** (manual verification):
- Bleacher Seats Collectibles
- Cardboard Connection
- Beckett calendars
- Manufacturer announcements

### 2. Set Weekly Review Reminder

**Calendar reminder** for Sunday (to replace automated scraper).

**Process**:
1. Check aggregator sites manually
2. Add new releases via CLI
3. Update verification status for confirmed dates

### 3. Monitor Logs

**Railway Dashboard** → Logs:

Watch for:
- `⚠️ ADMIN_EMAILS not configured` - Fix immediately
- `⚠️ Non-admin user attempted admin access` - Expected for unauthorized users
- Any 500 errors - Investigate database or code issues

---

## Security Validation

### Test unauthorized access is properly blocked

```bash
# Test 1: Unauthenticated request (should fail)
curl -X POST https://your-site.com/api/releases/manual-add \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","releaseDate":"2027-01-01"}'

# Expected: 401 Unauthorized

# Test 2: Non-admin authenticated user (should fail)
# Sign in with email NOT in ADMIN_EMAILS
# Try accessing /api/releases/unverified

# Expected: 403 Forbidden

# Test 3: Admin user (should succeed)
# Sign in with email in ADMIN_EMAILS
# Access /api/releases/unverified

# Expected: 200 OK with data
```

---

## Success Criteria

✅ All tests pass (40/40)  
✅ ADMIN_EMAILS configured in Railway  
✅ Migration applied successfully  
✅ Code deployed to production  
✅ Admin can add releases via CLI  
✅ Admin can access /unverified endpoint  
✅ Non-admin users blocked from admin endpoints  
✅ Frontend displays date status correctly  
✅ No errors in Railway logs  

---

## Support & Troubleshooting

### Common Issues

**"Admin access not configured"**
- Fix: Set ADMIN_EMAILS in Railway environment variables
- Verify: Check Railway dashboard → Variables

**"Authentication required"**
- Cause: Not signed in with Google OAuth
- Fix: Visit homepage and sign in

**"Admin access required"**
- Cause: Email not in ADMIN_EMAILS list
- Fix: Add email to ADMIN_EMAILS and redeploy

**CLI script fails with "DATABASE_URL not set"**
- Railway: Use `railway run` instead of direct node
- Local: Export DATABASE_URL before running

**Migration fails with "permission denied"**
- Cause: Database user lacks ALTER TABLE permission
- Fix: Contact Railway support or use database admin credentials

---

## Timeline Estimate

- Step 1 (Environment variables): 2 minutes
- Step 2 (Migration): 5 minutes (including verification)
- Step 3 (Deploy): 5-10 minutes (Railway auto-deploy)
- Step 4 (Verification): 10-15 minutes (thorough testing)

**Total**: ~30 minutes for complete deployment and verification

---

**Last Updated**: 2026-09-29  
**PR**: #9  
**Branch**: `cursor/improve-release-calendar-9a1e`
