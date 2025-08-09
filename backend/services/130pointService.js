const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs'); // npm install qs

// 130point.com search endpoint
const ONEPOINT_URL = 'https://back.130point.com/cards/';

// Rate limiting for 130point scraping
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

// User-agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
];
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper function to delay requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to get a random delay between min and max ms
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to format search query for 130point
const formatSearchQuery = (keywords) => {
  return keywords
    .replace(/\s+/g, '+') // Replace spaces with +
    .replace(/[^\w\s+]/g, '') // Remove special characters except +
    .toLowerCase();
};

// Helper function to extract price from text
const extractPrice = (priceText) => {
  if (!priceText) return null;
  const cleanText = priceText.replace(/[^\d.,]/g, '');
  const price = parseFloat(cleanText.replace(',', ''));
  return isNaN(price) ? null : price;
};

// Helper function to extract date from text
const extractDate = (dateText) => {
  if (!dateText) return null;
  const date = new Date(dateText);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

// Main function to search 130point for card sales
async function search130point(keywords, numSales = 10) {
  try {
    // Rate limiting with random delay
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const extraDelay = randomDelay(2000, 5000); // 2-5 seconds random delay
      const totalDelay = (MIN_REQUEST_INTERVAL - timeSinceLastRequest) + extraDelay;
      console.log(`⏳ Rate limiting: waiting ${totalDelay}ms (base + random)`);
      await delay(totalDelay);
    }
    lastRequestTime = Date.now();

    console.log(`🔍 Searching 130point.com for: "${keywords}"`);
    // Use the raw search string for the POST payload
    // Format query: replace spaces with +
    const formattedQuery = keywords.replace(/\s+/g, '+');
    const formData = qs.stringify({
      query: formattedQuery,
      sort: 'EndTimeSoonest',
      tab_id: 1,
      tz: 'America/Chicago',
      width: 721,
      height: 695,
      mp: 'all',
      tk: 'dc848953a13185261a89'
    });
    console.log("130point POST URL:", ONEPOINT_URL);
    console.log("130point POST payload:", formData);
    // Make POST request to 130point
    const response = await axios.post(ONEPOINT_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Origin': 'https://130point.com',
        'Referer': 'https://130point.com/',
      },
      timeout: 10000
    });

    if (!response || response.status !== 200) {
      console.error(`❌ HTTP ${response?.status}: Failed to fetch 130point data`);
      return [];
    }

    // Log the first 500 characters of the HTML response for debugging
    console.log('130point HTML response (first 500 chars):', response.data?.slice(0, 500));

    // Parse HTML response
    const $ = cheerio.load(response.data);
    const sales = [];

    // Parse currency conversion rates from the HTML
    let currencyRates = {};
    try {
      const currencyDataText = $('#1-currData').text();
      if (currencyDataText) {
        currencyRates = JSON.parse(currencyDataText);
      }
    } catch (error) {
      console.log('⚠️ Could not parse currency rates:', error.message);
    }

    // Enhanced sealed product patterns to catch more variations - Updated for comprehensive filtering
    const sealedProductPatterns = [
      /\bhobby\s+box\b/i,
      /\bhobby\s+case\b/i,
      /\bjumbo\s+hobby\s+case\b/i,
      /\bjumbo\s+box\b/i,
      /\bjumbo\s+pack\b/i,
      /\bjumbo\b/i,  // Standalone JUMBO
      /\bfactory\s+sealed\b/i,
      /\bsealed\s+box\b/i,
      /\bsealed\s+pack\b/i,
      /\bsealed\s+case\b/i,
      /\bbooster\s+box\b/i,
      /\bbooster\s+pack\b/i,
      /\bblaster\s+box\b/i,
      /\bblaster\s+pack\b/i,
      /\bfat\s+pack\b/i,
      /\bjumbo\s+pack\b/i,
      /\bretail\s+box\b/i,
      /\bretail\s+pack\b/i,
      /\bhanger\s+box\b/i,
      /\bhanger\s+pack\b/i,
      /\bvalue\s+pack\b/i,
      /\bvalue\s+box\b/i,
      /\bcomplete\s+set\b/i,
      /\bfactory\s+set\b/i,
      /\bsealed\s+product\b/i,
      /\bunopened\b/i,
      /\bsealed\s+item\b/i,
      /\bsealed\s+lot\b/i,
      /\bsuperbox\b/i,
      /\bsuper\s+box\b/i,
      /\bmega\s+box\b/i,
      /\bcelebration\s+mega\s+box\b/i,
      /\bcelebration\s+mega\s+fun\s+box\b/i,
      /\bmega\s+celebration\s+fun\s+box\b/i,
      /\bcase\s+of\b/i,
      /\bbreak\s+case\b/i,
      /\bcase\s+break\b/i,
      /\bwax\s+box\b/i,
      /\bcellos?\b/i,
      /\bwrappers?\b/i,
      /\bsealed\b/i,  // Catch any item with "sealed" in the title
      /\bnew\s+sealed\b/i,
      /\bsealed\s+new\b/i,
      /\bexclusive\s+new\b/i,
      /\bnew\s+exclusive\b/i,
      /\bfun\s+box\b/i,
      /\btrading\s+card\s+box\b/i,
      /\btrading\s+card\s+super\s+box\b/i,
      /\bflagship\s+box\b/i,
      /\bcelebration\s+box\b/i,
      /\bmega\s+celebration\b/i,
      /\bcelebration\s+mega\b/i
    ];

    // Extract sales data from the actual 130point table rows
    $('#salesDataTable-1 tr#dRow').each((index, el) => {
      if (sales.length >= numSales) return false; // Stop if we have enough results
      const $el = $(el);
      try {
        const price = $el.attr('data-price');
        const currency = $el.attr('data-currency');
        const imgUrl = $el.find('td#imgCol img').first().attr('src');
        const title = $el.find('td#dCol #titleText a').text().trim();
        const titleUrl = $el.find('td#dCol #titleText a').attr('href');
        const soldVia = $el.find('td#dCol #soldVia').parent().text().replace('Sold Via:', '').trim();
        const saleType = $el.find('td#dCol #auctionLabel').text().trim();
        const listPriceRaw = $el.find('td#dCol #listPrice').text().replace('List Price:', '').trim();
        // Parse numeric value from listPrice
        let listPrice = null;
        if (listPriceRaw) {
          const match = listPriceRaw.match(/([\d,.]+)/);
          if (match) {
            listPrice = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(listPrice)) listPrice = listPrice.toFixed(2);
            else listPrice = null;
          }
        }
        const salePrice = $el.find('td#dCol .priceSpan').text().trim();
        const dateText = $el.find('td#dCol #dateText').text().replace('Date:', '').trim();
        // Parse the date properly - format is like "Thu 17 Jul 2025 06:24:43 CDT"
        let date = null;
        if (dateText) {
          try {
            // Convert to a proper date format that JavaScript can parse
            const dateMatch = dateText.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(\w{3})/);
            if (dateMatch) {
              const [, dayName, day, month, year, hour, minute, second, timezone] = dateMatch;
              // Create a date string that JavaScript can parse
              const dateString = `${month} ${day}, ${year} ${hour}:${minute}:${second}`;
              date = new Date(dateString).toISOString();
            } else {
              // Fallback to direct parsing
              date = new Date(dateText).toISOString();
            }
          } catch (error) {
            console.log(`⚠️ Error parsing date "${dateText}":`, error.message);
            date = new Date().toISOString();
          }
        }
        const shipping = $el.find('td#dCol #shipString').text().replace('Shipping Price:', '').trim();
        
        // Extract number of bids if available
        const bidText = $el.find('td#dCol #bidText').text().trim();
        let numBids = null;
        if (bidText) {
          const bidMatch = bidText.match(/Bids:\s*(\d+)/);
          if (bidMatch) {
            numBids = parseInt(bidMatch[1]);
          }
        }

        // Convert price to USD if needed
        let priceInUSD = parseFloat(price || salePrice.replace(/[^\d.,]/g, '').replace(',', ''));
        if (currency && currency !== 'USD' && currencyRates[`USD${currency}`]) {
          const rate = currencyRates[`USD${currency}`].start_rate;
          priceInUSD = priceInUSD / rate;
        }

        // Format sale type with green box styling
        const formattedSaleType = saleType ? `[${saleType}]` : '';

        // Only push if we have a title and price
        if (title && salePrice) {
          // Filter out sealed products before adding to results
          const titleLower = title.toLowerCase();
          
          // Check if title matches any sealed product pattern
          const isSealedProduct = sealedProductPatterns.some(pattern => pattern.test(titleLower));
          
          // Check for quantity indicators that suggest sealed products
          const hasQuantityIndicators = /\d+\s*(hobby\s+box|booster\s+box|blaster\s+box|retail\s+box|sealed\s+box|sealed\s+pack|sealed\s+case|lot\s+of|lots\s+of|bundle|complete\s+set|factory\s+set|hobby\s+case|jumbo\s+hobby\s+case)/i.test(titleLower);
          
          // Check for high-value items that are clearly sealed products
          const isHighValueSealed = priceInUSD > 200 && (
            titleLower.includes('hobby box') || 
            titleLower.includes('hobby case') ||
            titleLower.includes('jumbo hobby case') ||
            titleLower.includes('booster box') || 
            titleLower.includes('blaster box') || 
            titleLower.includes('complete set') ||
            titleLower.includes('factory set') ||
            titleLower.includes('superbox') ||
            titleLower.includes('mega box') ||
            /\d+\s*(box|pack|case)/i.test(titleLower)
          );
          
          // Additional specific checks for the problematic items
          const hasSpecificSealedTerms = (
            titleLower.includes('jumbo hobby case') ||
            titleLower.includes('superbox') ||
            titleLower.includes('mega box') ||
            titleLower.includes('celebration mega box') ||
            titleLower.includes('sealed') && (titleLower.includes('box') || titleLower.includes('case') || titleLower.includes('pack'))
          );
          
          // Only filter out if it's clearly a sealed product
          const shouldFilter = isSealedProduct || hasQuantityIndicators || isHighValueSealed || hasSpecificSealedTerms;
          
          // Debug specific problematic entry
          if (titleLower.includes('jumbo hobby case') || titleLower.includes('2025 topps series one 1 baseball jumbo hobby case')) {
            console.log(`[130POINT DEBUG] Found problematic entry: "${title}"`);
            console.log(`[130POINT DEBUG] - isSealedProduct: ${isSealedProduct}`);
            console.log(`[130POINT DEBUG] - hasQuantityIndicators: ${hasQuantityIndicators}`);
            console.log(`[130POINT DEBUG] - isHighValueSealed: ${isHighValueSealed}`);
            console.log(`[130POINT DEBUG] - hasSpecificSealedTerms: ${hasSpecificSealedTerms}`);
            console.log(`[130POINT DEBUG] - shouldFilter: ${shouldFilter}`);
          }
          
          if (shouldFilter) {
            console.log(`[130POINT FILTERED] Sealed product removed: "${title}" - Price: $${priceInUSD.toFixed(2)}`);
            return; // Skip this item
          }

          // Extract eBay item ID if it's an eBay URL
          let ebayItemId = null;
          let finalUrl = titleUrl ? (titleUrl.startsWith('http') ? titleUrl : `https://130point.com${titleUrl}`) : null;
          
          if (finalUrl && finalUrl.includes('ebay.com')) {
            const ebayItemMatch = finalUrl.match(/\/itm\/(\d+)|[\?&]item=(\d+)/);
            ebayItemId = ebayItemMatch ? (ebayItemMatch[1] || ebayItemMatch[2]) : null;
          }

          sales.push({
            id: `130point_${index}_${Date.now()}`,
            title: title,
            price: {
              value: priceInUSD.toFixed(2),
              currency: 'USD',
            },
            soldDate: date || new Date().toISOString(),
            saleType: formattedSaleType,
            imageUrl: imgUrl || null,
            itemWebUrl: finalUrl,
            ebayItemId: ebayItemId, // 🎯 NEW: Extracted eBay item ID
            seller: soldVia || '130point',
            source: '130point',
            platform: soldVia || '130point',
            listPrice: listPrice || null,
            shipping: shipping || null,
            numBids: numBids,
          });
        }
      } catch (error) {
        console.log(`⚠️ Error parsing sale row ${index}:`, error.message);
      }
    });

    console.log(`✅ Found ${sales.length} sales from 130point.com (after filtering sealed products)`);
    return sales;
  } catch (error) {
    console.error('❌ 130point search error:', error.message);
    return [];
  }
}

// Mock data for 130point when scraping fails
function getMock130pointData(searchQuery, numSales) {
  const mockItem = {
    id: "130point_mock_1",
    title: `${searchQuery} (130point)`,
    price: {
      value: "125.00",
      currency: "USD"
    },
    soldDate: new Date().toISOString(),
    condition: "Used",
    imageUrl: "https://example.com/card-130point.jpg",
    itemWebUrl: "https://130point.com/sales/example",
    seller: "130point",
    source: "130point",
    platform: "130point"
  };
  
  return Array(Math.min(numSales, 3)).fill(mockItem).map((item, index) => ({
    ...item,
    id: `130point_mock_${index + 1}`,
    price: {
      value: (parseFloat(item.price.value) + (index * 15)).toFixed(2),
      currency: "USD"
    }
  }));
}

// Function to check 130point availability
async function check130pointStatus() {
  try {
    console.log('🔍 Checking 130point.com availability...');
    
    const response = await axios.get('https://130point.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000
    });
    
    return {
      success: response.status === 200,
      status: response.status,
      message: response.status === 200 ? '130point.com is accessible' : `HTTP ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '130point.com is not accessible',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  search130point,
  check130pointStatus,
  getMock130pointData
}; 