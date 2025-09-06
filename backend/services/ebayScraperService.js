// Playwright removed to reduce deployment size - using direct HTTP only
const axios = require('axios');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.browser = null;
        this.context = null;
        this.page = null;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        this.currentUserAgent = 0;
    }

    /**
     * Get a random user agent to avoid detection
     */
    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }

    /**
     * Try direct HTTP request first as fallback
     */
    async tryDirectHttpRequest(searchUrl) {
        try {
            console.log('🌐 Trying direct HTTP request as fallback...');
            
            const response = await axios.get(searchUrl, {
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
                    'Upgrade-Insecure-Requests': '1',
                    'Referer': 'https://www.ebay.com/'
                },
                timeout: 30000
            });

            console.log(`✅ Direct HTTP request successful (${response.data.length} characters)`);
            return response.data;
            
        } catch (error) {
            console.log(`⚠️ Direct HTTP request failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Initialize the headless browser with Railway-compatible settings
     */
    async initializeBrowser() {
        console.log('ℹ️ Browser initialization skipped - using direct HTTP only');
        return true;
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
    buildSearchUrl(searchTerm, sport = null, expectedGrade = null, originalIsAutograph = false) {
        // Clean and encode the search term (preserve negative keywords properly)
        // Replace spaces with + but handle negative keywords specially
        const cleanTerm = searchTerm
            .replace(/[^\w\s\-]/g, ' ')  // Preserve hyphens for negative keywords
            .trim()
            .replace(/\s+/g, '+')        // Replace spaces with +
            .replace(/\+(-)/g, '+$1');   // Ensure negative keywords stay as "+-psa" format
        
        // Build the search URL with sold filter (don't encode + signs)
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}`;
        
        // Add filters for sold items (match working eBay format)
        searchUrl += '&_sacat=0&LH_Complete=1&LH_Sold=1';
        
        // Add graded card specific filters
        if (expectedGrade === 'PSA 10' || expectedGrade === 'PSA 9') {
            searchUrl += '&_oaa=1';       // Additional eBay filter for graded cards
            searchUrl += '&Graded=Yes';   // Only graded cards
            searchUrl += '&_dcat=261328'; // Sports trading card singles category
            searchUrl += '&rt=nc';        // Additional eBay filter
            
            // Add specific grade filter
            if (expectedGrade === 'PSA 10') {
                searchUrl += '&Grade=10';
            } else if (expectedGrade === 'PSA 9') {
                searchUrl += '&Grade=9';
            }
            
            // Add PSA as professional grader (URL encoded)
            searchUrl += '&Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529';
            
            // Add autographed filter based on card type
            if (originalIsAutograph) {
                searchUrl += '&Autographed=Yes';
            } else {
                searchUrl += '&Autographed=No';
            }
        } else if (expectedGrade === 'Raw') {
            // Add raw (non-graded) card specific filters
            searchUrl += '&_oaa=1';      // Additional eBay filter
            searchUrl += '&rt=nc';       // Additional eBay filter
            searchUrl += '&Graded=No';   // Explicitly exclude graded cards
            searchUrl += '&_dcat=261328'; // Sports trading card singles category
            
            // Add autographed filter based on card type
            if (originalIsAutograph) {
                searchUrl += '&Autographed=Yes';
            } else {
                searchUrl += '&Autographed=No';
            }
        }
        
        // Debug logging to see exact search terms and URLs
        console.log(`🔍 DEBUG - Original search term: "${searchTerm}"`);
        console.log(`🔍 DEBUG - Expected grade: "${expectedGrade}"`);
        console.log(`🔍 DEBUG - Cleaned search term: "${cleanTerm}"`);
        console.log(`🔍 DEBUG - Final search URL: ${searchUrl}`);
        
        // Add sport-specific category if provided (but not if we already added _dcat=261328)
        if (sport && !(expectedGrade === 'PSA 10' || expectedGrade === 'PSA 9' || expectedGrade === 'Raw')) {
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
     * Search for sold cards on eBay using headless browser with fallback
     */
    async searchSoldCards(searchTerm, sport = null, maxResults = 50, expectedGrade = null, originalIsAutograph = false, targetPrintRun = null) {
        try {
            console.log(`🔍 Searching eBay for sold cards: ${searchTerm}`);
            
            // Build search URL for sold listings
            const searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph);
            console.log(`🔍 Search URL: ${searchUrl}`);

            // Try direct HTTP request first (faster and less likely to be blocked)
            console.log('🌐 Trying direct HTTP request first...');
            const htmlContent = await this.tryDirectHttpRequest(searchUrl);
            
            if (htmlContent) {
                console.log('✅ Direct HTTP request successful, parsing HTML...');
                const results = this.parseHtmlForCards(htmlContent, maxResults, searchTerm, sport, expectedGrade, false, originalIsAutograph, targetPrintRun);
                
                if (results.length > 0) {
                    console.log(`✅ Found ${results.length} cards via direct HTTP request`);
                    return {
                        success: true,
                        searchTerm: searchTerm,
                        sport: sport,
                        totalResults: results.length,
                        results: results,
                        method: 'direct_http'
                    };
                } else {
                    console.log('⚠️ Direct HTTP request returned no results, trying headless browser...');
                }
            }

            // Browser fallback disabled - using direct HTTP only
            console.log('⚠️ Direct HTTP request failed, no browser fallback available');
            return {
                success: false,
                error: 'No results found via direct HTTP request',
                results: [],
                method: 'direct_http_failed'
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
     * Parse HTML content for card data using updated patterns for eBay's new structure
     */
    /**
     * Filter cards by grade to ensure accuracy
     */
    filterCardsByGrade(cards, expectedGrade) {
        if (!expectedGrade) return cards;
        
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            
            if (expectedGrade === 'PSA 10') {
                // Must contain "psa 10" or "psa-10" 
                return title.includes('psa 10') || title.includes('psa-10');
            } else if (expectedGrade === 'PSA 9') {
                // Must contain "psa 9" or "psa-9" but not "psa 10"
                return (title.includes('psa 9') || title.includes('psa-9')) && 
                       !title.includes('psa 10') && !title.includes('psa-10');
            } else if (expectedGrade === 'Raw') {
                // Must NOT contain any grading company terms (be more specific to avoid excluding raw condition descriptions)
                const gradingTerms = [
                    'psa', 'sgc', 'bgs', 'cgc', 'tag', 'beckett', 'hga', 'csg',
                    'graded', 'psa 10', 'psa 9', 'psa 8', 'gem mt', 'psa gem'
                ];
                return !gradingTerms.some(term => title.includes(term));
            }
            
            return true; // Default: no filtering
        });
    }

    /**
     * Filter cards to remove autographs from non-autograph searches
     */
    filterOutAutographs(cards, shouldRemoveAutos) {
        if (!shouldRemoveAutos) return cards;
        
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            const autoTerms = [
                'auto', 'autograph', 'autographed', 'signed', 'signature'
            ];
            return !autoTerms.some(term => title.includes(term));
        });
    }

    /**
     * Filter cards to match autograph status - if original is auto, keep autos; if not auto, exclude autos
     */
    filterByAutographStatus(cards, originalIsAutograph) {
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            const autoTerms = [
                'auto', 'autograph', 'autographed', 'signed', 'signature'
            ];
            const hasAuto = autoTerms.some(term => title.includes(term));
            
            // If original is autograph, keep autograph cards; if not, exclude them
            return originalIsAutograph ? hasAuto : !hasAuto;
        });
    }

    /**
     * Filter cards to match print run - only keep cards with same print run
     */
    filterByPrintRun(cards, targetPrintRun) {
        return cards.filter(card => {
            const title = card.title.toLowerCase();
            
            // Look for print run patterns like /50, /99, /199, etc.
            const printRunPattern = /\/(\d+)/g;
            const matches = title.match(printRunPattern);
            
            if (!targetPrintRun) {
                // If target has no print run, only keep cards with no print run (base cards only)
                return !matches;
            }
            
            if (!matches) {
                // If target has print run but card doesn't, exclude it
                return false;
            }
            
            // Both have print runs - must match exactly
            return matches.some(match => {
                const foundPrintRun = match.toLowerCase();
                return foundPrintRun === targetPrintRun.toLowerCase();
            });
        });
    }

    parseHtmlForCards(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            console.log('🔍 Parsing HTML for card data with updated patterns...');
            const results = [];
            
            // Look for the new eBay structure - item IDs and data
            const itemIdPattern = /"itemId":(\d+)/g;
            const itemIds = [];
            let match;
            
            while ((match = itemIdPattern.exec(html)) !== null) {
                itemIds.push(match[1]);
            }
            
            console.log(`🔍 Found ${itemIds.length} item IDs in HTML`);
            
            // Look for image URLs (these are easier to find)
            const imagePattern = /https:\/\/i\.ebayimg\.com\/images\/g\/[^"]+\.jpg/g;
            const images = html.match(imagePattern) || [];
            
            console.log(`🔍 Found ${images.length} image URLs in HTML`);
            
            // Look for prices (try multiple patterns)
            const pricePatterns = [
                /\$[\d,]+\.?\d*/g,
                /[\$£€]?[\d,]+\.?\d*/g
            ];
            
            let prices = [];
            for (const pattern of pricePatterns) {
                const found = html.match(pattern) || [];
                prices = prices.concat(found);
            }
            
            // Remove duplicates and filter out non-price numbers
            prices = [...new Set(prices)].filter(price => {
                const num = parseFloat(price.replace(/[\$,]/g, ''));
                return num > 1 && num < 10000; // Reasonable card price range
            });
            
            console.log(`🔍 Found ${prices.length} potential prices in HTML`);
            
            // Look for REAL card titles - search for text that looks like card titles
            // Enhanced patterns to get actual card titles
            const titlePatterns = [
                // Modern eBay item title patterns (updated 2024)
                /<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/span>/gi,
                /<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/gi,
                /<h3[^>]*class="[^"]*it-ttl[^"]*"[^>]*>([^<]+)<\/h3>/gi,
                // Link titles with actual card names  
                /<a[^>]*title="([^"]{20,200})"[^>]*>/gi,
                /<a[^>]*aria-label="([^"]{20,200})"[^>]*>/gi,
                // Updated JSON patterns for modern eBay
                /"title":"([^"]{15,200})"/gi,
                /"name":"([^"]{15,150})"/gi,
                /"listingTitle":"([^"]{15,200})"/gi,
                // Card-specific content patterns
                />([\w\s\d#\/\-]{15,150}(?:2024|2023|2022)[\w\s\d#\/\-]{5,100}(?:Bowman|Topps|Prizm|Chrome|Draft|PSA|SGC|BGS)[\w\s\d#\/\-]{5,100})</gi,
                // Look for Griffin or other player names
                />([\w\s\d#\/\-]{10,150}(?:Griffin|Konnor)[\w\s\d#\/\-]{10,150}(?:Bowman|Chrome|Draft|Sapphire|Refractor)[\w\s\d#\/\-]{5,100})</gi,
                // General card patterns
                />([^<]{15,150}(?:Bowman|Topps|Prizm|Select|Chrome|Draft)[\w\s\d#\/\-]{10,150})</gi
            ];
            
            let titles = [];
            console.log(`🔍 Trying ${titlePatterns.length} title patterns...`);
            
            for (let i = 0; i < titlePatterns.length; i++) {
                const pattern = titlePatterns[i];
                const found = html.match(pattern) || [];
                console.log(`   Pattern ${i + 1}: Found ${found.length} matches`);
                
                if (found.length > 0) {
                    console.log(`   First match: ${found[0].substring(0, 100)}...`);
                }
                
                // Extract and clean the actual title text
                const extractedTitles = found.map(match => {
                    // Try different extraction methods
                    let title = '';
                    
                    // For HTML tag matches, extract content between > and <
                    const htmlMatch = match.match(/[>]([^<]+)[<]/);
                    if (htmlMatch) {
                        title = htmlMatch[1].trim();
                    } else {
                        // For quoted matches, extract the quoted content
                        const quotedMatch = match.match(/"([^"]+)"/);
                        if (quotedMatch) {
                            title = quotedMatch[1].trim();
                        } else {
                            // Fallback: remove all HTML and quotes
                            title = match.replace(/<[^>]*>/g, '').replace(/['"]/g, '').trim();
                        }
                    }
                    
                    // Clean up the title
                    title = title
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/\+/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    return title;
                }).filter(title => {
                    return title.length > 15 && 
                           title.length < 200 &&
                           !title.includes('Shop on eBay') &&
                           !title.includes('Your shopping destination') &&
                           !title.includes('electronics and accessories') &&
                           !title.includes('sponsored') &&
                           // Must contain card-related terms
                           (title.toLowerCase().includes('psa') ||
                            title.toLowerCase().includes('sgc') ||
                            title.toLowerCase().includes('bgc') ||
                            title.toLowerCase().includes('bowman') ||
                            title.toLowerCase().includes('topps') ||
                            title.toLowerCase().includes('prizm') ||
                            title.toLowerCase().includes('select') ||
                            title.toLowerCase().includes('chrome') ||
                            title.toLowerCase().includes('draft') ||
                            title.toLowerCase().includes('card') ||
                            title.toLowerCase().includes('rookie') ||
                            title.toLowerCase().includes('auto'));
                });
                titles = titles.concat(extractedTitles);
            }
            
            // Remove duplicates and filter out non-card titles
            titles = [...new Set(titles)].filter(title => {
                const lowerTitle = title.toLowerCase();
                return title.length > 10 && 
                       title.length < 200 &&
                       !lowerTitle.includes('shop on ebay') &&
                       !lowerTitle.includes('sponsored') &&
                       !lowerTitle.includes('advertisement') &&
                       (lowerTitle.includes('card') || 
                        lowerTitle.includes('psa') || 
                        lowerTitle.includes('bowman') || 
                        lowerTitle.includes('topps') ||
                        lowerTitle.includes('prizm') ||
                        lowerTitle.includes('select') ||
                        lowerTitle.includes('upper deck') ||
                        lowerTitle.includes('pokemon') ||
                        lowerTitle.includes('football') ||
                        lowerTitle.includes('basketball') ||
                        lowerTitle.includes('hockey') ||
                        lowerTitle.includes('soccer') ||
                        lowerTitle.includes('baseball'));
            });
            
            console.log(`🔍 Found ${titles.length} potential card titles in HTML`);
            
            // If we still don't have good titles, try to extract from the search term context
            if (titles.length === 0 && searchTerm) {
                console.log(`🔍 No titles found, trying to extract from search term: ${searchTerm}`);
                // Look for text that contains parts of the search term
                const searchWords = searchTerm.split(' ').filter(word => word.length > 2);
                const contextPattern = new RegExp(`([^<>]{20,150}${searchWords.join('[^<>]*')}[^<>]{20,150})`, 'gi');
                const contextMatches = html.match(contextPattern) || [];
                
                titles = contextMatches.map(match => {
                    // Clean up the extracted text
                    return match.replace(/<[^>]*>/g, '')
                              .replace(/[^\w\s\-\.#]/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim()
                              .substring(0, 100);
                }).filter(title => title.length > 20);
                
                console.log(`🔍 Extracted ${titles.length} titles from search term context`);
            }
            
            // Try to extract structured data from eBay's JSON data instead of HTML scraping
            console.log(`🔍 DEBUG: Starting structured JSON extraction...`);
            console.log(`🔍 DEBUG: HTML length: ${html.length} characters`);
            
            // Try multiple JSON patterns to find eBay's data structure
            const jsonPatterns = [
                // Pattern 1: Original listingAuction format
                /"listingAuction":\s*{[^}]*"currentPrice":\s*{\s*"value":\s*([0-9.]+)[^}]*"convertedFromValue":\s*([0-9.]+)[^}]*}[^}]*"itemId":\s*"([^"]+)"[^}]*"title":\s*"([^"]+)"/gi,
                
                // Pattern 2: Alternative price format
                /"itemId":\s*"([^"]+)"[^}]*"title":\s*"([^"]+)"[^}]*"price":\s*{\s*"value":\s*([0-9.]+)/gi,
                
                // Pattern 3: Simple price-title-itemId format
                /"price":\s*"?\$?([0-9,.]+)"?[^}]*"title":\s*"([^"]+)"[^}]*"itemId":\s*"([^"]+)"/gi,
                
                // Pattern 4: Sold listing format
                /"soldPrice":\s*"?\$?([0-9,.]+)"?[^}]*"title":\s*"([^"]+)"[^}]*"itemId":\s*"([^"]+)"/gi,
                
                // Pattern 5: Look for our specific item 365770463030
                /"itemId":\s*"365770463030"[^}]*"title":\s*"([^"]+)"[^}]*(?:"price"|"soldPrice"|"currentPrice").*?([0-9.]+)/gi
            ];
            
            const jsonResults = [];
            
            for (let i = 0; i < jsonPatterns.length; i++) {
                console.log(`🔍 DEBUG: Trying JSON pattern ${i + 1}...`);
                const pattern = jsonPatterns[i];
                
                let jsonMatch;
                let patternResults = [];
                
                while ((jsonMatch = pattern.exec(html)) !== null) {
                    console.log(`🔍 DEBUG: Pattern ${i + 1} match:`, jsonMatch.slice(0, 5));
                    
                    let title, price, itemId;
                    
                    if (i === 0) { // Original pattern
                        const [, currentPrice, convertedPrice, id, t] = jsonMatch;
                        title = t;
                        price = parseFloat(currentPrice || convertedPrice);
                        itemId = id;
                    } else if (i === 1) { // Alternative
                        const [, id, t, p] = jsonMatch;
                        title = t;
                        price = parseFloat(p);
                        itemId = id;
                    } else if (i === 2 || i === 3) { // Simple formats
                        const [, p, t, id] = jsonMatch;
                        title = t;
                        price = parseFloat(p.replace(/,/g, ''));
                        itemId = id;
                    } else if (i === 4) { // Specific item
                        const [, t, p] = jsonMatch;
                        title = t;
                        price = parseFloat(p);
                        itemId = "365770463030";
                    }
                    
                    if (price > 1 && price < 50000 && title && title.length > 10) {
                        const result = {
                            title: title.replace(/\\"/g, '"').replace(/&quot;/g, '"'),
                            price: `$${price.toFixed(2)}`,
                            numericPrice: price,
                            itemId: itemId,
                            source: `structured_json_pattern_${i + 1}`
                        };
                        patternResults.push(result);
                        
                        // Special logging for our problem item
                        if (itemId === "365770463030") {
                            console.log(`🎯 DEBUG: Found target item 365770463030 with pattern ${i + 1}:`, result);
                        }
                    }
                }
                
                console.log(`🔍 DEBUG: Pattern ${i + 1} found ${patternResults.length} results`);
                jsonResults.push(...patternResults);
            }
            
            console.log(`🔍 DEBUG: Total structured JSON results: ${jsonResults.length}`);
            
            // If we got structured data, use that; otherwise fall back to HTML parsing
            let finalResults = [];
            
            if (jsonResults.length > 0) {
                // Use structured JSON data (more reliable)
                finalResults = jsonResults.slice(0, maxResults).map(item => ({
                    title: item.title,
                    price: item.price,
                    numericPrice: item.numericPrice,
                    soldDate: 'Recently sold',
                    condition: 'Unknown',
                    cardType: 'Unknown',
                    grade: null,
                    sport: sport || this.detectSportFromTitle(item.title, searchTerm || ''),
                    imageUrl: '',
                    itemUrl: item.itemId ? `https://www.ebay.com/itm/${item.itemId}` : '',
                    rawData: {
                        itemId: item.itemId,
                        source: 'structured_json',
                        foundTitles: jsonResults.length,
                        foundPrices: jsonResults.length
                    }
                }));
                console.log(`✅ Using ${finalResults.length} structured JSON results`);
            } else {
                // Fall back to section-based HTML parsing to keep title-price pairs together
                console.log(`⚠️ No structured data found, falling back to section-based HTML parsing`);
                
                // Try to find eBay listing containers and extract title-price pairs from each section
                const listingPatterns = [
                    // eBay search result item containers
                    /<div[^>]*class="[^"]*s-item[^"]*"[^>]*>(.*?)<\/div>/gis,
                    /<li[^>]*class="[^"]*srp-result[^"]*"[^>]*>(.*?)<\/li>/gis,
                    /<div[^>]*class="[^"]*it-row[^"]*"[^>]*>(.*?)<\/div>/gis
                ];
                
                console.log(`🔍 DEBUG: Trying section-based parsing...`);
                
                for (let patternIndex = 0; patternIndex < listingPatterns.length; patternIndex++) {
                    const pattern = listingPatterns[patternIndex];
                    const sections = html.match(pattern) || [];
                    
                    console.log(`🔍 DEBUG: Pattern ${patternIndex + 1} found ${sections.length} sections`);
                    
                    if (sections.length > 0) {
                        // Process each section to extract title-price pairs
                        console.log(`🔍 DEBUG: Processing ${sections.length} sections for title-price extraction...`);
                        
                        for (let i = 0; i < Math.min(maxResults, sections.length); i++) {
                            const section = sections[i];
                            console.log(`🔍 DEBUG: Processing section ${i + 1}/${sections.length} (${section.length} chars)`);
                            
                            // Extract itemId from this section
                            const itemIdMatches = [
                                /(?:itemId|\/itm\/)[":\s]*(\d+)/,
                                /itm\/(\d+)/,
                                /"itemId":"(\d+)"/,
                                /data-itemid="(\d+)"/i
                            ];
                            
                            let itemId = null;
                            for (const pattern of itemIdMatches) {
                                const match = section.match(pattern);
                                if (match) {
                                    itemId = match[1];
                            break;
                          }
                            }
                            console.log(`🔍 DEBUG: Section ${i + 1} itemId: ${itemId || 'not found'}`);
                            
                            // Extract title from this section with enhanced patterns
                            const titlePatterns = [
                                // HTML element patterns
                                /<h3[^>]*>([^<]+)</i,
                                /<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</i,
                                /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</a>/i,
                                
                                // Attribute patterns
                                /title="([^"]{15,200})"/i,
                                /aria-label="([^"]{15,200})"/i,
                                /alt="([^"]{15,200})"/i,
                                
                                // Text patterns with card keywords
                                />([^<]{15,200}(?:Bowman|Topps|Prizm|Chrome|Draft|PSA|SGC|Konnor|Griffin)[\w\s\d#\/\-]{10,150})</i,
                                />([^<]{15,200}(?:2024|2023|2022)[\w\s\d#\/\-]{10,150}(?:Bowman|Chrome|Draft)[\w\s\d#\/\-]{5,100})</i,
                                
                                // JSON patterns
                                /"title":"([^"]{15,200})"/i,
                                /"name":"([^"]{15,150})"/i
                            ];
                            
                            let title = null;
                            let titlePattern = null;
                            for (let tp = 0; tp < titlePatterns.length; tp++) {
                                const titleMatch = section.match(titlePatterns[tp]);
                                if (titleMatch && titleMatch[1] && titleMatch[1].length > 10) {
                                    title = titleMatch[1].trim()
                                        .replace(/\s+/g, ' ')
                                        .replace(/&quot;/g, '"')
                                        .replace(/&#39;/g, "'")
                                        .replace(/&amp;/g, '&');
                                    titlePattern = tp + 1;
                            break;
                          }
                            }
                            console.log(`🔍 DEBUG: Section ${i + 1} title: "${title ? title.substring(0, 60) + '...' : 'not found'}" (pattern ${titlePattern || 'none'})`);
                            
                            // Extract price from this same section with enhanced patterns
                            const pricePatterns = [
                                // Standard price patterns
                                /\$[\d,]+\.?\d*/g,
                                /[\$£€][\d,]+\.?\d*/g,
                                
                                // Specific price element patterns
                                /class="[^"]*price[^"]*"[^>]*>[\s]*\$?([\d,]+\.?\d*)/i,
                                /class="[^"]*amount[^"]*"[^>]*>[\s]*\$?([\d,]+\.?\d*)/i,
                                
                                // JSON price patterns
                                /"price":"?\$?([\d,]+\.?\d*)"/i,
                                /"amount":"?\$?([\d,]+\.?\d*)"/i,
                                /"value":([\d,]+\.?\d*)/i
                            ];
                            
                            let price = null;
                            let pricePattern = null;
                            for (let pp = 0; pp < pricePatterns.length; pp++) {
                                const priceMatches = section.match(pricePatterns[pp]);
                                if (priceMatches) {
                                    for (const priceMatch of priceMatches) {
                                        const cleanPrice = priceMatch.replace(/[^\d.]/g, '');
                                        const numericValue = parseFloat(cleanPrice);
                                        if (numericValue > 1 && numericValue < 50000) {
                                            price = `$${numericValue.toFixed(2)}`;
                                            pricePattern = pp + 1;
                              break;
                            }
                          }
                                    if (price) break;
                                }
                            }
                            console.log(`🔍 DEBUG: Section ${i + 1} price: "${price || 'not found'}" (pattern ${pricePattern || 'none'})`);
                            
                            // Lower validation requirements and create result if we have title and either price or itemId
                            if (title && title.length > 10 && (price || itemId)) {
                                const numericPrice = price ? parseFloat(price.replace(/[\$,]/g, '')) : 0;
                                
                                // Special debug for our target item
                                if (itemId === "365770463030") {
                                    console.log(`🎯 DEBUG: Found target item 365770463030 in section ${i}:`);
                                    console.log(`🎯 DEBUG: - Title from section: "${title}"`);
                                    console.log(`🎯 DEBUG: - Price from section: "${price}"`);
                                    console.log(`🎯 DEBUG: - NumericPrice: ${numericPrice}`);
                                }
                                
                                const result = {
                                    title: title,
                                    price: price || 'Price not found',
                                    numericPrice: numericPrice,
                                    soldDate: 'Recently sold',
                                    condition: 'Unknown',
                                    cardType: 'Unknown',
                                    grade: null,
                                    sport: sport || this.detectSportFromTitle(title, searchTerm || ''),
                                    imageUrl: '',
                                    itemUrl: itemId ? `https://www.ebay.com/itm/${itemId}` : '',
                                    rawData: {
                                        itemId: itemId,
                                        source: `section_based_pattern_${patternIndex + 1}`,
                                        sectionIndex: i,
                                        foundFromSection: true
                                    }
                                };
                                
                                finalResults.push(result);
                            }
                        }
                        
                        // If we found results with this pattern, use them
                        if (finalResults.length > 0) {
                            console.log(`✅ Section-based parsing found ${finalResults.length} results with pattern ${patternIndex + 1}`);
                          break;
                        }
                      }
                    }
                
                // If section-based parsing failed, fall back to the old array method
                if (finalResults.length === 0) {
                    console.log(`⚠️ Section-based parsing failed, using array-based fallback`);
                    console.log(`🔍 DEBUG: HTML parsing arrays - titles: ${titles.length}, prices: ${prices.length}, itemIds: ${itemIds.length}`);
                    
                    for (let i = 0; i < Math.min(maxResults, Math.max(itemIds.length, titles.length, 5)); i++) {
                        const title = titles[i] || `Card ${i + 1} - ${searchTerm || 'Unknown'}`;
                        const price = prices[i] || 'Price not found';
                        const numericPrice = prices[i] ? parseFloat(prices[i].replace(/[\$,]/g, '')) : 0;
                        
                        const result = {
                            title: title,
                            price: price,
                            numericPrice: numericPrice,
                            soldDate: 'Recently sold',
                            condition: 'Unknown',
                            cardType: 'Unknown',
                            grade: null,
                            sport: sport || this.detectSportFromTitle(title, searchTerm || ''),
                            imageUrl: '',
                            itemUrl: itemIds[i] ? `https://www.ebay.com/itm/${itemIds[i]}` : '',
                            rawData: {
                                itemId: itemIds[i] || null,
                                source: 'array_based_fallback',
                                foundTitles: titles.length,
                                foundPrices: prices.length
                            }
                        };
                        
                        finalResults.push(result);
                    }
                }
                
                console.log(`🔍 Created ${finalResults.length} results from HTML parsing fallback`);
            }
            
            // Apply grade filtering to final results
            let filteredResults = this.filterCardsByGrade(finalResults, expectedGrade);
            if (expectedGrade) {
                console.log(`🔍 Grade filtering (${expectedGrade}): ${finalResults.length} → ${filteredResults.length} results`);
            }
            
            // Apply autograph status filtering (match original card's auto status)
            const beforeAutoFilter = filteredResults.length;
            filteredResults = this.filterByAutographStatus(filteredResults, originalIsAutograph);
            if (beforeAutoFilter !== filteredResults.length) {
                console.log(`🔍 Auto status filtering (${originalIsAutograph ? 'keep autos' : 'exclude autos'}): ${beforeAutoFilter} → ${filteredResults.length} results`);
            }
            
            // Apply print run filtering
            const beforePrintRunFilter = filteredResults.length;
            filteredResults = this.filterByPrintRun(filteredResults, targetPrintRun);
            if (targetPrintRun && beforePrintRunFilter !== filteredResults.length) {
                console.log(`🔍 Print run filtering (${targetPrintRun}): ${beforePrintRunFilter} → ${filteredResults.length} results`);
            }
            
            // Legacy autograph filtering (for backward compatibility)
            filteredResults = this.filterOutAutographs(filteredResults, shouldRemoveAutos);
            if (shouldRemoveAutos) {
                console.log(`🔍 Legacy auto filtering: ${results.length} → ${filteredResults.length} results`);
            }
            
            return filteredResults;
            
        } catch (error) {
            console.error('❌ Error parsing HTML:', error.message);
            return [];
        }
    }

    /**
     * Detect sport from title and search term
     */
    detectSportFromTitle(title, searchTerm) {
        const text = `${title} ${searchTerm}`.toLowerCase();
        
        if (text.includes('football') || text.includes('nfl')) return 'football';
        if (text.includes('basketball') || text.includes('nba')) return 'basketball';
        if (text.includes('hockey') || text.includes('nhl')) return 'hockey';
        if (text.includes('soccer') || text.includes('mls')) return 'soccer';
        if (text.includes('pokemon') || text.includes('tcg')) return 'pokemon';
        if (text.includes('baseball') || text.includes('mlb')) return 'baseball';
        
        // Default to baseball only if we're confident
        return 'unknown';
    }

    /**
     * Extract data from a single item's HTML
     */
    extractItemDataFromHtml(itemHtml) {
        try {
            // Extract title
            const titleMatch = itemHtml.match(/<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/span>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';
            
            // Skip "Shop on eBay" items
            if (!title || title === 'Shop on eBay' || title.includes('Shop on eBay')) {
                return null;
            }

            // Extract price
            const priceMatch = itemHtml.match(/<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([^<]+)<\/span>/i);
            const price = priceMatch ? priceMatch[1].trim() : '';
            
            // Extract sold date
            const soldMatch = itemHtml.match(/<span[^>]*class="[^"]*POSITIVE[^"]*"[^>]*>([^<]+)<\/span>/i);
            const soldDate = soldMatch ? soldMatch[1].trim() : '';
            
            // Extract condition
            const conditionMatch = itemHtml.match(/<span[^>]*class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([^<]+)<\/span>/i);
            const condition = conditionMatch ? conditionMatch[1].trim() : '';

                  // Extract image URL
            const imgMatch = itemHtml.match(/<img[^>]*class="[^"]*s-item__image-img[^"]*"[^>]*src="([^"]+)"/i);
            const imageUrl = imgMatch ? imgMatch[1] : '';

                  // Extract item URL
            const linkMatch = itemHtml.match(/<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*href="([^"]+)"/i);
            const itemUrl = linkMatch ? linkMatch[1] : '';

            // Parse price to numeric value
            const numericPrice = this.parsePrice(price);
            
            // Extract card details
            const cardDetails = this.extractCardDetails(title);
            
            // Determine card type and grade
            const cardType = this.determineCardType(title, condition);
            const grade = this.extractGrade(title, condition);

            return {
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

                } catch (error) {
            console.log(`⚠️ Error extracting item data: ${error.message}`);
            return null;
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