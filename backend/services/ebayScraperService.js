const axios = require('axios');
const cheerio = require('cheerio');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        this.currentUserAgent = 0;
        this.sessionCookies = '';
        this.requestDelay = 2000; // 2 seconds between requests
        this.lastRequestTime = 0;
    }

    /**
     * Get a random user agent to avoid detection
     */
    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }

    /**
     * Add delay between requests to appear more human-like
     */
    async addDelay() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            const delayNeeded = this.requestDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Initialize session by visiting eBay homepage
     */
    async initializeSession() {
        try {
            console.log('🔐 Initializing eBay session...');
            
            const response = await axios.get(this.baseUrl, {
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

            // Extract cookies from response
            if (response.headers['set-cookie']) {
                this.sessionCookies = response.headers['set-cookie']
                    .map(cookie => cookie.split(';')[0])
                    .join('; ');
                console.log('🔐 Session initialized with cookies');
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize eBay session:', error.message);
            return false;
        }
    }

    /**
     * Search for sold cards on eBay
     * @param {string} searchTerm - Card name to search for
     * @param {string} sport - Sport type (optional)
     * @param {number} maxResults - Maximum number of results to return
     * @returns {Object} Search results with pricing data
     */
    async searchSoldCards(searchTerm, sport = null, maxResults = 50) {
        try {
            await this.addDelay();
            
            if (!this.sessionCookies) {
                await this.initializeSession();
            }

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
                    'Cookie': this.sessionCookies,
                    'Referer': this.baseUrl,
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            });

            // Parse the HTML response
            const $ = cheerio.load(response.data);
            const results = this.parseSearchResults($, maxResults);

            console.log(`✅ Found ${results.length} sold listings for "${searchTerm}"`);
            
            return {
                success: true,
                searchTerm: searchTerm,
                sport: sport,
                totalResults: results.length,
                results: results
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
            '_ipg': '200',         // Items per page (max)
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
     * Parse eBay search results HTML
     */
    parseSearchResults($, maxResults) {
        const results = [];
        
        // Find all sold item listings
        $('.s-item').each((index, element) => {
            if (results.length >= maxResults) return false;
            
            try {
                const $item = $(element);
                
                // Extract basic item info
                const title = $item.find('.s-item__title').text().trim();
                const price = $item.find('.s-item__price').text().trim();
                const soldDate = $item.find('.s-item__title--tagblock .POSITIVE').text().trim();
                const condition = $item.find('.SECONDARY_INFO').text().trim();
                const imageUrl = $item.find('.s-item__image-img').attr('src');
                const itemUrl = $item.find('.s-item__link').attr('href');
                
                // Skip if no title or price
                if (!title || !price || title === 'Shop on eBay') return;
                
                // Parse price
                const priceMatch = price.match(/[\$£€]?([\d,]+\.?\d*)/);
                const numericPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
                
                // Extract card details from title
                const cardDetails = this.extractCardDetails(title);
                
                // Determine card type and grade
                const cardType = this.determineCardType(title, condition);
                const grade = this.extractGrade(title, condition);
                
                const result = {
                    title: title,
                    price: price,
                    numericPrice: numericPrice,
                    soldDate: soldDate,
                    condition: condition,
                    imageUrl: imageUrl,
                    itemUrl: itemUrl,
                    cardDetails: cardDetails,
                    cardType: cardType,
                    grade: grade,
                    sport: cardDetails.sport
                };
                
                results.push(result);
                
            } catch (error) {
                console.log(`⚠️ Error parsing item ${index}:`, error.message);
            }
        });
        
        return results;
    }

    /**
     * Extract card details from title
     */
    extractCardDetails(title) {
        const details = {
            sport: null,
            player: null,
            year: null,
            brand: null,
            set: null,
            cardNumber: null,
            parallel: null
        };
        
        // Extract sport
        const sports = ['baseball', 'basketball', 'football', 'hockey', 'soccer', 'pokemon', 'magic', 'yugioh'];
        for (const sport of sports) {
            if (title.toLowerCase().includes(sport)) {
                details.sport = sport;
                break;
            }
        }
        
        // Extract year (4-digit year)
        const yearMatch = title.match(/(\d{4})/);
        if (yearMatch) {
            details.year = yearMatch[1];
        }
        
        // Extract brand
        const brands = ['topps', 'panini', 'bowman', 'upper deck', 'fleer', 'donruss'];
        for (const brand of brands) {
            if (title.toLowerCase().includes(brand)) {
                details.brand = brand;
                break;
            }
        }
        
        // Extract set
        const sets = ['prizm', 'select', 'optic', 'contenders', 'chrome', 'update', 'heritage'];
        for (const set of sets) {
            if (title.toLowerCase().includes(set)) {
                details.set = set;
                break;
            }
        }
        
        // Extract card number
        const numberMatch = title.match(/#(\d+)/);
        if (numberMatch) {
            details.cardNumber = numberMatch[1];
        }
        
        // Extract parallel
        const parallels = ['gold', 'silver', 'black', 'rainbow', 'blue', 'red', 'green', 'purple', 'orange', 'pink'];
        for (const parallel of parallels) {
            if (title.toLowerCase().includes(parallel)) {
                details.parallel = parallel;
                break;
            }
        }
        
        return details;
    }

    /**
     * Determine card type (raw, PSA, BGS, etc.)
     */
    determineCardType(title, condition) {
        const titleLower = title.toLowerCase();
        const conditionLower = condition.toLowerCase();
        
        if (titleLower.includes('psa') || conditionLower.includes('psa')) {
            return 'PSA';
        } else if (titleLower.includes('bgs') || conditionLower.includes('bgs')) {
            return 'BGS';
        } else if (titleLower.includes('sgc') || conditionLower.includes('sgc')) {
            return 'SGC';
        } else if (titleLower.includes('raw') || conditionLower.includes('raw')) {
            return 'Raw';
        } else {
            return 'Unknown';
        }
    }

    /**
     * Extract grade from title or condition
     */
    extractGrade(title, condition) {
        const titleLower = title.toLowerCase();
        const conditionLower = condition.toLowerCase();
        
        // Look for grade patterns
        const gradePatterns = [
            /psa\s*(\d+)/i,
            /bgs\s*(\d+)/i,
            /sgc\s*(\d+)/i,
            /grade\s*(\d+)/i,
            /(\d+)\s*grade/i
        ];
        
        for (const pattern of gradePatterns) {
            const match = titleLower.match(pattern) || conditionLower.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }

    /**
     * Get pricing summary for a card search
     */
    async getCardPricingSummary(searchTerm, sport = null) {
        try {
            const searchResults = await this.searchSoldCards(searchTerm, sport, 100);
            
            if (!searchResults.success) {
                return searchResults;
            }
            
            // Group results by grade
            const groupedResults = this.groupResultsByGrade(searchResults.results);
            
            // Calculate averages for each grade
            const pricingSummary = this.calculatePricingSummary(groupedResults);
            
            return {
                success: true,
                searchTerm: searchTerm,
                sport: sport,
                totalResults: searchResults.totalResults,
                pricingSummary: pricingSummary,
                rawData: searchResults.results
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
     * Group search results by grade
     */
    groupResultsByGrade(results) {
        const grouped = {
            raw: [],
            psa9: [],
            psa10: [],
            other: []
        };
        
        results.forEach(result => {
            if (result.grade === '10' && result.cardType === 'PSA') {
                grouped.psa10.push(result);
            } else if (result.grade === '9' && result.cardType === 'PSA') {
                grouped.psa9.push(result);
            } else if (result.cardType === 'Raw') {
                grouped.raw.push(result);
            } else {
                grouped.other.push(result);
            }
        });
        
        return grouped;
    }

    /**
     * Calculate pricing summary for different grades
     */
    calculatePricingSummary(groupedResults) {
        const summary = {
            raw: { count: 0, average: 0, min: 0, max: 0 },
            psa9: { count: 0, average: 0, min: 0, max: 0 },
            psa10: { count: 0, average: 0, min: 0, max: 0 }
        };
        
        // Calculate for each grade type
        Object.keys(summary).forEach(gradeType => {
            const results = groupedResults[gradeType];
            if (results.length > 0) {
                const prices = results.map(r => r.numericPrice).filter(p => p !== null);
                if (prices.length > 0) {
                    summary[gradeType] = {
                        count: prices.length,
                        average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
                        min: Math.min(...prices),
                        max: Math.max(...prices)
                    };
                }
            }
        });
        
        // Calculate potential gains
        if (summary.raw.average > 0 && summary.psa9.average > 0) {
            summary.psa9Gain = summary.psa9.average - summary.raw.average;
            summary.psa9Multiplier = summary.psa9.average / summary.raw.average;
        }
        
        if (summary.raw.average > 0 && summary.psa10.average > 0) {
            summary.psa10Gain = summary.psa10.average - summary.raw.average;
            summary.psa10Multiplier = summary.psa10.average / summary.raw.average;
        }
        
        return summary;
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