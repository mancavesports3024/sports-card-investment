# TCDB Integration Plan

## Overview
Overhaul the admin Card Database page to integrate with TCDB.com for browsing and selecting cards to get sales data.

## Current State
- Admin page at `/admin/card-database` showing 167 cards
- Database: SQLite database with `cards` table
- Endpoint: `/api/admin/cards` (GET with pagination/filtering)

## Goals
1. **Clear existing database** (167 cards - no longer needed)
2. **Integrate with TCDB.com** to browse:
   - Sport selection (Football, Baseball, etc.)
   - Year selection (after sport)
   - Set selection (after year)
   - Checklist view (after set)
   - Select cards from checklist to get sales data

## TCDB URL Structure
- Browse by sport: `https://www.tcdb.com/ViewAll.cfm/sp/Football?MODE=Years`
- Browse by year: `https://www.tcdb.com/ViewAll.cfm/sp/Baseball/year/2025`
- View checklist: `https://www.tcdb.com/ViewAll.cfm/sp/Baseball/year/2025/set/12345` (set ID needed)

## Implementation Plan

### Phase 1: Clear Existing Database
1. Create endpoint: `DELETE /api/admin/cards/clear-all`
2. Add confirmation dialog in admin UI
3. Clear all cards from database

### Phase 2: TCDB Service
1. Create `backend/services/tcdbService.js`
2. Functions needed:
   - `getSports()` - Get list of sports
   - `getYears(sport)` - Get years for a sport
   - `getSets(sport, year)` - Get sets for a sport/year
   - `getChecklist(setId)` - Get checklist for a set
3. Scrape TCDB HTML pages (they don't have a public API)

### Phase 3: New Admin UI
1. Replace current card list with TCDB browser
2. Multi-step flow:
   - Step 1: Select Sport
   - Step 2: Select Year
   - Step 3: Select Set
   - Step 4: View Checklist
   - Step 5: Select cards and get sales data
3. Show selected cards and allow triggering sales data fetch

### Phase 4: Sales Data Integration
1. When cards are selected, trigger sales search
2. Use existing search infrastructure (130point/eBay)
3. Store results in database

## Technical Details

### TCDB Scraping
- Use Cheerio to parse HTML
- Handle pagination if needed
- Cache results to avoid rate limiting

### Database Changes
- Keep existing `cards` table structure
- Add `tcdb_set_id` field to track TCDB set
- Add `tcdb_card_id` field to track TCDB card

### UI Components
- Sport selector (dropdown or cards)
- Year selector (grid or list)
- Set selector (list with search)
- Checklist table (with checkboxes)
- Selected cards panel
- Sales data fetch button

## Files to Create/Modify

### New Files
1. `backend/services/tcdbService.js` - TCDB scraping service
2. `frontend/src/components/TCDBBrowser.js` - New TCDB browser component
3. `frontend/src/components/TCDBBrowser.css` - Styles for TCDB browser

### Modified Files
1. `frontend/src/components/AdminCardDatabase.js` - Replace with TCDB browser
2. `backend/index.js` - Add TCDB endpoints and clear database endpoint
3. `backend/create-new-pricing-database.js` - Add TCDB fields to cards table

## Endpoints Needed

### Backend
- `GET /api/tcdb/sports` - Get list of sports
- `GET /api/tcdb/years/:sport` - Get years for sport
- `GET /api/tcdb/sets/:sport/:year` - Get sets for sport/year
- `GET /api/tcdb/checklist/:setId` - Get checklist for set
- `DELETE /api/admin/cards/clear-all` - Clear all cards (with confirmation)
- `POST /api/admin/cards/fetch-sales` - Fetch sales data for selected cards

## Next Steps
1. Start with Phase 1 (clear database)
2. Then Phase 2 (TCDB service)
3. Then Phase 3 (UI)
4. Finally Phase 4 (sales integration)

