# Release Calendar Data Source Analysis

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
- **Website**: https://www.topps.com/collections/baseball-cards, https://www.topps.com/collections/coming-soon
- **Feed/API**: ❌ No public API or RSS feed
- **Data Quality**: ✅ Official dates (most accurate when posted)
- **Update Frequency**: Irregular; releases announced 2-8 weeks before launch
- **Coverage**: Baseball, WWE, Star Wars, F1, UEFA (Topps products only)
- **Access Constraints**: No scraping ToS restrictions, but no structured feed
- **Scraping Difficulty**: Moderate (JavaScript-rendered pages, Shopify storefront)
- **Reliability**: High for posted releases; incomplete for future dates

#### Panini America
- **Website**: https://www.paniniamerica.net/release-calendar, https://www.paniniamerica.net/category/panini-previews
- **Feed/API**: ❌ No public API or RSS feed  
- **Data Quality**: ✅ Official dates (most accurate when posted)
- **Update Frequency**: Irregular; releases announced 2-6 weeks before launch
- **Coverage**: Football, Basketball, Soccer, Baseball, Multi-Sport (Panini products only)
- **Access Constraints**: No scraping ToS restrictions, but WordPress site
- **Scraping Difficulty**: Moderate (dynamic content loading)
- **Reliability**: High for posted releases; incomplete for future dates

