const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper to build eBay Browse API query
function buildEbayQuery(searchQuery, grade) {
  let query = searchQuery;
  if (grade === 'PSA 9') query += ' PSA 9';
  else if (grade === 'PSA 10') query += ' PSA 10';
  // For raw, we can add -PSA -BGS -SGC -CGC to exclude graded
  else if (grade === 'Raw') query += ' -PSA -BGS -SGC -CGC';
  return query;
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
    } catch (error) {
      console.log('❌ Approach 1 failed:', error.message);
    }

    // Approach 2: If no items found and looking for auctions, try with auction-specific query
    if (items.length === 0 && saleType === 'auction') {
      try {
        const auctionQuery = ebayQuery + ' auction';
        console.log('🔍 Approach 2: Adding "auction" to search query:', auctionQuery);
        
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: {
            q: auctionQuery,
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
        console.log(`✅ Approach 2 found ${items.length} items`);
      } catch (error) {
        console.log('❌ Approach 2 failed:', error.message);
      }
    }

    // Approach 3: Try different query strategies for auctions
    if (items.length === 0 && saleType === 'auction') {
      try {
        // Try with "bid" in the query to find auction items
        const bidQuery = ebayQuery + ' bid';
        console.log('🔍 Approach 3: Adding "bid" to search query:', bidQuery);
        
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: {
            q: bidQuery,
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
        console.log(`✅ Approach 3 found ${items.length} items`);
      } catch (error) {
        console.log('❌ Approach 3 failed:', error.message);
      }
    }

    // Approach 4: Try with "ending soon" to find active auctions
    if (items.length === 0 && saleType === 'auction') {
      try {
        const endingQuery = ebayQuery + ' "ending soon"';
        console.log('🔍 Approach 4: Adding "ending soon" to search query:', endingQuery);
        
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: {
            q: endingQuery,
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
        console.log(`✅ Approach 4 found ${items.length} items`);
      } catch (error) {
        console.log('❌ Approach 4 failed:', error.message);
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
        const auctionItems = items.filter(item => 
          item.buyingOptions?.includes('AUCTION') || 
          item.title?.toLowerCase().includes('auction') ||
          item.title?.toLowerCase().includes('bid')
        );
        if (auctionItems.length > 0) {
          console.log(`   🎯 Client-side filtered to ${auctionItems.length} auction items`);
          items = auctionItems;
        }
      } else if (saleType === 'fixed') {
        const fixedItems = items.filter(item => 
          item.buyingOptions?.includes('FIXED_PRICE') || 
          !item.title?.toLowerCase().includes('auction')
        );
        if (fixedItems.length > 0) {
          console.log(`   🎯 Client-side filtered to ${fixedItems.length} fixed price items`);
          items = fixedItems;
        }
      }
    } else {
      console.log('   ❌ No items found in any approach');
    }

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