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
        const listPrice = $el.find('td#dCol #listPrice').text().replace('List Price:', '').trim();
        const salePrice = $el.find('td#dCol .priceSpan').text().trim();
        const date = $el.find('td#dCol #dateText').text().replace('Date:', '').trim();
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
            itemWebUrl: titleUrl ? (titleUrl.startsWith('http') ? titleUrl : `https://130point.com${titleUrl}`) : null,
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

    console.log(`✅ Found ${sales.length} sales from 130point.com`);
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