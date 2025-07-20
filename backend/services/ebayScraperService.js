const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const axios = require('axios');
const ebayService = require('./ebayService');
const liveListings = require('../routes/liveListings');

// eBay scraping configuration
const EBAY_BASE_URL = 'https://www.ebay.com';
const EBAY_SEARCH_URL = `${EBAY_BASE_URL}/sch/i.html`;

// Rate limiting for eBay scraping
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

// Helper function to delay requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract price from text
const extractPrice = (priceText) => {
  if (!priceText) return null;
  
  // Remove common prefixes and extract number
  const cleanText = priceText.replace(/[^\d.,]/g, '');
  const price = parseFloat(cleanText.replace(',', ''));
  
  return isNaN(price) ? null : price;
};

// Helper function to extract date from text
const extractDate = (dateText) => {
  if (!dateText) return null;
  
  // Remove common prefixes and clean up the text
  const cleanText = dateText.replace(/Sold|Ended|on|at/gi, '').trim();
  
  // Try to parse various date formats
  const date = new Date(cleanText);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Try to parse relative dates like "2 days ago", "1 week ago", etc.
  const relativeMatch = cleanText.match(/(\d+)\s*(day|week|month|hour)s?\s*ago/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();
    
    switch (unit) {
      case 'hour':
        now.setHours(now.getHours() - amount);
        break;
      case 'day':
        now.setDate(now.getDate() - amount);
        break;
      case 'week':
        now.setDate(now.getDate() - (amount * 7));
        break;
      case 'month':
        now.setMonth(now.getMonth() - amount);
        break;
    }
    
    return now.toISOString();
  }
  
  return null;
};

// Helper function to extract bids from text
const extractBids = (bidText) => {
  if (!bidText) return 0;
  
  const bidMatch = bidText.match(/(\d+)\s*bid/);
  return bidMatch ? parseInt(bidMatch[1]) : 0;
};

