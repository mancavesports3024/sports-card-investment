const express = require('express');
const router = express.Router();
const OptimizedSearchEngine = require('../optimized-search-engine');
const searchHistoryService = require('../services/searchHistoryService');

// Initialize the optimized search engine as a singleton
let searchEngine = null;
let isInitialized = false;

async function initializeSearchEngine() {
    if (!isInitialized) {
        console.log('🚀 Initializing Optimized Search Engine...');
        searchEngine = new OptimizedSearchEngine();
        await searchEngine.loadDatabase();
        isInitialized = true;
        console.log('✅ Optimized Search Engine initialized successfully!');
    }
    return searchEngine;
}

// GET /api/optimized-search-cards
router.get('/', async (req, res) => {
    const { searchQuery, numSales = 25 } = req.query;
    console.log(`>>> GET /api/optimized-search-cards endpoint hit at ${new Date().toISOString()} with searchQuery: "${searchQuery}"`);
    
    // Validate required parameters
    if (!searchQuery) {
        return res.status(400).json({ 
            error: 'Missing required parameter: searchQuery',
            example: '/api/optimized-search-cards?searchQuery=Mike%20Trout%202011&numSales=25'
        });
    }

    // Set timeout for this request
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                error: 'Request timeout',
                message: 'The request took too long to process. Please try again.',
                timestamp: new Date().toISOString()
            });
        }
    }, 30000); // 30 second timeout (much faster than original)

    try {
        // Initialize search engine if needed
        const engine = await initializeSearchEngine();
        
        // Perform fast search
        const startTime = Date.now();
        const result = engine.fastSearch(searchQuery, { numSales });
        const searchTime = Date.now() - startTime;
        
        console.log(`⚡ Fast search completed in ${searchTime}ms for query: "${searchQuery}"`);
        
        // Save search history
        try {
            await searchHistoryService.saveSearch({
                query: searchQuery,
                results: result.results,
                priceAnalysis: result.priceAnalysis
            });
        } catch (historyError) {
            console.error('Failed to save search history:', historyError.message);
            // Don't fail the request for history saving errors
        }

        clearTimeout(timeout);
        
        // Return optimized response
        res.json({
            searchParams: { searchQuery, numSales },
            results: result.results,
            priceAnalysis: result.priceAnalysis,
            performance: {
                searchTime: searchTime,
                totalItems: result.performance.totalItems,
                matchingItems: result.performance.matchingItems,
                databaseSize: result.performance.totalItems
            },
            sources: {
                total: result.performance.matchingItems,
                raw: result.results.raw.length,
                psa7: result.results.psa7.length,
                psa8: result.results.psa8.length,
                psa9: result.results.psa9.length,
                psa10: result.results.psa10.length,
                cgc9: result.results.cgc9.length,
                cgc10: result.results.cgc10.length,
                tag8: result.results.tag8.length,
                tag9: result.results.tag9.length,
                tag10: result.results.tag10.length,
                sgc10: result.results.sgc10.length,
                aigrade9: result.results.aigrade9.length,
                aigrade10: result.results.aigrade10.length,
                otherGraded: result.results.otherGraded.length
            }
        });
        
    } catch (error) {
        clearTimeout(timeout);
        console.error('Optimized search error:', error);
        res.status(500).json({ 
            error: 'Failed to perform optimized search', 
            details: error.message 
        });
    }
});

