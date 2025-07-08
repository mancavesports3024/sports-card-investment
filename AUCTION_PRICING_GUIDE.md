# Auction Data & Pricing Guide

## Overview
The sports card API now provides enhanced auction information and detailed pricing data to help you understand the true market value of cards.

## Price Types

### 1. Auction Prices (Final Bid)
- **Price Type**: `final_bid`
- **Description**: The final winning bid amount in an auction
- **Accuracy**: ✅ **This is the true sold price** - the amount the buyer actually paid
- **Data Source**: eBay Marketplace Insights API + eBay Scraping

### 2. Buy It Now Prices
- **Price Type**: `buy_it_now`
- **Description**: Fixed price sales where buyer paid the listed price
- **Accuracy**: ✅ **This is the true sold price** - the amount the buyer actually paid
- **Data Source**: eBay Marketplace Insights API + eBay Scraping

## Auction Information

### Available Auction Data
```json
{
  "auction": {
    "bidCount": 15,           // Number of bids placed
    "startingPrice": 0.99,    // Starting bid amount (if available)
    "reserveMet": true,       // Whether reserve price was met
    "endTime": "2024-01-15T20:30:00Z"  // When auction ended
  }
}
```

### Bid Count Analysis
- **High Bid Count (>10)**: Indicates strong interest and competitive bidding
- **Low Bid Count (1-3)**: May indicate limited interest or poor listing visibility
- **No Bids**: Could indicate overpriced item or poor listing

## Price Structure

### Complete Price Object
```json
{
  "price": {
    "value": "150.00",           // Final sold price
    "currency": "USD",           // Currency
    "originalPrice": "200.00",   // Original listing price (if different)
    "priceType": "final_bid"     // "final_bid" or "buy_it_now"
  },
  "shippingCost": 5.99,          // Shipping cost (if available)
  "totalPrice": 155.99           // Price + shipping
}
```

## Sale Types

### 1. Auction Sales
- **Sale Type**: `"auction"`
- **Listing Type**: `"AUCTION"`
- **Price**: Final winning bid amount
- **Bid Information**: Available in `auction` object

### 2. Fixed Price Sales
- **Sale Type**: `"fixed_price"`
- **Listing Type**: `"FIXED_PRICE"`
- **Price**: Buy It Now price (what buyer paid)
- **Bid Information**: Not applicable

## Data Sources

### eBay Marketplace Insights API
- **Auction Data**: ✅ Full auction details including bid count, starting price, reserve status
- **Price Accuracy**: ✅ 100% accurate - official eBay data
- **Coverage**: Recent sold items (last 90 days typically)

### eBay Scraping Service
- **Auction Data**: ✅ Bid count available, limited auction details
- **Price Accuracy**: ✅ Accurate - scraped from actual sold listings
- **Coverage**: Recent sold items from eBay website

## Price Accuracy Verification

### ✅ True Sold Prices
All prices returned by the API represent **actual amounts paid by buyers**:

1. **Auction Items**: Final winning bid amount
2. **Buy It Now**: The fixed price the buyer paid
3. **Best Offer**: Accepted offer amount

### ❌ Not Included
- **Listed Prices**: Original asking prices that didn't sell
- **Current Listings**: Active items that haven't sold yet
- **Reserve Prices**: Minimum prices that weren't met

## Usage Examples

### Filtering by Sale Type
```javascript
// Get only auction sales
const auctionSales = results.filter(item => item.saleType === 'auction');

// Get only fixed price sales
const fixedPriceSales = results.filter(item => item.saleType === 'fixed_price');
```

### Analyzing Bid Activity
```javascript
// High-competition auctions (10+ bids)
const competitiveAuctions = results.filter(item => 
  item.auction && item.auction.bidCount >= 10
);

// Low-competition auctions (1-3 bids)
const lowCompetitionAuctions = results.filter(item => 
  item.auction && item.auction.bidCount <= 3
);
```

### Price Analysis
```javascript
// Compare auction vs fixed price averages
const auctionPrices = results
  .filter(item => item.saleType === 'auction')
  .map(item => parseFloat(item.price.value));

const fixedPrices = results
  .filter(item => item.saleType === 'fixed_price')
  .map(item => parseFloat(item.price.value));

const avgAuctionPrice = auctionPrices.reduce((a, b) => a + b, 0) / auctionPrices.length;
const avgFixedPrice = fixedPrices.reduce((a, b) => a + b, 0) / fixedPrices.length;
```

## Best Practices

1. **Use Total Price**: Include shipping costs for accurate value comparison
2. **Consider Bid Count**: Higher bid counts often indicate fair market value
3. **Compare Sale Types**: Auctions vs fixed price can show different market dynamics
4. **Check Reserve Status**: Reserve met auctions are more reliable indicators
5. **Recent Data**: Focus on recent sales for current market conditions

## API Response Format

The enhanced API now returns detailed auction and pricing information:

```json
{
  "searchParams": { "searchQuery": "Mike Trout 2011", "numSales": 10 },
  "results": {
    "raw": [
      {
        "id": "123456789",
        "title": "2011 Topps Update Mike Trout RC",
        "price": {
          "value": "150.00",
          "currency": "USD",
          "originalPrice": "200.00",
          "priceType": "final_bid"
        },
        "saleType": "auction",
        "auction": {
          "bidCount": 15,
          "startingPrice": 0.99,
          "reserveMet": true,
          "endTime": "2024-01-15T20:30:00Z"
        },
        "listingType": "AUCTION",
        "totalPrice": 155.99,
        "soldDate": "2024-01-15T20:30:00Z"
      }
    ],
    "psa9": [...],
    "psa10": [...]
  },
  "priceAnalysis": {
    "raw": { "count": 26, "avgPrice": 53.30 },
    "psa9": { "count": 11, "avgPrice": 63.18 },
    "psa10": { "count": 8, "avgPrice": 274.12 }
  }
}
``` 