const axios = require('axios');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        this.currentUserAgent = 0;
    }

    /**
     * Get a random user agent to avoid detection
     */
    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }

    /**
     * Search for sold cards on eBay using HTTP requests
     */
    async searchSoldCards(searchTerm, sport = null, maxResults = 50) {
        try {
            console.log(`🔍 Searching eBay for sold cards: ${searchTerm}`);
            
            // Build search URL for sold listings
            const searchUrl = this.buildSearchUrl(searchTerm, sport);
            console.log(`🔍 Search URL: ${searchUrl}`);

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            });

            console.log(`✅ Got response from eBay (${response.data.length} characters)`);
            
            // For now, return a simple response to test the service
            return {
                success: true,
                searchTerm: searchTerm,
                sport: sport,
                totalResults: 0,
                message: 'Service is working - eBay response received',
                responseLength: response.data.length,
                sampleData: response.data.substring(0, 500) // First 500 chars for debugging
            };

        } catch (error) {
            console.error('❌ eBay search failed:', error.message);
            return {
                success: false,
                error: error.message,
                searchTerm: searchTerm
            };
        }
    }

    /**
     * Build eBay search URL for sold listings
     */
    buildSearchUrl(searchTerm, sport) {
        const params = new URLSearchParams({
            '_nkw': searchTerm,
            '_sacat': '0',
            'LH_Sold': '1',        // Show sold items only
            '_dmd': '2',           // Show completed items
            '_ipg': '50',          // Items per page
            '_pgn': '1'            // Page number
        });

        // Add sport-specific category if provided
        if (sport) {
            const sportCategories = {
                'baseball': '162',
                'basketball': '162',
                'football': '162',
                'hockey': '162',
                'soccer': '162',
                'pokemon': '253',
                'magic': '191',
                'yugioh': '31388'
            };
            
            if (sportCategories[sport.toLowerCase()]) {
                params.set('_sacat', sportCategories[sport.toLowerCase()]);
            }
        }

        return `${this.baseUrl}/sch/i.html?${params.toString()}`;
    }

    /**
     * Get pricing summary for a card search
     */
    async getCardPricingSummary(searchTerm, sport = null) {
        try {
            const searchResults = await this.searchSoldCards(searchTerm, sport, 50);
            
            if (!searchResults.success) {
                return searchResults;
            }
            
            return {
                success: true,
                searchTerm: searchTerm,
                sport: sport,
                totalResults: searchResults.totalResults || 0,
                message: searchResults.message,
                responseLength: searchResults.responseLength,
                sampleData: searchResults.sampleData
            };
            
        } catch (error) {
            console.error('❌ Failed to get pricing summary:', error.message);
            return {
                success: false,
                error: error.message,
                searchTerm: searchTerm
            };
        }
    }

    /**
     * Test the service with a sample search
     */
    async testService() {
        try {
            console.log('🧪 Testing eBay scraper service...');
            
            // Test with a popular card
            const testSearch = '2023 Bowman Chrome Draft Jackson Holliday';
            const result = await this.getCardPricingSummary(testSearch, 'baseball');
            
            return {
                success: true,
                testSearch: testSearch,
                result: result
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = EbayScraperService; 