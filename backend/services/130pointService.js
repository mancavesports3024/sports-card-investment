const axios = require('axios');
const redis = require('redis');
const cheerio = require('cheerio');

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
            // Check cache first
            const cacheKey = `130point_${searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            if (this.redisClient) {
                const cached = await this.redisClient.get(cacheKey);
                if (cached) {
                    const cachedData = JSON.parse(cached);
                    return cachedData;
                }
            }

            // Build search parameters
            const searchParams = this.buildSearchParams(searchTerm, options);
            
            // Make API request
            const response = await axios.post(`${this.baseUrl}/sales/`, searchParams.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Origin': 'https://130point.com',
                    'Referer': 'https://130point.com/',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 20000,
                responseType: 'text',
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400
            });

            // Parse the response
            const cardData = this.parseResponse(response.data, searchTerm);
            
            // Cache the results (even if 0 results to avoid repeated API calls)
            if (this.redisClient) {
                try {
                    await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(cardData)); // 1 hour cache
                } catch (cacheError) {
                    console.log('⚠️ Cache error (non-critical):', cacheError.message);
                }
            }

            // If no results, try a simpler search term
            if (cardData.length === 0 && searchTerm.includes(' -(')) {
                const simpleTerm = searchTerm.split(' -(')[0].trim();
                
                const simpleParams = this.buildSearchParams(simpleTerm, options);
                const simpleResponse = await axios.post(`${this.baseUrl}/sales/`, simpleParams.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Origin': 'https://130point.com',
                        'Referer': 'https://130point.com/',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    timeout: 20000,
                    responseType: 'text',
                    maxRedirects: 0,
                    validateStatus: status => status >= 200 && status < 400
                });
                
                const simpleCardData = this.parseResponse(simpleResponse.data, simpleTerm);
                
                if (simpleCardData.length > 0) {
                    return simpleCardData;
                }
            }

            return cardData;

        } catch (error) {
            console.error('❌ 130point search failed:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
                console.error('Body preview:', String(error.response.data || '').slice(0, 200));
            }
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
        const params = new URLSearchParams();
        params.append('query', processedTerm);
        params.append('type', options.type || '2');
        params.append('subcat', options.subcat || '-1');
        params.append('tab_id', options.tab_id || '1');
        params.append('tz', options.timezone || 'America/Chicago');
        params.append('sort', options.sort || 'urlEndTimeSoonest');

        return params;
    }

    /**
     * Parse 130point API response
     */
    parseResponse(html, searchTerm) {
        try {
            const $ = cheerio.load(html);
            
            const cards = [];
            
            // Look for card items in table rows (130point uses table structure)
            $('tbody tr').each((index, element) => {
                const $row = $(element);
                const cells = $row.find('td');
                
                if (cells.length >= 2) {
                    const cell1 = $(cells[0]).text().trim();
                    const cell2 = $(cells[1]).text().trim();
                    
                    // Skip empty rows
                    if (cell1 || cell2) {
                        const card = this.extractCardFromRow(cell1, cell2);
                        if (card && card.title) {
                            cards.push(card);
                        }
                    }
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
     * Extract card data from table row cells
     */
    extractCardFromRow(cell1, cell2) {
        try {
            // Look for price in both cells - 130point embeds prices in the text
            const fullText = (cell1 + ' ' + cell2);
            const priceMatch = fullText.match(/Sale Price:\s*\$?([\d,]+\.?\d*)/i) || 
                             fullText.match(/\$([\d,]+\.?\d*)/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
            
            // Look for title and other info in cell2
            let title = cell2 || cell1;
            
            // Extract date from fullText - look for date patterns like "Wed 05 Nov 2025" or "Mon 06 Oct 2025"
            let soldDate = null;
            // Try multiple date formats
            const datePatterns = [
                /Date:\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/i,
                /(\d{1,2}\/\d{1,2}\/\d{4})/,
                /(\d{4}-\d{2}-\d{2})/
            ];
            
            for (const pattern of datePatterns) {
                const dateMatch = fullText.match(pattern);
                if (dateMatch) {
                    try {
                        let date;
                        if (dateMatch[0].includes('Date:')) {
                            // Format: "Date: Wed 05 Nov 2025 11:31:14"
                            const [, dayName, day, monthName, year, hour, minute, second] = dateMatch;
                            const monthMap = {
                                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                            };
                            const month = monthMap[monthName.toLowerCase()];
                            if (month !== undefined) {
                                date = new Date(Date.UTC(parseInt(year), month, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)));
                            }
                        } else if (dateMatch[1].includes('/')) {
                            // Format: MM/DD/YYYY
                            const [month, day, year] = dateMatch[1].split('/');
                            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        } else {
                            // Format: YYYY-MM-DD
                            date = new Date(dateMatch[1]);
                        }
                        
                        if (date && !isNaN(date.getTime())) {
                            // Set to noon UTC if no time component
                            if (!dateMatch[0].includes('Date:')) {
                                date.setUTCHours(12, 0, 0, 0);
                            }
                            soldDate = date.toISOString();
                            break;
                        }
                    } catch (error) {
                        console.error(`Error parsing 130point date: "${dateMatch[0]}"`, error);
                    }
                }
            }
            
            // Look for links
            const linkMatch = fullText.match(/https?:\/\/[^\s]+/);
            const link = linkMatch ? linkMatch[0] : null;
            
            if (title && title.length > 5) {
                return {
                    title: this.cleanTitle(title),
                    price: price ? { value: price, currency: 'USD' } : null,
                    soldDate: soldDate,
                    link: link,
                    source: '130point'
                };
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error extracting card from row:', error);
            return null;
        }
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
     * Removes 130point metadata like "Sold Via: eBay", "Fixed Price", "Sale Price: X USD", etc.
     */
    cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title
            // Remove "Sold Via: eBay" prefix
            .replace(/^Sold\s+Via:\s*eBay\s*/i, '')
            // Remove sale type prefixes (Fixed Price, Best Offer Accepted, Auction)
            .replace(/^(Fixed\s+Price|Best\s+Offer\s+Accepted|Auction)\s*/i, '')
            // Remove "List Price: X USD" patterns
            .replace(/List\s+Price:\s*[\d,]+\.?\d*\s*USD\s*/gi, '')
            // Remove "Sale Price: X USD" patterns
            .replace(/Sale\s+Price:\s*[\d,]+\.?\d*\s*USD\s*/gi, '')
            // Remove date patterns like "Date: Wed 05 Nov 2025 11:31:14 CDT"
            .replace(/Date:\s*[A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+[A-Z]{3,4}\s*/gi, '')
            // Remove "Shipping Price: N/A" or "Shipping Price: X USD"
            .replace(/Shipping\s+Price:\s*(N\/A|[\d,]+\.?\d*\s*USD)\s*/gi, '')
            // Remove price patterns like "79.99 USD Sale Price: 79.99"
            .replace(/[\d,]+\.?\d*\s*USD\s*Sale\s+Price:\s*[\d,]+\.?\d*\s*/gi, '')
            // Remove "Best Offer Price: X" patterns
            .replace(/Best\s+Offer\s+Price:\s*[\d,]+\.?\d*\s*/gi, '')
            // Remove "Current Price: X" patterns
            .replace(/Current\s+Price:\s*[\d,]+\.?\d*\s*/gi, '')
            // Remove "Bids: X (Click to View)" patterns
            .replace(/Bids:\s*\d+\s*\(Click\s+to\s+View\)\s*/gi, '')
            // Remove "Sale Type: X" patterns
            .replace(/Sale\s+Type:\s*\w+\s*/gi, '')
            // Remove "CurrentPriceFull: X USD" patterns
            .replace(/CurrentPriceFull:\s*[\d,]+\.?\d*\s*USD\s*/gi, '')
            // Remove "SalePriceFull: X USD" patterns
            .replace(/SalePriceFull:\s*[\d,]+\.?\d*\s*USD\s*/gi, '')
            // Remove remaining standalone price patterns at the end
            .replace(/\s+[\d,]+\.?\d*\s*USD\s*$/gi, '')
            // Remove " - " patterns that might be left
            .replace(/\s*-\s*$/g, '')
            // Clean up multiple spaces
            .replace(/\s+/g, ' ')
            // Remove common suffixes
            .replace(/\s*#unknown\b.*$/i, '')
            .replace(/\s+unknown\s*$/i, '')
            .trim();
        
        return cleaned;
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
