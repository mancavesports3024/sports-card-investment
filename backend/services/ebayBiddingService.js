const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

puppeteer.use(StealthPlugin());

class EbayBiddingService {
    constructor() {
        this.browser = null;
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

    async initializeBrowser() {
        if (!this.browser) {
            // Use environment variable to determine headless mode
            const isProduction = process.env.NODE_ENV === 'production';
            const headlessMode = isProduction ? 'new' : false;
            
            this.browser = await puppeteer.launch({
                headless: headlessMode,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                // Use system Chrome in production if available
                executablePath: isProduction ? process.env.CHROME_BIN || undefined : undefined
            });
        }
        return this.browser;
    }

    async getAuctionInfo(itemId) {
        try {
            const browser = await this.initializeBrowser();
            const page = await browser.newPage();
            
            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Set viewport for consistent rendering
            await page.setViewport({ width: 1920, height: 1080 });
            
            const url = `https://www.ebay.com/itm/${itemId}`;
            console.log(`🔍 Fetching auction info for item: ${itemId}`);
            
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 // 30 second timeout
            });

            // Extract auction information
            const auctionInfo = await page.evaluate(() => {
                const getTextContent = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : null;
                };

                const getAttribute = (selector, attribute) => {
                    const element = document.querySelector(selector);
                    return element ? element.getAttribute(attribute) : null;
                };

                // Get current price - try multiple selectors
                const priceSelectors = [
                    '[data-testid="x-price-primary"] span',
                    '.x-price-primary span',
                    '[data-testid="price"]',
                    '.x-price-primary',
                    '[data-testid="x-price"]',
                    '.x-price',
                    '.vi-price',
                    '.vi-bin-price',
                    '.vi-price-current'
                ];
                
                let currentPrice = null;
                for (const selector of priceSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        currentPrice = element.textContent.trim();
                        break;
                    }
                }

                // Get time remaining - try multiple selectors and patterns
                const timeSelectors = [
                    '[data-testid="x-time-left"]',
                    '.x-time-left',
                    '[data-testid="time-left"]',
                    '.x-time-left span',
                    '.vi-time-left',
                    '.vi-time-left span',
                    '[data-testid="time-remaining"]',
                    '.time-remaining',
                    '.vi-countdown',
                    '.vi-countdown span',
                    '.vi-time-left-primary',
                    '.vi-time-left-primary span'
                ];
                
                let timeRemaining = null;
                for (const selector of timeSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        timeRemaining = element.textContent.trim();
                        break;
                    }
                }

                // If still no time found, try looking for any element containing time patterns
                if (!timeRemaining) {
                    const timePatterns = ['d ', 'h ', 'm ', 's ', 'day', 'hour', 'minute', 'second'];
                    const allElements = document.querySelectorAll('*');
                    
                    for (const element of allElements) {
                        const text = element.textContent.trim();
                        if (text && timePatterns.some(pattern => text.toLowerCase().includes(pattern))) {
                            // Check if it looks like a time remaining string
                            if (text.match(/\d+/) && (text.includes('left') || text.includes('remaining') || text.includes('ending'))) {
                                timeRemaining = text;
                                break;
                            }
                        }
                    }
                }