async function scrapeEbaySales(keywords, numSales = 10, maxRetries = 2) {
  console.log(`🔍 Scraping eBay sales for: "${keywords}" (target: ${numSales} items)`);
  let attempt = 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    try {
      // Construct eBay search URL for sold items
      const searchQuery = encodeURIComponent(keywords);
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&_sacat=0&LH_Sold=1&LH_Complete=1&_ipg=200`;
      console.log(`🌐 Scraping URL: ${searchUrl} (attempt ${attempt + 1})`);
      // Puppeteer launch options with optional proxy
      const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ];
      if (process.env.HTTP_PROXY) {
        puppeteerArgs.push(`--proxy-server=${process.env.HTTP_PROXY}`);
        console.log(`🌐 Using proxy: ${process.env.HTTP_PROXY}`);
      }
      const browser = await puppeteer.launch({ 
        headless: true, 
        args: puppeteerArgs
      });
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        // Wait for at least one item or a no-results message
        await Promise.race([
          page.waitForSelector('.s-item', { timeout: 12000 }),
          page.waitForSelector('[data-testid="s-item"]', { timeout: 12000 }),
          page.waitForSelector('body', { timeout: 12000 })
        ]).catch(() => {
          console.log('⚠️ No .s-item or [data-testid="s-item"] elements found, continuing anyway...');
        });
        // Debug: Check what's actually on the page
        const pageContent = await page.content();
        const hasSoldItems = pageContent.includes('s-item');
        const hasNoResults = pageContent.includes('no results') || pageContent.includes('No results found');
        // Ensure screenshots directory exists
        if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');
        // Block/CAPTCHA detection
        const isCloud = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT;
        const blockPhrases = [
          'Access to this page has been denied',
          'unusual traffic',
          'verify you are a human',
          'verify you’re a human',
          'verify you are not a robot',
          'verify you’re not a robot',
          'captcha',
          'please enable cookies',
          'restricted access',
          'forbidden',
          'blocked',
          'robot check',
          'are you a human',
          'are you human',
          'security check',
          'your request has been blocked',
          'temporarily unavailable',
          'please try again later'
        ];
        const isBlocked = blockPhrases.some(phrase => pageContent.toLowerCase().includes(phrase));
        if (isBlocked) {
          console.error('❌ eBay block or CAPTCHA detected in Puppeteer page.');
          if (!isCloud) {
            await page.screenshot({ path: 'screenshots/ebay-blocked.png', fullPage: true }).catch(() => {
              console.log('⚠️ Could not save block screenshot');
            });
          } else {
            console.log('⚠️ Screenshot not saved: running in Railway/cloud environment.');
          }
          throw new Error('eBay block or CAPTCHA detected');
        }
        console.log(`🔍 Page debug: hasSoldItems=${hasSoldItems}, hasNoResults=${hasNoResults}, isBlocked=${isBlocked}`);
        if (!isCloud) {
          await page.screenshot({ path: 'screenshots/ebay-debug.png', fullPage: true }).catch(() => {
            console.log('⚠️ Could not save debug screenshot');
          });
        }
        // Robust scraping with retry inside page.evaluate
        let sales = [];
        let evalError = null;
        for (let evalAttempt = 0; evalAttempt < 2; evalAttempt++) {
          try {
            sales = await page.evaluate((targetNumSales) => {
              const items = [];
              // Try multiple selectors for finding items
              const selectors = [
                '.s-item',
                '[data-testid="s-item"]',
                '.srp-results .s-item',
                '.srp-results li',
                '.srp-results .s-item__wrapper'
              ];
              let elements = [];
              for (const selector of selectors) {
                elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                  break;
                }
              }
              for (let i = 0; i < Math.min(elements.length, targetNumSales); i++) {
                const element = elements[i];
                try {
                  // Extract title
                  const titleElement = element.querySelector('.s-item__title');
                  const title = titleElement ? titleElement.textContent.trim() : '';
                  if (!title || title.includes('Shop on eBay')) continue;
                  // Extract price
                  const priceElement = element.querySelector('.s-item__price');
                  const priceText = priceElement ? priceElement.textContent.trim() : '';
                  const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
                  const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : 0;
                  // Extract sold date (existing improved logic)
                  let soldDate = null;
                  const dateSelectors = [
                    '.s-item__title--tagblock .POSITIVE',
                    '.s-item__title--tagblock span',
                    '.s-item__subtitle',
                    '.s-item__info .s-item__title--tagblock',
                    '.s-item__title--tagblock',
                    '.s-item__info span',
                    '.s-item__date',
                    '.s-item__time',
                    '[data-testid="s-item__date"]',
                    '.s-item__info .s-item__date'
                  ];
                  for (const selector of dateSelectors) {
                    const dateElement = element.querySelector(selector);
                    if (dateElement) {
                      const dateText = dateElement.textContent.trim();
                      if (dateText && (dateText.includes('Sold') || dateText.includes('Ended') || dateText.includes('ago') || dateText.includes('/'))) {
                        if (dateText.includes('ago')) {
                          const agoMatch = dateText.match(/(\d+)\s*(day|week|month|hour)s?\s*ago/i);
                          if (agoMatch) {
                            const amount = parseInt(agoMatch[1]);
                            const unit = agoMatch[2].toLowerCase();
                            const date = new Date();
                            if (unit === 'hour') date.setHours(date.getHours() - amount);
                            else if (unit === 'day') date.setDate(date.getDate() - amount);
                            else if (unit === 'week') date.setDate(date.getDate() - (amount * 7));
                            else if (unit === 'month') date.setMonth(date.getMonth() - amount);
                            soldDate = date;
                            break;
                          }
                        } else if (dateText.includes('/')) {
                          const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
                          if (dateMatch) {
                            const month = parseInt(dateMatch[1]) - 1;
                            const day = parseInt(dateMatch[2]);
                            const year = parseInt(dateMatch[3]);
                            const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
                            soldDate = new Date(fullYear, month, day);
                            break;
                          }
                        } else if (dateText.includes('Sold on')) {
                          const soldMatch = dateText.match(/Sold on\s+(.+)/i);
                          if (soldMatch) {
                            const dateStr = soldMatch[1].trim();
                            const parsedDate = new Date(dateStr);
                            if (!isNaN(parsedDate.getTime())) {
                              soldDate = parsedDate;
                              break;
                            }
                          }
                        }
                      }
                    }
                  }
                  if (!soldDate) {
                    const allText = element.textContent;
                    const datePatterns = [
                      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g,
                      /(\d{1,2})-(\d{1,2})-(\d{2,4})/g,
                      /(\d{1,2})\/(\d{1,2})\/(\d{2})/g,
                      /(\d{1,2})-(\d{1,2})-(\d{2})/g
                    ];
                    for (const pattern of datePatterns) {
                      const matches = allText.match(pattern);
                      if (matches && matches.length > 0) {
                        const dateMatch = matches[0].match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                        if (dateMatch) {
                          const month = parseInt(dateMatch[1]) - 1;
                          const day = parseInt(dateMatch[2]);
                          const year = parseInt(dateMatch[3]);
                          const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
                          soldDate = new Date(fullYear, month, day);
                          break;
                        }
                      }
                    }
                  }
                  if (!soldDate) {
                    soldDate = new Date();
                  }
                  // Extract condition
                  let condition = '';
                  const allText = element.textContent.toLowerCase();
                  if (title.includes('PSA') || title.includes('BGS') || title.includes('SGC') || title.includes('CGC') ||
                      title.includes('TAG') || allText.includes('psa') || allText.includes('bgs') || 
                      allText.includes('sgc') || allText.includes('cgc') || allText.includes('tag')) {
                    condition = 'Graded';
                  } else if (title.includes('Mint') || title.includes('NM') || title.includes('Near Mint') || title.includes('NM-MT') ||
                             allText.includes('mint') || allText.includes('nm') || allText.includes('near mint') || allText.includes('nm-mt')) {
                    condition = 'Near Mint';
                  } else if (title.includes('LP') || title.includes('Light Play') || title.includes('Lightly Played') ||
                             allText.includes('lp') || allText.includes('light play') || allText.includes('lightly played')) {
                    condition = 'Used';
                  } else if (title.includes('MP') || title.includes('Moderate Play') || title.includes('Moderately Played') ||
                             allText.includes('mp') || allText.includes('moderate play') || allText.includes('moderately played')) {
                    condition = 'Used';
                  } else if (title.includes('HP') || title.includes('Heavy Play') || title.includes('Heavily Played') ||
                             allText.includes('hp') || allText.includes('heavy play') || allText.includes('heavily played')) {
                    condition = 'Used';
                  } else if (title.includes('Used') || title.includes('Good') || title.includes('Fair') || title.includes('Poor') || title.includes('Damaged') ||
                             allText.includes('used') || allText.includes('good') || allText.includes('fair') || allText.includes('poor') || allText.includes('damaged')) {
                    condition = 'Used';
                  } else if (title.includes('New') || title.includes('Sealed') || title.includes('Pack Fresh') ||
                             allText.includes('new') || allText.includes('sealed') || allText.includes('pack fresh')) {
                    condition = 'New (Other)';
                  } else if (title.includes('Holo') || title.includes('Foil') || title.includes('Holographic') ||
                             allText.includes('holo') || allText.includes('foil') || allText.includes('holographic')) {
                    condition = 'Near Mint';
                  }
                  // Extract image URL
                  const imgElement = element.querySelector('.s-item__image-img');
                  const imageUrl = imgElement ? imgElement.src : null;
                  // Extract item URL
                  const linkElement = element.querySelector('.s-item__link');
                  const itemWebUrl = linkElement ? linkElement.href : null;
                  // Extract bid count
                  const bidElement = element.querySelector('.s-item__bids');
                  const bidText = bidElement ? bidElement.textContent.trim() : '';
                  const bidMatch = bidText.match(/(\d+)/);
                  const bidCount = bidMatch ? parseInt(bidMatch[1]) : 0;
                  // Determine sale type
                  let saleType = 'unknown';
                  if (bidCount > 0) {
                    saleType = 'auction';
                  } else if (priceText.includes('Buy It Now') || priceText.includes('BIN')) {
                    saleType = 'fixed_price';
                  }
                  if (price > 0) {
                    items.push({
                      id: `ebay_scraped_${i}_${Date.now()}`,
                      title: title,
                      price: {
                        value: price.toFixed(2),
                        currency: "USD",
                        priceType: saleType === 'auction' ? "final_bid" : "buy_it_now"
                      },
                      soldDate: soldDate.toISOString(),
                      condition: condition || "Unknown",
                      imageUrl: imageUrl,
                      itemWebUrl: itemWebUrl,
                      seller: "eBay",
                      source: "ebay_scraped",
                      platform: "eBay",
                      bidCount: bidCount,
                      saleType: saleType,
                      auction: saleType === 'auction' ? {
                        bidCount: bidCount,
                        startingPrice: null,
                        reserveMet: null,
                        endTime: soldDate.toISOString()
                      } : null,
                      listingType: saleType === 'auction' ? "AUCTION" : "FIXED_PRICE",
                      category: "Sports Cards",
                      location: "US",
                      shippingCost: null,
                      totalPrice: price
                    });
                  }
                } catch (error) {
                  // Catch errors for each item, but continue
                  // If frame is detached, break and retry
                  if (error.message && error.message.includes('detached frame')) {
                    throw new Error('detached frame');
                  }
                }
              }
              return items;
            }, numSales); // Pass numSales as targetNumSales
            evalError = null;
            break;
          } catch (err) {
            evalError = err;
            if (err.message && err.message.includes('detached frame')) {
              console.log('⚠️ Frame detached in page.evaluate, retrying...');
              continue;
            } else {
              throw err;
            }
          }
        }
        if (evalError) throw evalError;
        console.log(`✅ Found ${sales.length} completed sales from eBay scraping with Puppeteer`);
        return sales;
      } finally {
        await browser.close();
      }
    } catch (error) {
      lastError = error;
      if (error.message && error.message.includes('detached frame')) {
        console.log('⚠️ Frame detached in main try/catch, retrying whole scrape...');
        attempt++;
        continue;
      }
      // If not a frame error, break and fallback
      break;
    }
  }
  // If all retries fail, try eBay API as fallback
  try {
    console.log('🔄 Puppeteer failed, falling back to eBay API for live data...');
    const apiResults = await ebayService.searchSoldItems({ keywords, numSales });
    if (Array.isArray(apiResults) && apiResults.length > 0) {
      return apiResults;
    }
  } catch (apiError) {
    console.error('❌ eBay API fallback also failed:', apiError.message);
  }
  // If both fail, call liveListings logic directly
  try {
    console.log('🔄 Both Puppeteer and eBay API failed, calling liveListings for live sales data...');
    // Simulate a request to the liveListings route handler
    // We'll call the main function in liveListings.js directly
    // You may need to refactor liveListings.js to export a function for programmatic use
    // For now, let's assume we can call a function like getLiveListings({ query, grade, saleType })
    const liveResults = await liveListings.getLiveListings({ query: keywords, grade: 'Raw', saleType: undefined });
    if (liveResults && Array.isArray(liveResults.items) && liveResults.items.length > 0) {
      return liveResults.items;
    }
  } catch (liveError) {
    console.error('❌ liveListings fallback also failed:', liveError.message);
  }
  // If all fail, return empty array
  console.error('❌ All scraping and API methods failed. Returning no data.');
  return [];
}

// Mock data for eBay scraping when it fails
function getMockEbayScrapedData(searchQuery, numSales) {
  const mockItem = {
    id: "ebay_scraped_mock_1",
    title: `${searchQuery} (eBay Scraped)`,
    price: {
      value: "175.00",
      currency: "USD",
      priceType: "final_bid"
    },
    soldDate: new Date().toISOString(),
    condition: "Used",
    imageUrl: "https://example.com/card-ebay-scraped.jpg",
    itemWebUrl: "https://www.ebay.com/itm/123456789",
    seller: "ebay_seller",
    source: "ebay_scraped",
    platform: "eBay",
    saleType: "auction",
    auction: {
      bidCount: 5,
      startingPrice: null,
      reserveMet: null,
      endTime: new Date().toISOString()
    },
    listingType: "AUCTION",
    category: "Sports Cards",
    location: "US",
    shippingCost: null,
    totalPrice: 175.00
  };
  
  return Array(Math.min(numSales, 3)).fill(mockItem).map((item, index) => ({
    ...item,
    id: `ebay_scraped_mock_${index + 1}`,
    price: {
      value: (parseFloat(item.price.value) + (index * 20)).toFixed(2),
      currency: "USD",
      priceType: index % 2 === 0 ? "final_bid" : "buy_it_now"
    },
    saleType: index % 2 === 0 ? "auction" : "fixed_price",
    auction: index % 2 === 0 ? {
      bidCount: item.auction.bidCount + index,
      startingPrice: null,
      reserveMet: null,
      endTime: new Date().toISOString()
    } : null,
    listingType: index % 2 === 0 ? "AUCTION" : "FIXED_PRICE",
    totalPrice: parseFloat(item.price.value) + (index * 20)
  }));
}

// Function to check eBay scraping availability
async function checkEbayScrapingStatus() {
  try {
    console.log('🔍 Checking eBay scraping availability...');
    
    const response = await axios.get('https://www.ebay.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });
    
    return {
      success: response.status === 200,
      status: response.status,
      message: response.status === 200 ? 'eBay.com is accessible for scraping' : `HTTP ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'eBay.com is not accessible for scraping',
      timestamp: new Date().toISOString()
    };
  }
}

// Function to get eBay sales trends
async function getEbaySalesTrends(keywords, days = 30) {
  try {
    console.log(`📈 Getting eBay sales trends for: "${keywords}" (last ${days} days)`);
    
    // This would scrape multiple pages to get trend data
    const recentSales = await scrapeEbaySales(keywords, 50);
    
    // Calculate trends
    const prices = recentSales.map(sale => parseFloat(sale.price.value)).filter(price => price > 0);
    
    if (prices.length === 0) {
      return {
        success: false,
        message: 'No price data available',
        trends: null
      };
    }
    
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Calculate price volatility
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);
    
    return {
      success: true,
      message: `Trends calculated from ${prices.length} sales`,
      trends: {
        averagePrice: avgPrice.toFixed(2),
        minPrice: minPrice.toFixed(2),
        maxPrice: maxPrice.toFixed(2),
        volatility: volatility.toFixed(2),
        totalSales: prices.length,
        priceRange: (maxPrice - minPrice).toFixed(2)
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ eBay trends error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to calculate trends',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  scrapeEbaySales,
  checkEbayScrapingStatus,
  getEbaySalesTrends,
  getMockEbayScrapedData
}; 