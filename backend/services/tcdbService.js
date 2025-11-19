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
     */
    async fetchWithBrowser(url) {
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
                // Look for AJAX/API calls that might contain checklist data
                if (responseUrl.includes('ViewSet') || responseUrl.includes('checklist') || 
                    responseUrl.includes('card') || responseUrl.includes('.cfm') || 
                    responseUrl.includes('ajax') || response.request().resourceType() === 'xhr') {
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
            
            // Try with domcontentloaded first (faster), then fallback to networkidle2
            let html = null;
            try {
                await this.page.goto(url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 45000 
                });
                
                // Wait longer for JavaScript to render dynamic content (checklists are often loaded via JS)
                console.log('⏳ Waiting for dynamic content to load...');
                
                // Wait for network to be idle (all AJAX calls complete)
                // Note: Puppeteer doesn't have waitForLoadState, so we'll just wait longer
                // The network response handler will capture AJAX calls
                
                // Wait additional time for any remaining JS execution
                await new Promise(resolve => setTimeout(resolve, 8000));
                
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
                
                // Wait a bit more for any remaining dynamic content
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                html = await this.page.content();
                
                // Check if any of the network responses contain checklist data
                if (networkResponses.length > 0) {
                    console.log(`📡 Found ${networkResponses.length} network responses, checking for checklist data...`);
                    for (const resp of networkResponses) {
                        // Check if this looks like checklist HTML
                        if (resp.content.includes('<tr') && resp.content.includes('td')) {
                            const $test = cheerio.load(resp.content);
                            const rowCount = $test('tr').length;
                            if (rowCount > 10) {
                                console.log(`✅ Found checklist data in network response: ${resp.url.substring(0, 80)} (${rowCount} rows, ${resp.length} chars)`);
                                html = resp.content;
                                break;
                            }
                        }
                    }
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
     * Fetch HTML with axios first, then browser fallback on 403
     */
    async fetchHtmlWithFallback(url, referer = null) {
        let html = null;
        try {
            const response = await axios.get(url, {
                headers: this.getDefaultHeaders(referer || this.baseUrl + '/'),
                timeout: 20000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });
            html = response.data;
            return html;
        } catch (axiosError) {
            if (axiosError.response && axiosError.response.status === 403) {
                console.log('⚠️ Axios request blocked (403), trying browser fallback...');
                html = await this.fetchWithBrowser(url);
                return html;
            }
            throw axiosError;
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

            // Try to construct URL - TCDB might use different patterns
            // TCDB checklists are typically at ViewSet.cfm with sid parameter
            let url = `${this.baseUrl}/ViewSet.cfm/sid/${setId}`;
            
            // Also try the ViewAll pattern as fallback
            const alternativeUrl = sport && year 
                ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}/set/${setId}`
                : null;

            console.log(`🔍 Fetching checklist for set ${setId}: ${url}`);
            
            const refererUrl = sport && year 
                ? `${this.baseUrl}/ViewAll.cfm/sp/${encodeURIComponent(sport)}/year/${year}`
                : this.baseUrl + '/';
            
            let html = await this.fetchHtmlWithFallback(url, refererUrl);
            let $ = cheerio.load(html);
            let cards = [];
            
            // Parse the first URL
            // (cards will be populated by extractCardInfo below)
            
            // If we got HTML but no cards, and we have an alternative URL, try it
            if (cards.length === 0 && alternativeUrl) {
                console.log(`⚠️ No cards found with ViewSet.cfm, trying alternative URL: ${alternativeUrl}`);
                html = await this.fetchHtmlWithFallback(alternativeUrl, refererUrl);
                // Re-parse with the new HTML
                $ = cheerio.load(html);
                cards = []; // Reset cards array
            }

            const extractCardInfo = ($row, indexFallback = null) => {
                const $cells = $row.find('td');
                if ($cells.length === 0) return false;

                let number = $cells.eq(0).text().trim();
                let nameCellIndex = $cells.length > 1 ? 1 : 0;
                let nameText = $cells.eq(nameCellIndex).text().trim();

                const normalizedNumber = number.replace(/[^a-z0-9]/gi, '').toLowerCase();
                const normalizedName = nameText.replace(/\s+/g, ' ').trim().toLowerCase();
                const headerNumbers = new Set(['', '#', 'no', 'no.', 'card', 'checklist', 'card#']);
                const headerNames = new Set(['player', 'name', 'card', 'team', 'event', 'checklist']);

                if (headerNumbers.has(normalizedNumber) || headerNames.has(normalizedName)) {
                    return false;
                }

                if (!number && indexFallback !== null) {
                    number = (indexFallback + 1).toString();
                }
                if (!nameText) return false;

                const $link = $cells.eq(nameCellIndex).find('a').first();
                const player = $link.length > 0 ? $link.text().trim() : nameText;

                let cardLink = $link.attr('href') || null;
                let tcdbCardId = null;
                if (cardLink) {
                    const idMatch = cardLink.match(/tid\/(\d+)|cardId=(\d+)|cid\/(\d+)|pid\/(\d+)/i);
                    if (idMatch) {
                        tcdbCardId = idMatch[1] || idMatch[2] || idMatch[3] || idMatch[4];
                    }
                    if (!cardLink.startsWith('http')) {
                        cardLink = `${this.baseUrl}${cardLink.startsWith('/') ? '' : '/'}${cardLink}`;
                    }
                }

                cards.push({
                    number: number || '',
                    name: nameText,
                    player,
                    tcdbId: tcdbCardId,
                    url: cardLink
                });
                return true;
            };

            // Look for card rows in tables - TCDB typically displays checklist in tables
            // Try all tables, not just the first one
            $('table').each((tableIndex, tableElement) => {
                const $table = $(tableElement);
                const $rows = $table.find('tr');
                console.log(`   - Table ${tableIndex + 1}: ${$rows.length} rows`);
                
                $rows.each((index, element) => {
                    extractCardInfo($(element), index);
                });
            });

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

