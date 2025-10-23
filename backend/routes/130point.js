const express = require('express');
const router = express.Router();
const Point130Service = require('../services/130pointService');

const point130Service = new Point130Service();

/**
 * Search sold cards on 130point.com
 * GET /api/130point/search/:query
 */
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { type, subcat, sort, timezone } = req.query;
        
        console.log(`🔍 130point search request: "${query}"`);
        
        const options = {
            type: type || '2',
            subcat: subcat || '-1',
            sort: sort || 'urlEndTimeSoonest',
            timezone: timezone || 'America/Chicago'
        };

        const results = await point130Service.searchSoldCards(query, options);
        
        res.json({
            success: true,
            query: query,
            results: results,
            count: results.length,
            source: '130point'
        });

    } catch (error) {
        console.error('❌ 130point search error:', error);
        res.status(500).json({
            success: false,
            error: '130point search failed',
            message: error.message
        });
    }
});

/**
 * Search with exclusions
 * POST /api/130point/search
 */
router.post('/search', async (req, res) => {
    try {
        const { query, exclusions, options = {} } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        console.log(`🔍 130point search request: "${query}" with exclusions: ${exclusions || 'none'}`);
        
        // Build search term with exclusions
        let searchTerm = query;
        if (exclusions && exclusions.length > 0) {
            const exclusionStr = exclusions.join(',');
            searchTerm = `${query} -(${exclusionStr})`;
        }

        const results = await point130Service.searchSoldCards(searchTerm, options);
        
        res.json({
            success: true,
            query: query,
            exclusions: exclusions || [],
            searchTerm: searchTerm,
            results: results,
            count: results.length,
            source: '130point'
        });

    } catch (error) {
        console.error('❌ 130point search error:', error);
        res.status(500).json({
            success: false,
            error: '130point search failed',
            message: error.message
        });
    }
});

module.exports = router;
