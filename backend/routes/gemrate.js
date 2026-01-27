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

// POST /api/gemrate/search - Removed duplicate route (see route at line 307)

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
    
    console.log(`[gemrate/details] getCardDetails returned: ${cardDetails ? 'data' : 'null'}`);
    
    if (cardDetails) {
      const population = gemrateService.parsePopulationData(cardDetails);
      console.log(`[gemrate/details] parsePopulationData returned: ${population ? 'data' : 'null'}`);
      
      res.json({
        success: true,
        data: {
          gemrateId: gemrateId,
          population: population,
          rawData: cardDetails
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`[gemrate/details] No card details found for gemrateId: ${gemrateId}`);
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

// GET /api/gemrate/universal-pop-report - Get all sets from universal-pop-report organized by category
router.get('/universal-pop-report', async (req, res) => {
  try {
    console.log('📊 GemRate universal-pop-report request');
    
    const result = await gemrateService.getUniversalPopReportSets();
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate universal-pop-report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get universal-pop-report data',
      details: error.message
    });
  }
});

// GET /api/gemrate/universal-pop-report/checklist/:setPath - Get checklist for a specific set
router.get('/universal-pop-report/checklist/:setPath', async (req, res) => {
  try {
    const { setPath } = req.params;
    const decodedPath = decodeURIComponent(setPath);
    
    console.log(`📋 GemRate checklist request for set: ${decodedPath}`);
    
    const cards = await gemrateService.getSetChecklist(decodedPath);
    
    res.json({
      success: true,
      data: {
        setPath: decodedPath,
        cards: cards
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate checklist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get set checklist',
      details: error.message
    });
  }
});

// POST /api/gemrate/search - Search for a card and return population data
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing required body parameter: query'
      });
    }
    
    console.log(`📊 GemRate search request: "${query}"`);
    
    const searchResult = await gemrateService.searchCardPopulation(query.trim());
    
    console.log(`[gemrate.js] Search result:`, {
      success: searchResult.success,
      hasPopulation: !!searchResult.population,
      populationType: typeof searchResult.population,
      populationValue: searchResult.population,
      gemrateId: searchResult.gemrateId
    });
    
    if (searchResult.success) {
      res.json({
        success: true,
        query: query,
        gemrateId: searchResult.gemrateId,
        population: searchResult.population,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: searchResult.error || 'Card not found on GemRate',
        query: query
      });
    }
  } catch (error) {
    console.error('❌ GemRate search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search GemRate',
      details: error.message
    });
  }
});

// GET /api/gemrate/player - Get cards for a specific player (GemRate player page)
router.get('/player', async (req, res) => {
  try {
    const { grader = 'psa', category = 'all', player } = req.query;

    if (!player) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: player'
      });
    }

    const cards = await gemrateService.getPlayerCards({
      grader,
      category,
      player
    });

    res.json({
      success: true,
      data: {
        grader,
        category,
        player,
        cards
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GemRate player search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get GemRate player cards',
      details: error.message
    });
  }
});

// GET /api/gemrate/trending/players - Get trending players from GemRate API
router.get('/trending/players', async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    console.log(`📈 GemRate trending players request (period: ${period})`);

    const result = await gemrateService.getTrendingPlayers(period);

    if (result.success) {
      res.json({
        success: true,
        period: result.period,
        data: result.data,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch trending players',
        period: result.period,
        timestamp: result.timestamp
      });
    }
  } catch (error) {
    console.error('❌ GemRate trending players error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending players',
      details: error.message
    });
  }
});

// GET /api/gemrate/trending/sets - Get trending sets from GemRate API
router.get('/trending/sets', async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    console.log(`📈 GemRate trending sets request (period: ${period})`);

    const result = await gemrateService.getTrendingSets(period);

    if (result.success) {
      res.json({
        success: true,
        period: result.period,
        data: result.data,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch trending sets',
        period: result.period,
        timestamp: result.timestamp
      });
    }
  } catch (error) {
    console.error('❌ GemRate trending sets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending sets',
      details: error.message
    });
  }
});

module.exports = router;
