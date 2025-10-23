const axios = require('axios');
const redis = require('redis');

class Point130Service {
    constructor() {
        this.baseUrl = 'https://back.130point.com';
        this.redisClient = null;
        this.initRedis();
    }

    async initRedis() {
        try {
            if (process.env.REDIS_URL) {
                this.redisClient = redis.createClient({ url: process.env.REDIS_URL });
                await this.redisClient.connect();
                console.log('📦 Redis cache connected for 130point');
            }
        } catch (error) {
            console.log('⚠️ Redis not available for 130point caching');
        }
    }

    /**
     * Search for sold cards on 130point.com
     * @param {string} searchTerm - Card search term
     * @param {Object} options - Search options
     * @returns {Array} Array of sold card data
     */
    async searchSoldCards(searchTerm, options = {}) {
        try {
            console.log(`🔍 130point search: "${searchTerm}"`);
            
            // Check cache first
            const cacheKey = `130point_${searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            if (this.redisClient) {
                const cached = await this.redisClient.get(cacheKey);
                if (cached) {
                    console.log('✅ Using cached 130point data');
                    return JSON.parse(cached);
                }
            }

            // Build search parameters
            const searchParams = this.buildSearchParams(searchTerm, options);
            
            // Make API request
            const response = await axios.post(`${this.baseUrl}/sales/`, searchParams, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Origin': 'https://130point.com',
                    'Referer': 'https://130point.com/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site'
                },
                timeout: 15000
            });

            // Parse the response
            const cardData = this.parseResponse(response.data, searchTerm);
            
            // Cache the results
            if (this.redisClient && cardData.length > 0) {
                await this.redisClient.setex(cacheKey, 3600, JSON.stringify(cardData)); // 1 hour cache
            }

            console.log(`✅ 130point found ${cardData.length} sold items`);
            return cardData;

        } catch (error) {
            console.error('❌ 130point search failed:', error.message);
            return [];
        }
    }

    /**
     * Build search parameters for 130point API
     */
    buildSearchParams(searchTerm, options) {
        // Process exclusions (convert -(word1, word2) to -(word1,word2))
        let processedTerm = searchTerm;
        const exclusionMatch = searchTerm.match(/-\s*\(([^)]+)\)/);
        if (exclusionMatch) {
            const exclusions = exclusionMatch[1].split(',').map(e => e.trim()).join(',');
            processedTerm = searchTerm.replace(/-\s*\(([^)]+)\)/, `-(${exclusions})`);
        }

        // URL encode the search term
        const encodedTerm = encodeURIComponent(processedTerm);

        return {
            query: encodedTerm,
            type: options.type || '2', // 2 = sold items
            subcat: options.subcat || '-1', // -1 = all categories
            tab_id: options.tab_id || '1',
            tz: options.timezone || 'America/Chicago',
            sort: options.sort || 'urlEndTimeSoonest' // Sort by end time
        };
    }

    /**
     * Parse 130point API response
     */
    parseResponse(html, searchTerm) {
        try {
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            
            const cards = [];
            
            // Look for card items in the response
            $('.sold-item, .card-item, .result-item').each((index, element) => {
                const $item = $(element);
                
                const card = this.extractCardData($item, $);
                if (card && card.title) {
                    cards.push(card);
                }
            });

            // If no specific selectors work, try to parse JSON if it's a JSON response
            if (cards.length === 0 && html.trim().startsWith('{')) {
                try {
                    const jsonData = JSON.parse(html);
                    return this.parseJsonResponse(jsonData, searchTerm);
                } catch (e) {
                    // Not JSON, continue with HTML parsing
                }
            }

            return cards;

        } catch (error) {
            console.error('❌ Error parsing 130point response:', error);
            return [];
        }
    }

    /**
     * Parse JSON response from 130point
     */
    parseJsonResponse(jsonData, searchTerm) {
        const cards = [];
        
        // Handle different possible JSON structures
        const items = jsonData.items || jsonData.data || jsonData.results || jsonData;
        
        if (Array.isArray(items)) {
            items.forEach(item => {
                const card = this.extractCardFromJson(item);
                if (card && card.title) {
                    cards.push(card);
                }
            });
        }

        return cards;
    }

    /**
     * Extract card data from HTML element
     */
    extractCardData($item, $) {
        try {
            const title = $item.find('.title, .card-title, .item-title').text().trim() ||
                         $item.find('h3, h4').text().trim() ||
                         $item.find('a').attr('title') || '';

            const price = $item.find('.price, .sold-price, .final-price').text().trim() ||
                         $item.find('.amount').text().trim() || '';

            const date = $item.find('.date, .sold-date, .end-date').text().trim() ||
                        $item.find('.time').text().trim() || '';

            const link = $item.find('a').attr('href') || '';

            const image = $item.find('img').attr('src') || '';

            return {
                title: this.cleanTitle(title),
                price: this.parsePrice(price),
                soldDate: this.parseDate(date),
                link: this.normalizeUrl(link),
                image: this.normalizeUrl(image),
                source: '130point'
            };

        } catch (error) {
            console.error('❌ Error extracting card data:', error);
            return null;
        }
    }

    /**
     * Extract card data from JSON object
     */
    extractCardFromJson(item) {
        try {
            return {
                title: this.cleanTitle(item.title || item.name || ''),
                price: this.parsePrice(item.price || item.final_price || item.sold_price || ''),
                soldDate: this.parseDate(item.sold_date || item.end_date || item.date || ''),
                link: this.normalizeUrl(item.url || item.link || ''),
                image: this.normalizeUrl(item.image || item.thumbnail || ''),
                source: '130point'
            };
        } catch (error) {
            console.error('❌ Error extracting card from JSON:', error);
            return null;
        }
    }

    /**
     * Clean and sanitize card title
     */
    cleanTitle(title) {
        if (!title) return '';
        
        return title
            .replace(/\s*#unknown\b.*$/i, '')
            .replace(/\s*#Unknown\b.*$/i, '')
            .replace(/\s*#UNKNOWN\b.*$/i, '')
            .replace(/\s+unknown\s*$/i, '')
            .replace(/\s+Unknown\s*$/i, '')
            .replace(/\s+UNKNOWN\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse price from string
     */
    parsePrice(priceStr) {
        if (!priceStr) return { value: 0, currency: 'USD' };
        
        const match = priceStr.match(/\$?([\d,]+\.?\d*)/);
        if (match) {
            return {
                value: parseFloat(match[1].replace(/,/g, '')),
                currency: 'USD'
            };
        }
        
        return { value: 0, currency: 'USD' };
    }

    /**
     * Parse date from string
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date.toISOString();
        } catch (error) {
            return null;
        }
    }

    /**
     * Normalize URL
     */
    normalizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return `https://130point.com${url}`;
        return `https://130point.com/${url}`;
    }
}

module.exports = Point130Service;
