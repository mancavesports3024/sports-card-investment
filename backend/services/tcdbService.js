const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

class TCDBService {
    constructor() {
        this.baseUrl = 'https://www.tcdb.com';
        this.cache = new Map(); // Simple in-memory cache
        this.cookieJar = null; // For maintaining session cookies
        
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
        this.browserEnabled = false;
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
     * Initialize headless browser (similar to eBay scraper)
     */
    async initializeBrowser() {
        if (this.browser) return true;
        
        try {
            console.log('🚀 Initializing headless browser for TCDB...');
            const fs = require('fs');
            const { execFileSync } = require('child_process');
            const path = require('path');
            
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
                ],
                protocolTimeout: 180000 // 3 minutes for protocol operations
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
                } catch (e) {
                    // Continue searching
                }
            }

            // Second: Check common installation paths
            if (!systemChromium) {
                console.log('🔍 Checking common Chromium paths...');
                const commonPaths = [
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium',
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/snap/bin/chromium'
                ];
                
                for (const commonPath of commonPaths) {
                    try {
                        if (fs.existsSync(commonPath)) {
                            systemChromium = commonPath;
                            console.log(`✅ Found Chromium at: ${commonPath}`);
                            break;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }

            // Third: Try serverless Chromium
            if (!systemChromium && this.serverlessChromium) {
                try {
                    console.log('🔍 Trying serverless Chromium...');
                    launchOptions.args = this.serverlessChromium.args || launchOptions.args;
                    launchOptions.headless = (typeof this.serverlessChromium.headless !== 'undefined') ? this.serverlessChromium.headless : launchOptions.headless;
                    const sparticuzPath = await this.serverlessChromium.executablePath();
                    if (sparticuzPath && fs.existsSync(sparticuzPath)) {
                        systemChromium = sparticuzPath;
                        console.log(`🧭 Using @sparticuz/chromium: ${sparticuzPath}`);
                    } else {
                        console.log('⚠️ @sparticuz/chromium path does not exist');
                    }
                } catch (error) {
                    console.log('⚠️ Serverless Chromium not available:', error.message);
                }
            }

            if (!systemChromium) {
                console.log('ℹ️ Browser fallback disabled - Chromium not found on system');
                this.browserEnabled = false;
                return false;
            }

            launchOptions.executablePath = systemChromium;
            this.browser = await puppeteer.launch(launchOptions);
            this.page = await this.browser.newPage();
            
            // Set timeouts for page operations
            this.page.setDefaultTimeout(120000); // 2 minutes for page operations
            this.page.setDefaultNavigationTimeout(120000); // 2 minutes for navigation
            
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await this.page.setViewport({ width: 1366, height: 768 });
            
            this.browserEnabled = true;
            console.log('✅ Browser initialized successfully for TCDB');
            return true;
        } catch (error) {
            console.error('❌ Browser initialization failed:', error.message);
            this.browserEnabled = false;
            this.browser = null;
            this.page = null;
            return false;
        }
    }

    /**
     * Close browser
     */
    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            } catch (error) {
                console.error('❌ Error closing browser:', error.message);
            }
        }
    }

    /**
     * Fetch page using browser (fallback when axios is blocked)
     * @param {string} url - URL to fetch
     * @param {Object} options - Options for fetching
     * @param {boolean} options.waitForTables - Whether to wait for tables with many rows (for checklists)
     * @param {number} options.waitTime - Additional wait time in ms (default: 5000)
     * @param {boolean} options.clickMoreButton - Whether to click "More" button to load more cards
     * @param {boolean} options.loadAllPages - Whether to paginate through all pages
     */
    async fetchWithBrowser(url, options = {}) {
        const { waitForTables = false, waitTime = 5000, clickMoreButton = false, loadAllPages = false } = options;
        if (!this.browserEnabled || !this.browser) {
            const initialized = await this.initializeBrowser();
            if (!initialized) {
                throw new Error('Browser not available for TCDB scraping - Chromium not found on system');
            }
        }
        
        if (!this.browser || !this.page) {
            throw new Error('Browser not available for TCDB scraping - initialization failed');
        }

        try {
            console.log(`🌐 Fetching TCDB page with browser: ${url}`);
            
            // Set up network request monitoring to catch AJAX calls
            const networkResponses = [];
            const cheerio = require('cheerio');
            
            const responseHandler = async (response) => {
                const responseUrl = response.url();
                // Only capture TCDB-specific responses (filter out ads/tracking scripts)
                // Look for AJAX/API calls that might contain checklist data
                if ((responseUrl.includes('ViewSet') || responseUrl.includes('ViewAll') || 
                     responseUrl.includes('ViewCard') || responseUrl.includes('checklist') || 
                     (responseUrl.includes('tcdb.com') && responseUrl.includes('.cfm'))) &&
                    !responseUrl.includes('adthrive') && !responseUrl.includes('amazon-adsystem') &&
                    !responseUrl.includes('scorecardresearch') && !responseUrl.includes('imasdk') &&
                    !responseUrl.includes('brandmetrics') && !responseUrl.includes('pubmatic')) {
                    try {
                        const text = await response.text();
                        if (text && text.length > 500) {
                            networkResponses.push({
                                url: responseUrl,
                                content: text,
                                length: text.length
                            });
                        }
                    } catch (e) {
                        // Ignore errors reading response
                    }
                }
            };
            
            this.page.on('response', responseHandler);
            
            // Use networkidle2 for sets/years (content loads via JS), domcontentloaded for checklists
            let html = null;
            try {
                const waitUntil = waitForTables ? 'domcontentloaded' : 'networkidle2';
                await this.page.goto(url, { 
                    waitUntil: waitUntil, 
                    timeout: 60000 
                });
                
                // Wait for JavaScript to render dynamic content
                console.log('⏳ Waiting for dynamic content to load...');
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // If waiting for tables (checklists), do additional waiting
                if (waitForTables) {
                    // Try to wait for tables with multiple rows (checklist tables usually have many rows)
                    try {
                        await this.page.waitForFunction(
                            () => {
                                const tables = document.querySelectorAll('table');
                                for (let table of tables) {
                                    const rows = table.querySelectorAll('tr');
                                    if (rows.length > 10) {
                                        return true; // Found a table with many rows (likely checklist)
                                    }
                                }
                                return false;
                            },
                            { timeout: 20000 }
                        ).catch(() => {
                            console.log('⚠️ Checklist table not found in DOM, checking network responses...');
                        });
                    } catch (e) {
                        // Continue even if selector not found
                    }
                    
                    // Check if any of the network responses contain checklist data
                    if (networkResponses.length > 0) {
                        console.log(`📡 Found ${networkResponses.length} TCDB network responses (filtered out ads/tracking), checking for checklist data...`);
                        
                        // Log first few URLs for debugging
                        networkResponses.slice(0, 5).forEach((resp, i) => {
                            console.log(`   Response ${i + 1}: ${resp.url.substring(0, 100)} (${resp.length} chars)`);
                        });
                        
                        for (const resp of networkResponses) {
                            // Check if this looks like checklist HTML (has div.block1 or ViewCard links)
                            if (resp.content.includes('div class="block1"') || 
                                (resp.content.includes('<tr') && resp.content.includes('td') && resp.content.includes('ViewCard'))) {
                                const $test = cheerio.load(resp.content);
                                const $block1 = $test('div.block1').has('h1.site:contains("Cards")');
                                const rowCount = $test('tr').length;
                                if ($block1.length > 0 || rowCount > 10) {
                                    console.log(`✅ Found checklist data in network response: ${resp.url.substring(0, 80)} (${rowCount} rows, ${resp.length} chars)`);
                                    html = resp.content;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Try to wait for checklist to appear in DOM by checking repeatedly
                    // Reduced attempts and timeout to avoid protocol timeouts
                    console.log('⏳ Waiting for checklist to appear in DOM...');
                    let checklistFound = false;
                    for (let attempt = 0; attempt < 5; attempt++) { // Reduced from 10 to 5
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Check if a large table has appeared (with timeout protection)
                        try {
                            const tableCount = await Promise.race([
                                this.page.evaluate(() => {
                                    const tables = document.querySelectorAll('table');
                                    let maxRows = 0;
                                    tables.forEach(table => {
                                        const rows = table.querySelectorAll('tr');
                                        if (rows.length > maxRows) {
                                            maxRows = rows.length;
                                        }
                                    });
                                    return { tableCount: tables.length, maxRows: maxRows };
                                }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                            ]);
                            
                            console.log(`   Attempt ${attempt + 1}: ${tableCount.tableCount} tables, max ${tableCount.maxRows} rows`);
                            
                            if (tableCount.maxRows > 10) {
                                console.log(`✅ Found checklist table with ${tableCount.maxRows} rows!`);
                                checklistFound = true;
                                html = await this.page.content();
                                break;
                            }
                        } catch (e) {
                            console.log(`   Attempt ${attempt + 1}: Evaluation timeout, continuing...`);
                            // Continue to next attempt
                        }
                    }
                    
                    if (!checklistFound) {
                        console.log('⚠️ Checklist table never appeared in DOM, using current HTML');
                        html = await this.page.content();
                    }
                    
                    // If this is a checklist page, handle "More" button and pagination
                    if (clickMoreButton || loadAllPages) {
                        console.log('🔄 Handling "More" button and pagination for checklist...');
                        
                        // Step 1: Click "More" button to load ~100 cards
                        try {
                            // Look for "More" button - could be text "More", "More >", or similar
                            const moreButton = await this.page.evaluateHandle(() => {
                                // Try different selectors for the More button
                                const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
                                return buttons.find(btn => {
                                    const text = btn.textContent?.toLowerCase().trim() || '';
                                    return text.includes('more') && !text.includes('comments');
                                });
                            });
                            
                            if (moreButton && moreButton.asElement()) {
                                console.log('   ✅ Found "More" button, clicking...');
                                await moreButton.asElement().click();
                                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load
                                console.log('   ✅ "More" button clicked, waiting for content...');
                            } else {
                                console.log('   ⚠️ "More" button not found (may already be expanded)');
                            }
                        } catch (e) {
                            console.log(`   ⚠️ Error clicking "More" button: ${e.message}`);
                        }
                        
                        // Step 2: If loadAllPages is true, paginate through all pages
                        if (loadAllPages) {
                            let pageCount = 1;
                            let hasNextPage = true;
                            
                            while (hasNextPage && pageCount < 20) { // Safety limit of 20 pages
                                // Get current page HTML and parse cards
                                const currentHtml = await this.page.content();
                                const $current = cheerio.load(currentHtml);
                                
                                // Count cards on current page
                                const currentCardCount = $current('a[href*="ViewCard"]').length;
                                console.log(`   📄 Page ${pageCount}: Found ${currentCardCount} ViewCard links`);
                                
                                // Look for "Next" button or pagination
                                try {
                                    const nextButton = await this.page.evaluateHandle(() => {
                                        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
                                        const links = Array.from(document.querySelectorAll('a'));
                                        const allElements = [...buttons, ...links];
                                        
                                        return allElements.find(el => {
                                            const text = el.textContent?.toLowerCase().trim() || '';
                                            const href = el.getAttribute('href') || '';
                                            // Look for "Next", ">", "Next >", or pagination links
                                            return (text.includes('next') || text === '>' || text === '»') &&
                                                   !text.includes('comments') &&
                                                   (href.includes('ViewSet') || href.includes('sid/'));
                                        });
                                    });
                                    
                                    if (nextButton && nextButton.asElement()) {
                                        console.log(`   ➡️ Found "Next" button, clicking to load page ${pageCount + 1}...`);
                                        await nextButton.asElement().click();
                                        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for next page to load
                                        pageCount++;
                                    } else {
                                        console.log('   ✅ No more pages found');
                                        hasNextPage = false;
                                    }
                                } catch (e) {
                                    console.log(`   ⚠️ Error finding/clicking "Next" button: ${e.message}`);
                                    hasNextPage = false;
                                }
                            }
                            
                            if (pageCount >= 20) {
                                console.log('   ⚠️ Reached page limit (20), stopping pagination');
                            }
                        }
                        
                        // Get final HTML after all interactions
                        html = await this.page.content();
                    }
                } else {
                    // For sets/years pages, just wait a bit more and get the HTML
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    html = await this.page.content();
                }
            } catch (timeoutError) {
                // If domcontentloaded times out, try with a shorter wait
                console.log('⚠️ domcontentloaded timed out, trying with load event...');
                try {
                    await this.page.goto(url, { 
                        waitUntil: 'load', 
                        timeout: 60000 
                    });
                    // Wait even longer for JS-rendered content
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    html = await this.page.content();
                } catch (loadError) {
                    // Last resort: just get whatever HTML we have
                    console.log('⚠️ Load event timed out, getting current HTML...');
                    html = await this.page.content();
                    if (!html || html.length < 100) {
                        throw new Error('Page did not load - HTML too short or empty');
                    }
                }
            }
            
            // Clean up network listeners
            this.page.removeAllListeners('response');
            
            if (!html || html.length < 100) {
                throw new Error('Page did not load - HTML too short or empty');
            }
            
            return html;
        } catch (error) {
            console.error('❌ Error fetching with browser:', error.message);
            // Don't close browser on timeout - might be recoverable
            if (!error.message.includes('timeout')) {
                await this.closeBrowser();
            }
            throw error;
        }
    }

    /**
     * Fetch HTML - skip axios (always blocked) and go straight to browser
     * @param {string} url - URL to fetch
     * @param {string} referer - Referer URL (for headers, not used now)
     * @param {Object} options - Options for browser fetch
     */
    async fetchHtmlWithFallback(url, referer = null, options = {}) {
        // TCDB always blocks axios requests, so skip it and use browser directly
        console.log('🌐 Fetching TCDB page with browser (skipping axios - always blocked)');
        return await this.fetchWithBrowser(url, options);
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

            const url = `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}?MODE=Years`;
            console.log(`🔍 Fetching years for ${sport}: ${url}`);
            
            const html = await this.fetchHtmlWithFallback(url, this.baseUrl + '/');

            const $ = cheerio.load(html);
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
                    console.error('⚠️ TCDB is blocking the request (403 Forbidden). Trying browser fallback...');
                    // Try browser fallback one more time
                    try {
                        const url = `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}?MODE=Years`;
                        const html = await this.fetchWithBrowser(url);
                        const $ = cheerio.load(html);
                        const years = [];
                        
                        $('a[href*="/year/"]').each((index, element) => {
                            const $link = $(element);
                            const href = $link.attr('href');
                            const yearText = $link.text().trim();
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
                        
                        const uniqueYears = Array.from(new Map(years.map(y => [y.year, y])).values())
                            .sort((a, b) => b.year - a.year);
                        
                        console.log(`✅ Found ${uniqueYears.length} years for ${sport} via browser`);
                        return uniqueYears;
                    } catch (browserError) {
                        console.error('❌ Browser fallback also failed:', browserError.message);
                        throw new Error(`TCDB blocked request (403): Both axios and browser failed`);
                    }
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
            
            const html = await this.fetchHtmlWithFallback(
                url,
                `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}?MODE=Years`
            );

            const $ = cheerio.load(html);
            const sets = [];

            const normalizeSetLink = (href, text) => {
                if (!href) return null;
                const setIdMatch = href.match(/\/set\/(\d+)|sid\/(\d+)|SetID=(\d+)|setId=(\d+)/i);
                if (!setIdMatch) return null;
                const setId = setIdMatch[1] || setIdMatch[2] || setIdMatch[3] || setIdMatch[4];
                const name = (text || '').trim();
                if (!setId || !name) return null;
                const absoluteUrl = href.startsWith('http') ? href : `${this.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
                return { id: setId, name, url: absoluteUrl };
            };

            // Look for set links - TCDB typically has links to sets
            $('a[href*="/set/"], a[href*="ViewSet.cfm"], a[href*="sid="], a[href*="SetID="]').each((index, element) => {
                const $link = $(element);
                const href = $link.attr('href');
                const setName = $link.text().trim();
                const normalized = normalizeSetLink(href, setName);
                if (normalized) sets.push(normalized);
            });

            // Also try looking in tables or lists
            if (sets.length === 0) {
                // Try alternative selectors
                $('table a, .set-list a, .checklist a, td a, li a').each((index, element) => {
                    const $link = $(element);
                    const href = $link.attr('href');
                    const text = $link.text().trim();
                    
                    const normalized = normalizeSetLink(href, text);
                    if (normalized) {
                        sets.push(normalized);
                    }
                });

                // Another fallback: inspect table rows without direct links
                if (sets.length === 0) {
                    $('table tr').each((index, row) => {
                        const $row = $(row);
                        const $link = $row.find('a').first();
                        if ($link.length === 0) return;
                        const href = $link.attr('href');
                        const rowText = $row.text().replace(/\s+/g, ' ').trim();
                        const normalized = normalizeSetLink(href, rowText || $link.text());
                        if (normalized) {
                            sets.push(normalized);
                        }
                    });
                }
            }

            // Remove duplicates
            const uniqueSets = Array.from(new Map(sets.map(s => [s.id, s])).values());

            if (uniqueSets.length === 0) {
                console.warn(`⚠️ No sets parsed for ${sport} ${year}. Sample HTML snippet:`);
                console.warn(html.substring(0, 500));
            }

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

            // Try the ViewAll pattern first (this is what appears in network tab)
            // Format: ViewAll.cfm/sp/Baseball/year/2025/set/482758
            let url = sport && year 
                ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}/set/${setId}`
                : `${this.baseUrl}/ViewSet.cfm/sid/${setId}`;
            
            // Alternative URL as fallback
            const alternativeUrl = url.includes('ViewAll') 
                ? `${this.baseUrl}/ViewSet.cfm/sid/${setId}`
                : (sport && year ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}/set/${setId}` : null);

            console.log(`🔍 Fetching checklist for set ${setId}: ${url}`);
            
            const refererUrl = sport && year 
                ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}`
                : this.baseUrl + '/';
            
            // Use browser to load page and handle "More" button + pagination
            let html = await this.fetchHtmlWithFallback(url, refererUrl, { waitForTables: true, waitTime: 8000, clickMoreButton: true, loadAllPages: true });
            let $ = cheerio.load(html);
            let cards = [];
            
            // Parse the first URL
            // (cards will be populated by extractCardInfo below)
            
            // If we got HTML but no cards, and we have an alternative URL, try it
            if (cards.length === 0 && alternativeUrl) {
                console.log(`⚠️ No cards found with first URL, trying alternative URL: ${alternativeUrl}`);
                html = await this.fetchHtmlWithFallback(alternativeUrl, refererUrl, { waitForTables: true, waitTime: 8000, clickMoreButton: true, loadAllPages: true });
                // Re-parse with the new HTML
                $ = cheerio.load(html);
                cards = []; // Reset cards array
            }
            
            // After initial parse, check if we need to load more pages
            // TCDB paginates checklists - typically 10-50 cards per page
            // Look for pagination links or "Show All" option
            const $allPages = $('a').filter((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().toLowerCase().trim();
                // Look for "Show All" or pagination that might load all cards
                return (text.includes('show all') || text.includes('all cards') || 
                        (href.includes('ViewSet') && text.match(/^\d+$/))) && 
                       href.includes('sid/' + setId);
            });
            
            if ($allPages.length > 0 && cards.length < 50) {
                console.log(`   📄 Found ${$allPages.length} pagination links - checklist may be paginated`);
                console.log(`   ⚠️ Only found ${cards.length} cards - may need to load additional pages`);
            }

            const extractCardInfo = ($row, indexFallback = null) => {
                const $cells = $row.find('td');
                if ($cells.length === 0) return false;

                // CRITICAL: Only parse rows that have a ViewCard link - this ensures we're getting actual cards, not trivia/comments
                const $viewCardLinks = $row.find('a[href*="ViewCard"]');
                if ($viewCardLinks.length === 0) {
                    // Skip rows without ViewCard links (these are trivia/comments/other content)
                    return false;
                }

                // TCDB structure can vary:
                // Option 1: First 2 cells are images, 3rd cell has card number (ViewCard link), 4th cell has player (Person link)
                // Option 2: First cell has card number (ViewCard link), second cell has player (Person link)
                let number = '';
                let nameText = '';
                let playerName = '';
                
                // Find the ViewCard link that contains the card number (not an image)
                // Look through all cells to find the one with a ViewCard link that has text (not just an image)
                let $numberLink = null;
                for (let i = 0; i < $cells.length; i++) {
                    const $cell = $cells.eq(i);
                    const $link = $cell.find('a[href*="ViewCard"]').first();
                    if ($link.length > 0) {
                        const linkText = $link.text().trim();
                        // If the link has text (not just an image), this is likely the card number
                        if (linkText && linkText.length > 0 && linkText.length < 20) {
                            $numberLink = $link;
                            number = linkText;
                            break;
                        }
                    }
                }
                
                // If we didn't find a text-based ViewCard link, try the first one
                if (!$numberLink && $viewCardLinks.length > 0) {
                    $numberLink = $viewCardLinks.first();
                    number = $numberLink.text().trim();
                }
                
                // Extract player name from Person link - look in cells after the number cell
                let $playerLink = null;
                for (let i = 0; i < $cells.length; i++) {
                    const $cell = $cells.eq(i);
                    const $link = $cell.find('a[href*="Person"]').first();
                    if ($link.length > 0) {
                        $playerLink = $link;
                        playerName = $link.text().trim();
                        nameText = playerName;
                        break;
                    }
                }
                
                // If no Person link found, try to get text from cells
                if (!playerName) {
                    // Skip image cells (first 2) and number cell, get text from remaining cells
                    for (let i = 2; i < $cells.length; i++) {
                        const cellText = $cells.eq(i).text().trim();
                        if (cellText && cellText.length > 0 && !cellText.match(/^\d+$/)) {
                            playerName = cellText;
                            nameText = cellText;
                            break;
                        }
                    }
                }

                const normalizedNumber = number.replace(/[^a-z0-9]/gi, '').toLowerCase();
                const normalizedName = nameText.replace(/\s+/g, ' ').trim().toLowerCase();
                const headerNumbers = new Set(['', '#', 'no', 'no.', 'card', 'checklist', 'card#']);
                const headerNames = new Set(['player', 'name', 'card', 'team', 'event', 'checklist', 'trivia', 'user comments', 'comments']);

                // Skip header rows and non-card content
                if (headerNumbers.has(normalizedNumber) || headerNames.has(normalizedName)) {
                    return false;
                }

                // Skip rows that look like trivia/comments/affiliate links (contain dates, usernames, ratings, eBay links)
                const rowText = $row.text().toLowerCase();
                if (rowText.includes('rating:') || rowText.includes('trivia') || 
                    rowText.includes('ebay') || rowText.includes('affiliate') || 
                    rowText.includes('commission') || rowText.includes('search') ||
                    rowText.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || // Date pattern
                    rowText.match(/\d{1,2}:\d{2}(am|pm)/i)) { // Time pattern
                    console.log(`   ⏭️ Skipping row (non-card content): ${rowText.substring(0, 100)}`);
                    return false;
                }

                if (!number && indexFallback !== null) {
                    number = (indexFallback + 1).toString();
                }
                if (!nameText && !playerName) return false;
                
                // Must have a valid card number (not empty, not just whitespace)
                if (!number || number.trim().length === 0) {
                    return false;
                }

                // Get card link from ViewCard link - use the number link we found
                let cardLink = $numberLink ? $numberLink.attr('href') : null;
                let tcdbCardId = null;
                
                // Extract TCDB card ID from ViewCard link (format: /ViewCard.cfm/sid/482758/cid/27980431/...)
                if (cardLink) {
                    const cidMatch = cardLink.match(/cid\/(\d+)/i);
                    if (cidMatch) {
                        tcdbCardId = cidMatch[1];
                    }
                    if (!cardLink.startsWith('http')) {
                        cardLink = `${this.baseUrl}${cardLink.startsWith('/') ? '' : '/'}${cardLink}`;
                    }
                } else {
                    // Fallback: try to get any ViewCard link from the row
                    const $anyViewCardLink = $row.find('a[href*="ViewCard"]').first();
                    if ($anyViewCardLink.length > 0) {
                        cardLink = $anyViewCardLink.attr('href');
                        if (cardLink && !cardLink.startsWith('http')) {
                            cardLink = `${this.baseUrl}${cardLink.startsWith('/') ? '' : '/'}${cardLink}`;
                        }
                    }
                }

                // Final validation: make sure we're not getting affiliate text
                const finalName = (nameText || playerName || '').toLowerCase();
                if (finalName.includes('ebay') || finalName.includes('affiliate') || finalName.includes('commission')) {
                    console.log(`   ⏭️ Skipping card (affiliate text in name): ${finalName.substring(0, 100)}`);
                    return false;
                }
                
                // Log first few cards for debugging
                if (cards.length < 3) {
                    console.log(`   📋 Card ${cards.length + 1}: #${number}, Player: ${playerName || nameText}, Name: ${nameText || playerName}`);
                }
                
                // Extract team name if available (Team link in cells)
                let teamName = '';
                for (let i = 0; i < $cells.length; i++) {
                    const $cell = $cells.eq(i);
                    const $teamLink = $cell.find('a[href*="Team"]').first();
                    if ($teamLink.length > 0) {
                        teamName = $teamLink.text().trim();
                        break;
                    }
                }
                
                cards.push({
                    number: number || '',
                    player: playerName || nameText || '',
                    team: teamName || '',
                    tcdbId: tcdbCardId,
                    url: cardLink
                });
                return true;
            };

            // TCDB checklist is in a div.block1 with h1.site="Cards"
            // Look for the specific structure the user identified
            const $block1 = $('div.block1').has('h1.site:contains("Cards")');
            if ($block1.length > 0) {
                console.log('✅ Found div.block1 with Cards header');
                const $checklistTable = $block1.find('table').first();
                if ($checklistTable.length > 0) {
                    const totalRows = $checklistTable.find('tr').length;
                    const rowsWithViewCard = $checklistTable.find('tr').filter((i, row) => $(row).find('a[href*="ViewCard"]').length > 0);
                    console.log(`   - Found checklist table with ${totalRows} rows (${rowsWithViewCard.length} have ViewCard links)`);
                    
                    let parsedCount = 0;
                    let skippedCount = 0;
                    $checklistTable.find('tr').each((index, element) => {
                        const wasParsed = extractCardInfo($(element), index);
                        if (wasParsed) {
                            parsedCount++;
                        } else {
                            skippedCount++;
                        }
                    });
                    console.log(`   - Parsed ${parsedCount} cards, skipped ${skippedCount} rows`);
                } else {
                    console.log('   ⚠️ No table found in block1');
                }
            } else {
                console.log('⚠️ div.block1 with Cards header not found');
            }
            
            // If no cards found in block1, try all tables but be more selective
            if (cards.length === 0) {
                console.log('⚠️ No cards in block1, trying all tables...');
                $('table').each((tableIndex, tableElement) => {
                    const $table = $(tableElement);
                    const $rows = $table.find('tr');
                    const rowsWithViewCard = $rows.filter((i, row) => $(row).find('a[href*="ViewCard"]').length > 0);
                    
                    if (rowsWithViewCard.length > 0) {
                        console.log(`   - Table ${tableIndex + 1}: ${$rows.length} rows, ${rowsWithViewCard.length} have ViewCard links`);
                        $rows.each((index, element) => {
                            extractCardInfo($(element), index);
                        });
                    } else {
                        console.log(`   - Table ${tableIndex + 1}: ${$rows.length} rows, none have ViewCard links (skipping)`);
                    }
                });
            }

            // If no cards found in table format, try alternative selectors
            if (cards.length === 0) {
                $('.card-item, .checklist-item, [class*="card"]').each((index, element) => {
                    const $item = $(element);
                    const text = $item.text().trim();
                    const $link = $item.find('a').first();
                    
                    if (text && $link.length > 0) {
                        let cardLink = $link.attr('href');
                        if (cardLink && !cardLink.startsWith('http')) {
                            cardLink = `${this.baseUrl}${cardLink.startsWith('/') ? '' : '/'}${cardLink}`;
                        }

                        cards.push({
                            number: (index + 1).toString(),
                            name: text,
                            player: $link.text().trim(),
                            tcdbId: null,
                            url: cardLink
                        });
                    }
                });
            }

            if (cards.length === 0) {
                console.warn(`⚠️ No cards parsed for set ${setId}. Sample HTML snippet:`);
                console.warn(html.substring(0, 500));
            }

            // If still no cards, log more details for debugging
            if (cards.length === 0) {
                console.warn(`⚠️ No cards parsed for set ${setId}. Debugging info:`);
                console.warn(`   - HTML length: ${html.length} characters`);
                console.warn(`   - Tables found: ${$('table').length}`);
                console.warn(`   - Table rows found: ${$('table tr').length}`);
                console.warn(`   - Links with /tid/: ${$('a[href*="/tid/"]').length}`);
                console.warn(`   - Links with ViewCard: ${$('a[href*="ViewCard"]').length}`);
                console.warn(`   - Links with card: ${$('a[href*="card"]').length}`);
                
                // Log table details
                $('table').each((i, table) => {
                    const $t = $(table);
                    console.warn(`   - Table ${i + 1}: ${$t.find('tr').length} rows, ${$t.find('td').length} cells`);
                    if ($t.find('tr').length > 0 && $t.find('tr').length < 20) {
                        console.warn(`     Sample rows: ${$t.find('tr').slice(0, 3).map((i, r) => $(r).text().substring(0, 100)).get().join(' | ')}`);
                    }
                });
                
                console.warn(`   - Sample HTML (first 2000 chars): ${html.substring(0, 2000)}`);
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

