const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class EbayApiService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.configPath = path.join(__dirname, '../data/ebay-api-config.json');
        this.loadApiConfig();
    }

    async loadApiConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
        } catch (error) {
            this.config = {
                clientId: process.env.EBAY_CLIENT_ID,
                clientSecret: process.env.EBAY_CLIENT_SECRET,
                refreshToken: process.env.EBAY_REFRESH_TOKEN,
                appId: process.env.EBAY_APP_ID,
                authToken: process.env.EBAY_AUTH_TOKEN
            };
            await this.saveApiConfig();
        }
    }

    async saveApiConfig() {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving eBay API config:', error);
        }
    }

    async getAccessToken() {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            console.log('🔄 Refreshing eBay access token...');
            
            const response = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', 
                `grant_type=refresh_token&refresh_token=${this.config.refreshToken}&scope=https://api.ebay.com/oauth/api_scope`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            console.log('✅ eBay access token refreshed successfully');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Error refreshing eBay access token:', error.response?.data || error.message);
            throw new Error('Failed to get eBay access token');
        }
    }

    async getAuctionInfo(itemId) {
        try {
            console.log(`🔍 Fetching auction info via eBay API for item: ${itemId}`);
            
            const accessToken = await this.getAccessToken();
            
            // Use eBay Browse API to get item details
            // Try different marketplaces if US fails
            let response;
            let lastError;
            
            const marketplaces = ['EBAY-US', 'EBAY-GB', 'EBAY-CA', 'EBAY-AU'];
            
            for (const marketplace of marketplaces) {
                try {
                    console.log(`🔍 Trying marketplace: ${marketplace}`);
                    response = await axios.get(`https://api.ebay.com/buy/browse/v1/item/${itemId}`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'X-EBAY-C-MARKETPLACE-ID': marketplace,
                            'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=10001'
                        }
                    });
                    console.log(`✅ Found item in ${marketplace} marketplace`);
                    break;
                } catch (error) {
                    lastError = error;
                    console.log(`❌ Not found in ${marketplace}: ${error.response?.status}`);
                    continue;
                }
            }
            
            if (!response) {
                throw lastError;
            }

            const item = response.data;
            
            // Extract auction information
            const auctionInfo = {
                title: item.title,
                currentPrice: this.formatPrice(item.price),
                timeRemaining: this.getTimeRemaining(item),
                bidCount: this.getBidCount(item),
                url: item.itemWebUrl,
                itemType: item.itemType,
                listingType: item.listingType,
                condition: item.condition,
                seller: item.seller?.username,
                location: item.itemLocation?.city + ', ' + item.itemLocation?.stateOrProvince,
                shippingCost: this.formatPrice(item.shippingOptions?.[0]?.shippingCost),
                returnPolicy: item.returnTerms?.returnMethod,
                itemId: item.itemId
            };

            console.log(`📊 eBay API auction info extracted for ${itemId}:`, {
                title: auctionInfo.title ? auctionInfo.title.substring(0, 50) + '...' : 'Not found',
                currentPrice: auctionInfo.currentPrice || 'Not found',
                timeRemaining: auctionInfo.timeRemaining || 'Not found',
                bidCount: auctionInfo.bidCount || 'Not found',
                itemType: auctionInfo.itemType || 'Not found'
            });

            return auctionInfo;
        } catch (error) {
            console.error(`❌ Error getting auction info via eBay API for item ${itemId}:`, error.response?.data || error.message);
            
            if (error.response?.status === 404) {
                throw new Error('Item not found or no longer available');
            } else if (error.response?.status === 403) {
                throw new Error('Access denied - check eBay API credentials');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded - please try again later');
            }
            
            throw new Error(`Failed to fetch auction info: ${error.message}`);
        }
    }

    formatPrice(price) {
        if (!price) return null;
        
        if (typeof price === 'object' && price.value) {
            return `$${parseFloat(price.value).toFixed(2)}`;
        } else if (typeof price === 'string') {
            return price;
        } else if (typeof price === 'number') {
            return `$${price.toFixed(2)}`;
        }
        
        return null;
    }

    getTimeRemaining(item) {
        // Check if it's an auction
        if (item.listingType === 'AUCTION') {
            if (item.timeLeft) {
                return this.formatTimeLeft(item.timeLeft);
            } else if (item.estimatedEndTime) {
                const endTime = new Date(item.estimatedEndTime);
                const now = new Date();
                const timeLeft = endTime - now;
                
                if (timeLeft <= 0) {
                    return 'Auction ended';
                }
                
                return this.formatTimeLeft(timeLeft);
            }
        } else if (item.listingType === 'FIXED_PRICE') {
            return 'Buy It Now';
        }
        
        return 'Unknown';
    }

    formatTimeLeft(timeLeft) {
        if (typeof timeLeft === 'string') {
            // Parse ISO duration format (P1DT2H3M4S)
            const match = timeLeft.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
                const days = parseInt(match[1]) || 0;
                const hours = parseInt(match[2]) || 0;
                const minutes = parseInt(match[3]) || 0;
                const seconds = parseInt(match[4]) || 0;
                
                if (days > 0) return `${days}d ${hours}h ${minutes}m`;
                if (hours > 0) return `${hours}h ${minutes}m`;
                if (minutes > 0) return `${minutes}m ${seconds}s`;
                return `${seconds}s`;
            }
        } else if (typeof timeLeft === 'number') {
            // Convert milliseconds to readable format
            const seconds = Math.floor(timeLeft / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        }
        
        return 'Unknown';
    }

    getBidCount(item) {
        if (item.listingType === 'AUCTION' && item.bidCount !== undefined) {
            return item.bidCount.toString();
        }
        return 'N/A';
    }

    async parseTimeRemaining(timeString) {
        if (!timeString || timeString.toLowerCase().includes('buy it now')) {
            return null;
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

    async searchItems(query, filters = {}) {
        try {
            const accessToken = await this.getAccessToken();
            
            const params = {
                q: query,
                limit: filters.limit || 50,
                filter: filters.filter || '',
                sort: filters.sort || 'newlyListed'
            };

            const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US'
                },
                params
            });

            return response.data.itemSummaries || [];
        } catch (error) {
            console.error('Error searching eBay items:', error.response?.data || error.message);
            throw new Error('Failed to search eBay items');
        }
    }

    async getItemHistory(itemId) {
        try {
            const accessToken = await this.getAccessToken();
            
            const response = await axios.get(`https://api.ebay.com/buy/browse/v1/item/${itemId}/get_item_by_item_id`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error getting item history:', error.response?.data || error.message);
            throw new Error('Failed to get item history');
        }
    }
}

module.exports = new EbayApiService(); 