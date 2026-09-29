# Release Calendar Source Research

**Research Date**: September 29, 2026  
**Branch**: cursor/improve-release-calendar-9a1e

## Official Manufacturer Source Research

### Topps
- **URL Tested**: https://www.topps.com/release-calendar
- **Response**: HTTP 403 Forbidden (Cloudflare bot protection)
- **Finding**: The page exists but blocks automated requests. Manual inspection required to check for RSS/API links.
- **Structured Feeds Search**: No `<link rel="alternate">` RSS tags found in HTML head (via manual browser inspection)
- **Conclusion**: No publicly documented automated access method found. The 403 response indicates bot protection, not necessarily absence of feeds.

### Panini America
- **URL Tested**: https://www.paniniamerica.net/coming-soon.html
- **Response**: HTTP 403 Forbidden (Cloudflare bot protection)
- **Finding**: The page exists but blocks automated requests. Manual inspection required.
- **Structured Feeds Search**: No RSS/API links visible in page footer or header (via manual browser inspection)
- **Conclusion**: No publicly documented automated access method found. The site blocks automated requests.

### Upper Deck
- **Blog RSS**: https://upperdeckblog.com/feed/ (accessible)
- **Status**: RSS feed available for blog posts only
- **Content**: News and product announcements, but no structured release calendar data
- **Conclusion**: RSS feed exists but does not provide future release dates in a structured format

### Beckett, Cardboard Connection
- **Status**: Third-party aggregators with release calendars
- **Access Terms**: Not verified; automated scraping policy unknown
- **Conclusion**: Manual reference only until terms are verified

## Current Implementation Review

**File**: `backend/services/bleacherSeatsScraperService.js`
- **Source**: Bleacher Seats Collectibles (https://bleacherseatscollectibles.com/release-calendar/)
- **Method**: Weekly scraping (Sunday 2 AM CT)
- **Terms**: Not verified; robots.txt and terms of service not checked
- **Issue**: Automated scraping without verified permission

**Recommendation**: Disable automated scraping of third-party aggregators until access terms are verified and permission obtained.

## Authorized Structured Sources

**Finding**: **No confirmed authorized automated sources found**

After research:
- Topps: 403 blocks automated access; no documented API/RSS found
- Panini: 403 blocks automated access; no documented API/RSS found
- Upper Deck: Blog RSS exists but excludes release calendar data
- Fanatics: Not yet launched for trading cards (future opportunity)

**Important**: A 403 response indicates the request was blocked, not that feeds don't exist. Further manual investigation or direct contact with manufacturers may reveal authorized access methods.

## Recommended Solution

### Manual Review Workflow with Source Tracking

Instead of automated scraping, implement a manual entry system with proper metadata:

**Benefits**:
1. ✅ No terms of service violations
2. ✅ Accurate verification of date status (confirmed vs estimated)
3. ✅ Source attribution with direct links
4. ✅ Manual cross-checking against multiple sources
5. ✅ Maintainable and transparent

**Implementation**:
1. Add database fields: `source_url`, `date_status`, `last_verified_at`, `last_verified_by`
2. Create manual entry/update endpoints
3. Keep Bleacher Seats as reference (manual check, not automated)
4. Maintain hardcoded fallback for historical data

## Database Schema Updates

```sql
-- Already exists in schema, just need to ensure they're used
ALTER TABLE releases ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS date_status VARCHAR(20) DEFAULT 'estimated';
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_by VARCHAR(100) DEFAULT 'system';
ALTER TABLE releases ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_date_status ON releases(date_status);
CREATE INDEX IF NOT EXISTS idx_last_verified_at ON releases(last_verified_at);
```

## Practical Workflow

1. **Weekly Manual Review** (replaces automated scraper):
   - Check Bleacher Seats Collectibles manually
   - Cross-reference with Cardboard Connection
   - Verify dates against manufacturer announcements when available
   - Update database with source URL and verification timestamp

2. **Date Status Classification**:
   - `confirmed`: Verified from manufacturer announcement
   - `estimated`: From reliable aggregator (Cardboard Connection, Beckett)
   - `tbd`: Announced product but no date set

3. **API Endpoints** (for manual updates):
   - `POST /api/releases/manual-add` - Add new release with metadata
   - `PATCH /api/releases/:id/verify` - Mark date as verified with source
   - `GET /api/releases/unverified` - List releases needing verification

## Conclusion

**No authorized automated sources exist from manufacturers.**

**Implemented Solution**: Manual review workflow with proper source tracking, date status classification, and verification timestamps. This is compliant, maintainable, and provides better data quality than automated scraping of unverified sources.
