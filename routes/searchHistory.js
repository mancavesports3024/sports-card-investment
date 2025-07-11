const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const searchHistoryService = require('../services/searchHistoryService');

// Middleware to require JWT and extract user
function requireUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.split(' ')[1];
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/search-history - Get all saved searches for user
router.get('/', requireUser, async (req, res) => {
  try {
    const history = await searchHistoryService.getSearchHistoryForUser(req.user);
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

// GET /api/search-history/admin/all - Get all search history for all users (admin only)
router.get('/admin/all', requireUser, async (req, res) => {
  try {
    // Check if user is admin (you can customize this logic)
    const isAdmin = req.user.email === process.env.ADMIN_EMAIL || req.user.email?.includes('admin');
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const allHistory = await searchHistoryService.getAllSearchHistory();
    
    // Group by user
    const groupedByUser = {};
    allHistory.forEach(search => {
      const userId = search.userId || 'anonymous';
      if (!groupedByUser[userId]) {
        groupedByUser[userId] = [];
      }
      groupedByUser[userId].push(search);
    });
    
    res.json({
      success: true,
      totalSearches: allHistory.length,
      users: Object.keys(groupedByUser).length,
      groupedByUser,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting all search history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load all search history',
      details: error.message
    });
  }
});

// POST /api/search-history - Save a new search for user
router.post('/', requireUser, async (req, res) => {
  try {
    const { searchQuery, results, priceAnalysis } = req.body;
    console.log('📥 Received search data:', { searchQuery, results: results ? 'present' : 'missing', priceAnalysis: priceAnalysis ? 'present' : 'missing' });
    
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: searchQuery'
      });
    }
    
    const savedSearch = await searchHistoryService.addSearchForUser(req.user, {
      searchQuery,
      results,
      priceAnalysis
    });
    
    console.log('✅ Search saved successfully for user:', req.user.email);
    
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

// GET /api/search-history/:id - Get a specific saved search for user
router.get('/:id', requireUser, async (req, res) => {
  try {
    const { id } = req.params;
    const search = await searchHistoryService.getSearchByIdForUser(req.user, id);
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

// DELETE /api/search-history/:id - Delete a saved search for user
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await searchHistoryService.deleteSearchForUser(req.user, id);
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

// DELETE /api/search-history - Clear all search history for user
router.delete('/', requireUser, async (req, res) => {
  try {
    const success = await searchHistoryService.clearSearchHistoryForUser(req.user);
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