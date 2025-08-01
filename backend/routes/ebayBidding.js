const express = require('express');
const router = express.Router();
const ebayBiddingService = require('../services/ebayBiddingService');

// Get auction information
router.get('/auction/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        
        // Validate item ID
        if (!itemId || itemId.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid item ID is required' 
            });
        }
        
        console.log(`🔍 API request for auction info: ${itemId}`);
        const auctionInfo = await ebayBiddingService.getAuctionInfo(itemId);
        
        // Check if we got meaningful data
        if (!auctionInfo.title && !auctionInfo.currentPrice) {
            return res.status(404).json({ 
                success: false, 
                error: 'Auction information not found or item may not exist' 
            });
        }
        
        res.json({ success: true, data: auctionInfo });
    } catch (error) {
        console.error(`❌ API Error getting auction info for ${req.params.itemId}:`, error.message);
        
        // Provide more specific error messages
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.message.includes('timeout')) {
            statusCode = 408;
            errorMessage = 'Request timeout - eBay may be slow to respond';
        } else if (error.message.includes('net::ERR')) {
            statusCode = 503;
            errorMessage = 'Network error - unable to reach eBay';
        } else if (error.message.includes('Failed to fetch auction info')) {
            statusCode = 404;
            errorMessage = 'Auction not found or no longer available';
        }
        
        res.status(statusCode).json({ 
            success: false, 
            error: errorMessage,
            itemId: req.params.itemId
        });
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
router.get('/health', async (req, res) => {
    try {
        // Check if eBay API credentials are configured
        const hasCredentials = ebayBiddingService.config && 
            (ebayBiddingService.config.clientId || ebayBiddingService.config.authToken);
        
        const isHealthy = hasCredentials;
        
        res.json({ 
            status: isHealthy ? 'healthy' : 'degraded',
            service: 'ebay-bidding',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            apiStatus: hasCredentials ? 'configured' : 'not_configured',
            method: 'ebay_api'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy',
            service: 'ebay-bidding',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router; 