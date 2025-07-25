const express = require('express');
const axios = require('axios');
const router = express.Router();
const cacheService = require('../services/cacheService');
const xml2js = require('xml2js');
const RSS_URL = 'https://www.ebay.com/sch/i.html?_rss=1&_saslop=1&_sasl=mancavesportscardsllc24';
const fs = require('fs');
const path = require('path');
const ebayService = require('../services/ebayService');

// Helper function to refresh eBay token
async function refreshEbayToken() {
  try {
    console.log('🔄 Attempting to refresh eBay token...');
    
    // Check if we have the required credentials
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET || !process.env.EBAY_REFRESH_TOKEN) {
      console.log('❌ Missing credentials for token refresh');
      return false;
    }

    // eBay OAuth token refresh endpoint
    const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
    
    // Prepare the request
    const auth = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(tokenUrl, 
      'grant_type=refresh_token&refresh_token=' + process.env.EBAY_REFRESH_TOKEN,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        }
      }
    );

    // Update the token
    const newToken = response.data.access_token;
    process.env.EBAY_AUTH_TOKEN = newToken;
    
    console.log('✅ eBay token refreshed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to refresh eBay token:', error.response?.data || error.message);
    return false;
  }
}

// Helper to build eBay Browse API query
function buildEbayQuery(searchQuery, grade) {
  let query = searchQuery;
  if (grade === 'PSA 9') query += ' PSA 9';
  else if (grade === 'PSA 10') query += ' PSA 10';
  // For raw, exclude graded cards to get only raw/ungraded items
  else if (grade === 'Raw') {
    query = searchQuery + ' -PSA -BGS -SGC -CGC -TAG -graded';
  }
  return query;
}

// Helper to add EPN tracking parameters to eBay URLs
function addEbayTracking(url) {
  if (!url) return url;
  
  // Your EPN tracking parameters - replace with your actual values
  const epnParams = {
    mkevt: process.env.EBAY_MKEVT || '1', // Your affiliate ID
    mkcid: process.env.EBAY_MKCID || '1', // Campaign ID
    mkrid: process.env.EBAY_MKRID || '711-53200-19255-0', // Rotation ID (marketplace)
    siteid: process.env.EBAY_SITEID || '0', // Site ID (0 for US)
    campid: process.env.EBAY_CAMPID || '5338333097', // Your EPN campaign ID
    toolid: process.env.EBAY_TOOLID || '10001', // Tool ID
    customid: process.env.EBAY_CUSTOMID || 'trading-card-tracker' // Sub-ID for tracking
  };
  
  try {
    const urlObj = new URL(url);
    
    // Add EPN parameters
    Object.entries(epnParams).forEach(([key, value]) => {
      if (value) {
        urlObj.searchParams.set(key, value);
      }
    });
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error adding EPN tracking to URL:', error);
    return url; // Return original URL if there's an error
  }
}

