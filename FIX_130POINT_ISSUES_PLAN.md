# Plan to Fix 130point Card Display Issues

## Issues Identified

1. **Verbose Titles**: Titles contain metadata like "Best Offer Acceptedhipping Price: N/A", "Auctionhipping Price: N/A", "Bids: 24" that should be cleaned
2. **Missing Images**: No card images are being extracted from 130point results, causing "CARD IMAGE NOT AVAILABLE" in scorecard summary
3. **All Cards Show "See listing"**: All cards appear to be from 130point (no eBay cards showing), or source detection isn't working
4. **No Item Numbers**: Item numbers aren't being displayed (expected for 130point, but should show for eBay if present)

## Root Causes

### Issue 1: Title Cleaning
- Current `cleanTitle()` function doesn't handle patterns like:
  - "Best Offer Acceptedhipping Price" (missing space between words)
  - "Auctionhipping Price" (missing space)
  - "Fixed Pricehipping Price" (missing space)
  - "Bids: X" patterns that aren't in parentheses
  - These patterns suggest the title text is concatenated without proper spacing

### Issue 2: Missing Images
- `extractCardFromRow()` method doesn't extract images - only extracts title, price, date, and link
- `extractCardData()` method does extract images but may not be used for table-based results
- Need to check how 130point HTML is structured and add image extraction to `extractCardFromRow()`

### Issue 3: Source Detection
- All cards showing "See listing" suggests they're all 130point cards
- This might be correct if 130point is the primary source now
- But need to verify eBay fallback is working when 130point has no results

## Fix Plan

### Fix 1: Improve Title Cleaning
**File**: `backend/services/130pointService.js`
**Method**: `cleanTitle()`

**Changes needed**:
1. Add patterns to handle concatenated words:
   - `/(Best\s+Offer\s+Accepted|Auction|Fixed\s+Price)hipping\s+Price/gi` → Remove
   - `/(Best\s+Offer\s+Accepted|Auction|Fixed\s+Price)(?=hipping)/gi` → Remove sale type before "hipping"
2. Remove "Bids: X" patterns more aggressively:
   - `/\s*Bids:\s*\d+\s*-?\s*/gi` → Remove
3. Remove "Shipping Price: N/A" variations:
   - `/\s*hipping\s+Price:\s*(N\/A|[\d,]+\.?\d*\s*USD)\s*/gi` → Remove
4. Clean up multiple dashes and separators:
   - `/\s*-\s*-\s*-?\s*/g` → Remove
5. Remove trailing metadata patterns

### Fix 2: Extract Images from 130point
**File**: `backend/services/130pointService.js`
**Methods**: `parseResponse()` and `extractCardFromRow()`

**Root Cause**: 
- `parseResponse()` extracts only text from cells using `.text().trim()`, losing all HTML structure
- Images are in the HTML but never extracted because we only pass text strings

**Changes needed**:
1. **Modify `parseResponse()`**: Pass the actual jQuery/Cheerio elements to `extractCardFromRow()` instead of just text
   - Change: `const cell1 = $(cells[0]).text().trim();` → `const $cell1 = $(cells[0]);`
   - Pass `$cell1` and `$cell2` (or the full `$row`) to `extractCardFromRow()`

2. **Modify `extractCardFromRow()`**: Accept HTML elements and extract images
   - Change signature: `extractCardFromRow($cell1, $cell2, $row)` or `extractCardFromRow($row)`
   - Extract text: `const cell1Text = $cell1.text().trim();`
   - **Extract images**: Based on HTML structure, images are in `<td id="imgCol">` with `<img src="...">`
   - Try multiple approaches:
     - `$row.find('td#imgCol img').attr('src')` - Direct selector for image column
     - `$row.find('img').first().attr('src')` - Fallback to any image in row
     - Also check: `data-src`, `data-lazy`, `data-original` attributes
   - **Upgrade image size**: If eBay image (i.ebayimg.com), upgrade from `s-1150.jpg` to `s-l1600.jpg` for better quality
   - Normalize image URL using `normalizeUrl()`
   - Return image in result: `{ ..., image: normalizedImageUrl }`

