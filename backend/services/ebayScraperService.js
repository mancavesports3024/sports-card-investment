const axios = require('axios');
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
        // Optional serverless Chromium (if available)
        try {
            this.serverlessChromium = require('@sparticuz/chromium');
        } catch (e) {
            this.serverlessChromium = null;
        }
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
            // Prefer a system-provided Chromium when available (Railway/Heroku)
            const fs = require('fs');
            const { execFileSync } = require('child_process');
            const launchOptions = {
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
            };

            // First: Probe system for Chromium using 'which' command (most reliable)
            console.log('🔍 Probing system for Chromium...');
            const whichNames = ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable'];
            let systemChromium = null;
            
            for (const name of whichNames) {
                try {
                    const pathOut = execFileSync('which', [name], { encoding: 'utf8' }).trim();
                    if (pathOut && fs.existsSync(pathOut)) {
                        systemChromium = pathOut;
                        console.log(`✅ Found system Chromium: ${name} -> ${pathOut}`);
                        break;
                    }
                } catch (_) {
                    // Silently skip - browser not available (normal in serverless)
                }
            }
            
            // Use system Chromium if found
            if (systemChromium) {
                launchOptions.executablePath = systemChromium;
                console.log(`🧭 Using system Chromium: ${systemChromium}`);
                this.browserEnabled = true;
            } else {
                // Fallback to env variables
                const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || process.env.GOOGLE_CHROME_BIN;
                if (chromiumPath) {
                    console.log(`🔍 Checking env path: ${chromiumPath}`);
                    if (fs.existsSync(chromiumPath)) {
                        launchOptions.executablePath = chromiumPath;
                        console.log(`🧭 Using env Chromium: ${chromiumPath}`);
                        this.browserEnabled = true;
                } else {
                    // Silently skip - browser not available (normal in serverless)
                }
                }
                
                // Final fallback to @sparticuz/chromium
                if (!launchOptions.executablePath && this.serverlessChromium) {
                    try {
                        launchOptions.args = this.serverlessChromium.args || launchOptions.args;
                        launchOptions.headless = (typeof this.serverlessChromium.headless !== 'undefined') ? this.serverlessChromium.headless : launchOptions.headless;
                        const sparticuzPath = await this.serverlessChromium.executablePath();
                        if (fs.existsSync(sparticuzPath)) {
                            launchOptions.executablePath = sparticuzPath;
                            console.log(`🧭 Using @sparticuz/chromium: ${sparticuzPath}`);
                            this.browserEnabled = true;
                        } else {
                            // Silently skip - browser not available (normal in serverless)
                        }
                    } catch (error) {
                        // Silently skip - browser not available (normal in serverless)
                    }
                }
                
                if (!launchOptions.executablePath) {
                    console.log('ℹ️ Browser fallback disabled (normal in serverless environments)');
                    this.browserEnabled = false;
                }
            }


            this.browser = await puppeteer.launch(launchOptions);
            
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
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            };
            
            const config = { headers: warmUpHeaders, timeout: 30000, responseType: 'text', decompress: true };
            
            // Chain a few lightweight requests to establish cookies
            await this.httpClient.get(this.baseUrl, config);
            await this.httpClient.get(`${this.baseUrl}/favicon.ico`, { ...config, headers: { ...warmUpHeaders, Accept: '*/*' } });
            await this.httpClient.get(`${this.baseUrl}/robots.txt`, { ...config, headers: { ...warmUpHeaders, Accept: 'text/plain,*/*;q=0.8' } });
            
            this.warmedUp = true;
            console.log('✅ Session warmed up successfully');
            
            // Minimal delay to appear more human
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
            
        } catch (error) {
            console.log('⚠️ Warm-up failed, continuing anyway:', error.message);
        }
    }
    

    buildSearchUrl(searchTerm, sport = null, expectedGrade = null, originalIsAutograph = null, cardType = null, season = null, page = 1) {
        // Simplify search term to avoid eBay detection
        let processedTerm = searchTerm;
        
        // Extract the main card name (before any exclusions)
        const mainCardName = processedTerm.split(' -')[0].trim();
        
        // Only use the main card name to avoid complex exclusions that trigger detection
        // Preserve # character (will be URL-encoded as %23)
        const cleanTerm = mainCardName
            .replace(/[^\w\s#]/g, ' ') // Remove special characters but keep #
            .replace(/\s+/g, '+')
            .trim();
        
        // Pokemon TCG cards use different category and structure with BLANK search term
        if (cardType && cardType.toLowerCase().includes('pokemon tcg')) {
            // No grade filters; centralized price range; DO NOT add Season for Pokemon
            const searchUrl = `${this.baseUrl}/sch/i.html?_nkw=&_sacat=183454&_from=R40&_sasl=comc_consignment%2C+dcsports87%2C+probstein123%2C+5_star_cards&LH_PrefLoc=1&_saslop=2&_oaa=1&Game=Pok%25C3%25A9mon%2520TCG&LH_Complete=1&LH_Sold=1&_udlo=11&_udhi=3000`;
            return searchUrl;
        }
        
        // Standard sports cards (non-Pokemon) — no grade filters; centralized price range
        // Add cache buster to reduce bot-detection correlation
        const rnd = Math.floor(Math.random() * 1e9);
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1&rt=nc&_dcat=261328&_udlo=11&_udhi=3000&_rnd=${rnd}&_sop=12&_pgn=${page}`;
        
        // For Pokemon-related searches, try broader category
        if (cleanTerm.toLowerCase().includes('pokemon') || cleanTerm.toLowerCase().includes('charmeleon') || cleanTerm.toLowerCase().includes('charizard')) {
            searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1&rt=nc&_dcat=183454&_udlo=11&_udhi=3000&_rnd=${rnd}&_sop=12&_pgn=${page}`;
        }
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

    /**
     * Parse sold date string from eBay and convert to ISO format
     * @param {string} dateText - Date string like "Sold Nov 13, 2024" or "Nov 13, 2024 2:30 PM"
     * @returns {string|null} ISO date string or null if invalid
     */
    parseSoldDate(dateText) {
        if (!dateText || typeof dateText !== 'string') {
            return null;
        }
        
        // Skip if it's just a placeholder like "Recently sold" (no actual date)
        const lowerText = dateText.toLowerCase().trim();
        if (lowerText === 'recently sold' || lowerText === 'sold' || lowerText === 'recently') {
            return null;
        }
        
        try {
            // Remove "Sold" prefix if present (e.g., "Sold Nov 13, 2024" -> "Nov 13, 2024")
            let cleanDateText = dateText.replace(/^sold\s+/i, '').trim();
            
            // Handle various date formats that eBay might use
            // Format 1: "Nov 13, 2024" or "Nov 13, 2024 2:30 PM"
            // Format 2: "13 Nov 2024" (less common)
            // Format 3: "November 13, 2024"
            
            // Try parsing the date
            const date = new Date(cleanDateText);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                // Try alternative parsing for formats like "13 Nov 2024"
                const altMatch = cleanDateText.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i);
                if (altMatch) {
                    const [, day, month, year] = altMatch;
                    const altDate = new Date(`${month} ${day}, ${year}`);
                    if (!isNaN(altDate.getTime())) {
                        return altDate.toISOString();
                    }
                }
                return null;
            }
            
            // Return ISO string
            return date.toISOString();
        } catch (error) {
            console.error(`Error parsing sold date: "${dateText}"`, error);
            return null;
        }
    }

    async searchSoldCards(searchTerm, sport = null, maxResults = 200, expectedGrade = null, originalIsAutograph = null, targetPrintRun = null, cardType = null, season = null, forceRefresh = false) {
        try {
            // Check cache first (unless forceRefresh is true)
            // Include maxResults in cache key to prevent returning wrong number of results
            const cacheKey = `ebay_search:${searchTerm}:${sport}:${expectedGrade}:${maxResults}:${season}`;
            if (!forceRefresh) {
            const cachedResult = await this.getCachedResult(cacheKey);
            if (cachedResult) {
                console.log(`📦 Returning cached result (cacheKey: ${cacheKey}, cached maxResults: ${cachedResult.results?.length || 0})`);
                return cachedResult;
                }
            } else {
                console.log(`🔄 Force refresh requested - bypassing cache (cacheKey: ${cacheKey})`);
            }

            // Warm up session first
            await this.warmUpSession();
            
            // Calculate how many pages we need to fetch
            const itemsPerPage = 50; // eBay typically shows 50 items per page
            const pagesNeeded = Math.ceil(maxResults / itemsPerPage);
            console.log(`🔍 eBay search: "${searchTerm}" (maxResults: ${maxResults}, pages: ${pagesNeeded}, cacheKey: ${cacheKey})`);
            
            let allResults = [];
            
            // Fetch multiple pages if needed
            for (let page = 1; page <= pagesNeeded && allResults.length < maxResults; page++) {
                let searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType, season, page);
                console.log(`🔍 Fetching page ${page}: ${searchUrl}`);
                
                const pageResults = await this.fetchPageResults(searchUrl, maxResults - allResults.length, searchTerm, sport, expectedGrade, originalIsAutograph, targetPrintRun);
                
                if (pageResults && pageResults.length > 0) {
                    allResults = allResults.concat(pageResults);
                    console.log(`📄 Page ${page}: Found ${pageResults.length} items (Total: ${allResults.length})`);
                } else {
                    console.log(`📄 Page ${page}: No more results found, stopping pagination`);
                    break;
                }
                
                // Add delay between pages to avoid verification pages
                if (page < pagesNeeded) {
                    const pageDelay = 3000 + Math.random() * 3000; // 3-6 seconds
                    console.log(`⏳ Waiting ${Math.round(pageDelay)}ms before next page...`);
                    await new Promise(resolve => setTimeout(resolve, pageDelay));
                }
            }
            
            if (allResults.length > 0) {
                console.log(`✅ Found ${allResults.length} total cards across ${pagesNeeded} pages`);
                const result = {
                    success: true,
                    results: allResults,
                    method: 'pagination',
                    searchUrl: this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType, season)
                };
                // Cache the successful result
                await this.setCachedResult(cacheKey, result);
                return result;
            }
            
            return {
                success: false,
                results: [],
                method: 'pagination_failed',
                searchUrl: this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType, season)
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
    
    async fetchPageResults(searchUrl, maxResults, searchTerm, sport, expectedGrade, originalIsAutograph, targetPrintRun) {
        try {
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
                },
                timeout: 15000, // Reduced for faster failures
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
                    
                    // Add minimal delay between attempts
                    if (attempt > 1) {
                        const delay = 3000 + Math.random() * 2000; // 3-5 seconds
                        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    // Use cookie jar client for all requests
                    response = await this.httpClient.get(searchUrl, requestConfig);
                    const html = response?.data || '';
                    const looksLikeVerification =
                        typeof html === 'string' && html.length < 15000;
                    if (looksLikeVerification && attempt < maxAttempts) {
                        console.log(`🛑 Verification page detected (length=${html.length}) on attempt ${attempt}. Retrying with new session...`);
                        
                        // Reset session and warm up new session
                        this.warmedUp = false;
                        await this.warmUpSession();
                        
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
                        
                        attempt++;
                    } else {
                        throw error; // Re-throw if not retryable or max attempts reached
                    }
                }
            }

            if (response && response.data) {
                console.log(`✅ Direct HTTP request successful (${response.data.length} characters), parsing HTML...`);
                
                // For card set analysis, don't truncate HTML to get more results
                let htmlToParse = response.data;
                const cutoffMarker = 'Results matching fewer words';
                const cutoffIndex = htmlToParse.indexOf(cutoffMarker);
                if (cutoffIndex !== -1 && maxResults <= 200) {
                    // Only truncate for smaller searches to maintain quality
                    htmlToParse = htmlToParse.slice(0, cutoffIndex);
                    console.log('✂️ Truncated HTML at "Results matching fewer words" section to avoid looser matches');
                } else if (cutoffIndex !== -1) {
                    console.log('📈 Large search requested - keeping all results including looser matches');
                }
                
                const results = this.parseHtmlForCards(htmlToParse, maxResults, searchTerm, sport, expectedGrade, false, originalIsAutograph, targetPrintRun);
                
                if (results.length > 0) {
                    console.log(`✅ Found ${results.length} cards via direct HTTP request`);
                    return results;
                }
            }

            // HTTP failed, try browser fallback
            console.log('🔄 HTTP request failed, trying browser fallback...');
            const browserResults = await this.searchWithBrowser(searchUrl, maxResults);
            
            if (browserResults && browserResults.length > 0) {
                console.log(`✅ Found ${browserResults.length} cards via browser fallback`);
                return browserResults;
            }

            return [];

        } catch (error) {
            console.error('Error in fetchPageResults:', error.message);
            return [];
        }
    }

    parseHtmlForCards(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            const finalResults = [];
            const showBidDebug = process.env.EBAY_VERBOSE_BID_LOGS === '1';
            const debugBidLog = (...args) => {
                if (showBidDebug) console.log(...args);
            };
            const maxResultsNum = parseInt(maxResults) || 200;
            
            console.log(`🔍 Parsing HTML with Cheerio...`);
            
            // Load HTML into Cheerio first
            const $ = cheerio.load(html);
            
            // Check for data-view elements (reduced logging)
            console.log(`🔍 Found ${$('[data-view]').length} data-view elements`);
            
            // Extract card items using eBay's standard selectors
            const cardItems = [];
            
            // Try multiple selectors for eBay items
            const itemSelectors = [
                '.s-item:not(.s-item--ad)', // Main selector, exclude ads
                '.srp-results .s-item:not(.s-item--ad)', 
                '.s-item__wrapper:not(.s-item--ad)',
                '[data-view*="iid:"]', // Try any data-view with iid
                '[data-view="mi:1686|iid:1"]',
                '[data-view*="mi:1686"]', // Try any mi:1686 variant
                '.item', '.sresult', '.srp-item'
            ];
            
            let items = $();
            for (const selector of itemSelectors) {
                items = $(selector);
                if (items.length > 0) {
                    console.log(`✅ Using selector: ${selector} (${items.length} items)`);
                    break;
                }
            }
            
            if (items.length === 0) {
                console.log('❌ No items found with standard selectors, falling back to regex parsing...');
                return this.parseHtmlForCardsRegex(html, maxResults, searchTerm, sport, expectedGrade, shouldRemoveAutos, originalIsAutograph, targetPrintRun);
            }

            if (items.length < 5) {
                console.log('⚠️ Detected sparse result set (<5 items). Dumping HTML preview for analysis.');
                const preview = html.slice(0, 2000).replace(/\s+/g, ' ');
                console.log(`--- HTML PREVIEW START ---\n${preview}\n--- HTML PREVIEW END ---`);
                const itemSummariesIdx = html.indexOf('"itemSummaries"');
                if (itemSummariesIdx !== -1) {
                    const start = Math.max(0, itemSummariesIdx - 300);
                    const end = Math.min(html.length, itemSummariesIdx + 2000);
                    const snippet = html.slice(start, end).replace(/\s+/g, ' ');
                    console.log(`--- ITEM SUMMARIES SNIPPET ---\n${snippet}\n--- ITEM SUMMARIES SNIPPET END ---`);
                } else {
                    console.log('ℹ️ No "itemSummaries" token detected in HTML.');
                }
            }

            console.log(`🔄 Processing ${items.length} items...`);

            let processedCount = 0;
            let skippedCount = 0;

            const seenItemIds = new Set();

            // Process each item
            items.each((index, element) => {
                if (index >= maxResultsNum) {
                    console.log(`🛑 Reached processing limit of ${maxResultsNum} items, stopping`);
                    return false; // Stop processing
                }

                const $item = $(element);

                // Extract title with multiple fallbacks
                let title = '';
                const titleSelectors = [
                    '.s-item__title span', // Try span inside title first
                    '.s-item__title',
                    '.s-item__link .s-item__title span',
                    '.s-item__link .s-item__title',
                    'h3 span',
                    'h3',
                    '.item-title',
                    '[data-view="mi:1686|iid:1"] .s-item__title',
                    '.s-item__info .s-item__title',
                    'a[href*="/itm/"] span',
                    'a[href*="/itm/"]'
                ];

                for (const selector of titleSelectors) {
                    const titleEl = $item.find(selector).first();
                    if (titleEl.length > 0) {
                        // Prefer the last non-promotional span text inside the title element
                        let candidateTitle = '';
                        const spans = titleEl.find('span');
                        if (spans && spans.length) {
                            for (let i = spans.length - 1; i >= 0; i--) {
                                const spanText = $(spans[i]).text().trim();
                                if (spanText && !/^New Listing$/i.test(spanText) && !/^Brand New$/i.test(spanText)) {
                                    candidateTitle = spanText;
                                    break;
                                }
                            }
                        }
                        title = (candidateTitle || titleEl.text().trim());

                        // Sanitize: remove common promo prefixes from composed title text
                        if (title) {
                            title = title.replace(/^\s*(New Listing|Brand New)\b\s*/i, '').trim();
                        }

                        // If still promotional like 'New Listing' or 'Brand New', try aria-label on the link
                        if ((/^New Listing$/i.test(title) || /^Brand New$/i.test(title)) && titleEl.is('a')) {
                            const aria = titleEl.attr('aria-label');
                            if (aria && aria.trim().length > 10) {
                                title = aria.trim();
                            }
                        }

                        // Reduced logging - title extraction
                        // Skip if it looks like an item ID (all digits) or navigation text
                        if (title && (
                            /^\d+$/.test(title) || 
                            /^(Shop on eBay|eBay|View|See|More|Loading|Sponsored|Ad)$/i.test(title) ||
                            /Shop on eBay/i.test(title) ||
                            /Brand New/i.test(title) ||
                            /^Shop on eBayBrand New/i.test(title)
                        )) {
                            console.log(`⚠️ Skipping navigation/advertisement text: "${title}"`);
                            continue;
                        }
                        if (title && title.length > 10) break; // Increased threshold
                    }
                }

                // Stronger fallback: if title is missing or looks like a placeholder like 'New Listing',
                // attempt to extract from any product link inside the item
                if (!title || /^New Listing$/i.test(title)) {
                    const links = $item.find('a[href*="/itm/"]');
                    if (links && links.length) {
                        let recovered = '';
                        // Prefer a link with a useful aria-label
                        links.each((i, el) => {
                            if (recovered) return; // already found
                            const $el = $(el);
                            const aria = ($el.attr('aria-label') || '').trim();
                            const ttlAttr = ($el.attr('title') || '').trim();
                            const href = ($el.attr('href') || '').trim();
                            if (aria && aria.length > 10 && !/^New Listing$/i.test(aria)) {
                                recovered = aria;
                                return;
                            }
                            if (ttlAttr && ttlAttr.length > 10 && !/^New Listing$/i.test(ttlAttr)) {
                                recovered = ttlAttr;
                                return;
                            }
                            // Try to reconstruct from URL slug when present
                            const slugMatch = href.match(/\/itm\/([^\/?#]+)(?:[\/?#]|$)/);
                            if (slugMatch && slugMatch[1]) {
                                const fromSlug = decodeURIComponent(slugMatch[1]).replace(/[-_]+/g, ' ').trim();
                                if (fromSlug && fromSlug.length > 10 && !/^New Listing$/i.test(fromSlug)) {
                                    recovered = fromSlug;
                                }
                            }
                        });
                        if (recovered) {
                            title = recovered;
                        }
                    }
                }

                // Additional filter for promotional content and "Choose Your Card" items
                if (title && (
                    /Shop on eBay/i.test(title) ||
                    /Brand New.*\$?\d+/i.test(title) ||
                    /^Shop on eBay/i.test(title) ||
                    title.includes('Shop on eBay') ||
                    (title.length < 20 && /Shop|eBay|Brand/i.test(title)) ||
                    /choose your card/i.test(title)
                )) {
                    console.log(`⚠️ Skipping promotional content or "Choose Your Card" item: "${title}"`);
                    skippedCount++;
                    return;
                }

                if (!title || title.length < 10) {
                    console.log(`⚠️ Skipping item ${index}: no valid title found (length: ${title?.length || 0})`);
                    skippedCount++;
                    return;
                }
                // Reduced logging - item processed

                // Extract price with better accuracy
                let price = '';
                let numericPrice = 0;
                const priceSelectors = [
                    '.s-item__price',
                    '.s-item__detail--primary .s-item__price',
                    '.notranslate',
                    '.u-flL.condText',
                    '.s-item__price .notranslate',
                    '.s-item__detail .s-item__price',
                    '.s-item__details .s-item__price'
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

                // If no price found with selectors, try regex on the entire item text
                if (!price) {
                    const itemText = $item.text();
                    const priceMatch = itemText.match(/\$[\d,]+\.?\d*/);
                    if (priceMatch) {
                        price = priceMatch[0];
                        numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(/,/g, ''));
                    }
                }

                if (!price || numericPrice === 0) {
                    console.log(`⚠️ Skipping item ${index}: no valid price found (price: "${price}", numeric: ${numericPrice})`);
                    skippedCount++;
                    return;
                }
                // Reduced logging - price extracted

                // Extract sold date and time
                let soldDate = null; // Will be ISO string or null
                const soldDateSelectors = [
                    '.su-styled-text.positive.default',
                    '.s-card__caption .su-styled-text',
                    '.s-item__caption .su-styled-text',
                    '.s-item__detail--primary .su-styled-text',
                    '.s-item__time',
                    '.s-item__sold',
                    '.s-item__caption span',
                    '.su-card-container_header span',
                    '.s-item__detail--secondary',
                    '.s-item__details',
                    '.s-item__subtitle',
                    '.s-item__info'
                ];

                // Extract shipping cost
                // Primary: User-identified exact location where eBay places shipping info
                // Same selector as bids but filter by content (delivery/shipping/postage)
                let shippingCost = null;
                const primaryShippingSelector = '.s-card_attribute-row .su-styled-text.secondary.large';
                const shippingElements = $item.find(primaryShippingSelector);

                // Find the element that contains shipping information
                shippingElements.each((index, element) => {
                    const shippingText = $(element).text().trim();
                    const lowerText = shippingText.toLowerCase();
                    // Only consider elements that contain shipping-related terms (not bids)
                    if ((lowerText.includes('delivery') || lowerText.includes('shipping') || lowerText.includes('postage')) &&
                        !lowerText.includes('bid') && !lowerText.includes('bids')) {
                        // Match patterns like "+$7.80 delivery", "$4.99 shipping", "Free delivery"
                        const shippingPatterns = [
                            /\+?\s*(\$|£|€)\s*([\d,]+\.?\d*)\s*(?:delivery|shipping|postage)/i,
                            /free\s+(?:delivery|shipping|postage)/i,
                        ];

                        for (const pattern of shippingPatterns) {
                            const match = shippingText.match(pattern);
                            if (match) {
                                if (match[0].toLowerCase().includes('free')) {
                                    shippingCost = 'Free';
                                } else if (match[2] && match[1]) {
                                    const currency = match[1] || '$';
                                    const value = match[2].replace(/,/g, '');
                                    shippingCost = `${currency}${value}`;
                                }
                                if (shippingCost) {
                                    return false; // Break out of each loop
                                }
                            }
                        }
                    }
                });

                // Fallback: Only check other selectors if primary didn't find it
                if (!shippingCost) {
                    const shippingSelectors = [
                        '.s-card_attribute-row span',
                        '.s-item__shipping',
                        '.s-item__detail--secondary .s-item__shipping',
                        '.s-item__details .s-item__shipping',
                        '.s-item__shipping .s-item__shippingCost',
                        '.s-item__shippingCost',
                        '.s-item__detail--secondary',
                        '.s-item__detail--primary',
                        '.s-item__price',
                        '.s-item__time',
                        '.s-item__freeXDays',
                        '[class*="shipping"]',
                        '[class*="delivery"]',
                        '.su-styled-text.secondary'
                    ];

                    for (const selector of shippingSelectors) {
                        const shippingEl = $item.find(selector).first();
                        if (shippingEl.length > 0) {
                            const shippingText = shippingEl.text().trim();

                            // Look for various shipping cost patterns
                            const patterns = [
                                /(?:shipping|delivery|postage|p\s*&\s*p)[\s:+]*(\$|£|€)?\s*([\d,]+\.?\d*|Free|free)/i,
                                /\+?\s*(\$|£|€)\s*([\d,]+\.?\d*)\s*(?:shipping|delivery|postage)/i,
                                /(Free\s+(?:shipping|delivery|postage)|free\s+(?:shipping|delivery|postage))/i,
                                /(\$|£|€)\s*([\d,]+\.?\d*)/i,
                                /(shipping\s+included|included\s+shipping)/i
                            ];

                            for (const pattern of patterns) {
                                const shippingMatch = shippingText.match(pattern);
                                if (shippingMatch) {
                                    let raw = shippingMatch[0];
                                    let currency = shippingMatch[1] && /[$£€]/.test(shippingMatch[1])
                                        ? shippingMatch[1]
                                        : (shippingMatch[2] && /[$£€]/.test(shippingMatch[2]) ? shippingMatch[2] : '$');
                                    let valuePart = shippingMatch[2] && !/[$£€]/.test(shippingMatch[2])
                                        ? shippingMatch[2]
                                        : (shippingMatch[1] && !/[$£€]/.test(shippingMatch[1]) ? shippingMatch[1] : null);
                                    const lower = raw.toLowerCase().trim();
                                    if (lower.includes('free') || lower === 'free' || lower.includes('included')) {
                                        shippingCost = 'Free';
                                    } else if (valuePart) {
                                        shippingCost = `${currency}${valuePart}`;
                                    } else {
                                        const num = raw.match(/([\d,]+\.?\d*)/);
                                        if (num) {
                                            shippingCost = `${currency}${num[1]}`;
                                        }
                                    }
                                    break;
                                }
                            }

                            if (shippingCost) break;
                        }
                    }

                    if (!shippingCost) {
                        const fullItemText = $item.text();
                        const shippingPatterns = [
                            /\+?\s*(\$|£|€)\s*([\d,]+\.?\d*)\s*(?:delivery|shipping|postage|p\s*&\s*p)/i,
                            /free\s+(?:delivery|shipping|postage)/i,
                            /(\$|£|€)\s*([\d,]+\.?\d*)\s*(?:delivery|shipping|postage)/i,
                        ];

                        for (const pattern of shippingPatterns) {
                            const match = fullItemText.match(pattern);
                            if (match) {
                                if (match[0].toLowerCase().includes('free')) {
                                    shippingCost = 'Free';
                                } else if (match[2] && match[1]) {
                                    const currency = match[1] || '$';
                                    const value = match[2].replace(/,/g, '');
                                    shippingCost = `${currency}${value}`;
                                }
                                if (shippingCost) break;
                            }
                        }
                    }
                }

                // Extract sale type and bid information
                let saleType = null;
                let numBids = null;

                // Primary: User-identified exact location where eBay places bid count
                // Try multiple selectors to catch different eBay layouts
                let foundBidElement = null;
                const bidSelectors = [
                    '.s-card_attribute-row .su-styled-text.secondary.large',
                    '.s-card_attribute-row .su-styled-text',
                    '.s-card_attribute-row span'
                ];

                for (const selector of bidSelectors) {
                    const bidElements = $item.find(selector);
                    if (bidElements.length > 0) {
                        bidElements.each((index, element) => {
                            let text = $(element).text().trim();
                            debugBidLog(`🔍 Checking element ${index} with selector "${selector}": "${text}"`);

                            if (text.includes('$')) {
                                const dollarIndex = text.indexOf('$');
                                text = text.substring(0, dollarIndex).trim();
                                debugBidLog(`   After splitting at $: "${text}"`);
                            }

                            text = text.replace(/[=]+/g, ' ').trim();

                            const lowerText = text.toLowerCase();
                            if (lowerText.includes('bid') || lowerText.includes('bids')) {
                                debugBidLog(`   Contains bid text, attempting match...`);
                                const bidMatch = text.match(/\b(\d+)\s*bids?\b/i);
                                if (bidMatch) {
                                    debugBidLog(`   Matched bid pattern: "${bidMatch[0]}"`);
                                    const bidNum = parseInt(bidMatch[1], 10);
                                    if (bidNum >= 1 && bidNum <= 10000) {
                                        let isPricePattern = false;
                                        if (bidNum < 100) {
                                            const beforeMatch = text.substring(Math.max(0, bidMatch.index - 10), bidMatch.index);
                                            const decimalPattern = new RegExp(`\\d+\\.${bidNum}\\b`);
                                            isPricePattern = decimalPattern.test(beforeMatch);
                                        }

                                        if (!isPricePattern) {
                                            foundBidElement = { text, bidNum };
                                            debugBidLog(`   ✅ Found bid element with ${bidNum} bids (primary selector match)`);
                                            return false;
                                        } else {
                                            debugBidLog(`   ⚠️ Rejected as price pattern`);
                                        }
                                    }
                                } else {
                                    debugBidLog(`   ⚠️ No bid match found in text`);
                                }
                            }
                        });
                        if (foundBidElement) break;
                    }
                }

                if (foundBidElement) {
                    saleType = 'Auction';
                    numBids = foundBidElement.bidNum;
                    debugBidLog(`🎯 Found auction with ${numBids} bids in primary selector (text: "${foundBidElement.text}")`);
                }

                const saleTypeSelectors = [
                    '.s-item__detail--primary',
                    '.s-item__details',
                    '.s-item__subtitle',
                    '.s-item__info',
                    '.s-item__caption',
                    '.s-item__price',
                    '.s-item__shipping'
                ];

                if (!saleType || numBids == null) {
                    for (const selector of saleTypeSelectors) {
                        const saleEl = $item.find(selector);
                        if (saleEl.length > 0) {
                            let saleText = saleEl.text().trim();
                            if (saleText.includes('$')) {
                                const dollarIndex = saleText.indexOf('$');
                                saleText = saleText.substring(0, dollarIndex).trim();
                            }

                            const bidMatch = saleText.match(/\b(\d+)\s*bids?\b/i);
                            if (bidMatch) {
                                saleType = 'Auction';
                                numBids = parseInt(bidMatch[1]);
                                debugBidLog(`🎯 Found auction with ${numBids} bids`);
                                break;
                            }
                        }
                    }
                }

                if (!saleType || numBids == null || isNaN(numBids)) {
                    debugBidLog(`🔍 Running full-text search for bids. Current saleType: ${saleType}, numBids: ${numBids}`);
                    const fullText = $item.text();
                    if (fullText) {
                        debugBidLog(`   Full text length: ${fullText.length}`);
                        let bidMatches = [];
                        try {
                            const matchIterator = fullText.matchAll(/\b(\d+)\s*bids?\b/gi);
                            bidMatches = Array.from(matchIterator);
                        } catch (e) {
                            const regex = /\b(\d+)\s*bids?\b/gi;
                            let match;
                            while ((match = regex.exec(fullText)) !== null) {
                                bidMatches.push(match);
                            }
                        }

                        if (bidMatches && bidMatches.length > 0) {
                            debugBidLog(`   Found ${bidMatches.length} potential bid matches`);
                            let bestMatch = null;
                            let bestScore = 0;
                            let bestEffectiveNum = null;

                            for (const match of bidMatches) {
                                const num = parseInt(match[1], 10);
                                debugBidLog(`   Checking match: "${match[0]}" (number: ${num})`);

                                if (num >= 1 && num <= 10000) {
                                    const beforeMatch = fullText.substring(Math.max(0, match.index - 25), match.index);
                                    const matchContext = fullText.substring(Math.max(0, match.index - 10), match.index + match[0].length + 5);
                                    debugBidLog(`     Before match context: "${beforeMatch}"`);
                                    debugBidLog(`     Match context (includes match): "${matchContext}"`);

                                    const trimmedBeforeMatch = beforeMatch.trim();
                                    const hasDollarImmediatelyBefore = /[$£€]\s*\d+(?:\.\d+)?\s{0,2}$/.test(trimmedBeforeMatch);
                                    const isDecimalPart = num < 100 && /\d+\.\d*\s*$/.test(trimmedBeforeMatch);
                                    const isItemNumber = /\d{12,}\s*$/.test(beforeMatch.trim());
                                    const isReasonableBidCount = num >= 1 && num <= 1000;

                                    let effectiveNum = num;
                                    let wasConcatenatedAndFixed = false;

                                    const concatenatedPriceMatch = /[$£€]\s*(\d+)\.(\d{1,2})(\d+)\s*bids?/i.exec(matchContext);
                                    if (concatenatedPriceMatch) {
                                        const priceDollars = concatenatedPriceMatch[1];
                                        const priceCents = concatenatedPriceMatch[2];
                                        const bidDigits = concatenatedPriceMatch[3];
                                        debugBidLog(`     Found concatenated price pattern: $${priceDollars}.${priceCents}${bidDigits} bids`);
                                        debugBidLog(`     Price cents: "${priceCents}", Bid digits: "${bidDigits}"`);
                                        const matchedNumberStr = match[1];
                                        const expectedConcatenated = priceCents + bidDigits;
                                        debugBidLog(`     Comparing matched string "${matchedNumberStr}" with expected "${expectedConcatenated}"`);
                                        if (matchedNumberStr === expectedConcatenated) {
                                            const bidNum = parseInt(bidDigits, 10);
                                            if (bidNum >= 1 && bidNum <= 1000) {
                                                debugBidLog(`     ↩️ Correcting concatenated number ${num} → ${bidNum} (price "${priceCents}" + bid "${bidDigits}")`);
                                                effectiveNum = bidNum;
                                                wasConcatenatedAndFixed = true;
                                            } else {
                                                debugBidLog(`     ❌ Bid digits "${bidDigits}" out of range (1-1000)`);
                                            }
                                        } else {
                                            debugBidLog(`     ❌ Matched string "${matchedNumberStr}" doesn't match expected "${expectedConcatenated}"`);
                                        }
                                    }

                                    const pricePatternBefore = /[$£€]\s*\d+\.(\d{1,2})\s*$/.exec(beforeMatch.trim());
                                    if (pricePatternBefore) {
                                        const priceCents = pricePatternBefore[1];
                                        const priceCentsLength = pricePatternBefore[1].length;
                                        debugBidLog(`     Found price pattern before: "${pricePatternBefore[0]}", cents: "${priceCents}"`);
                                        const numStr = match[1];
                                        debugBidLog(`     Checking if "${numStr}" starts with "${priceCents}"`);
                                        if (numStr.startsWith(priceCents)) {
                                            const bidPart = numStr.substring(priceCentsLength);
                                            const bidDigits = bidPart.replace(/^0+/, '');
                                            const bidNum = parseInt(bidDigits || '0', 10);
                                            debugBidLog(`     Extracted bid part: "${bidPart}" → ${bidNum}`);
                                            if (bidNum >= 1 && bidNum <= 1000) {
                                                debugBidLog(`     ↩️ Correcting concatenated number ${num} → ${bidNum} (price "${priceCents}" + bid "${bidPart}")`);
                                                effectiveNum = bidNum;
                                                wasConcatenatedAndFixed = true;
                                            } else {
                                                debugBidLog(`     ❌ Skipped - concatenated with price but invalid bid part: "${bidPart}"`);
                                                continue;
                                            }
                                        } else {
                                            debugBidLog(`     Number "${numStr}" does not start with price cents "${priceCents}"`);
                                        }
                                    } else {
                                        debugBidLog(`     No price pattern found before match`);
                                    }

                                    if (hasDollarImmediatelyBefore && !wasConcatenatedAndFixed && !isReasonableBidCount) {
                                        debugBidLog(`     Rejecting ${num} because price pattern detected immediately before`);
                                        continue;
                                    }

                                    if (isDecimalPart) {
                                        debugBidLog(`     ❌ Looks like decimal part of price, skipping`);
                                        continue;
                                    }

                                    if (isItemNumber) {
                                        debugBidLog(`     ❌ Matched item number, skipping`);
                                        continue;
                                    }

                                    debugBidLog(`     ⚠️ Candidate bid count: ${effectiveNum} (original: ${num}, concatenatedFix: ${wasConcatenatedAndFixed})`);

                                    if (!bestMatch || effectiveNum > bestScore) {
                                        debugBidLog(`     ✅ Selecting bid match ${effectiveNum}`);
                                        bestMatch = match;
                                        bestScore = effectiveNum;
                                        bestEffectiveNum = effectiveNum;
                                    } else {
                                        debugBidLog(`     ➖ Not better than current best score (${bestScore})`);
                                    }
                                }
                            }

                            if (bestMatch) {
                                saleType = 'Auction';
                                numBids = bestEffectiveNum ?? parseInt(bestMatch[1], 10);
                                debugBidLog(`🎯 Found auction with ${numBids} bids in full-text search (text: "${bestMatch[0]}", index: ${bestMatch.index})`);
                            } else {
                                debugBidLog(`   ❌ No valid bid matches found after filtering`);
                            }
                        } else {
                            debugBidLog(`   ❌ No bid matches found in full text`);
                        }
                    } else {
                        debugBidLog(`   ❌ No full text available`);
                    }
                } else {
                    debugBidLog(`ℹ️ Skipping full-text search - already found ${numBids} bids from primary/secondary selectors`);
                }

                if (!saleType) {
                    for (const selector of saleTypeSelectors) {
                        const saleEl = $item.find(selector).first();
                        if (saleEl.length > 0) {
                            const saleText = saleEl.text().trim();

                            if (saleText.includes('Buy It Now') || saleText.includes('BIN')) {
                                saleType = 'Buy It Now';
                                break;
                            }

                            if (saleText.includes('Best Offer') || saleText.includes('OBO')) {
                                saleType = 'Best Offer';
                                break;
                            }
                        }
                    }
                }

                if (!saleType) {
                    const bidElements = $item.find('[class*="bid"], [class*="auction"]');
                    if (bidElements.length > 0) {
                        saleType = 'Auction';
                        const bidText = bidElements.text();
                        const bidMatch = bidText.match(/\b(\d+)\s*bids?\b/i);
                        if (bidMatch) {
                            const bidNum = parseInt(bidMatch[1], 10);
                            if (bidNum >= 1 && bidNum <= 10000) {
                                numBids = bidNum;
                            }
                        }
                    }
                }

                if (!saleType) {
                    saleType = 'Buy It Now';
                    debugBidLog(`⚠️ Defaulting to "Buy It Now" - no sale type detected`);
                }

                console.log(`📊 Final result for item: saleType="${saleType}", numBids=${numBids}`);

                // Try to extract sold date from various selectors
                for (const selector of soldDateSelectors) {
                    const soldDateEl = $item.find(selector).first();
                    if (soldDateEl.length > 0) {
                        const dateText = soldDateEl.text().trim();
                        if (dateText && dateText.length > 0) {
                            // Log what we found for debugging
                            if (dateText.length < 100) { // Only log if reasonable length
                                console.log(`🔍 Found potential date text with selector "${selector}": "${dateText}"`);
                            }
                            
                            // Try to parse any date-like text (more flexible matching)
                            // Match patterns like:
                            // - "Sold Nov 13, 2024"
                            // - "Nov 13, 2024"
                            // - "Nov 13, 2024 2:30 PM"
                            // - "13 Nov 2024"
                            // - "November 13, 2024"
                            if (/(sold\s+)?[a-z]{3,9}\s+\d{1,2},\s+\d{4}(\s+\d{1,2}:\d{2}\s*[ap]m)?/i.test(dateText) ||
                                /(sold\s+)?\d{1,2}\s+[a-z]{3}\s+\d{4}/i.test(dateText) ||
                                /(sold\s+)?[a-z]{3,9}\s+\d{1,2},\s+\d{4}/i.test(dateText)) {
                                // Parse and convert to ISO format (parseSoldDate handles "Sold" prefix)
                                const parsedDate = this.parseSoldDate(dateText);
                                if (parsedDate) {
                                    soldDate = parsedDate;
                                    console.log(`✅ Parsed sold date: "${dateText}" -> ${parsedDate}`);
                                    break;
                                } else {
                                    console.log(`⚠️ Failed to parse sold date: "${dateText}"`);
                                }
                            }
                        }
                    }
                }
                
                // If no date found, log it for debugging
                if (!soldDate) {
                    console.log(`⚠️ No sold date found for item: ${title?.substring(0, 50)}...`);
                }

                let itemId = null;
                const itemIdSelectors = [
                    'a[href*="/itm/"]',
                    '.s-item__link',
                    'a'
                ];

                for (const selector of itemIdSelectors) {
                    const linkEl = $item.find(selector).first();
                    if (linkEl.length > 0) {
                        const href = linkEl.attr('href');
                        if (href) {
                            const idMatch = href.match(/(?:itm\/|item\/)(\d{9,})/);
                            if (idMatch) {
                                itemId = idMatch[1];
                            }
                        }
                    }
                }

                if (itemId && seenItemIds.has(itemId)) {
                    skippedCount++;
                    return;
                }

                // Final safety: if title is numeric-only, skip and log context
                if (/^\d+$/.test(title)) {
                    const debugHref = $item.find('a[href*="/itm/"]').first().attr('href') || '';
                    console.log(`🛑 Skipping numeric-only title for itemId=${itemId || 'unknown'} href=${debugHref}`);
                    skippedCount++;
                    return;
                }

                // Extract image URL
                let imageUrl = '';
                const imageSelectors = [
                    '.s-item__image img',
                    '.s-item__image-wrapper img',
                    'img.s-item__image-img',
                    '.s-item__picture img',
                    '.picture img',
                    'img[src*="ebayimg"]',
                    'img[src*="ebaystatic"]'
                ];

                for (const selector of imageSelectors) {
                    const imgEl = $item.find(selector).first();
                    if (imgEl.length > 0) {
                        let src = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy');
                        if (src) {
                            // Fix relative URLs and eBay image URLs
                            if (src.startsWith('//')) {
                                src = 'https:' + src;
                            } else if (src.startsWith('/')) {
                                src = 'https://www.ebay.com' + src;
                            }
                            // Convert eBay thumbnail URLs to full-size if needed
                            if (src.includes('s-l') && !src.includes('s-l1600')) {
                                src = src.replace(/s-l\d+/, 's-l1600');
                            }
                            imageUrl = src;
                            break;
                        }
                    }
                }

                // Extract grade information
                const grade = this.detectGradeFromTitle(title);

                // Apply confidence scoring for autograph detection
                const autoConfidence = this.calculateAutographConfidence(title);

                const itemUrl = itemId ? `https://www.ebay.com/itm/${itemId}` : '';
                if (itemId) {
                    seenItemIds.add(itemId);
                }

                cardItems.push({
                    title: title,
                    price: price,
                    numericPrice: numericPrice,
                    itemUrl: itemUrl,
                    sport: this.detectSportFromTitle(title),
                    grade: expectedGrade || grade,
                    soldDate: soldDate || null, // Only include date if we actually found one
                    ebayItemId: itemId,
                    autoConfidence: autoConfidence,
                    shippingCost: shippingCost,
                    saleType: saleType,
                    numBids: numBids,
                    imageUrl: imageUrl
                });

                processedCount++;
            });

            if ((cardItems.length === 0 || processedCount < maxResultsNum) && items.length <= 5) {
                const fallbackResults = this.extractItemsFromJson(html, maxResultsNum - processedCount, expectedGrade);
                if (fallbackResults.length > 0) {
                    console.log(`✅ Added ${fallbackResults.length} cards via JSON fallback parsing`);
                    for (const item of fallbackResults) {
                        if (item.ebayItemId && seenItemIds.has(item.ebayItemId)) {
                            continue;
                        }
                        if (item.ebayItemId) {
                            seenItemIds.add(item.ebayItemId);
                        }
                        cardItems.push(item);
                        processedCount++;
                    }
                } else {
                    console.log('❌ JSON fallback parsing did not yield additional cards');
                }
            }

            console.log(`📊 Processed ${processedCount} items, skipped ${skippedCount} items`);
            return cardItems;
        } catch (error) {
            console.error('Error in parseHtmlForCards:', error.message);
            return [];
        }
    }

    detectSportFromTitle(title) {
        const lowerTitle = (title || '').toLowerCase();

        if (/(football|nfl|panini\s+prizm|donruss)/i.test(lowerTitle)) {
            return 'football';
        }
        if (/(basketball|nba|hoops|select)/i.test(lowerTitle)) {
            return 'basketball';
        }
        if (/(baseball|mlb|topps|bowman)/i.test(lowerTitle)) {
            return 'baseball';
        }
        if (/(hockey|nhl|upper\s+deck)/i.test(lowerTitle)) {
            return 'hockey';
        }
        if (/(pokemon|pokémon)/i.test(lowerTitle)) {
            return 'pokemon';
        }
        if (/(soccer|futbol|football\s+club|premier\s+league)/i.test(lowerTitle)) {
            return 'soccer';
        }
        if (/(ufc|mma|wwe|wrestling)/i.test(lowerTitle)) {
            return 'mma';
        }
        if (/(golf|pga)/i.test(lowerTitle)) {
            return 'golf';
        }
        if (/(tennis)/i.test(lowerTitle)) {
            return 'tennis';
        }

        return 'unknown';
    }

    detectGradeFromTitle(title) {
        const lowerTitle = (title || '').toLowerCase();

        if (/(psa\s*10|psa-10|psa10|gem\s*mt\s*10|gem\s*mint\s*10)/i.test(lowerTitle)) {
            return 'PSA 10';
        }
        if (/(psa\s*9|psa-9|psa9|gem\s*mt\s*9|gem\s*mint\s*9)/i.test(lowerTitle)) {
            return 'PSA 9';
        }
        if (/(psa\s*8|psa-8|psa8|mint\s*8)/i.test(lowerTitle)) {
            return 'PSA 8';
        }
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
        const lowerTitle = (title || '').toLowerCase();
        const autoTerms = ['auto', 'autograph', 'autographed', 'signed', 'signature'];
        const relicTerms = ['relic', 'patch', 'jersey', 'swatch'];
        const ambiguousTerms = ['auto relic', 'autograph relic', 'signed relic'];

        let confidence = 0;

        autoTerms.forEach(term => {
            if (lowerTitle.includes(term)) confidence += 1;
        });

        relicTerms.forEach(term => {
            if (lowerTitle.includes(term) && !autoTerms.some(auto => lowerTitle.includes(auto))) {
                confidence -= 0.5;
            }
        });

        ambiguousTerms.forEach(term => {
            if (lowerTitle.includes(term)) confidence += 0.5;
        });

        return Math.max(0, Math.min(1, confidence));
    }

    filterByAutographStatusWithConfidence(cards, originalIsAutograph) {
        if (originalIsAutograph == null) return cards;

        return cards.filter(card => {
            const hasAuto = (card.autoConfidence || 0) > 0.5;
            return originalIsAutograph ? hasAuto : !hasAuto;
        });
    }

    filterByPrintRun(cards, targetPrintRun) {
        if (!targetPrintRun) return cards;
        return cards.filter(card => {
            const match = (card.title || '').match(/\/(\d+)/);
            return match && match[1] === targetPrintRun.replace('/', '');
        });
    }

    filterByGrade(cards, expectedGrade) {
        if (!expectedGrade) return cards;
        const normalized = expectedGrade.toLowerCase();

        return cards.filter(card => {
            const title = (card.title || '').toLowerCase();
            if (normalized === 'raw') {
                const gradingTerms = ['psa 10', 'psa 9', 'psa 8', 'gem mt', 'mint 9'];
                return !gradingTerms.some(term => title.includes(term));
            }
            return title.includes(normalized);
        });
    }

    extractItemsFromJson(html, remainingSlots, expectedGrade) {
        const assignments = [
            'window.__INITIAL_STATE__',
            'window.__INITIAL_DATA__',
            'window.__SRP_REDUX_INITIAL_STATE__',
            'window.__srpReactInitialState__',
            'window.__srpInitialState__'
        ];

        for (const assignment of assignments) {
            const regex = new RegExp(`${assignment.replace(/\./g, '\\.') }\s*=\s*(\{[\s\S]*?\});`);
            const match = regex.exec(html);
            if (match) {
                const jsonString = match[1];
                const parsed = this.safeJsonParse(jsonString);
                if (!parsed) {
                    console.log(`⚠️ Failed to parse JSON for ${assignment}`);
                    continue;
                }

                const itemSummaries = this.findItemSummaries(parsed);
                if (Array.isArray(itemSummaries) && itemSummaries.length) {
                    console.log(`✅ Found ${itemSummaries.length} items via JSON assignment ${assignment}`);
                    console.log(`🧩 JSON item summary keys: ${Object.keys(itemSummaries[0] || {}).slice(0, 12).join(', ')}`);
                    return this.normalizeItemSummaries(itemSummaries, remainingSlots, expectedGrade);
                }
            }
        }
        return [];
    }

    safeJsonParse(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            try {
                const sanitized = jsonString
                    .replace(/undefined/g, 'null')
                    .replace(/\bNaN\b/g, 'null');
                return JSON.parse(sanitized);
            } catch (innerError) {
                console.log('⚠️ JSON parse failed:', innerError.message);
                return null;
            }
        }
    }

    findItemSummaries(root) {
        const queue = [root];
        const seen = new WeakSet();

        while (queue.length) {
            const node = queue.shift();
            if (!node || typeof node !== 'object') continue;
            if (seen.has(node)) continue;
            seen.add(node);

            if (Array.isArray(node)) {
                for (const item of node) {
                    queue.push(item);
                }
                continue;
            }

            if (Array.isArray(node.itemSummaries) && node.itemSummaries.length) {
                return node.itemSummaries;
            }

            for (const value of Object.values(node)) {
                if (value && typeof value === 'object') {
                    queue.push(value);
                }
            }
        }
        return null;
    }

    normalizeItemSummaries(itemSummaries, remainingSlots, expectedGrade) {
        const results = [];
        for (const summary of itemSummaries) {
            if (remainingSlots != null && results.length >= remainingSlots) break;
            const title = (summary.title || summary.legacyItemTitle || '').trim();
            if (!title || title.length < 6) continue;

            const priceInfo = summary.price || summary.currentPrice || summary.currentBidPrice || summary.primaryPrice;
            const rawPrice = priceInfo ? parseFloat(priceInfo.value ?? priceInfo.raw ?? priceInfo.convertedValue ?? priceInfo.amount ?? 0) : 0;
            if (!Number.isFinite(rawPrice) || rawPrice <= 0) continue;
            const normalizedPrice = Math.round(rawPrice * 100) / 100;
            const currency = (priceInfo?.currency || priceInfo?.currencyId || priceInfo?.currencySymbol || 'USD');
            const priceText = `${this.currencySymbol(currency)}${normalizedPrice.toFixed(2)}`;

            const itemId = summary.itemId || summary.id || summary.legacyItemId || null;
            const itemUrl = summary.itemHref || summary.itemUrl || (itemId ? `https://www.ebay.com/itm/${itemId}` : '');

            const saleType = Array.isArray(summary.buyingOptions) && summary.buyingOptions.includes('AUCTION')
                ? 'Auction'
                : 'Buy It Now';
            let numBids = null;
            if (saleType === 'Auction') {
                const bidSources = [
                    summary.bidCount,
                    summary.bids,
                    summary.numBids,
                    summary.bidCountDisplay,
                    summary.itemAuctionInfo?.bidCount,
                    summary.itemAuctionInfo?.bidCountDisplay,
                    summary.auctionInfo?.bidCount,
                    summary.auctionInfo?.bidCountDisplay
                ];
                for (const src of bidSources) {
                    const normalized = this.normalizeBidCount(src);
                    if (normalized != null) {
                        numBids = normalized;
                        break;
                    }
                }
                if (numBids == null) {
                    const textSources = [
                        summary.itemSubtitle,
                        summary.subtitle,
                        summary.itemTitleSubtitle,
                        summary.itemCardSubTitle,
                        summary.itemInfo?.viewItemShortDescription,
                        summary.itemInfo?.subtitle
                    ];
                    for (const text of textSources) {
                        if (typeof text === 'string') {
                            const match = text.match(/\b(\d+)\s*bids?\b/i);
                            if (match) {
                                numBids = parseInt(match[1], 10);
                                break;
                            }
                        }
                    }
                }
            }

            const imageUrl = summary.image?.imageUrl || summary.image?.imageUrlHttps || summary.galleryUrl || null;
            const popSport = this.detectSportFromTitle(title);
            const grade = expectedGrade || this.detectGradeFromTitle(title);
            
            // Parse sold date from various possible fields
            let soldDate = null;
            const dateSource = summary.itemEndDate || summary.itemEndDateString || summary.timeLeft;
            if (dateSource) {
                // If it's already an ISO string or timestamp, use it
                if (typeof dateSource === 'string' && dateSource.includes('T')) {
                    soldDate = dateSource;
                } else if (typeof dateSource === 'number') {
                    soldDate = new Date(dateSource).toISOString();
                } else {
                    // Try parsing as date string
                    soldDate = this.parseSoldDate(dateSource);
                }
            }
            // Don't use fallback - only use actual sold date from eBay
            // If no date found, leave as null

            let shippingCost = null;
            if (summary.shipping?.price?.value) {
                const shipCurrency = summary.shipping.price.currency || summary.shipping.price.currencyId || currency;
                const shipValue = Math.round(parseFloat(summary.shipping.price.value) * 100) / 100;
                if (Number.isFinite(shipValue) && shipValue > 0) {
                    shippingCost = `${this.currencySymbol(shipCurrency)}${shipValue.toFixed(2)}`;
                } else if (shipValue === 0) {
                    shippingCost = 'Free';
                }
            } else if (summary.shipping?.type === 'FREE' || summary.shipping?.value === 'FREE') {
                shippingCost = 'Free';
            } else if (typeof summary.shippingCostDisplay === 'string') {
                const match = summary.shippingCostDisplay.match(/\b(free)\b/i);
                if (match) {
                    shippingCost = 'Free';
                } else {
                    const numeric = summary.shippingCostDisplay.match(/([$£€])\s*([\d,.]+)/);
                    if (numeric) {
                        shippingCost = `${numeric[1]}${numeric[2]}`;
                    }
                }
            }

            results.push({
                title,
                price: priceText,
                numericPrice: normalizedPrice,
                itemUrl,
                sport: popSport,
                grade,
                soldDate,
                ebayItemId: itemId,
                autoConfidence: this.calculateAutographConfidence(title),
                shippingCost,
                saleType,
                numBids,
                imageUrl
            });
        }
        return results;
    }

    currencySymbol(code) {
        switch ((code || '').toUpperCase()) {
            case 'USD':
                return '$';
            case 'GBP':
                return '£';
            case 'EUR':
                return '€';
            case 'AUD':
                return 'A$';
            case 'CAD':
                return 'C$';
            case 'JPY':
                return '¥';
            default:
                return `${code} `;
        }
    }

    normalizeBidCount(raw) {
        if (raw == null) return null;
        if (typeof raw === 'number') {
            if (!Number.isFinite(raw)) return null;
            if (raw > 100 && raw % 100 < 100) {
                const stripped = Math.floor(raw % 100);
                if (stripped >= 1 && stripped <= 100) {
                    return stripped;
                }
            }
            const integer = Math.floor(raw);
            return integer >= 0 ? integer : null;
        }
        if (typeof raw === 'string') {
            const match = raw.match(/(\d[\d,]*)/);
            if (match) {
                const value = parseInt(match[1].replace(/,/g, ''), 10);
                if (Number.isFinite(value)) {
                    if (value > 100 && value % 100 < 100) {
                        const stripped = value % 100;
                        if (stripped >= 1 && stripped <= 100) {
                            return stripped;
                        }
                    }
                    return value;
                }
            }
        }
        return null;
    }

    parseHtmlForCardsRegex(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            const finalResults = [];
            const showBidDebug = process.env.EBAY_VERBOSE_BID_LOGS === '1';
            const debugBidLog = (...args) => {
                if (showBidDebug) console.log(...args);
            };
            const maxResultsNum = parseInt(maxResults) || 200;

            console.log(`🔍 Parsing HTML with Regex...`);

            // Load HTML into Cheerio first
            const $ = cheerio.load(html);

            // Check for data-view elements (reduced logging)
            console.log(`🔍 Found ${$('[data-view]').length} data-view elements`);

            // Extract card items using eBay's standard selectors
            const cardItems = [];

            // Try multiple selectors for eBay items
            const itemSelectors = [
                '.s-item:not(.s-item--ad)',
                '.srp-results .s-item:not(.s-item--ad)',
                '.s-item__wrapper:not(.s-item--ad)',
                '[data-view*="iid:"]',
                '[data-view="mi:1686|iid:1"]',
                '[data-view*="mi:1686"]',
                '.item',
                '.sresult',
                '.srp-item'
            ];

            let items = $();
            for (const selector of itemSelectors) {
                items = $(selector);
                if (items.length > 0) {
                    console.log(`✅ Using selector: ${selector} (${items.length} items)`);
                    break;
                }
            }

            if (items.length === 0) {
                console.log('❌ No items found with standard selectors in regex fallback. Returning empty results.');
                return [];
            }

            items.each((index, element) => {
                if (index >= maxResultsNum) {
                    return false;
                }

                const $item = $(element);
                const text = $item.text();
                const titleMatch = text.match(/"([^"]{10,})"/);
                const priceMatch = text.match(/[\$£€]\s*([0-9,.]+)/);

                if (!titleMatch || !priceMatch) {
                    return;
                }

                const title = titleMatch[1].trim();
                const numericPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                if (!title || !Number.isFinite(numericPrice) || numericPrice <= 0) {
                    return;
                }

                finalResults.push({
                    title,
                    price: priceMatch[0],
                    numericPrice,
                    itemUrl: '',
                    sport: this.detectSportFromTitle(title),
                    grade: expectedGrade || this.detectGradeFromTitle(title),
                    soldDate: null,
                    ebayItemId: null,
                    autoConfidence: this.calculateAutographConfidence(title),
                    shippingCost: null,
                    saleType: 'Buy It Now',
                    numBids: null,
                    imageUrl: null
                });
            });

            console.log(`📊 Regex fallback extracted ${finalResults.length} cards`);
            return finalResults;
        } catch (error) {
            console.error('Error in parseHtmlForCardsRegex:', error.message);
            return [];
        }
    }
}

module.exports = EbayScraperService;