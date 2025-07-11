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

    // Build API parameters
    const params = {
      q: ebayQuery,
      limit: 20,
      sort: 'price asc',
    };

    // Add buying options filter if specified
    if (saleType === 'auction') {
      params.buyingOptions = 'AUCTION';
    } else if (saleType === 'fixed') {
      params.buyingOptions = 'FIXED_PRICE';
    }

    console.log('🔍 Fetching live listings with params:', { query: ebayQuery, saleType, buyingOptions: params.buyingOptions });

    const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const items = response.data.itemSummaries || [];
    console.log(`✅ Found ${items.length} live listings for "${ebayQuery}"`);
    
    // Log some details about the items found
    if (items.length > 0) {
      const auctionCount = items.filter(item => item.buyingOptions?.includes('AUCTION')).length;
      const fixedCount = items.filter(item => item.buyingOptions?.includes('FIXED_PRICE')).length;
      console.log(`   📊 Breakdown: ${auctionCount} auctions, ${fixedCount} fixed price`);
    }

    res.json({ items });
  } catch (error) {
    console.error('eBay Browse API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch live listings', details: error.response?.data || error.message });
  }
});

module.exports = router; 