#### Upper Deck
- **Website**: https://upperdeckstore.com/, https://www.upperdeckblog.com/
- **Feed/API**: ❌ No public API (blog has RSS but doesn't list future releases)
- **Data Quality**: ✅ Official when posted
- **Update Frequency**: Irregular; very little advance notice
- **Coverage**: Hockey, Marvel, gaming products (Upper Deck products only)
- **Access Constraints**: No API access
- **Scraping Difficulty**: Moderate
- **Reliability**: Medium (announcements often day-of or last minute)

#### Bowman (Topps Subsidiary)
- **Website**: https://www.topps.com/collections/bowman
- **Feed/API**: ❌ No separate feed (integrated with Topps)
- **Data Quality**: ✅ Official
- **Update Frequency**: Same as Topps
- **Coverage**: Baseball only
- **Access Constraints**: Same as Topps
- **Scraping Difficulty**: Same as Topps
- **Reliability**: High for posted releases

#### Fanatics (Topps Successor)
- **Website**: https://www.fanatics.com/trading-cards/o-2398+z-92793-3509862569
- **Feed/API**: ❌ No public API
- **Data Quality**: ✅ Will be official source starting 2025/2026 for MLB/NBA/NFL
- **Update Frequency**: Not yet established
- **Coverage**: Will replace Topps/Panini for major sports
- **Access Constraints**: Unknown (new platform)
- **Scraping Difficulty**: Unknown
- **Reliability**: Not yet launched for trading cards

---

### 2. Multi-Brand Aggregator Sources

#### Beckett (https://www.beckett.com/sports-cards-collectibles-release-calendar)
- **Feed/API**: ❌ No public API or RSS feed
- **Data Quality**: ⚠️ Aggregated from multiple sources; generally reliable but sometimes delayed
- **Update Frequency**: Weekly to bi-weekly manual updates
- **Coverage**: ✅ Multi-brand (Topps, Panini, Upper Deck, Bowman, Leaf, Onyx, etc.)
- **Coverage Sports**: Baseball, Basketball, Football, Hockey, Soccer, Multi-Sport
- **Date Status**: Dates marked as "Estimated" or confirmed when known
- **Pricing**: ❌ No retail/hobby prices listed
- **Access Constraints**: Paywall for some features; scraping not explicitly prohibited but heavy anti-bot measures
- **Scraping Difficulty**: High (JavaScript-heavy, dynamic content, potential CAPTCHA)
- **Reliability**: Medium-High (community-trusted but not always up-to-date)
- **Additional Notes**: Requires careful parsing to distinguish confirmed vs. estimated dates

#### Cardboard Connection (https://www.cardboardconnection.com/sports-card-release-dates)
- **Feed/API**: ❌ No public API; site has RSS for blog posts but not release calendar
- **Data Quality**: ✅ High-quality aggregation; manually curated by industry experts
- **Update Frequency**: Daily to weekly updates
- **Coverage**: ✅ Multi-brand (Topps, Panini, Upper Deck, Bowman, Leaf, Onyx, Sage, etc.)
- **Coverage Sports**: Baseball, Basketball, Football, Hockey, Soccer, Non-Sport
- **Date Status**: ✅ Clearly marked as "Confirmed," "Estimated," or "TBD"
- **Pricing**: ✅ Hobby box prices listed when available
- **Access Constraints**: No explicit anti-scraping ToS; reasonable rate limiting expected
- **Scraping Difficulty**: Moderate (WordPress-based, structured HTML)
- **Reliability**: High (industry-standard resource, frequently cited)
- **Additional Notes**: 
  - Includes product checklists, set details, and box configurations
  - Community-driven corrections and updates
  - Most comprehensive free source for multi-brand releases

#### Blowout Cards (https://www.blowoutcards.com/sports-cards/release-calendar)
- **Feed/API**: ❌ No public API
- **Data Quality**: ✅ High (driven by pre-order inventory dates)
- **Update Frequency**: Real-time as products become available for pre-order
- **Coverage**: ✅ Multi-brand (products they stock)
- **Coverage Sports**: All major sports
- **Date Status**: Dates reflect pre-order availability (may differ from official retail dates)
- **Pricing**: ✅ Pre-order prices (hobby boxes, retail, etc.)
- **Access Constraints**: Commercial scraping discouraged; rate limiting in place
- **Scraping Difficulty**: High (e-commerce platform with bot protection)
- **Reliability**: High for products in their inventory; incomplete for retail-only or exclusives
- **Additional Notes**: Best for hobby box release dates; retail dates may differ

#### Steel City Collectibles (https://www.steelcitycollectibles.com/release-calendar)
- **Feed/API**: ❌ No public API
- **Data Quality**: ✅ High (based on distributor allocation dates)
- **Update Frequency**: Real-time as allocations confirmed
- **Coverage**: ✅ Multi-brand (products they stock)
- **Date Status**: Dates reflect expected shipment to their warehouse
- **Pricing**: ✅ Pre-order prices
- **Access Constraints**: Commercial scraping discouraged
- **Scraping Difficulty**: High (e-commerce platform with bot protection)
- **Reliability**: High for hobby products; less reliable for retail exclusives

#### Bleacher Seats Collectibles (Current Source)
- **Website**: https://bleacherseatscollectibles.com/release-calendar/
- **Feed/API**: ❌ No public API or RSS feed
- **Data Quality**: ⚠️ Moderate; manually maintained, sometimes outdated
- **Update Frequency**: Irregular (appears weekly to monthly)
- **Coverage**: ✅ Multi-brand
- **Date Status**: ❌ No distinction between confirmed/estimated/TBD
- **Pricing**: ❌ Not listed on calendar
- **Access Constraints**: No explicit restrictions observed
- **Scraping Difficulty**: ✅ Low (simple HTML structure, accessible via axios + cheerio)
- **Reliability**: Medium (calendar is low-priority for their site; updates can lag)
- **Current Implementation**: Successfully scraping since initial implementation

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

1. **Add Cardboard Connection as Secondary Source**
   - **Why**: Most comprehensive, clearly marks date status, includes pricing, community-trusted
   - **How**: Create `cardboardConnectionScraperService.js` using Puppeteer (JavaScript-rendered)
   - **Merge Strategy**: 
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
1. Implement Cardboard Connection scraper (Puppeteer-based)
2. Add source priority system and conflict resolution
3. Create dashboard to compare sources and flag discrepancies
4. Add automated alerts for scraper failures

### Future PRs (Lower Priority)
1. Price tracking integration
2. Community verification system
3. Release notification system
4. Public API for external integrations

---

## Scraping Best Practices

### Rate Limiting
- **Beckett/Cardboard Connection**: Max 1 request per 5 seconds
- **Bleacher Seats**: Max 1 request per 3 seconds
- **Manufacturer Sites**: Max 1 request per 10 seconds (heavier pages)

### User-Agent Rotation
- Use realistic browser user-agents
- Rotate between Chrome, Firefox, Safari on Windows/macOS/Linux
- Match user-agent with actual rendering engine when using Puppeteer

### Error Handling
- Implement exponential backoff on 429/503 errors
- Log all failures with timestamp and error details
- Fallback to cached data when scraping fails
- Alert admin after 3 consecutive failures

### Respect for Source Sites
- Cache scraped data for at least 24 hours before re-scraping
- Don't scrape during peak hours (9 AM - 5 PM EST)
- Follow robots.txt directives when present
- Provide contact info in user-agent string for site owners to reach us

### Legal/Ethical Considerations
- Release dates are factual information (not copyrightable)
- Do not scrape content (reviews, articles, images) without permission
- Attribute sources when displaying data: "Data via Cardboard Connection"
- Link back to original source when possible
- Do not frame or misrepresent scraped content as original

---

## Conclusion

**Current Approach**: Bleacher Seats scraping + database + hardcoded fallback is functional but has single-source risk.

**Recommended Next Step**: Fix service worker caching (this PR), then add Cardboard Connection as a secondary source with conflict resolution logic. This provides redundancy while maintaining a simple, maintainable architecture.

**Long-Term Goal**: Multi-source aggregation with manufacturer verification, community corrections, and price tracking—but start simple and iterate based on user feedback and data quality needs.
