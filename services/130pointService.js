const axios = require('axios');
const cheerio = require('cheerio');

// 130point.com search endpoint
const ONEPOINT_URL = 'https://130point.com/sales/';

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
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      console.log(`⏳ Rate limiting: waiting ${MIN_REQUEST_INTERVAL - timeSinceLastRequest}ms`);
      await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    console.log(`🔍 Searching 130point.com for: "${keywords}"`);
    // Format search query
    const searchQuery = formatSearchQuery(keywords);
    const searchUrl = `${ONEPOINT_URL}${searchQuery}`;
    console.log(`📡 Fetching: ${searchUrl}`);

    // Proxy support
    const axiosConfig = {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000
    };
    if (process.env.HTTP_PROXY) {
      axiosConfig.proxy = false;
      axiosConfig.httpsAgent = new (require('https-proxy-agent'))(process.env.HTTP_PROXY);
      console.log(`🌐 Using proxy: ${process.env.HTTP_PROXY}`);
    }

    let response;
    try {
      response = await axios.get(searchUrl, axiosConfig);
    } catch (err) {
      if (err.response) {
        console.error(`❌ HTTP error: ${err.response?.status} - ${err.response?.statusText}`);
        console.error('❌ Response body:', err.response.data?.slice?.(0, 500) || err.response.data);
      } else {
        console.error('❌ Request error:', err.message);
      }
      return [];
    }

    if (!response || response.status !== 200) {
      console.error(`❌ HTTP ${response?.status}: Failed to fetch 130point data`);
      return [];
    }

    // Parse HTML response
    const $ = cheerio.load(response.data);
    const sales = [];

    // Extract sales data from the page
    $('.sale-item, .card-sale, .sale-record').each((index, element) => {
      if (sales.length >= numSales) return false; // Stop if we have enough results
      const $el = $(element);
      try {
        // Extract card title
        const title = $el.find('.card-title, .title, h3, h4').first().text().trim();
        // Extract price
        const priceText = $el.find('.price, .sale-price, .amount').first().text().trim();
        const price = extractPrice(priceText);
        // Extract date
        const dateText = $el.find('.date, .sale-date, .timestamp').first().text().trim();
        const soldDate = extractDate(dateText);
        // Extract condition/grade
        const condition = $el.find('.condition, .grade, .status').first().text().trim();
        // Extract platform (eBay, COMC, etc.)
        const platform = $el.find('.platform, .source, .marketplace').first().text().trim();
        // Extract image URL
        const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        // Extract item URL
        const itemUrl = $el.find('a').first().attr('href');
        if (title && price) {
          sales.push({
            id: `130point_${index}_${Date.now()}`,
            title: title,
            price: {
              value: price.toFixed(2),
              currency: "USD"
            },
            soldDate: soldDate || new Date().toISOString(),
            condition: condition || "Unknown",
            imageUrl: imageUrl || null,
            itemWebUrl: itemUrl ? (itemUrl.startsWith('http') ? itemUrl : `https://130point.com${itemUrl}`) : null,
            seller: platform || "130point",
            source: "130point",
            platform: platform || "130point"
          });
        }
      } catch (error) {
        console.log(`⚠️ Error parsing sale item ${index}:`, error.message);
      }
    });

    // If no structured data found, try alternative selectors
    if (sales.length === 0) {
      console.log('🔍 Trying alternative parsing method...');
      const pageText = $.text();
      const lines = pageText.split('\n').filter(line => line.trim().length > 0);
      let currentSale = null;
      for (let i = 0; i < lines.length && sales.length < numSales; i++) {
        const line = lines[i].trim();
        // Look for price patterns
        const priceMatch = line.match(/\$[\d,]+\.?\d*/);
        if (priceMatch && currentSale) {
          const price = extractPrice(priceMatch[0]);
          if (price) {
            currentSale.price = {
              value: price.toFixed(2),
              currency: "USD"
            };
            sales.push(currentSale);
            currentSale = null;
          }
        }
        // Look for potential card titles (lines with card-related keywords)
        if (line.length > 10 && line.length < 200 && 
            (line.includes('Card') || line.includes('RC') || line.includes('Rookie') || 
             line.includes('PSA') || line.includes('BGS') || line.includes('SGC'))) {
          currentSale = {
            id: `130point_alt_${sales.length}_${Date.now()}`,
            title: line,
            price: { value: "0.00", currency: "USD" },
            soldDate: new Date().toISOString(),
            condition: "Unknown",
            imageUrl: null,
            itemWebUrl: null,
            seller: "130point",
            source: "130point",
            platform: "130point"
          };
        }
      }
    }

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