3. **Confirmed HTML Structure**: 
   - Images are in `<td id="imgCol">` within table rows
   - Images are eBay-hosted (`i.ebayimg.com`)
   - Current code misses these because it only extracts `.text()`

### Fix 3: Verify Image Passing
**File**: `backend/routes/searchCards.js`
**Location**: Line ~1222 where 130point cards are transformed

**Changes needed**:
1. Ensure `imageUrl` field is properly set from `card.image`
2. Verify the image field is being passed through correctly
3. Add logging to debug if images are being extracted but not passed

### Fix 4: Improve Image Extraction Logic
**File**: `backend/services/130pointService.js`
**Method**: `searchSoldCards()`

**Changes needed**:
1. Check if the method uses `extractCardFromRow()` or `extractCardData()`
2. If using `extractCardFromRow()`, ensure it extracts images
3. If HTML structure changed, update selectors
4. Add fallback image extraction methods

### Fix 5: Debug Source Detection
**File**: `frontend/src/components/SearchPage.js`
**Location**: Button rendering logic

**Changes needed**:
1. Add console logging to see what `card.source` and `card.itemWebUrl` values are
2. Verify eBay cards are being marked with `source: 'ebay'`
3. Ensure 130point cards have `source: '130point'`

## Implementation Order

1. **First**: Fix title cleaning (Fix 1) - Most visible issue, high confidence this will work
2. **Second**: Add image extraction to `extractCardFromRow()` (Fix 2) - Core fix, but may need iteration if HTML structure is different
3. **Third**: Verify image passing in route (Fix 3) - Quick verification
4. **Fourth**: Debug and improve image extraction (Fix 4) - May need to inspect actual 130point HTML
5. **Fifth**: Verify source detection (Fix 5) - Should work, but good to confirm
6. **Sixth** (If needed): Add eBay fallback for images if 130point has no images (Gap 1)

## Confidence Assessment

**High Confidence (Will Fix)**:
- ✅ Title cleaning - Regex patterns are straightforward
- ✅ Source detection - Already implemented, just needs verification
- ✅ Image passing - Simple field mapping issue

**Medium Confidence (Should Fix, May Need Iteration)**:
- ⚠️ Image extraction - Depends on 130point HTML structure. If images aren't in table rows, may need alternative approach

**Lower Confidence (May Need Additional Work)**:
- ⚠️ If 130point HTML doesn't contain images at all, we'll need Gap 1 solution (eBay fallback for images)

## Potential Gaps & Additional Considerations

### Gap 1: eBay Fallback When 130point Has Results But No Images
**Issue**: Current logic only calls eBay fallback if 130point returns NO results. If 130point returns results but without images, we won't get eBay images.

**Potential Fix** (Optional):
- After getting 130point results, check if any have images
- If no images found, also try eBay as supplement (not replacement)
- Merge results, prioritizing cards with images

### Gap 2: 130point HTML Structure May Not Have Images
**Issue**: If 130point's HTML structure doesn't include images in table rows, we need an alternative approach.

**Potential Solutions**:
- Check if images are in a separate API endpoint or JSON response
- Use the link to fetch the actual listing page and extract image from there
- Fall back to eBay if 130point structure doesn't support images

### Gap 3: Item Numbers for 130point
**Issue**: 130point cards won't have eBay item numbers, which is expected. But we should verify the frontend handles this gracefully (shows nothing instead of "Item: undefined").

## Testing Checklist

- [ ] Titles are clean (no metadata like "hipping Price", "Bids: X")
- [ ] Card images appear in individual tiles
- [ ] Scorecard summary shows card image (not "NOT AVAILABLE")
- [ ] eBay cards show "VIEW ON EBAY" button
- [ ] 130point cards show "See listing" button
- [ ] Item numbers appear for eBay cards (not for 130point, which is correct)
- [ ] All tiles have consistent layout
- [ ] No "Item: undefined" or similar errors in console

## Files to Modify

1. `backend/services/130pointService.js`
   - `cleanTitle()` method
   - `extractCardFromRow()` method
   - `searchSoldCards()` method (if needed)

2. `backend/routes/searchCards.js`
   - 130point card transformation (verify image passing)

3. `frontend/src/components/SearchPage.js`
   - Add debug logging (optional, for verification)

