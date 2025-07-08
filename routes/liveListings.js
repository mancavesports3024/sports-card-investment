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
  const { query, grade } = req.query;
  if (!query || !grade) {
    return res.status(400).json({ error: 'Missing query or grade parameter' });
  }

  const ebayQuery = buildEbayQuery(query, grade);

  try {
    const token = process.env.EBAY_AUTH_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'No eBay token available' });
    }

    const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: ebayQuery,
        limit: 20,
        sort: 'price asc',
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({ items: response.data.itemSummaries || [] });
  } catch (error) {
    console.error('eBay Browse API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch live listings', details: error.response?.data || error.message });
  }
});

module.exports = router; 