const axios = require('axios');
const cheerio = require('cheerio');

class TCDBService {
    constructor() {
        this.baseUrl = 'https://www.tcdb.com';
        this.cache = new Map(); // Simple in-memory cache
        this.cookieJar = null; // For maintaining session cookies
    }

    /**
     * Get default headers that mimic a real browser
     */
    getDefaultHeaders(referer = null) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };
        
        if (referer) {
            headers['Referer'] = referer;
        } else {
            headers['Referer'] = this.baseUrl + '/';
        }
        
        return headers;
    }

    /**
     * Get list of sports from TCDB
     * @returns {Array} Array of sport objects {name, url}
     */
    async getSports() {
        try {
            // TCDB sports are typically: Baseball, Football, Basketball, Hockey, etc.
            // We can hardcode common sports or scrape from a page
            const commonSports = [
                { name: 'Baseball', value: 'Baseball' },
                { name: 'Football', value: 'Football' },
                { name: 'Basketball', value: 'Basketball' },
                { name: 'Hockey', value: 'Hockey' },
                { name: 'Soccer', value: 'Soccer' },
                { name: 'Racing', value: 'Racing' },
                { name: 'Golf', value: 'Golf' },
                { name: 'Wrestling', value: 'Wrestling' },
                { name: 'Non-Sport', value: 'Non-Sport' }
            ];
            
            return commonSports;
        } catch (error) {
            console.error('❌ Error getting sports:', error);
            throw error;
        }
    }

    /**
     * Get years for a specific sport
     * @param {string} sport - Sport name (e.g., 'Baseball', 'Football')
     * @returns {Array} Array of year objects
     */
    async getYears(sport) {
        try {
            const cacheKey = `years_${sport}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // First, try to visit the homepage to establish a session
            try {
                await axios.get(this.baseUrl + '/', {
                    headers: this.getDefaultHeaders(),
                    timeout: 10000,
                    maxRedirects: 5
                });
            } catch (err) {
                console.log('⚠️ Could not visit homepage first, continuing anyway...');
            }

            const url = `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}?MODE=Years`;
            console.log(`🔍 Fetching years for ${sport}: ${url}`);
            
            const response = await axios.get(url, {
                headers: this.getDefaultHeaders(this.baseUrl + '/'),
                timeout: 20000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });

            const $ = cheerio.load(response.data);
            const years = [];

            // Look for year links - TCDB typically has links like "ViewAll.cfm/sp/Baseball/year/2025"
            $('a[href*="/year/"]').each((index, element) => {
                const $link = $(element);
                const href = $link.attr('href');
                const yearText = $link.text().trim();
                
                // Extract year from href or text
                const yearMatch = href.match(/\/year\/(\d{4})/) || yearText.match(/(\d{4})/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1]);
                    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
                        years.push({
                            year: year,
                            display: year.toString(),
                            url: href.startsWith('http') ? href : `${this.baseUrl}${href}`
                        });
                    }
                }
            });

            // Remove duplicates and sort
            const uniqueYears = Array.from(new Map(years.map(y => [y.year, y])).values())
                .sort((a, b) => b.year - a.year);

            // Cache for 1 hour
            this.cache.set(cacheKey, uniqueYears);
            
            console.log(`✅ Found ${uniqueYears.length} years for ${sport}`);
            return uniqueYears;

        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                console.error(`❌ Error getting years for ${sport}: HTTP ${status} ${statusText}`);
                
                if (status === 403) {
                    console.error('⚠️ TCDB is blocking the request (403 Forbidden). This may be due to:');
                    console.error('   - Rate limiting');
                    console.error('   - Bot detection');
                    console.error('   - IP blocking');
                    console.error('   - Missing required headers/cookies');
                    throw new Error(`TCDB blocked request (403): ${error.response.statusText || 'Forbidden'}`);
                } else if (status === 404) {
                    throw new Error(`TCDB page not found (404): Sport "${sport}" may not exist or URL structure changed`);
                } else {
                    throw new Error(`TCDB server error (${status}): ${statusText}`);
                }
            } else if (error.request) {
                console.error(`❌ Error getting years for ${sport}: No response received`);
                throw new Error(`Network error: No response from TCDB server`);
            } else {
                console.error(`❌ Error getting years for ${sport}:`, error.message);
                throw error;
            }
        }
    }

    /**
     * Get sets for a specific sport and year
     * @param {string} sport - Sport name
     * @param {number} year - Year
     * @returns {Array} Array of set objects {id, name, url}
     */
    async getSets(sport, year) {
        try {
            const cacheKey = `sets_${sport}_${year}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const url = `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}`;
            console.log(`🔍 Fetching sets for ${sport} ${year}: ${url}`);
            
            const response = await axios.get(url, {
                headers: this.getDefaultHeaders(`${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}?MODE=Years`),
                timeout: 20000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });

            const $ = cheerio.load(response.data);
            const sets = [];

            // Look for set links - TCDB typically has links to sets
            // Pattern might be: ViewAll.cfm/sp/Baseball/year/2025/set/12345
            $('a[href*="/set/"]').each((index, element) => {
                const $link = $(element);
                const href = $link.attr('href');
                const setName = $link.text().trim();
                
                // Extract set ID from href
                const setIdMatch = href.match(/\/set\/(\d+)/);
                if (setIdMatch && setName) {
                    const setId = setIdMatch[1];
                    sets.push({
                        id: setId,
                        name: setName,
                        url: href.startsWith('http') ? href : `${this.baseUrl}${href}`
                    });
                }
            });

            // Also try looking in tables or lists
            if (sets.length === 0) {
                // Try alternative selectors
                $('table a, .set-list a, .checklist a').each((index, element) => {
                    const $link = $(element);
                    const href = $link.attr('href');
                    const text = $link.text().trim();
                    
                    if (href && text && (href.includes('/set/') || href.includes('ViewSet'))) {
                        const setIdMatch = href.match(/\/set\/(\d+)|setId=(\d+)/);
                        if (setIdMatch) {
                            const setId = setIdMatch[1] || setIdMatch[2];
                            sets.push({
                                id: setId,
                                name: text,
                                url: href.startsWith('http') ? href : `${this.baseUrl}${href}`
                            });
                        }
                    }
                });
            }

            // Remove duplicates
            const uniqueSets = Array.from(new Map(sets.map(s => [s.id, s])).values());

            // Cache for 1 hour
            this.cache.set(cacheKey, uniqueSets);
            
            console.log(`✅ Found ${uniqueSets.length} sets for ${sport} ${year}`);
            return uniqueSets;

        } catch (error) {
            console.error(`❌ Error getting sets for ${sport} ${year}:`, error.message);
            throw error;
        }
    }

    /**
     * Get checklist for a specific set
     * @param {string} setId - Set ID
     * @param {string} sport - Sport name (for URL construction)
     * @param {number} year - Year (for URL construction)
     * @returns {Array} Array of card objects {number, name, player, url, tcdbId}
     */
    async getChecklist(setId, sport = null, year = null) {
        try {
            const cacheKey = `checklist_${setId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Try to construct URL - TCDB might use different patterns
            let url;
            if (sport && year) {
                url = `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}/set/${setId}`;
            } else {
                // Try to find set URL from a search or use a generic pattern
                url = `${this.baseUrl}/ViewSet.cfm/sid/${setId}`;
            }

            console.log(`🔍 Fetching checklist for set ${setId}: ${url}`);
            
            const refererUrl = sport && year 
                ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}`
                : this.baseUrl + '/';
            
            const response = await axios.get(url, {
                headers: this.getDefaultHeaders(refererUrl),
                timeout: 20000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });

            const $ = cheerio.load(response.data);
            const cards = [];

            // Look for card rows in tables - TCDB typically displays checklist in tables
            $('table tr').each((index, element) => {
                const $row = $(element);
                const $cells = $row.find('td');
                
                if ($cells.length >= 2) {
                    // Try to extract card number and name
                    const cardNumber = $cells.eq(0).text().trim();
                    const cardName = $cells.eq(1).text().trim();
                    
                    // Look for player name (might be in a link or specific cell)
                    let playerName = '';
                    const $link = $cells.eq(1).find('a').first();
                    if ($link.length > 0) {
                        playerName = $link.text().trim();
                    } else {
                        playerName = cardName;
                    }

                    // Try to extract TCDB card ID from links
                    let tcdbCardId = null;
                    const cardLink = $cells.eq(1).find('a').attr('href');
                    if (cardLink) {
                        const idMatch = cardLink.match(/tid\/(\d+)|cardId=(\d+)/);
                        if (idMatch) {
                            tcdbCardId = idMatch[1] || idMatch[2];
                        }
                    }

                    if (cardNumber && cardName) {
                        cards.push({
                            number: cardNumber,
                            name: cardName,
                            player: playerName,
                            tcdbId: tcdbCardId,
                            url: cardLink ? (cardLink.startsWith('http') ? cardLink : `${this.baseUrl}${cardLink}`) : null
                        });
                    }
                }
            });

            // If no cards found in table format, try alternative selectors
            if (cards.length === 0) {
                $('.card-item, .checklist-item, [class*="card"]').each((index, element) => {
                    const $item = $(element);
                    const text = $item.text().trim();
                    const $link = $item.find('a').first();
                    
                    if (text && $link.length > 0) {
                        cards.push({
                            number: (index + 1).toString(),
                            name: text,
                            player: $link.text().trim(),
                            tcdbId: null,
                            url: $link.attr('href')
                        });
                    }
                });
            }

            // Cache for 1 hour
            this.cache.set(cacheKey, cards);
            
            console.log(`✅ Found ${cards.length} cards in set ${setId}`);
            return cards;

        } catch (error) {
            console.error(`❌ Error getting checklist for set ${setId}:`, error.message);
            throw error;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = TCDBService;

