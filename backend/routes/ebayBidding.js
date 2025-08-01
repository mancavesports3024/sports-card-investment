const express = require('express');
const router = express.Router();
const ebayBiddingService = require('../services/ebayBiddingService');

// Get auction information
router.get('/auction/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const auctionInfo = await ebayBiddingService.getAuctionInfo(itemId);
        res.json({ success: true, data: auctionInfo });
    } catch (error) {
        console.error('Error getting auction info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Schedule a bid
router.post('/schedule-bid', async (req, res) => {
    try {
        const { itemId, maxBidAmount, bidBuffer } = req.body;
        
        if (!itemId || !maxBidAmount) {
            return res.status(400).json({ 
                success: false, 
                error: 'itemId and maxBidAmount are required' 
            });
        }

        const result = await ebayBiddingService.scheduleBid(itemId, maxBidAmount, bidBuffer);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error scheduling bid:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all bidding tasks
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await ebayBiddingService.getBiddingTasks();
        res.json({ success: true, data: tasks });
    } catch (error) {
        console.error('Error getting bidding tasks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel a scheduled bid
router.delete('/cancel-bid/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const result = await ebayBiddingService.cancelBid(taskId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error cancelling bid:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get bidding configuration
router.get('/config', async (req, res) => {
    try {
        res.json({ success: true, data: ebayBiddingService.config });
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update bidding configuration
router.put('/config', async (req, res) => {
    try {
        const updatedConfig = await ebayBiddingService.updateConfig(req.body);
        res.json({ success: true, data: updatedConfig });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add saved item
router.post('/saved-items', async (req, res) => {
    try {
        const { itemId, maxBidAmount } = req.body;
        
        if (!itemId || !maxBidAmount) {
            return res.status(400).json({ 
                success: false, 
                error: 'itemId and maxBidAmount are required' 
            });
        }

        const item = await ebayBiddingService.addSavedItem(itemId, maxBidAmount);
        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Error adding saved item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove saved item
router.delete('/saved-items/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const result = await ebayBiddingService.removeSavedItem(itemId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error removing saved item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get saved items
router.get('/saved-items', async (req, res) => {
    try {
        res.json({ success: true, data: ebayBiddingService.config.savedItems });
    } catch (error) {
        console.error('Error getting saved items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint to check if service is working
router.get('/health', (req, res) => {
    res.json({ success: true, message: 'eBay Bidding Service is running' });
});

module.exports = router; 