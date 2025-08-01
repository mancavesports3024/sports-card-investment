const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const ebayApiService = require('./ebayApiService');

class EbayBiddingService {
    constructor() {
        this.biddingTasks = new Map();
        this.configPath = path.join(__dirname, '../data/bidding-config.json');
        this.loadBiddingConfig();
    }

    async loadBiddingConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
        } catch (error) {
            this.config = {
                maxBidAmount: 100,
                bidBuffer: 30, // seconds before auction ends
                autoBidEnabled: false,
                savedItems: []
            };
            await this.saveBiddingConfig();
        }
    }

    async saveBiddingConfig() {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving bidding config:', error);
        }
    }



    async getAuctionInfo(itemId) {
        try {
            console.log(`🔍 Fetching auction info via eBay API for item: ${itemId}`);
            
            // Use the eBay API service instead of web scraping
            const auctionInfo = await ebayApiService.getAuctionInfo(itemId);
            
            return auctionInfo;
        } catch (error) {
            console.error(`❌ Error getting auction info for item ${itemId}:`, error.message);
            throw error;
        }
    }

    async parseTimeRemaining(timeString) {
        // Use the eBay API service for time parsing
        return await ebayApiService.parseTimeRemaining(timeString);
    }

    async scheduleBid(itemId, maxBidAmount, bidBuffer = 30) {
        try {
            const auctionInfo = await this.getAuctionInfo(itemId);
            const timeRemaining = await this.parseTimeRemaining(auctionInfo.timeRemaining);
            
            if (!timeRemaining) {
                throw new Error('Could not parse time remaining');
            }

            const bidTime = timeRemaining - bidBuffer;
            
            if (bidTime <= 0) {
                throw new Error('Auction ending too soon or already ended');
            }

            const taskId = `bid_${itemId}_${Date.now()}`;
            const task = {
                itemId,
                maxBidAmount,
                bidTime,
                scheduledTime: Date.now() + (bidTime * 1000),
                auctionInfo,
                status: 'scheduled'
            };

            this.biddingTasks.set(taskId, task);
            
            // Schedule the bid
            setTimeout(async () => {
                await this.executeBid(taskId);
            }, bidTime * 1000);

            console.log(`Bid scheduled for item ${itemId} in ${bidTime} seconds`);
            return { taskId, scheduledTime: task.scheduledTime };
        } catch (error) {
            console.error('Error scheduling bid:', error);
            throw error;
        }
    }

    async executeBid(taskId) {
        const task = this.biddingTasks.get(taskId);
        if (!task) {
            console.error(`Task ${taskId} not found`);
            return;
        }

        try {
            task.status = 'executing';
            console.log(`Executing bid for item ${task.itemId}`);

            // Note: Actual bidding via API requires eBay's Trading API and user authentication
            // This is a placeholder for the bidding logic
            // In a real implementation, you would need to:
            // 1. Use eBay's Trading API for bidding
            // 2. Handle user authentication and session management
            // 3. Implement proper bid placement logic
            
            console.log(`⚠️  Bidding execution not yet implemented via API`);
            console.log(`📋 Would place bid of $${task.maxBidAmount} on item ${task.itemId}`);
            
            // For now, simulate a successful bid
            task.status = 'completed';
            task.result = 'simulated_success';
            console.log(`Bid simulation completed for item ${task.itemId}`);
            
        } catch (error) {
            task.status = 'failed';
            task.result = error.message;
            console.error(`Error executing bid for item ${task.itemId}:`, error);
        }
    }

    async getBiddingTasks() {
        return Array.from(this.biddingTasks.entries()).map(([taskId, task]) => ({
            taskId,
            ...task
        }));
    }

    async cancelBid(taskId) {
        const task = this.biddingTasks.get(taskId);
        if (task && task.status === 'scheduled') {
            this.biddingTasks.delete(taskId);
            return { success: true, message: 'Bid cancelled' };
        }
        return { success: false, message: 'Task not found or already executed' };
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await this.saveBiddingConfig();
        return this.config;
    }

    async addSavedItem(itemId, maxBidAmount) {
        const item = { itemId, maxBidAmount, addedAt: Date.now() };
        this.config.savedItems.push(item);
        await this.saveBiddingConfig();
        return item;
    }

    async removeSavedItem(itemId) {
        this.config.savedItems = this.config.savedItems.filter(item => item.itemId !== itemId);
        await this.saveBiddingConfig();
        return { success: true };
    }


}

module.exports = new EbayBiddingService(); 