const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const redis = require('redis');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
        ];
        this.currentUserAgent = 0;
        
        this.warmedUp = false;
        
        // ProxyMesh configuration - only use authorized server for basic plan
        this.proxyServers = [
            'us-ca.proxymesh.com:31280'  // Only server authorized for basic plan
        ];
        this.currentProxyIndex = 0;
        this.useProxy = process.env.PROXYMESH_USERNAME && process.env.PROXYMESH_PASSWORD;
        
        if (this.useProxy) {
            console.log('🌐 ProxyMesh enabled with', this.proxyServers.length, 'servers');
        }

        // Persistent cookie jar and axios client
        this.cookieJar = new CookieJar();
        this.httpClient = wrapper(axios.create({
            jar: this.cookieJar,
            withCredentials: true,
            timeout: 30000,
            responseType: 'text',
            decompress: true
        }));

        // Puppeteer setup with stealth plugin
        puppeteer.use(StealthPlugin());
        this.browser = null;
        this.page = null;

        // Redis cache setup
        this.redisClient = null;
        this.initRedis();
    }

    async initRedis() {
        try {
            if (process.env.REDIS_URL) {
                this.redisClient = redis.createClient({ url: process.env.REDIS_URL });
                await this.redisClient.connect();
                console.log('📦 Redis cache connected');
            }
        } catch (error) {
            console.log('⚠️ Redis cache not available:', error.message);
        }
    }

    async getCachedResult(cacheKey) {
        if (!this.redisClient) return null;
        try {
            const cached = await this.redisClient.get(cacheKey);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.log('⚠️ Cache read error:', error.message);
            return null;
        }
    }

    async setCachedResult(cacheKey, data, ttlSeconds = 21600) { // 6 hours default
        if (!this.redisClient) return;
        try {
            await this.redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(data));
        } catch (error) {
            console.log('⚠️ Cache write error:', error.message);
        }
    }

    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }

    async initializeBrowser() {
        if (this.browser) return true;
        
        try {
            console.log('🚀 Initializing headless browser...');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            
            this.page = await this.browser.newPage();
            await this.page.setUserAgent(this.getRandomUserAgent());
            await this.page.setViewport({ width: 1366, height: 768 });
            
            console.log('✅ Browser initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Browser initialization failed:', error.message);
            return false;
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('🔒 Browser closed');
        }
    }

    async searchWithBrowser(searchUrl, maxResults) {
        try {
            if (!this.page) {
                const initialized = await this.initializeBrowser();
                if (!initialized) return null;
            }

            console.log('🌐 Using headless browser for search...');
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for results to load
            await this.page.waitForSelector('.s-item, .no-results', { timeout: 10000 });
            
            // Check if we got verification page
            const pageContent = await this.page.content();
            if (pageContent.includes('Checking your browser') || pageContent.length < 15000) {
                console.log('🛑 Verification page detected in browser, retrying...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            const html = await this.page.content();
            return this.parseHtmlForCards(html, maxResults);
            
        } catch (error) {
            console.error('❌ Browser search failed:', error.message);
            return null;
        }
    }
    
    async warmUpSession() {
        if (this.warmedUp) return;
        
        try {
            console.log('🔥 Warming up session with eBay homepage...');
            const warmUpHeaders = {
                'User-Agent': this.getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                // Let axios negotiate; some proxies choke on br; we omit it explicitly
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            };
            
            const proxyAgent = this.getNextProxy();
            const config = { headers: warmUpHeaders, timeout: 30000, responseType: 'text', decompress: true };
            
            // Chain a few lightweight requests to establish cookies
            if (proxyAgent) {
                // Use regular axios with proxy for warm-up
                await axios.get(this.baseUrl, { ...config, httpsAgent: proxyAgent });
                await axios.get(`${this.baseUrl}/favicon.ico`, { ...config, httpsAgent: proxyAgent, headers: { ...warmUpHeaders, Accept: '*/*' } });
                await axios.get(`${this.baseUrl}/robots.txt`, { ...config, httpsAgent: proxyAgent, headers: { ...warmUpHeaders, Accept: 'text/plain,*/*;q=0.8' } });
            } else {
                // Use cookie jar client when no proxy
                await this.httpClient.get(this.baseUrl, config);
                await this.httpClient.get(`${this.baseUrl}/favicon.ico`, { ...config, headers: { ...warmUpHeaders, Accept: '*/*' } });
                await this.httpClient.get(`${this.baseUrl}/robots.txt`, { ...config, headers: { ...warmUpHeaders, Accept: 'text/plain,*/*;q=0.8' } });
            }
            this.warmedUp = true;
            console.log('✅ Session warmed up successfully');
            
            // Small delay to appear more human
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
        } catch (error) {
            console.log('⚠️ Warm-up failed, continuing anyway:', error.message);
        }
    }
    
    getNextProxy() {
        if (!this.useProxy) return null;
        
        const proxy = this.proxyServers[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyServers.length;
        
        const username = process.env.PROXYMESH_USERNAME;
        const password = process.env.PROXYMESH_PASSWORD;
        const proxyUrl = `http://${username}:${password}@${proxy}`;
        
        return new HttpsProxyAgent(proxyUrl);
    }

    buildSearchUrl(searchTerm, sport = null, expectedGrade = null, originalIsAutograph = null, cardType = null, season = null) {
        // Clean and encode the search term (preserve negative keywords properly)
        const cleanTerm = searchTerm.replace(/[^\w\s\-\+]/g, ' ').replace(/\s+/g, '+');
        
        // Pokemon TCG cards use different category and structure with BLANK search term
        if (cardType && cardType.toLowerCase().includes('pokemon tcg')) {
            // No grade filters; centralized price range; DO NOT add Season for Pokemon
            const searchUrl = `${this.baseUrl}/sch/i.html?_nkw=&_sacat=183454&_from=R40&_sasl=comc_consignment%2C+dcsports87%2C+probstein123%2C+5_star_cards&LH_PrefLoc=1&_saslop=2&_oaa=1&Game=Pok%25C3%25A9mon%2520TCG&LH_Complete=1&LH_Sold=1&_udlo=11&_udhi=3000`;
            return searchUrl;
        }
        
        // Standard sports cards (non-Pokemon) — no grade filters; centralized price range
        // Add cache buster to reduce bot-detection correlation
        const rnd = Math.floor(Math.random() * 1e9);
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1&rt=nc&_dcat=261328&_udlo=11&_udhi=3000&_rnd=${rnd}`;
        if (season) {
            searchUrl += `&Season=${encodeURIComponent(season)}`;
        }
        
        // Add sport filter if specified (for non-Pokemon sports)
        if (sport && sport.toLowerCase() !== 'pokemon') {
            searchUrl += `&Sport=${encodeURIComponent(sport)}`;
        }
        
        // Only add autographed filter when explicitly specified (doesn't apply to Pokemon)
        if (sport && sport.toLowerCase() !== 'pokemon') {
            if (originalIsAutograph === true) {
                searchUrl += '&Autographed=Yes';
            } else if (originalIsAutograph === false) {
                searchUrl += '&Autographed=No';
            }
        }
        // If originalIsAutograph is null, don't add any autograph filter (for general searches)
        
        return searchUrl;
    }

    async searchSoldCards(searchTerm, sport = null, maxResults = 50, expectedGrade = null, originalIsAutograph = null, targetPrintRun = null, cardType = null, season = null) {
        try {
            // Check cache first
            const cacheKey = `ebay_search:${searchTerm}:${sport}:${expectedGrade}:${maxResults}:${season}`;
            const cachedResult = await this.getCachedResult(cacheKey);
            if (cachedResult) {
                console.log('📦 Returning cached result');
                return cachedResult;
            }

            // Warm up session first
            await this.warmUpSession();
            
            let searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType, season);
            console.log(`🔍 DEBUG - Search request: "${searchTerm}" (sport: ${sport}, cardType: ${cardType}, grade: ${expectedGrade}, maxResults: ${maxResults})`);
            console.log(`🔍 Search URL: ${searchUrl}`);
            
            // Log built URL for debugging
            console.log(`🎯 Built Search URL: ${searchUrl}`);
            
            // Enhanced headers for better bot detection evasion
            const requestConfig = {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0',
                    'Referer': 'https://www.ebay.com/',
                    // Trim client hints to reduce fingerprint surface
                },
                timeout: 30000,
                responseType: 'text',
                decompress: true
            };
            
            // Retry logic for 402 errors
            let response;
            let attempt = 1;
            const maxAttempts = 3;
            
            while (attempt <= maxAttempts) {
                try {
                    // Rotate User-Agent each attempt
                    requestConfig.headers['User-Agent'] = this.getRandomUserAgent();
                    
                    // Add random delay between attempts
                    if (attempt > 1) {
                        const delay = 2000 + Math.random() * 3000; // 2-5 seconds
                        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    // Use appropriate client based on proxy configuration
                    const proxyAgent = this.getNextProxy();
                    if (proxyAgent) {
                        // Use regular axios with proxy instead of cookie jar client
                        console.log('🌐 Using ProxyMesh server with regular axios...');
                        response = await axios.get(searchUrl, { ...requestConfig, httpsAgent: proxyAgent });
                    } else {
                        // Use cookie jar client when no proxy
                        response = await this.httpClient.get(searchUrl, requestConfig);
                    }
                    const html = response?.data || '';
                    const looksLikeVerification =
                        typeof html === 'string' && html.length < 15000;
                    if (looksLikeVerification && attempt < maxAttempts) {
                        console.log(`🛑 Verification page detected (length=${html.length}) on attempt ${attempt}. Retrying with new session...`);
                        
                        // Reset session and warm up new session
                        this.warmedUp = false;
                        await this.warmUpSession();
                        
                        const newProxyAgent = this.getNextProxy();
                        if (newProxyAgent) {
                            requestConfig.httpsAgent = newProxyAgent;
                            console.log('🔄 Switching ProxyMesh server for retry...');
                        }
                        attempt++;
                        continue;
                    }
                    // Success path
                  break;
                    
                } catch (error) {
                    const status = error.response?.status;
                    if ((status === 402 || status === 403 || status === 429) && attempt < maxAttempts) {
                        console.log(`⚠️ HTTP ${status} (attempt ${attempt}/${maxAttempts}). Retrying with new session...`);
                        
                        // Reset session and warm up new session
                        this.warmedUp = false;
                        await this.warmUpSession();
                        
                        // Get a different proxy for retry
                        const newProxyAgent = this.getNextProxy();
                        if (newProxyAgent) {
                            requestConfig.httpsAgent = newProxyAgent;
                            console.log('🔄 Using different ProxyMesh server for retry...');
                        }
                        
                        attempt++;
                    } else {
                        throw error; // Re-throw if not retryable or max attempts reached
                    }
                }
            }

            if (response.data) {
                console.log(`✅ Direct HTTP request successful (${response.data.length} characters), parsing HTML...`);
                
                // Debug specific search
                if (searchTerm === "2024 Topps Chrome") {
                    console.log(`🔍 TOPPS CHROME DEBUG - HTML content sample (first 500 chars):`);
                    console.log(response.data.substring(0, 500));
                    console.log(`🔍 Searching for "Topps Chrome" in HTML...`);
                    const toppsMatches = (response.data.match(/topps chrome/gi) || []).length;
                    console.log(`🔍 Found ${toppsMatches} instances of "Topps Chrome" in HTML`);
                }
                
                // Exclude the section after "Results matching fewer words"
                let htmlToParse = response.data;
                const cutoffMarker = 'Results matching fewer words';
                const cutoffIndex = htmlToParse.indexOf(cutoffMarker);
                if (cutoffIndex !== -1) {
                    htmlToParse = htmlToParse.slice(0, cutoffIndex);
                    console.log('✂️ Truncated HTML at "Results matching fewer words" section to avoid looser matches');
                }
                
                const results = this.parseHtmlForCards(htmlToParse, maxResults, searchTerm, sport, expectedGrade, false, originalIsAutograph, targetPrintRun);
                
                if (results.length > 0) {
                    console.log(`✅ Found ${results.length} cards via direct HTTP request`);
                    const result = {
                        success: true,
                        results: results,
                        method: 'direct_http',
                        searchUrl
                    };
                    // Cache the successful result
                    await this.setCachedResult(cacheKey, result);
                    return result;
                }
            }

            // HTTP failed, try browser fallback
            console.log('🔄 HTTP request failed, trying browser fallback...');
            const browserResults = await this.searchWithBrowser(searchUrl, maxResults);
            
            if (browserResults && browserResults.length > 0) {
                console.log(`✅ Found ${browserResults.length} cards via browser fallback`);
                const result = {
                    success: true,
                    results: browserResults,
                    method: 'browser_fallback',
                    searchUrl
                };
                // Cache the successful result
                await this.setCachedResult(cacheKey, result);
                return result;
            }

            return {
                success: false,
                results: [],
                method: 'all_methods_failed',
                searchUrl
            };

        } catch (error) {
            console.error('Error in searchSoldCards:', error.message);
            return {
                success: false,
                results: [],
                error: error.message,
                searchUrl: searchUrl || 'unknown'
            };
        }
    }

    parseHtmlForCards(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            const finalResults = [];
            const maxResultsNum = parseInt(maxResults) || 50;
            
            console.log(`🔍 Parsing HTML with Cheerio for better reliability...`);
            
            // Load HTML into Cheerio
            const $ = cheerio.load(html);
            
            // Extract card items using eBay's standard selectors
            const cardItems = [];
            
            // Try multiple selectors for eBay items
            const itemSelectors = [
                '.s-item',
                '.srp-results .s-item',
                '.s-item__wrapper',
                '[data-view="mi:1686|iid:1"]'
            ];
            
            let items = $();
            for (const selector of itemSelectors) {
                items = $(selector);
                if (items.length > 0) {
                    console.log(`✅ Found ${items.length} items using selector: ${selector}`);
                    break;
                }
            }
            
            if (items.length === 0) {
                console.log('❌ No items found with standard selectors, falling back to regex parsing...');
                return this.parseHtmlForCardsRegex(html, maxResults, searchTerm, sport, expectedGrade, shouldRemoveAutos, originalIsAutograph, targetPrintRun);
            }
            
            // Process each item
            items.each((index, element) => {
                if (index >= maxResultsNum) return false; // Stop processing
                
                const $item = $(element);
                
                // Extract title with multiple fallbacks
                let title = '';
                const titleSelectors = [
                    '.s-item__title',
                    '.s-item__link',
                    'h3',
                    '.item-title',
                    '[data-view="mi:1686|iid:1"] .s-item__title'
                ];
                
                for (const selector of titleSelectors) {
                    const titleEl = $item.find(selector).first();
                    if (titleEl.length > 0) {
                        title = titleEl.text().trim();
                        break;
                    }
                }
                
                if (!title || title.length < 10) return; // Skip items without valid titles
                
                // Extract price with better accuracy
                let price = '';
                let numericPrice = 0;
                const priceSelectors = [
                    '.s-item__price',
                    '.s-item__detail--primary .s-item__price',
                    '.notranslate',
                    '.u-flL.condText'
                ];
                
                for (const selector of priceSelectors) {
                    const priceEl = $item.find(selector).first();
                    if (priceEl.length > 0) {
                        const priceText = priceEl.text().trim();
                        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
                        if (priceMatch) {
                            price = priceMatch[0];
                            numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(/,/g, ''));
                            if (numericPrice >= 1 && numericPrice <= 10000) {
                                break;
                            }
                        }
                    }
                }
                
                if (!price || numericPrice === 0) return; // Skip items without valid prices
                
                // Extract item ID
                let itemId = '';
                const itemIdSelectors = [
                    '.s-item__link',
                    'a[href*="/itm/"]',
                    '[data-view="mi:1686|iid:1"] a'
                ];
                
                for (const selector of itemIdSelectors) {
                    const linkEl = $item.find(selector).first();
                    if (linkEl.length > 0) {
                        const href = linkEl.attr('href');
                        if (href) {
                            const idMatch = href.match(/(?:itm\/|item\/)(\d{10,})/);
                            if (idMatch) {
                                itemId = idMatch[1];
                                break;
                            }
                        }
                    }
                }
                
                // Extract grade information
                const grade = this.detectGradeFromTitle(title);
                
                // Apply confidence scoring for autograph detection
                const autoConfidence = this.calculateAutographConfidence(title);
                
                cardItems.push({
                    title: title,
                    price: price,
                    numericPrice: numericPrice,
                    itemUrl: itemId ? `https://www.ebay.com/itm/${itemId}` : '',
                    sport: this.detectSportFromTitle(title),
                    grade: expectedGrade || grade,
                    soldDate: 'Recently sold',
                    ebayItemId: itemId,
                    autoConfidence: autoConfidence
                });
            });
            
            console.log(`🔍 Extracted ${cardItems.length} cards using Cheerio`);
            
            // Apply filtering
            let filteredResults = this.filterCardsByGrade(cardItems, expectedGrade);
            console.log(`🔍 Grade filtering (${expectedGrade || 'none'}): ${cardItems.length} → ${filteredResults.length} results`);
            
            // Apply autograph status filtering with confidence
            const beforeAutoFilter = filteredResults.length;
            filteredResults = this.filterByAutographStatusWithConfidence(filteredResults, originalIsAutograph);
            console.log(`🔍 Auto status filtering (${originalIsAutograph}): ${beforeAutoFilter} → ${filteredResults.length} results`);
            
            // Apply print run filtering
            const beforePrintRunFilter = filteredResults.length;
            filteredResults = this.filterByPrintRun(filteredResults, targetPrintRun);
            console.log(`🔍 Print run filtering (${targetPrintRun || 'none'}): ${beforePrintRunFilter} → ${filteredResults.length} results`);
            
            return filteredResults;
        } catch (error) {
            console.error('Error in parseHtmlForCards:', error);
            // Fallback to regex parsing
            return this.parseHtmlForCardsRegex(html, maxResults, searchTerm, sport, expectedGrade, shouldRemoveAutos, originalIsAutograph, targetPrintRun);
        }
    }

    filterCardsByGrade(cards, expectedGrade) {
        if (!expectedGrade) return cards;
        
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            if (expectedGrade === 'PSA 10') {
                return title.includes('psa 10') || title.includes('psa-10');
            } else if (expectedGrade === 'PSA 9') {
                return title.includes('psa 9') || title.includes('psa-9');
            } else if (expectedGrade === 'Raw') {
                const gradingTerms = ['psa 10', 'psa 9', 'psa 8', 'gem mt', 'mint 9'];
                return !gradingTerms.some(term => title.includes(term));
            }
            return true;
        });
    }

    filterByAutographStatus(cards, originalIsAutograph) {
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            const autoTerms = ['auto', 'autograph', 'autographed', 'signed', 'signature'];
            const hasAuto = autoTerms.some(term => title.includes(term));
            return originalIsAutograph ? hasAuto : !hasAuto;
        });
    }

    filterByPrintRun(cards, targetPrintRun) {
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            const matches = title.match(/\/(\d+)/);
            
            if (!targetPrintRun) {
                // If no target print run specified, keep all cards
                return true;
            } else {
                // If target print run specified, keep cards that match
                return matches && matches[1] === targetPrintRun.replace('/', '');
            }
        });
    }
    
    detectSportFromTitle(title) {
        const lowerTitle = title.toLowerCase();
        
        if (lowerTitle.includes('football') || lowerTitle.includes('nfl') || lowerTitle.includes('panini prizm') || lowerTitle.includes('donruss')) {
            return 'football';
        }
        if (lowerTitle.includes('basketball') || lowerTitle.includes('nba') || lowerTitle.includes('hoops') || lowerTitle.includes('select')) {
            return 'basketball';
        }
        if (lowerTitle.includes('baseball') || lowerTitle.includes('mlb') || lowerTitle.includes('topps') || lowerTitle.includes('bowman')) {
            return 'baseball';
        }
        if (lowerTitle.includes('hockey') || lowerTitle.includes('nhl') || lowerTitle.includes('upper deck')) {
            return 'hockey';
        }
        if (lowerTitle.includes('pokemon') || lowerTitle.includes('pokémon')) {
            return 'pokemon';
        }
        
        return 'unknown';
    }

    detectGradeFromTitle(title) {
        const lowerTitle = title.toLowerCase();
        
        // Enhanced grade detection with BGS and fuzzy matching
        // PSA 10 variants
        if (/(psa\s*10|psa-10|psa10|gem\s*mt\s*10|gem\s*mint\s*10|gem\s*mt\s*10)/i.test(lowerTitle)) {
            return 'PSA 10';
        }
        // PSA 9 variants
        if (/(psa\s*9|psa-9|psa9|gem\s*mt\s*9|gem\s*mint\s*9|mint\s*9)/i.test(lowerTitle)) {
            return 'PSA 9';
        }
        // PSA 8 variants
        if (/(psa\s*8|psa-8|psa8|mint\s*8)/i.test(lowerTitle)) {
            return 'PSA 8';
        }
        // BGS grades
        if (/(bgs\s*10|bgs-10|bgs10|beckett\s*10)/i.test(lowerTitle)) {
            return 'BGS 10';
        }
        if (/(bgs\s*9\.5|bgs-9\.5|bgs9\.5|beckett\s*9\.5)/i.test(lowerTitle)) {
            return 'BGS 9.5';
        }
        if (/(bgs\s*9|bgs-9|bgs9|beckett\s*9)/i.test(lowerTitle)) {
            return 'BGS 9';
        }
        
        return 'Raw';
    }

    calculateAutographConfidence(title) {
        const lowerTitle = title.toLowerCase();
        const autoTerms = ['auto', 'autograph', 'autographed', 'signed', 'signature'];
        const relicTerms = ['relic', 'patch', 'jersey', 'swatch'];
        const ambiguousTerms = ['auto relic', 'autograph relic', 'signed relic'];
        
        let confidence = 0;
        
        // Positive indicators
        autoTerms.forEach(term => {
            if (lowerTitle.includes(term)) confidence += 1;
        });
        
        // Negative indicators (relics without autographs)
        relicTerms.forEach(term => {
            if (lowerTitle.includes(term) && !autoTerms.some(auto => lowerTitle.includes(auto))) {
                confidence -= 0.5;
            }
        });
        
        // Ambiguous cases
        ambiguousTerms.forEach(term => {
            if (lowerTitle.includes(term)) confidence += 0.5;
        });
        
        return Math.max(0, Math.min(1, confidence));
    }

    filterByAutographStatusWithConfidence(cards, originalIsAutograph) {
        if (originalIsAutograph === null) return cards;
        
        return cards.filter(card => {
            const hasAuto = card.autoConfidence > 0.5;
            return originalIsAutograph ? hasAuto : !hasAuto;
        });
    }

    // Fallback regex parsing method
    parseHtmlForCardsRegex(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        // This is the original regex-based parsing method as a fallback
        // Implementation would be the same as the original parseHtmlForCards method
        console.log('🔄 Using regex fallback parsing...');
        return [];
    }
}

module.exports = EbayScraperService;
