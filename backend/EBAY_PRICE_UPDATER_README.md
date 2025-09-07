# eBay Price Updater System

## Overview
The eBay Price Updater is a clean, modern system that uses eBay's built-in search filters to find accurate pricing data for trading cards. It replaces all previous price updating systems that used problematic negative keywords or 130point service dependencies.

## Key Features

### ✅ **Modern eBay Integration**
- Uses `EbayScraperService` with eBay's native filters
- **No negative keywords** (which don't work reliably)
- **Built-in eBay filters**: `&Graded=Yes&Grade=10`, `&Graded=No`, etc.
- Proper price range filtering by grade

### ✅ **Three-Search Strategy**
1. **PSA 10 Search**: `&Graded=Yes&Grade=10&_udlo=50&_udhi=5000`
2. **PSA 9 Search**: `&Graded=Yes&Grade=9&_udlo=25&_udhi=2500`  
3. **Raw Search**: `&Graded=No&_udlo=10&_udhi=1000`

### ✅ **Robust Price Parsing**
- Handles currency symbols (`$12.00` → `12`)
- Uses `numericPrice` field first, fallback to `price`
- NaN detection and validation
- Detailed debugging for troubleshooting

### ✅ **Summary Title Based**
- Uses clean summary titles for accurate matching
- Better search precision than original titles
- Consistent formatting across searches

## Files

### Primary File
- `backend/ebay-price-updater.js` - Main price updater class

### API Integration
- `backend/index.js` - Contains `/api/trigger-price-update` endpoint

### Dependencies
- `backend/services/ebayScraperService.js` - eBay search functionality
- `backend/create-new-pricing-database.js` - Database operations

## Usage

### API Endpoint
```bash
POST /api/trigger-price-update
```
Triggers background price update for cards missing PSA 9 or raw prices.

### Direct Script
```bash
node backend/ebay-price-updater.js
```
Runs price updater directly for testing.

### Batch Processing
```javascript
const EbayPriceUpdater = require('./ebay-price-updater.js');
const updater = new EbayPriceUpdater();
await updater.updateBatch(30); // Update 30 cards
```

## Configuration

### Batch Sizes
- **Testing**: 1 card
- **Production**: 30 cards per batch
- **Rate Limiting**: 3 seconds between cards

### Price Ranges by Grade
- **PSA 10**: $50 - $5,000
- **PSA 9**: $25 - $2,500
- **Raw**: $10 - $1,000

## Database Updates

The system updates the following fields in the `cards` table:
- `raw_average_price` - Average price of ungraded cards
- `psa9_average_price` - Average price of PSA 9 graded cards  
- `psa10_average_price` - Average price of PSA 10 graded cards
- `multiplier` - PSA 10 price / raw price ratio
- `last_updated` - Timestamp of price update

## Search Strategy

### Card Identification
```sql
SELECT id, title, summary_title, sport
FROM cards 
WHERE (raw_average_price IS NULL OR psa9_average_price IS NULL)
AND summary_title IS NOT NULL 
AND summary_title != ''
```

### eBay Search Process
1. **PSA 10**: `searchSoldCards(summaryTitle, null, 20, 'PSA 10')`
2. **PSA 9**: `searchSoldCards(summaryTitle, null, 20, 'PSA 9')`
3. **Raw**: `searchSoldCards(summaryTitle, null, 20, 'Raw')`

### Price Calculation
- Filters out graded cards from raw results
- Calculates average from valid prices only
- Logs detailed results for debugging

## Logging

The system provides extensive logging:
```
🔍 Searching prices for: 2024 Prizm Caitlin Clark 57
   📊 Searching PSA 10...
   ✅ Found 10 PSA 10 results
     🔍 Processing 10 results for average calculation
     🔍 Result 0: price="$45.00", numericPrice="45"
     💰 Processing: "$45.00" / "45" → 45
     ✅ Calculated average: $42.50 from 10 prices
   ✅ Updated: PSA 10 $42.50, PSA 9 $28.75, Raw $15.25, Multiplier 2.79x
```

## Integration with Batch Pull

The price updater is integrated into the batch pull process:
```javascript
// In fast-batch-pull-ebay.js
const priceResult = await this.priceUpdater.updateCardPrices(cardResult.id, summaryTitle);
```

This ensures new PSA 10 cards immediately get complete pricing data.

## Troubleshooting

### Common Issues
1. **No results found**: Summary title might be too specific
2. **Price parsing fails**: Check currency symbol handling
3. **eBay blocking**: Reduce batch size or increase delays

### Debug Information
- Price field structure (`price` vs `numericPrice`)
- Valid price count vs total results
- Average calculation details
- Search URL parameters

## Replaced Systems

This new system replaces:
- ❌ `improve-price-updating.js` (130point dependencies)
- ❌ `fast-sqlite-price-updater.js` (negative keywords)
- ❌ `update-existing-cards-prices.js` (old logic)
- ❌ `update-prices.js` (wrapper for old system)

## Benefits

### Reliability
- Uses eBay's native filters instead of unreliable negative keywords
- Proper error handling and validation
- Extensive debugging for troubleshooting

### Performance  
- Direct eBay scraper integration
- Efficient batch processing
- Rate limiting to avoid blocking

### Accuracy
- Summary title based searches for better matching
- Grade-specific price ranges
- Smart filtering of incorrect results

### Maintainability
- Clean, documented code
- Single responsibility principle
- Easy to test and debug
