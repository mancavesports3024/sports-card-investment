const express = require('express');
const axios = require('axios');
const router = express.Router();

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

router.get('/', async (req, res) => {
  const { query, grade, saleType } = req.query;
  if (!query || !grade) {
    return res.status(400).json({ error: 'Missing query or grade parameter' });
  }

  const ebayQuery = buildEbayQuery(query, grade);

  try {
    const token = process.env.EBAY_AUTH_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'No eBay token available' });
    }

    // Try multiple approaches to get auctions
    let items = [];
    
    // Approach 1: Use Browse API with buyingOptions filter
    try {
      const params = {
        q: ebayQuery,
        limit: 20,
        sort: 'price asc',
      };

      if (saleType === 'auction') {
        params.buyingOptions = 'AUCTION';
      } else if (saleType === 'fixed') {
        params.buyingOptions = 'FIXED_PRICE';
      }

      console.log('🔍 Approach 1: Browse API with buyingOptions filter');
      console.log('🔍 Full API request params:', params);

      const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
        },
      });

      items = response.data.itemSummaries || [];
      console.log(`✅ Approach 1 found ${items.length} items`);
      console.log('🔍 Full response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Approach 1 failed:', error.message);
      console.log('❌ Full error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
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
      }
    }



    // If no items found, try a simpler search approach
    if (items.length === 0) {
      console.log('🔍 No items found, trying simpler search approach...');
      try {
        // Try with just the original query without any grade modifications
        const simpleParams = {
          q: searchQuery, // Use original query without grade modifications
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

    // Add EPN tracking to all eBay URLs
    items = items.map(item => ({
      ...item,
      itemWebUrl: addEbayTracking(item.itemWebUrl)
    }));

    res.json({ items });
  } catch (error) {
    console.error('eBay Browse API error:', error.response?.data || error.message);
    console.error('Full error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data
    });
    res.status(500).json({ error: 'Failed to fetch live listings', details: error.response?.data || error.message });
  }
});

module.exports = router; 