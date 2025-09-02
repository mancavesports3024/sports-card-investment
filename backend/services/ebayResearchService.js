const axios = require('axios');

class EbayResearchService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.researchUrl = 'https://www.ebay.com/sh/research/api/search';
        this.cookies = '';
        this.lastCookieRefresh = 0;
        this.cookieRefreshInterval = 30 * 60 * 1000; // 30 minutes
    }

    async getValidCookies() {
        try {
            console.log('🔍 EbayResearchService: Getting valid eBay cookies...');
            
            // First, visit the main eBay page to get initial cookies
            const mainResponse = await axios.get(this.baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000
            });

            // Extract cookies from the response
            if (mainResponse.headers['set-cookie']) {
                this.cookies = mainResponse.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                console.log(`🔍 EbayResearchService: Got initial cookies: ${this.cookies.substring(0, 100)}...`);
            }

            // Now visit the research page to get research-specific cookies
            const researchPageResponse = await axios.get(`${this.baseUrl}/sh/research`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Cookie': this.cookies
                },
                timeout: 30000
            });

            // Update cookies with any new ones from research page
            if (researchPageResponse.headers['set-cookie']) {
                const newCookies = researchPageResponse.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0]);
                
                // Merge new cookies with existing ones
                const existingCookies = this.cookies ? this.cookies.split('; ') : [];
                const allCookies = [...existingCookies, ...newCookies];
                this.cookies = allCookies.join('; ');
                
                console.log(`🔍 EbayResearchService: Updated cookies: ${this.cookies.substring(0, 100)}...`);
            }

            this.lastCookieRefresh = Date.now();
            return this.cookies;

        } catch (error) {
            console.error('❌ EbayResearchService: Error getting cookies:', error.message);
            throw error;
        }
    }

    async searchSoldItems(keywords, options = {}) {
        try {
            // Check if we need to refresh cookies
            if (!this.cookies || (Date.now() - this.lastCookieRefresh) > this.cookieRefreshInterval) {
                await this.getValidCookies();
            }

            const {
                dayRange = 90,
                limit = 50,
                offset = 0
            } = options;

            const now = Date.now();
            const startDate = now - (dayRange * 24 * 60 * 60 * 1000);

            const params = new URLSearchParams({
                marketplace: 'EBAY-US',
                keywords: keywords,
                dayRange: dayRange.toString(),
                endDate: now.toString(),
                startDate: startDate.toString(),
                offset: offset.toString(),
                limit: limit.toString(),
                tabName: 'SOLD',
                tz: 'America/Chicago',
                modules: 'searchV2Filter'
            });

            const url = `${this.researchUrl}?${params.toString()}`;
            console.log(`🔍 EbayResearchService: Searching: ${keywords}`);
            console.log(`🔍 EbayResearchService: URL: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${this.baseUrl}/sh/research`,
                    'Cookie': this.cookies
                },
                timeout: 30000,
                decompress: false
            });

            if (response.data.error) {
                if (response.data.error === 'auth_required') {
                    console.log('🔍 EbayResearchService: Auth required, refreshing cookies...');
                    await this.getValidCookies();
                    // Retry once with new cookies
                    return this.searchSoldItems(keywords, options);
                }
                throw new Error(`eBay API error: ${response.data.error} - ${response.data.reason_code || ''}`);
            }

            console.log(`🔍 EbayResearchService: Success! Got response with ${JSON.stringify(response.data).length} characters`);
            return response.data;

        } catch (error) {
            console.error('❌ EbayResearchService: Search error:', error.message);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.getValidCookies();
            const testResult = await this.searchSoldItems('baseball card', { dayRange: 7, limit: 5 });
            return {
                success: true,
                message: 'eBay research API connection successful',
                data: testResult
            };
        } catch (error) {
            return {
                success: false,
                message: 'eBay research API connection failed',
                error: error.message
            };
        }
    }
}

module.exports = EbayResearchService;