                // Check if this is a Buy It Now item (no auction time)
                if (!timeRemaining) {
                    const buyItNowSelectors = [
                        '[data-testid="buy-it-now"]',
                        '.vi-bin-price',
                        '.vi-bin-price span',
                        '.buy-it-now',
                        '.vi-bin-price-primary'
                    ];
                    
                    for (const selector of buyItNowSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            timeRemaining = 'Buy It Now';
                            break;
                        }
                    }
                }

                // Additional fallback: look for any text containing time-related words
                if (!timeRemaining) {
                    const timeKeywords = ['ending', 'left', 'remaining', 'auction', 'bid'];
                    const allTextElements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
                    
                    for (const element of allTextElements) {
                        const text = element.textContent.trim();
                        if (text && timeKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                            // Check if it contains numbers (likely a time)
                            if (text.match(/\d+/)) {
                                timeRemaining = text;
                                break;
                            }
                        }
                    }
                }

                // Get item title - try multiple selectors
                const titleSelectors = [
                    'h1.x-item-title__mainTitle span',
                    '[data-testid="item-title"]',
                    'h1.x-item-title__mainTitle',
                    '.x-item-title__mainTitle',
                    '.vi-title',
                    '.vi-title h1',
                    'h1.vi-title',
                    '.item-title',
                    'h1'
                ];
                
                let title = null;
                for (const selector of titleSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        title = element.textContent.trim();
                        break;
                    }
                }

                // Get current bid count - try multiple selectors
                const bidSelectors = [
                    '[data-testid="bid-count"]',
                    '.bid-count',
                    '.vi-bid-count',
                    '.vi-bid-count span',
                    '[data-testid="bid-count"] span',
                    '.vi-bid-count-primary',
                    '.vi-bid-count-primary span'
                ];
                
                let bidCount = null;
                for (const selector of bidSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        bidCount = element.textContent.trim();
                        break;
                    }
                }

                return {
                    title,
                    currentPrice,
                    timeRemaining,
                    bidCount,
                    url: window.location.href
                };
            });

            await page.close();
            
            // Log the extracted information for debugging
            console.log(`📊 Auction info extracted for ${itemId}:`, {
                title: auctionInfo.title ? auctionInfo.title.substring(0, 50) + '...' : 'Not found',
                currentPrice: auctionInfo.currentPrice || 'Not found',
                timeRemaining: auctionInfo.timeRemaining || 'Not found',
                bidCount: auctionInfo.bidCount || 'Not found'
            });

            // If time remaining is still not found, let's get some debug info
            if (!auctionInfo.timeRemaining) {
                console.log(`🔍 Debug: Time remaining not found for item ${itemId}. This might be a Buy It Now item or the selectors need updating.`);
            }
            
            return auctionInfo;
        } catch (error) {
            console.error(`❌ Error getting auction info for item ${itemId}:`, error.message);
            
            // Try to close the page if it exists
            try {
                if (page && !page.isClosed()) {
                    await page.close();
                }
            } catch (closeError) {
                console.error('Error closing page:', closeError.message);
            }
            
            throw new Error(`Failed to fetch auction info: ${error.message}`);
        }
    }

    async parseTimeRemaining(timeString) {
        if (!timeString) return null;
        
        // Handle Buy It Now items
        if (timeString.toLowerCase().includes('buy it now')) {
            return null; // No time remaining for Buy It Now items
        }
        
        const timeStringLower = timeString.toLowerCase();
        let totalSeconds = 0;
        
        // Parse different time formats
        const patterns = [
            { regex: /(\d+)\s*d/, multiplier: 24 * 60 * 60 },
            { regex: /(\d+)\s*h/, multiplier: 60 * 60 },
            { regex: /(\d+)\s*m/, multiplier: 60 },
            { regex: /(\d+)\s*s/, multiplier: 1 }
        ];
        
        for (const pattern of patterns) {
            const match = timeStringLower.match(pattern.regex);
            if (match) {
                totalSeconds += parseInt(match[1]) * pattern.multiplier;
            }
        }
        
        return totalSeconds;
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

            const browser = await this.initializeBrowser();
            const page = await browser.newPage();
            
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            const url = `https://www.ebay.com/itm/${task.itemId}`;
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Check if user is logged in
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('[data-testid="user-account"]') !== null ||
                       document.querySelector('.gh-eb-li-a') !== null;
            });

            if (!isLoggedIn) {
                throw new Error('User not logged in to eBay');
            }

            // Find and click bid button
            const bidButton = await page.$('[data-testid="bid-button"]') ||
                             await page.$('.bid-button') ||
                             await page.$('button[data-testid="place-bid"]');

            if (!bidButton) {
                throw new Error('Bid button not found');
            }

            await bidButton.click();
            await page.waitForTimeout(2000);

            // Enter bid amount
            const bidInput = await page.$('input[data-testid="bid-input"]') ||
                            await page.$('input[name="bidAmount"]') ||
                            await page.$('input[type="number"]');

            if (!bidInput) {
                throw new Error('Bid input field not found');
            }

            await bidInput.clear();
            await bidInput.type(task.maxBidAmount.toString());
            await page.waitForTimeout(1000);

            // Submit bid
            const submitButton = await page.$('button[data-testid="submit-bid"]') ||
                                await page.$('button[type="submit"]') ||
                                await page.$('input[type="submit"]');

            if (!submitButton) {
                throw new Error('Submit bid button not found');
            }

            await submitButton.click();
            await page.waitForTimeout(3000);

            // Check if bid was successful
            const successMessage = await page.evaluate(() => {
                const successElement = document.querySelector('[data-testid="bid-success"]') ||
                                     document.querySelector('.bid-success') ||
                                     document.querySelector('.success-message');
                return successElement ? successElement.textContent.trim() : null;
            });

            if (successMessage) {
                task.status = 'completed';
                task.result = 'success';
                console.log(`Bid successfully placed for item ${task.itemId}`);
            } else {
                task.status = 'failed';
                task.result = 'failed';
                console.log(`Bid failed for item ${task.itemId}`);
            }

            await page.close();
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

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = new EbayBiddingService(); 