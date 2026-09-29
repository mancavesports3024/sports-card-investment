# Release Calendar Source Research

**Research Date**: September 29, 2026  
**Branch**: cursor/improve-release-calendar-9a1e

## Official Manufacturer Source Research

### Topps
- **URL Tested**: https://www.topps.com/release-calendar
- **Response**: HTTP 403 Forbidden (Cloudflare protected)
- **Structured Feeds**: None found (no RSS, API, ICS)
- **Conclusion**: No public automated access available

### Panini America
- **URL Tested**: https://www.paniniamerica.net/coming-soon.html
- **Response**: HTTP 403 Forbidden (Cloudflare protected)
- **Structured Feeds**: None found (no RSS, API, ICS)
- **Conclusion**: No public automated access available

### Upper Deck
- **Status**: Blog has RSS but does not include future release dates
- **Conclusion**: Not suitable for release calendar automation

## Current Implementation Review

**File**: `backend/services/bleacherSeatsScraperService.js`
- **Source**: Bleacher Seats Collectibles (https://bleacherseatscollectibles.com/release-calendar/)
- **Method**: Weekly scraping (Sunday 2 AM CT)
- **Terms**: Not verified; access constraints unknown
- **Issue**: Automated scraping without verified permission

**Recommendation**: Do not continue automated scraping of third-party aggregators without verified permission.

## Authorized Structured Sources

**Finding**: **NONE EXIST**

After researching:
- Topps: No public API/RSS
- Panini: No public API/RSS
- Upper Deck: Blog RSS doesn't include releases
- Fanatics: Not yet launched for trading cards

**All manufacturer sites use Cloudflare protection and do not offer structured data feeds.**

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
