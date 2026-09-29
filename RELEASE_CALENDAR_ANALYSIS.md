# Release Calendar Data Source Analysis

**Checked on**: September 27, 2026  
**Status**: Source analysis only - no scraper implementation changes in this PR

## Current Implementation

### Data Pipeline
The current release calendar uses a **three-tier fallback strategy**:

1. **Primary**: PostgreSQL database (Railway)
2. **Secondary**: Weekly scraping from Bleacher Seats Collectibles
3. **Tertiary**: Hard-coded comprehensive list (~1,178+ releases)

### Current Scraper Configuration
- **Source**: Bleacher Seats Collectibles (`https://bleacherseatscollectibles.com/release-calendar/`)
- **Method**: Cheerio-based HTML parsing (axios + cheerio)
- **Schedule**: Weekly on Sunday at 2:00 AM CT (cron job)
- **Data Extracted**: Release title, date (MM/DD/YY format), brand (inferred from title)
- **Filtering**: Releases within next 6 months
- **Service**: `backend/services/bleacherSeatsScraperService.js`
- **Scheduler**: `backend/services/releaseCalendarScheduler.js`

### Database Schema
```sql
releases (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  sport VARCHAR(100),
  release_date DATE NOT NULL,
  year INTEGER,
  description TEXT,
  retail_price VARCHAR(50),
  hobby_price VARCHAR(50),
  source VARCHAR(100),
  source_url TEXT,
  status VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Current Issues
1. **Stale Cache**: Service worker may cache old navigation HTML, showing outdated release calendar even after weekly updates
2. **Single Source**: Relies entirely on Bleacher Seats Collectibles availability
3. **Limited Metadata**: Only captures title, date, brand—missing retail/hobby prices, product descriptions
4. **No Verification Status**: No way to distinguish confirmed vs. estimated vs. TBD dates

---

## Alternative Source Evaluation

### 1. Official Manufacturer Sources

#### Topps
- **Website**: https://www.topps.com/release-calendar
- **Feed/API**: ❌ No public API or RSS feed (checked Sep 27, 2026)
- **Data Quality**: ✅ Official dates (most accurate when posted)
- **Update Frequency**: Irregular (observed from site inspection; exact frequency not documented)
- **Coverage**: Baseball, WWE, Star Wars, F1, UEFA (Topps products only)
- **Access Constraints**: Not verified; no structured feed available
- **Scraping Difficulty**: Not verified (site structure observed during inspection)
- **Reliability**: High for posted releases; incomplete for future dates (inferred from site structure)

#### Panini America
- **Website**: https://www.paniniamerica.net/coming-soon.html
- **Feed/API**: ❌ No public API or RSS feed (checked Sep 27, 2026)
- **Data Quality**: ✅ Official dates (most accurate when posted)
- **Update Frequency**: Irregular (observed from site; exact frequency not documented)
- **Coverage**: Football, Basketball, Soccer, Baseball, Multi-Sport (Panini products only)
- **Access Constraints**: Not verified; no structured feed available
- **Scraping Difficulty**: Not verified (site structure observed during inspection)
- **Reliability**: High for posted releases; incomplete for future dates (inferred from site structure)

#### Upper Deck
- **Website**: https://upperdeckstore.com/, https://www.upperdeckblog.com/
- **Feed/API**: ❌ No public API (blog has RSS for articles but not future releases - checked Sep 27, 2026)
- **Data Quality**: ✅ Official when posted
- **Update Frequency**: Irregular (observed from site; timing varies)
- **Coverage**: Hockey, Marvel, gaming products (Upper Deck products only)
- **Access Constraints**: No public API (as of Sep 27, 2026)
- **Scraping Difficulty**: Moderate (site structure observed during inspection)
- **Reliability**: Medium (release timing observed to vary significantly)

#### Bowman (Topps Subsidiary)
- **Website**: https://www.topps.com/collections/bowman
- **Feed/API**: ❌ No separate feed (integrated with Topps - checked Sep 27, 2026)
- **Data Quality**: ✅ Official
- **Update Frequency**: Same as Topps (irregular)
- **Coverage**: Baseball only
- **Access Constraints**: Same as Topps
- **Scraping Difficulty**: Same as Topps (moderate)
- **Reliability**: High for posted releases

#### Fanatics (Topps Successor)
- **Website**: https://www.fanatics.com/trading-cards/o-2398+z-92793-3509862569
- **Feed/API**: ❌ No public API (checked Sep 27, 2026)
- **Data Quality**: Expected to be official source (timeline based on industry announcements)
- **Update Frequency**: Not yet established (platform still in development as of Sep 2026)
- **Coverage**: Expected to replace Topps/Panini for major sports (MLB/NBA/NFL)
- **Access Constraints**: Unknown (platform not yet launched for trading cards)
- **Scraping Difficulty**: Unknown (platform not yet launched)
- **Reliability**: Not yet launched for trading cards (as of Sep 27, 2026)

---

### 2. Multi-Brand Aggregator Sources

#### Beckett
- **Website**: https://www.beckett.com/sports-cards-collectibles-release-calendar
- **Feed/API**: ❌ No public API or RSS feed (checked Sep 27, 2026)
- **Data Quality**: ⚠️ Aggregated from multiple sources (quality inferred from site inspection)
- **Update Frequency**: Updates observed but exact schedule not documented
- **Coverage**: ✅ Multi-brand (Topps, Panini, Upper Deck, Bowman, Leaf, Onyx, etc.)
- **Coverage Sports**: Baseball, Basketball, Football, Hockey, Soccer, Multi-Sport
- **Date Status**: Some dates marked as "Estimated" (observed Sep 27, 2026)
- **Pricing**: ❌ No retail/hobby prices listed on calendar (as of Sep 27, 2026)
- **Access Constraints**: Paywall observed for some features; terms of service and bot protection not verified
- **Scraping Difficulty**: Not verified (JavaScript-heavy site observed during inspection)
- **Reliability**: Medium-High (reputation based on industry presence)
- **Additional Notes**: Parsing required to distinguish confirmed vs. estimated dates

#### Cardboard Connection
- **Website**: https://www.cardboardconnection.com/sports-card-release-dates
- **Feed/API**: ❌ No public API (checked Sep 27, 2026); RSS available for blog posts but not for release calendar
- **Data Quality**: ✅ High-quality aggregation (observed from site inspection)
- **Update Frequency**: Updates observed; exact schedule not documented
- **Coverage**: ✅ Multi-brand (Topps, Panini, Upper Deck, Bowman, Leaf, Onyx, Sage, etc.)
- **Coverage Sports**: Baseball, Basketball, Football, Hockey, Soccer, Non-Sport
- **Date Status**: ✅ Dates marked as "Confirmed," "Estimated," or "TBD" (verified Sep 27, 2026)
- **Pricing**: ✅ Hobby box prices listed for many releases (observed Sep 27, 2026)
- **Access Constraints**: Terms of service not verified
- **Scraping Difficulty**: Not verified (WordPress-based site observed during inspection)
- **Reliability**: High (established industry resource)
- **Additional Notes**: 
  - Includes product checklists, set details, and box configurations (verified Sep 27, 2026)
  - Community corrections accepted
  - Comprehensive free multi-brand source

#### Blowout Cards
- **Website**: https://www.blowoutcards.com/sports-cards/release-calendar
- **Feed/API**: ❌ No public API (checked Sep 27, 2026)
- **Data Quality**: ✅ High for inventory items (reflects their pre-order dates)
- **Update Frequency**: Real-time based on inventory (observed Sep 27, 2026)
- **Coverage**: ✅ Multi-brand (products they stock)
- **Coverage Sports**: All major sports (verified Sep 27, 2026)
- **Date Status**: Dates reflect pre-order availability (may differ from official retail dates)
- **Pricing**: ✅ Pre-order prices listed (hobby boxes, retail, etc. - verified Sep 27, 2026)
- **Access Constraints**: Terms of service and bot protection not verified
- **Scraping Difficulty**: Not verified (e-commerce platform)
- **Reliability**: High for stocked products; incomplete for non-stocked items
- **Additional Notes**: Dates reflect their inventory timeline, not necessarily official release dates

#### Steel City Collectibles
- **Website**: https://www.steelcitycollectibles.com/release-calendar
- **Feed/API**: ❌ No public API (checked Sep 27, 2026)
- **Data Quality**: ✅ High for inventory items (reflects distributor allocations)
- **Update Frequency**: Real-time based on allocations (observed Sep 27, 2026)
- **Coverage**: ✅ Multi-brand (products they stock)
- **Date Status**: Dates reflect expected shipment to their warehouse (not official retail dates)
- **Pricing**: ✅ Pre-order prices listed (verified Sep 27, 2026)
- **Access Constraints**: Terms of service not verified
- **Scraping Difficulty**: Not verified (e-commerce platform)
- **Reliability**: High for stocked hobby products; incomplete for non-stocked items

#### Bleacher Seats Collectibles (Current Source)
- **Website**: https://bleacherseatscollectibles.com/release-calendar/
- **Feed/API**: ❌ No public API or RSS feed (checked Sep 27, 2026)
- **Data Quality**: ⚠️ Moderate; manually maintained (observed from scraper results)
- **Update Frequency**: Irregular (inferred from scraper logs; exact schedule unknown)
- **Coverage**: ✅ Multi-brand (verified from scraped data)
- **Date Status**: ❌ No distinction between confirmed/estimated/TBD (verified Sep 27, 2026)
- **Pricing**: ❌ Not listed on calendar page (verified Sep 27, 2026)
- **Access Constraints**: Not verified; currently scraped without restrictions
- **Scraping Difficulty**: ✅ Low (simple HTML structure verified in current implementation)
- **Reliability**: Medium (completeness varies; observed from scraper results)
- **Current Implementation**: Actively scraped weekly by `backend/services/bleacherSeatsScraperService.js`

---

## Recommendations

### Short-Term: Improve Current Implementation (No Source Change)
1. **Fix Service Worker Cache Strategy** ✅ (addressed in this PR)
   - Implement network-first for HTML/navigation routes
   - Version caches and clean up stale versions on activation
   - Ensures fresh release calendar data reaches users after weekly scraper runs

2. **Add Date Status Field**
   - Extend database schema: `date_status ENUM('confirmed', 'estimated', 'tbd')`
   - Default all Bleacher Seats scraped dates to 'estimated'
   - Allow manual override for user-verified confirmed dates

3. **Add Verification Metadata**
   - `last_verified_at TIMESTAMP`: when source was last checked
   - `last_verified_by VARCHAR(100)`: 'scraper', 'manual', or admin username
   - `verification_notes TEXT`: optional notes on date changes or confirmations

4. **Improve Scraper Resilience**
   - Add retry logic (3 attempts with exponential backoff)
   - Implement detailed logging for scraping failures
   - Add health check endpoint to monitor scraper status
   - Email/Slack notification when scraper fails 3 consecutive weeks

### Medium-Term: Multi-Source Strategy
**Goal**: Reduce single-source dependency while maintaining maintainability

1. **Use Cardboard Connection as Manual Cross-Check**
   - **Why**: Most comprehensive, clearly marks date status, includes pricing, community-trusted
   - **How**: Manual review and cross-reference for date verification
   - **Status**: Automated scraping not recommended until access terms and permissions are verified
   - **Future**: Automation can be reconsidered after confirming:
     - Terms of service permit automated access, or an authorized API/feed becomes available
     - Site structure and update patterns are stable
     - Rate limits and access constraints are documented
   - **Merge Strategy** (when/if automation is verified): 
     - Use Cardboard Connection as primary where dates are marked "Confirmed"
     - Use Bleacher Seats as fallback or for cross-validation
     - When dates conflict, prefer "Confirmed" over "Estimated"
     - Log date discrepancies for manual review

2. **Implement Source Priority System**
   ```javascript
   const SOURCE_PRIORITY = {
     'manual': 1,           // Admin-verified dates (highest priority)
     'manufacturer': 2,     // Direct from Topps/Panini/Upper Deck
     'cardboard_connection_confirmed': 3,
     'cardboard_connection_estimated': 4,
     'beckett_confirmed': 5,
     'bleacher_seats': 6,
     'blowout_cards': 7,    // Pre-order dates (may differ from retail)
     'hardcoded_fallback': 99
   };
   ```

3. **Add Source Metadata to Database**
   - `source_priority INTEGER`: from above priority system
   - `source_url TEXT`: direct link to the source page
   - `scraped_at TIMESTAMP`: when data was last scraped from this source
   - `source_metadata JSONB`: store additional source-specific data

### Long-Term: Ideal Architecture

1. **Manufacturer API Monitoring**
   - Periodically check for official API releases from Fanatics/Topps/Panini
   - Set up webhooks/RSS monitoring for manufacturer blogs and release announcements
   - Build automated alerts when official sources publish release calendars

2. **Community Verification System**
   - Allow trusted users to flag incorrect dates
   - Implement upvote/downvote system for date accuracy
   - Build reputation system for contributors

3. **Price Tracking Integration**
   - Scrape hobby box prices from Blowout/Steel City (when available)
   - Track MSRP for retail releases
   - Historical price tracking to show price trends

4. **Release Notifications**
   - Email/SMS alerts for upcoming releases (user-customizable by sport/brand)
   - Integration with calendar apps (iCal, Google Calendar export)
   - RSS feed for releases by sport/brand/date range ✅ (already implemented for blog)

5. **External API for Third-Party Integration**
   - Provide JSON API for our release calendar data
   - API keys for authenticated access
   - Rate limiting and usage analytics

---

## Recommended Schema Updates

```sql
ALTER TABLE releases ADD COLUMN IF NOT EXISTS date_status VARCHAR(20) DEFAULT 'estimated';
ALTER TABLE releases ADD COLUMN IF NOT EXISTS source_priority INTEGER;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_verified_by VARCHAR(100);
ALTER TABLE releases ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS source_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_date_status ON releases(date_status);
CREATE INDEX IF NOT EXISTS idx_source_priority ON releases(source_priority);
CREATE INDEX IF NOT EXISTS idx_scraped_at ON releases(scraped_at);
```

---

## Implementation Priority

### ✅ This PR (Immediate)
1. Fix service worker cache strategy (network-first for HTML)
2. Version caches and clean up stale versions
3. Document current release calendar pipeline (this file)

### Next PR (High Priority)
1. Add `date_status`, `last_verified_at`, `verification_notes` columns
2. Update scraper to set `date_status = 'estimated'` by default
3. Add admin UI to manually mark dates as 'confirmed' or 'tbd'
4. Improve scraper error handling and monitoring

### Future PRs (Medium Priority)
1. Verify access terms for additional sources (Cardboard Connection, Beckett, etc.)
2. If authorized: implement verified secondary source with appropriate access method
3. Add source priority system and conflict resolution
4. Create dashboard to compare sources and flag discrepancies
5. Add automated alerts for scraper failures

### Future PRs (Lower Priority)
1. Price tracking integration
2. Community verification system
3. Release notification system
4. Public API for external integrations

---

## Scraping Best Practices

### Rate Limiting
- **Bleacher Seats**: Max 1 request per 3 seconds (currently implemented)
- **Other sources**: Rate limits not specified until access terms are verified

### Error Handling
- Implement exponential backoff on 429/503 errors
- Log all failures with timestamp and error details
- Fallback to cached data when scraping fails
- Alert admin after 3 consecutive failures

### Respect for Source Sites
- Cache scraped data for at least 24 hours before re-scraping
- Follow robots.txt directives when present
- Respect rate limits and usage terms

### Legal/Ethical Considerations
- Release dates are factual information (not copyrightable)
- Do not scrape content (reviews, articles, images) without permission
- Verify terms of service before implementing automated access
- Attribute sources when displaying data (e.g., "Data via [Source Name]")
- Link back to original source when possible
- Do not frame or misrepresent content as original

---

## Conclusion

**Current Approach**: Bleacher Seats scraping + database + hardcoded fallback is functional but has single-source risk.

**Recommended Next Step**: Fix service worker caching (this PR), then verify access terms for potential secondary sources. Use Cardboard Connection for manual cross-checking until automation permissions are confirmed. This ensures compliance while improving data quality.

**Long-Term Goal**: Multi-source aggregation with manufacturer verification, community corrections, and price tracking—but start simple and iterate based on user feedback and data quality needs.
