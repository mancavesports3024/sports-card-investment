const express = require('express');
const router = express.Router();
const gemrateService = require('../services/gemrateService');

const sanitizeGemrateQuery = (query) => {
  if (!query || typeof query !== 'string') return query;
  let cleanQuery = query;
  const exclusionIndex = cleanQuery.indexOf(' -(');
  if (exclusionIndex !== -1) {
    cleanQuery = cleanQuery.substring(0, exclusionIndex).trim();
  }
  cleanQuery = cleanQuery.replace(/\s*-\s*\([^)]+\)/g, '').trim();
  cleanQuery = cleanQuery.replace(/\s*-\s*\w+/g, '').trim();
  return cleanQuery;
};

// GET /api/gemrate/search/:query - Search for card population data
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { options } = req.query;
    const cleanQuery = sanitizeGemrateQuery(decodeURIComponent(query));
    
    console.log(`🔍 GemRate search request: "${cleanQuery}" (original: "${decodeURIComponent(query)}")`);
    
    if (!cleanQuery || cleanQuery.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search query',
        details: 'Query is empty after sanitization'
      });
    }
    
    const result = await gemrateService.searchCardPopulation(cleanQuery, options ? JSON.parse(options) : {});
    
    console.log(`🔍 GemRate search result: success=${result?.success}, hasPopulation=${!!result?.population}`);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate search error:', error);
    console.error('❌ GemRate error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to search GemRate data',
      details: error.message
    });
  }
});

// POST /api/gemrate/search - Search with POST body
router.post('/search', async (req, res) => {
  try {
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: query'
      });
    }

    const cleanQuery = sanitizeGemrateQuery(query);
    
    console.log(`🔍 GemRate search request: "${cleanQuery}"`);
    
    const result = await gemrateService.searchCardPopulation(cleanQuery, options || {});

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search GemRate data',
      details: error.message
    });
  }
});

// GET /api/gemrate/population/:cardName - Get population data for a specific card
router.get('/population/:cardName', async (req, res) => {
  try {
    const { cardName } = req.params;
    
    console.log(`📊 GemRate population request: "${cardName}"`);
    
    const populationData = await gemrateService.getPopulationData(cardName);
    
    if (populationData) {
      res.json({
        success: true,
        data: populationData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No population data found',
        cardName: cardName
      });
    }
  } catch (error) {
    console.error('❌ GemRate population error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get population data',
      details: error.message
    });
  }
});

// GET /api/gemrate/trends/:cardName - Get grading trends for a card
router.get('/trends/:cardName', async (req, res) => {
  try {
    const { cardName } = req.params;
    
    console.log(`📈 GemRate trends request: "${cardName}"`);
    
    const trendsData = await gemrateService.getGradingTrends(cardName);
    
    if (trendsData) {
      res.json({
        success: true,
        data: trendsData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No trends data found',
        cardName: cardName
      });
    }
  } catch (error) {
    console.error('❌ GemRate trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trends data',
      details: error.message
    });
  }
});

// POST /api/gemrate/analyze - Analyze investment potential
router.post('/analyze', async (req, res) => {
  try {
    const { cardName, priceData } = req.body;
    
    if (!cardName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: cardName'
      });
    }
    
    console.log(`💰 GemRate investment analysis: "${cardName}"`);
    
    const analysis = await gemrateService.analyzeInvestmentPotential(cardName, priceData);
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze investment potential',
      details: error.message
    });
  }
});

// GET /api/gemrate/set/:setName - Get set population data
router.get('/set/:setName', async (req, res) => {
  try {
    const { setName } = req.params;
    
    console.log(`📊 GemRate set population request: "${setName}"`);
    
    const setData = await gemrateService.getSetPopulation(setName);
    
    if (setData) {
      res.json({
        success: true,
        data: setData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No set data found',
        setName: setName
      });
    }
  } catch (error) {
    console.error('❌ GemRate set error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get set data',
      details: error.message
    });
  }
});

// GET /api/gemrate/details/:gemrateId - Get card details by gemrate_id
router.get('/details/:gemrateId', async (req, res) => {
  try {
    const { gemrateId } = req.params;
    
    console.log(`📊 GemRate card details request: "${gemrateId}"`);
    
    const cardDetails = await gemrateService.getCardDetails(gemrateId);
    
    if (cardDetails) {
      res.json({
        success: true,
        data: {
          gemrateId: gemrateId,
          population: gemrateService.parsePopulationData(cardDetails),
          rawData: cardDetails
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No card details found',
        gemrateId: gemrateId
      });
    }
  } catch (error) {
    console.error('❌ GemRate details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get card details',
      details: error.message
    });
  }
});

module.exports = router;