// Extracted function for programmatic use
async function getLiveListings({ query, grade, saleType, forceRefresh = false }) {
  if (!query || !grade) {
    throw new Error('Missing query or grade parameter');
  }
  const cacheKey = cacheService.generateLiveListingsKey(query, grade, saleType);
  
  // Only check cache if not forcing refresh
  if (!forceRefresh) {
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      return { ...cachedResult, cached: true, cacheKey };
    }
  } else {
    console.log(`🔄 Force refresh requested for live listings: ${query} (${grade})`);
  }
  const ebayQuery = buildEbayQuery(query, grade);
  try {
    const token = process.env.EBAY_AUTH_TOKEN;
    if (!token) throw new Error('No eBay token available');
    let params = { q: ebayQuery, limit: 20, sort: 'price asc' };
    if (saleType === 'auction') params.buyingOptions = 'AUCTION';
    else if (saleType === 'fixed') params.buyingOptions = 'FIXED_PRICE';
    let items = [];
    // Approach 1: Browse API
    try {
      const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
        },
      });
      items = response.data.itemSummaries || [];
    } catch (error) {
      console.log('❌ Approach 1 failed:', error.message);
      console.log('❌ Full error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      // Check if it's an invalid token error and try to refresh
      if (error.message.includes('Invalid eBay authentication token') || 
          error.response?.status === 401) {
        console.log('🔄 Invalid token detected, attempting to refresh...');
        const refreshSuccess = await refreshEbayToken();
        if (refreshSuccess) {
          console.log('🔄 Token refreshed, retrying search...');
          // Update token for retry
          const newToken = process.env.EBAY_AUTH_TOKEN;
          // Retry the search with new token
          try {
            const retryResponse = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
              params,
              headers: {
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json',
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
              },
            });
            items = retryResponse.data.itemSummaries || [];
            console.log(`✅ Retry successful: found ${items.length} items`);
          } catch (retryError) {
            console.log('❌ Retry failed:', retryError.message);
          }
        }
      }
    }

    // Approach 2: For auctions, use auction-specific search terms
    if (saleType === 'auction') {
      try {
        // Try multiple auction-specific search terms
        const auctionTerms = ['auction', 'bid', 'bidding', 'ending soon', 'auction ending'];
        let auctionItems = [];
        
        for (const term of auctionTerms) {
          if (auctionItems.length >= 20) break; // Stop if we have enough items
          
          const auctionQuery = ebayQuery + ' ' + term;
          console.log(`🔍 Approach 2: Trying "${term}" - ${auctionQuery}`);
          
          const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
            params: {
              q: auctionQuery,
              limit: 10,
              sort: 'price asc',
            },
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
            },
          });

          const newItems = response.data.itemSummaries || [];
          console.log(`   Found ${newItems.length} items with "${term}"`);
          
          // Add items that aren't already in our list
          newItems.forEach(item => {
            if (!auctionItems.find(existing => existing.itemId === item.itemId)) {
              auctionItems.push(item);
            }
          });
        }
        
        items = auctionItems;
        console.log(`✅ Approach 2 found ${items.length} total auction items`);
      } catch (error) {
        console.log('❌ Approach 2 failed:', error.message);
        
        // Check if it's an invalid token error and try to refresh
        if (error.message.includes('Invalid eBay authentication token') || 
            error.response?.status === 401) {
          console.log('🔄 Invalid token detected in Approach 2, attempting to refresh...');
          const refreshSuccess = await refreshEbayToken();
          if (refreshSuccess) {
            console.log('🔄 Token refreshed, retrying Approach 2...');
            // Update token for retry
            const newToken = process.env.EBAY_AUTH_TOKEN;
            // Retry the search with new token
            try {
              const retryResponse = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
                params: {
                  q: ebayQuery,
                  limit: 20,
                  sort: 'price asc',
                  buyingOptions: 'AUCTION'
                },
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                  'Content-Type': 'application/json',
                  'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
                },
              });
              items = retryResponse.data.itemSummaries || [];
              console.log(`✅ Approach 2 retry successful: found ${items.length} items`);
            } catch (retryError) {
              console.log('❌ Approach 2 retry failed:', retryError.message);
            }
          }
        }
      }
    } else if (saleType === 'fixed') {
      // For fixed price, try to exclude auction terms
      try {
        const fixedQuery = ebayQuery + ' "buy it now" -auction -bid';
        console.log('🔍 Approach 2: Fixed price search:', fixedQuery);
        
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: {
            q: fixedQuery,
            limit: 20,
            sort: 'price asc',
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
          },
        });

        items = response.data.itemSummaries || [];
        console.log(`✅ Approach 2 found ${items.length} fixed price items`);
      } catch (error) {
        console.log('❌ Approach 2 failed:', error.message);
        
        // Check if it's an invalid token error and try to refresh
        if (error.message.includes('Invalid eBay authentication token') || 
            error.response?.status === 401) {
          console.log('🔄 Invalid token detected in fixed price search, attempting to refresh...');
          const refreshSuccess = await refreshEbayToken();
          if (refreshSuccess) {
            console.log('🔄 Token refreshed, retrying fixed price search...');
            // Update token for retry
            const newToken = process.env.EBAY_AUTH_TOKEN;
            // Retry the search with new token
            try {
              const retryResponse = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
                params: {
                  q: fixedQuery,
                  limit: 20,
                  sort: 'price asc',
                },
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                  'Content-Type': 'application/json',
                  'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
                },
              });
              items = retryResponse.data.itemSummaries || [];
              console.log(`✅ Fixed price retry successful: found ${items.length} items`);
            } catch (retryError) {
              console.log('❌ Fixed price retry failed:', retryError.message);
            }
          }
        }
      }
    }



    // If no items found, try a simpler search approach
    if (items.length === 0) {
      console.log('🔍 No items found, trying simpler search approach...');
      try {
        // Try with just the original query without any grade modifications
        const simpleParams = {
          q: query, // Use original query without grade modifications
          limit: 20,
          sort: 'price asc',
        };

        if (saleType === 'auction') {
          simpleParams.buyingOptions = 'AUCTION';
        } else if (saleType === 'fixed') {
          simpleParams.buyingOptions = 'FIXED_PRICE';
        }

        console.log('🔍 Simple search params:', simpleParams);

        const simpleResponse = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: simpleParams,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
          },
        });

        items = simpleResponse.data.itemSummaries || [];
        console.log(`✅ Simple search found ${items.length} items`);
        console.log('🔍 Simple search full response:', JSON.stringify(simpleResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Simple search also failed:', error.message);
        console.log('❌ Simple search full error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        });
        
        // Check if it's an invalid token error and try to refresh
        if (error.message.includes('Invalid eBay authentication token') || 
            error.response?.status === 401) {
          console.log('🔄 Invalid token detected in simple search, attempting to refresh...');
          const refreshSuccess = await refreshEbayToken();
          if (refreshSuccess) {
            console.log('🔄 Token refreshed, retrying simple search...');
            // Update token for retry
            const newToken = process.env.EBAY_AUTH_TOKEN;
            // Retry the search with new token
            try {
              const retryResponse = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
                params: simpleParams,
                headers: {
                  'Authorization': `Bearer ${newToken}`,
                  'Content-Type': 'application/json',
                  'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
                },
              });
              items = retryResponse.data.itemSummaries || [];
              console.log(`✅ Simple search retry successful: found ${items.length} items`);
            } catch (retryError) {
              console.log('❌ Simple search retry failed:', retryError.message);
            }
          }
        }
      }
    }

    // Log results
    console.log(`✅ Final result: ${items.length} live listings for "${ebayQuery}"`);
    
    if (items.length > 0) {
      const auctionCount = items.filter(item => item.buyingOptions?.includes('AUCTION')).length;
      const fixedCount = items.filter(item => item.buyingOptions?.includes('FIXED_PRICE')).length;
      console.log(`   📊 Breakdown: ${auctionCount} auctions, ${fixedCount} fixed price`);
      
      // Log first few items to see their buying options
      console.log('   🔍 Sample items:');
      items.slice(0, 3).forEach((item, index) => {
        console.log(`     ${index + 1}. "${item.title}" - Buying Options: ${item.buyingOptions?.join(', ') || 'None'}`);
      });

      // Client-side filtering as fallback
      if (saleType === 'auction') {
        const auctionItems = items.filter(item => {
          const title = item.title?.toLowerCase() || '';
          return item.buyingOptions?.includes('AUCTION') || 
                 title.includes('auction') ||
                 title.includes('bid') ||
                 title.includes('bidding') ||
                 title.includes('ending soon') ||
                 title.includes('auction ending') ||
                 title.includes('current bid') ||
                 title.includes('time left');
        });
        if (auctionItems.length > 0) {
          console.log(`   🎯 Client-side filtered to ${auctionItems.length} auction items`);
          items = auctionItems;
        }
      } else if (saleType === 'fixed') {
        const fixedItems = items.filter(item => {
          const title = item.title?.toLowerCase() || '';
          return item.buyingOptions?.includes('FIXED_PRICE') || 
                 !title.includes('auction') && 
                 !title.includes('bid') && 
                 !title.includes('bidding') &&
                 !title.includes('ending soon');
        });
        if (fixedItems.length > 0) {
          console.log(`   🎯 Client-side filtered to ${fixedItems.length} fixed price items`);
          items = fixedItems;
        }
      }
    } else {
      console.log('   ❌ No items found in any approach');
    }

    // For raw grade, filter out any items that contain PSA, BGS, SGC, CGC, or TAG in the title
    if (grade === 'Raw') {
      items = items.filter(item => {
        const title = item.title?.toLowerCase() || '';
        return !title.includes('psa') && 
               !title.includes('bgs') && 
               !title.includes('sgc') && 
               !title.includes('cgc') &&
               !title.includes('tag') &&
               !title.includes('graded');
      });
      console.log(`🎯 After filtering graded items: ${items.length} raw items remaining`);
    }

    // Add EPN tracking to all eBay URLs and map extra details for frontend display
    items = items.map(item => ({
      itemId: item.itemId,
      title: item.title,
      condition: item.condition,
      price: item.price,
      bestOffer: item.price?.displayType === 'BestOffer' || item.bestOfferEnabled || false,
      shipping: item.shippingOptions?.[0]?.shippingCost?.value
        ? `$${item.shippingOptions[0].shippingCost.value} ${item.shippingOptions[0].shippingCost.currency}`
        : 'See listing',
      location: item.itemLocation?.country || item.itemLocation?.stateOrProvince || '',
      listingDate: item.itemCreationDate || item.listingDate || null,
      seller: {
        username: item.seller?.username,
        feedbackScore: item.seller?.feedbackScore,
        feedbackPercentage: item.seller?.feedbackPercentage
      },
      image: item.image?.imageUrl || item.imageUrl || null,
      itemWebUrl: addEbayTracking(item.itemWebUrl),
      // Optionally include star rating and number of ratings if available
      starRating: item.reviewRating?.averageRating || null,
      numRatings: item.reviewRating?.reviewCount || null,
      bids: item.bidCount || null
    }));

    const responseData = { items };

    // Cache the response
    await cacheService.set(cacheKey, responseData, cacheService.liveListingsTTL);
    console.log(`💾 Cached live listings for: ${query} (${grade})`);

    return responseData;
  } catch (error) {
    throw error;
  }
}

