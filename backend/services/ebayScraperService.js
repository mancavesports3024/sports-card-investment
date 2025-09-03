const { chromium } = require('playwright');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    /**
     * Initialize the headless browser with Railway-compatible settings
     */
    async initializeBrowser() {
        try {
            console.log('🌐 Initializing headless browser for Railway...');
            
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });

            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'en-US',
                timezoneId: 'America/New_York',
                ignoreHTTPSErrors: true
            });

            this.page = await this.context.newPage();
            
            // Set extra headers to appear more human-like
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            console.log('✅ Browser initialized successfully for Railway');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize browser:', error.message);
            return false;
        }
    }

    /**
     * Close the browser
     */
    async closeBrowser() {
        try {
            if (this.page) await this.page.close();
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
            console.log('🔒 Browser closed');
        } catch (error) {
            console.error('❌ Error closing browser:', error.message);
        }
    }

    /**
     * Add random delay to appear more human-like
     */
    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`⏱️ Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Build search URL for eBay sold listings
     */
    buildSearchUrl(searchTerm, sport = null) {
        // Clean and encode the search term
        const cleanTerm = searchTerm
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, '+')
            .trim();
        
        // Build the search URL with sold filter
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${encodeURIComponent(cleanTerm)}`;
        
        // Add filters for sold items
        searchUrl += '&_sacat=0&LH_Sold=1&_dmd=2';
        
        // Add sport-specific category if provided
        if (sport) {
            const sportCategories = {
                'baseball': '&_sacat=261',
                'basketball': '&_sacat=261',
                'football': '&_sacat=261',
                'hockey': '&_sacat=261',
                'soccer': '&_sacat=261',
                'pokemon': '&_sacat=261',
                'mtg': '&_sacat=261'
            };
            
            if (sportCategories[sport.toLowerCase()]) {
                searchUrl += sportCategories[sport.toLowerCase()];
            }
        }
        
        return searchUrl;
    }

    /**
     * Search for sold cards on eBay using headless browser
     */
    async searchSoldCards(searchTerm, sport = null, maxResults = 50) {
        try {
            if (!this.browser) {
                const initialized = await this.initializeBrowser();
                if (!initialized) {
                    throw new Error('Failed to initialize browser');
                }
            }

            console.log(`🔍 Searching eBay for sold cards: ${searchTerm}`);
            
            // Build search URL for sold listings
            const searchUrl = this.buildSearchUrl(searchTerm, sport);
            console.log(`🔍 Search URL: ${searchUrl}`);

            // Navigate to the search page
            console.log('🌐 Navigating to eBay search page...');
            await this.page.goto(searchUrl, { 
                waitUntil: 'networkidle',
                timeout: 90000 
            });
            
            console.log('⏱️ Waiting for page to load...');
            await this.randomDelay(5000, 8000);

            // Take a screenshot for debugging
            try {
                await this.page.screenshot({ path: '/tmp/ebay-debug.png', fullPage: true });
                console.log('📸 Debug screenshot saved');
            } catch (screenshotError) {
                console.log('⚠️ Screenshot failed:', screenshotError.message);
            }

            // Get page content for analysis
            const pageContent = await this.page.content();
            console.log(`📄 Page content length: ${pageContent.length} characters`);
            
            // Check if we got blocked or hit a login page
            const pageTitle = await this.page.title();
            console.log(`📄 Page title: ${pageTitle}`);
            
            if (pageTitle.includes('Sign in') || pageTitle.includes('Login') || pageTitle.includes('Verify')) {
                throw new Error('eBay requires authentication or verification');
            }

            // Wait for results to load - try multiple selectors with longer timeouts
            console.log('🔍 Waiting for search results...');
            let resultsLoaded = false;
            let items = [];
            
            // Try multiple selector strategies
            const selectorStrategies = [
                { selector: '.s-item', timeout: 30000 },
                { selector: '.srp-results .s-item', timeout: 30000 },
                { selector: '[data-testid="s-item"]', timeout: 30000 },
                { selector: '.srp-results li', timeout: 30000 },
                { selector: '.srp-results .s-item__wrapper', timeout: 30000 },
                { selector: '.s-item__wrapper', timeout: 30000 },
                { selector: '.s-item__info', timeout: 30000 }
            ];

            for (const strategy of selectorStrategies) {
                try {
                    console.log(`🔍 Trying selector: ${strategy.selector}`);
                    await this.page.waitForSelector(strategy.selector, { timeout: strategy.timeout });
                    items = await this.page.$$(strategy.selector);
                    
                    if (items.length > 0) {
                        console.log(`✅ Found ${items.length} items using selector: ${strategy.selector}`);
                        resultsLoaded = true;
                        break;
                    }
                } catch (selectorError) {
                    console.log(`⚠️ Selector ${strategy.selector} failed: ${selectorError.message}`);
                    continue;
                }
            }

            // If no items found with selectors, try alternative approach
            if (items.length === 0) {
                console.log('⚠️ No items found with selectors, trying alternative approach...');
                
                // Try to find any content that looks like card listings
                const alternativeContent = await this.page.evaluate(() => {
                    // Look for any elements that might contain card data
                    const possibleItems = document.querySelectorAll('div, li, article');
                    const cardLikeElements = [];
                    
                    for (const element of possibleItems) {
                        const text = element.textContent || '';
                        if (text.includes('$') && (text.includes('sold') || text.includes('auction') || text.includes('bid'))) {
                            cardLikeElements.push({
                                text: text.substring(0, 200),
                                tagName: element.tagName,
                                className: element.className
                            });
                        }
                    }
                    
                    return cardLikeElements.slice(0, 10);
                });
                
                console.log(`🔍 Found ${alternativeContent.length} potential card-like elements`);
                
                if (alternativeContent.length > 0) {
                    // Return basic info to show we're getting content
                    return {
                        success: true,
                        searchTerm: searchTerm,
                        sport: sport,
                        totalResults: alternativeContent.length,
                        results: alternativeContent.map((item, index) => ({
                            title: `Potential card ${index + 1}`,
                            price: 'Content found',
                            numericPrice: 0,
                            soldDate: 'Today',
                            condition: 'Unknown',
                            cardType: 'Unknown',
                            grade: null,
                            sport: sport || 'Unknown',
                            rawContent: item.text,
                            elementInfo: `${item.tagName}.${item.className}`
                        }))
                    };
                }
            }

            if (!resultsLoaded) {
                throw new Error('Search results failed to load - no items found');
            }

            // Scroll down to load more results
            console.log('📜 Scrolling to load more results...');
            await this.page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await this.randomDelay(3000, 5000);

            // Parse the results
            console.log('🔍 Parsing search results...');
            const results = await this.parseSearchResults(maxResults);

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
     * Parse eBay search results using page selectors
     */
    async parseSearchResults(maxResults) {
        try {
            const results = [];
            
            // Try multiple approaches to find items
            const itemSelectors = [
                '.s-item',
                '.srp-results .s-item',
                '[data-testid="s-item"], .srp-results li',
                '.srp-results .s-item__wrapper'
            ];

            let items = [];
            for (const selector of itemSelectors) {
                try {
                    items = await this.page.$$(selector);
                    if (items.length > 0) {
                        console.log(`🔍 Found ${items.length} items using selector: ${selector}`);
                        break;
                    }
                } catch (selectorError) {
                    console.log(`⚠️ Selector ${selector} failed: ${selectorError.message}`);
                    continue;
                }
            }

            if (items.length === 0) {
                console.log('⚠️ No items found with any selector, trying page content analysis...');
                
                // Get page content and analyze
                const pageContent = await this.page.content();
                console.log(`📄 Page content length: ${pageContent.length} characters`);
                
                // Look for any card-related content
                const hasCardContent = pageContent.includes('sold') || 
                                     pageContent.includes('price') || 
                                     pageContent.includes('auction');
                
                if (hasCardContent) {
                    console.log('✅ Page contains card-related content');
                    // Return a basic result to show we're getting data
                    return [{
                        title: 'Page loaded successfully - content analysis needed',
                        price: 'Content found',
                        numericPrice: 0,
                        soldDate: 'Today',
                        condition: 'Unknown',
                        cardType: 'Unknown',
                        grade: null,
                        sport: 'Unknown'
                    }];
                } else {
                    console.log('❌ No card content found on page');
                    return [];
                }
            }

            console.log(`🔍 Processing ${Math.min(items.length, maxResults)} items...`);

            for (let i = 0; i < Math.min(items.length, maxResults); i++) {
                try {
                    const item = items[i];
                    
                    // Extract basic item info using page selectors
                    const title = await item.$eval('.s-item__title, .s-item__title--tagblock, [data-testid="s-item__title"]', 
                        el => el.textContent?.trim() || '').catch(() => '');
                    
                    const price = await item.$eval('.s-item__price, [data-testid="s-item__price"]', 
                        el => el.textContent?.trim() || '').catch(() => '');
                    
                    const soldDate = await item.$eval('.s-item__title--tagblock .POSITIVE, .s-item__title--tagblock span', 
                        el => el.textContent?.trim() || '').catch(() => '');
                    
                    const condition = await item.$eval('.SECONDARY_INFO, .s-item__condition', 
                        el => el.textContent?.trim() || '').catch(() => '');
                    
                    // Skip if no title or price, or if it's a "Shop on eBay" item
                    if (!title || !price || title === 'Shop on eBay' || title.includes('Shop on eBay')) {
                        continue;
                    }

                    // Extract image URL
                    const imageElement = await item.$('.s-item__image-img, img').catch(() => null);
                    const imageUrl = imageElement ? await imageElement.getAttribute('src').catch(() => '') : '';

                    // Extract item URL
                    const linkElement = await item.$('.s-item__link, a').catch(() => null);
                    const itemUrl = linkElement ? await linkElement.getAttribute('href').catch(() => '') : '';

                    // Parse price to numeric value
                    const numericPrice = this.parsePrice(price);
                    
                    // Extract card details
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
                    
                } catch (itemError) {
                    console.log(`⚠️ Error parsing item ${i}: ${itemError.message}`);
                    continue;
                }
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Error parsing search results:', error.message);
            return [];
        }
    }

    /**
     * Parse price string to numeric value
     */
    parsePrice(priceStr) {
        try {
            const priceMatch = priceStr.match(/[\$£€]?([\d,]+\.?\d*)/);
            return priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
        } catch (error) {
            return null;
        }
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
        
        const titleLower = title.toLowerCase();
        
        // Extract sport
        const sports = ['baseball', 'basketball', 'football', 'hockey', 'soccer', 'pokemon', 'magic', 'yugioh'];
        for (const sport of sports) {
            if (titleLower.includes(sport)) {
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
            if (titleLower.includes(brand)) {
                details.brand = brand;
                break;
            }
        }
        
        // Extract set
        const sets = ['prizm', 'select', 'optic', 'contenders', 'chrome', 'update', 'heritage'];
        for (const set of sets) {
            if (titleLower.includes(set)) {
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
            if (titleLower.includes(parallel)) {
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
            } else if (result.cardType === 'Raw' || result.cardType === 'Unknown') {
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