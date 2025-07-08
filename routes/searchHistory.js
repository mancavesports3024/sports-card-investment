const express = require('express');
const router = express.Router();
const searchHistoryService = require('../services/searchHistoryService');

// GET /api/search-history - Get all saved searches
router.get('/', async (req, res) => {
  try {
    const history = await searchHistoryService.getSearchHistory();
    res.json({
      success: true,
      searches: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting search history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load search history',
      details: error.message
    });
  }
});

// POST /api/search-history - Save a new search
router.post('/', async (req, res) => {
  try {
    const { searchQuery, results, priceAnalysis } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: searchQuery'
      });
    }
    
    const savedSearch = await searchHistoryService.addSearch({
      searchQuery,
      results,
      priceAnalysis
    });
    
    res.json({
      success: true,
      savedSearch,
      message: 'Search saved successfully'
    });
  } catch (error) {
    console.error('Error saving search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save search',
      details: error.message
    });
  }
});

// GET /api/search-history/:id - Get a specific saved search
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const search = await searchHistoryService.getSearchById(id);
    
    if (!search) {
      return res.status(404).json({
        success: false,
        error: 'Search not found'
      });
    }
    
    res.json({
      success: true,
      search
    });
  } catch (error) {
    console.error('Error getting search by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search',
      details: error.message
    });
  }
});

// DELETE /api/search-history/:id - Delete a saved search
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await searchHistoryService.deleteSearch(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Search not found or could not be deleted'
      });
    }
    
    res.json({
      success: true,
      message: 'Search deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete search',
      details: error.message
    });
  }
});

// DELETE /api/search-history - Clear all search history
router.delete('/', async (req, res) => {
  try {
    const success = await searchHistoryService.clearSearchHistory();
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear search history'
      });
    }
    
    res.json({
      success: true,
      message: 'All search history cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing search history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear search history',
      details: error.message
    });
  }
});

module.exports = router; 