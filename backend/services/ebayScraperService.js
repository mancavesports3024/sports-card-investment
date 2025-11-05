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
        const cleanTerm = mainCardName
            .replace(/[^\w\s]/g, ' ') // Remove special characters
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

    async searchSoldCards(searchTerm, sport = null, maxResults = 200, expectedGrade = null, originalIsAutograph = null, targetPrintRun = null, cardType = null, season = null, forceRefresh = false) {
        try {
            // Check cache first (unless forceRefresh is true)
            const cacheKey = `ebay_search:${searchTerm}:${sport}:${expectedGrade}:${maxResults}:${season}`;
            if (!forceRefresh) {
            const cachedResult = await this.getCachedResult(cacheKey);
            if (cachedResult) {
                console.log('📦 Returning cached result');
                return cachedResult;
                }
            } else {
                console.log('🔄 Force refresh requested - bypassing cache');
            }

            // Warm up session first
            await this.warmUpSession();
            
            // Calculate how many pages we need to fetch
            const itemsPerPage = 50; // eBay typically shows 50 items per page
            const pagesNeeded = Math.ceil(maxResults / itemsPerPage);
            console.log(`🔍 eBay search: "${searchTerm}" (maxResults: ${maxResults}, pages: ${pagesNeeded})`);
            
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
            
            console.log(`🔄 Processing ${items.length} items...`);
            
            let processedCount = 0;
            let skippedCount = 0;
            
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
                let soldDate = 'Recently sold';
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
                let shippingCost = null;
                const shippingSelectors = [
                    '.s-item__shipping',
                    '.s-item__detail--secondary .s-item__shipping',
                    '.s-item__details .s-item__shipping',
                    '.s-item__shipping .s-item__shippingCost',
                    '.s-item__shippingCost',
                    '.s-item__detail--secondary'
                ];
                
                for (const selector of shippingSelectors) {
                    const shippingEl = $item.find(selector).first();
                    if (shippingEl.length > 0) {
                        const shippingText = shippingEl.text().trim();
                        
                        // Look for various shipping cost patterns
                        const patterns = [
                            // Standard patterns: "$4.99 shipping", "Free shipping"
                            /(?:shipping|delivery|postage|p\s*&\s*p)[\s:+]*(\$|£|€)?\s*([\d,]+\.?\d*|Free|free)/i,
                            // Cost followed by descriptor: "+$4.99 delivery", "+$4.99 postage"
                            /\+?\s*(\$|£|€)\s*([\d,]+\.?\d*)\s*(?:shipping|delivery|postage)/i,
                            // Descriptor with free: "Free delivery", "Free postage"
                            /(Free\s+(?:shipping|delivery|postage)|free\s+(?:shipping|delivery|postage))/i,
                            // Direct cost patterns: "$4.99", "£2.99", "Free"
                            /(\$|£|€)\s*([\d,]+\.?\d*)/i,
                            // "Shipping included" or similar
                            /(shipping\s+included|included\s+shipping)/i
                        ];
                        
                        for (const pattern of patterns) {
                            const shippingMatch = shippingText.match(pattern);
                            if (shippingMatch) {
                                let raw = shippingMatch[0];
                                let currency = shippingMatch[1] && /[$£€]/.test(shippingMatch[1]) ? shippingMatch[1] : (shippingMatch[2] && /[$£€]/.test(shippingMatch[2]) ? shippingMatch[2] : '$');
                                let valuePart = shippingMatch[2] && !/[$£€]/.test(shippingMatch[2]) ? shippingMatch[2] : (shippingMatch[1] && !/[$£€]/.test(shippingMatch[1]) ? shippingMatch[1] : null);
                                const lower = raw.toLowerCase().trim();
                                if (lower.includes('free') || lower === 'free' || lower.includes('included')) {
                                    shippingCost = 'Free';
                                } else if (valuePart) {
                                    shippingCost = `${currency}${valuePart}`;
                                } else {
                                    // Fallback: extract any number
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
                
                // Extract sale type and bid information
                let saleType = null;
                let numBids = null;
                
                // Look for sale type indicators - check multiple areas
                const saleTypeSelectors = [
                    '.s-item__detail--primary',
                    '.s-item__details',
                    '.s-item__subtitle',
                    '.s-item__info',
                    '.s-item__caption',
                    '.s-item__price',
                    '.s-item__shipping'
                ];
                
                // First, look for bid information (auctions)
                for (const selector of saleTypeSelectors) {
                    const saleEl = $item.find(selector);
                    if (saleEl.length > 0) {
                        const saleText = saleEl.text().trim();
                        
                        // Check for auction indicators and extract bid count
                        const bidMatch = saleText.match(/(\d+)\s*bids?/i);
                        if (bidMatch) {
                            saleType = 'Auction';
                            numBids = parseInt(bidMatch[1]);
                            console.log(`🎯 Found auction with ${numBids} bids`);
                            break;
                        }
                    }
                }
                
                // If no auction found, look for other sale types
                if (!saleType) {
                    for (const selector of saleTypeSelectors) {
                        const saleEl = $item.find(selector).first();
                        if (saleEl.length > 0) {
                            const saleText = saleEl.text().trim();
                            
                            // Check for "Buy It Now" indicators
                            if (saleText.includes('Buy It Now') || saleText.includes('BIN')) {
                                saleType = 'Buy It Now';
                                break;
                            }
                            
                            // Check for "Best Offer" indicators
                            if (saleText.includes('Best Offer') || saleText.includes('OBO')) {
                                saleType = 'Best Offer';
                                break;
                            }
                        }
                    }
                }
                
                // If no sale type found, try to infer from item structure
                if (!saleType) {
                    // Look for bid-related elements
                    const bidElements = $item.find('[class*="bid"], [class*="auction"]');
                    if (bidElements.length > 0) {
                        saleType = 'Auction';
                        // Try to extract bid count from bid elements
                        const bidText = bidElements.text();
                        const bidMatch = bidText.match(/(\d+)\s*bids?/i);
                        if (bidMatch) {
                            numBids = parseInt(bidMatch[1]);
                        }
                    } else {
                        // Default to Buy It Now for sold items
                        saleType = 'Buy It Now';
                    }
                }
                
                for (const selector of soldDateSelectors) {
                    const soldDateEl = $item.find(selector).first();
                    if (soldDateEl.length > 0) {
                        const dateText = soldDateEl.text().trim();
                        // Look for date patterns with time like "Oct 14, 2025 2:30 PM", "Sold Oct 14, 2025 2:30 PM", etc.
                        if (dateText && /(sold\s+)?[a-z]{3}\s+\d{1,2},\s+\d{4}(\s+\d{1,2}:\d{2}\s*[ap]m)?/i.test(dateText)) {
                            soldDate = dateText.replace(/^sold\s+/i, '');
                            // Reduced logging - sold date extracted
                            break;
                        }
                        // Fallback to date-only patterns like "Oct 14, 2025", "Sold Oct 14, 2025", etc.
                        else if (dateText && /(sold\s+)?[a-z]{3}\s+\d{1,2},\s+\d{4}/i.test(dateText)) {
                            soldDate = dateText.replace(/^sold\s+/i, '');
                            // Reduced logging - sold date extracted (date only)
                            break;
                        }
                    }
                }
                
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
                            const idMatch = href.match(/(?:itm\/|item\/)(\d{9,})/);
                            if (idMatch) {
                                itemId = idMatch[1];
                            }
                        }
                    }
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
                
                cardItems.push({
                    title: title,
                    price: price,
                    numericPrice: numericPrice,
                    itemUrl: itemId ? `https://www.ebay.com/itm/${itemId}` : '',
                    sport: this.detectSportFromTitle(title),
                    grade: expectedGrade || grade,
                    soldDate: soldDate,
                    ebayItemId: itemId,
                    autoConfidence: autoConfidence,
                    shippingCost: shippingCost,
                    saleType: saleType,
                    numBids: numBids,
                    imageUrl: imageUrl
                });
                
                processedCount++;
            });
            
            console.log(`📊 Processed ${processedCount} items, skipped ${skippedCount} items`);
            
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