// Express route handler now calls the function
router.get('/', async (req, res) => {
  const { query, grade, saleType, forceRefresh } = req.query;
  try {
    const data = await getLiveListings({ 
      query, 
      grade, 
      saleType, 
      forceRefresh: forceRefresh === 'true' 
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live listings', details: error.message });
  }
});

// Debug endpoint to list files in data directory
router.get('/debug-list-data', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const dirPath = path.join(__dirname, '../data');
  try {
    const files = fs.readdirSync(dirPath);
    res.json({ 
      files,
      dirPath,
      exists: fs.existsSync(dirPath),
      featuredFileExists: fs.existsSync(path.join(dirPath, 'featured_ebay_items.json'))
    });
  } catch (err) {
    res.status(500).json({ error: err.message, dirPath });
  }
});

// Featured eBay items endpoint
router.get('/featured-ebay-items', async (req, res) => {
  try {
    const EBAY_AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN;
    const seller = 'mancavesportscardsllc24';
    const query = 'card'; // or any keyword you want
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=sellers:{${seller}}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
        'Accept': 'application/json'
      }
    });

    const items = response.data.itemSummaries || [];
    // Shuffle and pick 10 random items
    const shuffled = items.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    const results = selected.map(item => ({
      itemId: item.itemId,
      title: item.title,
      image: item.image?.imageUrl,
      affiliateLink: `https://www.ebay.com/itm/${item.itemId}` // Add your affiliate tracking if needed
    }));

    res.json({ items: results });
  } catch (err) {
    console.error('Error in /api/featured-ebay-items:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch featured eBay items' });
  }
});

module.exports = router;
module.exports.getLiveListings = getLiveListings; 