// POST /api/optimized-search-cards
router.post('/', async (req, res) => {
    const { searchQuery, numSales = 25 } = req.body;
    console.log(`>>> POST /api/optimized-search-cards endpoint hit at ${new Date().toISOString()} with searchQuery: "${searchQuery}"`);
    
    // Validate required parameters
    if (!searchQuery) {
        return res.status(400).json({ 
            error: 'Missing required field: searchQuery',
            example: {
                searchQuery: "Mike Trout 2011 Topps Update Rookie",
                numSales: 25
            }
        });
    }

    // Set timeout for this request
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                error: 'Request timeout',
                message: 'The request took too long to process. Please try again.',
                timestamp: new Date().toISOString()
            });
        }
    }, 30000); // 30 second timeout

    try {
        // Initialize search engine if needed
        const engine = await initializeSearchEngine();
        
        // Perform fast search
        const startTime = Date.now();
        const result = engine.fastSearch(searchQuery, { numSales });
        const searchTime = Date.now() - startTime;
        
        console.log(`⚡ Fast search completed in ${searchTime}ms for query: "${searchQuery}"`);
        
        // Save search history
        try {
            await searchHistoryService.saveSearch({
                query: searchQuery,
                results: result.results,
                priceAnalysis: result.priceAnalysis
            });
        } catch (historyError) {
            console.error('Failed to save search history:', historyError.message);
            // Don't fail the request for history saving errors
        }

        clearTimeout(timeout);
        
        // Return optimized response
        res.json({
            searchParams: { searchQuery, numSales },
            results: result.results,
            priceAnalysis: result.priceAnalysis,
            performance: {
                searchTime: searchTime,
                totalItems: result.performance.totalItems,
                matchingItems: result.performance.matchingItems,
                databaseSize: result.performance.totalItems
            },
            sources: {
                total: result.performance.matchingItems,
                raw: result.results.raw.length,
                psa7: result.results.psa7.length,
                psa8: result.results.psa8.length,
                psa9: result.results.psa9.length,
                psa10: result.results.psa10.length,
                cgc9: result.results.cgc9.length,
                cgc10: result.results.cgc10.length,
                tag8: result.results.tag8.length,
                tag9: result.results.tag9.length,
                tag10: result.results.tag10.length,
                sgc10: result.results.sgc10.length,
                aigrade9: result.results.aigrade9.length,
                aigrade10: result.results.aigrade10.length,
                otherGraded: result.results.otherGraded.length
            }
        });
        
    } catch (error) {
        clearTimeout(timeout);
        console.error('Optimized search error:', error);
        res.status(500).json({ 
            error: 'Failed to perform optimized search', 
            details: error.message 
        });
    }
});

// GET /api/optimized-search-cards/stats
router.get('/stats', async (req, res) => {
    try {
        const engine = await initializeSearchEngine();
        const stats = engine.getDatabaseStats();
        
        res.json({
            databaseStats: stats,
            isInitialized: isInitialized,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting search stats:', error);
        res.status(500).json({ 
            error: 'Failed to get search statistics', 
            details: error.message 
        });
    }
});

// POST /api/optimized-search-cards/batch
router.post('/batch', async (req, res) => {
    const { queries = [] } = req.body;
    console.log(`>>> POST /api/optimized-search-cards/batch endpoint hit with ${queries.length} queries`);
    
    if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ 
            error: 'Missing or invalid queries array',
            example: {
                queries: ["Mike Trout 2011", "Patrick Mahomes Rookie", "LeBron James 2003"]
            }
        });
    }

    if (queries.length > 50) {
        return res.status(400).json({ 
            error: 'Too many queries. Maximum 50 queries per batch request.' 
        });
    }

    // Set timeout for batch request
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                error: 'Batch request timeout',
                message: 'The batch request took too long to process. Please try again.',
                timestamp: new Date().toISOString()
            });
        }
    }, 60000); // 1 minute timeout for batch requests

    try {
        const engine = await initializeSearchEngine();
        
        const startTime = Date.now();
        const batchResults = await engine.batchSearch(queries);
        const batchTime = Date.now() - startTime;
        
        console.log(`⚡ Batch search completed in ${batchTime}ms for ${queries.length} queries`);
        
        clearTimeout(timeout);
        
        res.json({
            batchResults: batchResults,
            performance: {
                totalTime: batchTime,
                averageTimePerQuery: batchTime / queries.length,
                totalQueries: queries.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        clearTimeout(timeout);
        console.error('Batch search error:', error);
        res.status(500).json({ 
            error: 'Failed to perform batch search', 
            details: error.message 
        });
    }
});

module.exports = router; 