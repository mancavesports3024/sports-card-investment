const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
        this.currentUserAgent = 0;
        
        // ProxyMesh configuration - only use authorized server for basic plan
        this.proxyServers = [
            'us-ca.proxymesh.com:31280'  // Only server authorized for basic plan
        ];
        this.currentProxyIndex = 0;
        this.useProxy = process.env.PROXYMESH_USERNAME && process.env.PROXYMESH_PASSWORD;
        
        if (this.useProxy) {
            console.log('🌐 ProxyMesh enabled with', this.proxyServers.length, 'servers');
        }
    }

    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
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

    buildSearchUrl(searchTerm, sport = null, expectedGrade = null, originalIsAutograph = null, cardType = null) {
        // Clean and encode the search term (preserve negative keywords properly)
        const cleanTerm = searchTerm.replace(/[^\w\s\-\+]/g, ' ').replace(/\s+/g, '+');
        
        // Pokemon TCG cards use different category and structure with BLANK search term
        if (cardType && cardType.toLowerCase().includes('pokemon tcg')) {
            let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=&_sacat=183454&_from=R40&_sasl=comc_consignment%2C+dcsports87%2C+probstein123%2C+5_star_cards&LH_PrefLoc=1&_saslop=2&_oaa=1&Game=Pok%25C3%25A9mon%2520TCG&LH_Complete=1&LH_Sold=1`;
            
            // Add grade-specific parameters for Pokemon
            if (expectedGrade === 'PSA 10' || expectedGrade === 'PSA 9') {
                searchUrl += '&Graded=Yes&_dcat=183454';
                
                if (expectedGrade === 'PSA 10') {
                    searchUrl += '&Grade=10';  // Pokemon PSA 10s
                } else {
                    searchUrl += '&Grade=9';   // Pokemon PSA 9s
                }
                searchUrl += '&Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529';
            } else if (expectedGrade === 'Raw') {
                searchUrl += '&Graded=No&_dcat=183454';  // Raw Pokemon cards
            }
            
            return searchUrl;
        }
        
        // Standard sports cards (non-Pokemon)
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1`;
        
        // Add grade-specific parameters
        if (expectedGrade === 'PSA 10' || expectedGrade === 'PSA 9') {
            searchUrl += '&Graded=Yes&_dcat=261328&rt=nc';
            
            if (expectedGrade === 'PSA 10') {
                searchUrl += '&Grade=10&_udlo=50&_udhi=5000';  // Price range for PSA 10s
            } else {
                searchUrl += '&Grade=9&_udlo=25&_udhi=2500';   // Price range for PSA 9s
            }
            searchUrl += '&Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529';
        } else if (expectedGrade === 'Raw') {
            searchUrl += '&rt=nc&Graded=No&_dcat=261328&_udlo=10&_udhi=1000';  // Price range for Raw
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

    async searchSoldCards(searchTerm, sport = null, maxResults = 50, expectedGrade = null, originalIsAutograph = null, targetPrintRun = null, cardType = null) {
        try {
            const searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType);
            console.log(`🔍 DEBUG - Search request: "${searchTerm}" (sport: ${sport}, cardType: ${cardType}, grade: ${expectedGrade}, maxResults: ${maxResults})`);
            console.log(`🔍 Search URL: ${searchUrl}`);
            
            // Compare with the working manual URL
            if (searchTerm === "2024 Topps Chrome" && sport === "Baseball" && expectedGrade === "PSA 10") {
                console.log(`🎯 MANUAL URL: https://www.ebay.com/sch/i.html?_nkw=2024+Topps+Chrome&_sacat=0&_from=R40&Graded=Yes&Grade=10&LH_Complete=1&LH_Sold=1&_udlo=50&_udhi=5000&rt=nc&Sport=Baseball&_dcat=261328`);
                console.log(`🎯 OUR URL:    ${searchUrl}`);
                console.log(`🔍 URL COMPARISON - Checking for differences...`);
            }
            
            // Make HTTP request with optional proxy
            const requestConfig = {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            };
            
            // Add proxy if configured
            const proxyAgent = this.getNextProxy();
            if (proxyAgent) {
                requestConfig.httpsAgent = proxyAgent;
                console.log('🌐 Using ProxyMesh server...');
            }
            
            // Retry logic for 402 errors
            let response;
            let attempt = 1;
            const maxAttempts = 3;
            
            while (attempt <= maxAttempts) {
                try {
                    response = await axios.get(searchUrl, requestConfig);
                    break; // Success, exit retry loop
                    
                } catch (error) {
                    if (error.response?.status === 402 && attempt < maxAttempts) {
                        console.log(`⚠️ 402 Payment Required (attempt ${attempt}/${maxAttempts}). Retrying in ${attempt * 5} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, attempt * 5000)); // Exponential backoff
                        
                        // Get a different proxy for retry
                        const newProxyAgent = this.getNextProxy();
                        if (newProxyAgent) {
                            requestConfig.httpsAgent = newProxyAgent;
                            console.log('🔄 Using different ProxyMesh server for retry...');
                        }
                        
                        attempt++;
                    } else {
                        throw error; // Re-throw if not 402 or max attempts reached
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
                
                const results = this.parseHtmlForCards(response.data, maxResults, searchTerm, sport, expectedGrade, false, originalIsAutograph, targetPrintRun);
                
                if (results.length > 0) {
                    console.log(`✅ Found ${results.length} cards via direct HTTP request`);
                    return {
                        success: true,
                        results: results,
                        method: 'direct_http'
                    };
                }
            }

            return {
                success: false,
                results: [],
                method: 'direct_http_failed'
            };

        } catch (error) {
            console.error('Error in searchSoldCards:', error.message);
            return {
                success: false,
                results: [],
                error: error.message
            };
        }
    }

    parseHtmlForCards(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            const finalResults = [];
            const maxResultsNum = parseInt(maxResults) || 50;
            
            console.log(`🔍 Parsing HTML for card data with proximity-based correlation...`);
            
            // Extract titles with positions using generic patterns for all searches
            const titleData = [];
            const workingTitlePatterns = [
                // 2024/2025 eBay HTML structure - modern span-based patterns
                /<span[^>]*>([^<]*(?:2024|2023|2022)[^<]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^<]*)</gi,
                /<span[^>]*>([^<]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^<]*(?:2024|2023|2022)[^<]*)</gi,
                // JSON-like data structures that eBay now uses
                /"title"\s*:\s*"([^"]*(?:2024|2023|2022)[^"]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^"]*)"/gi,
                /"([^"]*(?:2024|2023|2022)[^"]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^"]*(?:PSA|BGS|SGC|Raw)[^"]*)"/gi,
                // Alt attributes for images
                /alt\s*=\s*["']([^"']*(?:2024|2023|2022)[^"']*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^"']*)["']/gi,
                // Div content patterns (modern eBay structure)
                /<div[^>]*>([^<]*(?:2024|2023|2022)[^<]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^<]*)</gi,
                // Aria-label attributes
                /aria-label\s*=\s*["']([^"']*(?:2024|2023|2022)[^"']*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon|Panini)[^"']*)["']/gi,
                // Legacy patterns (keep for backward compatibility)
                /<h3[^>]*>([^<]+)<\/h3>/gi,
                /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi,
                />([^<]*(?:2024|2023)[^<]*(?:Topps|Chrome|Prizm|Select|Bowman|Pokemon)[^<]*)</gi
            ];
            
            for (let p = 0; p < workingTitlePatterns.length; p++) {
                const matches = [...html.matchAll(workingTitlePatterns[p])];
                matches.forEach(match => {
                    const title = match[1].trim().replace(/\s+/g, ' ');
                    if (title.length > 10) {
                        titleData.push({
                            title: title,
                            position: match.index
                        });
                    }
                });
            }
            
            // Extract prices with positions
            const priceData = [];
            const priceMatches = [...html.matchAll(/\$[\d,]+\.?\d*/g)];
            priceMatches.forEach(match => {
                const numericPrice = parseFloat(match[0].replace(/[^\d.,]/g, '').replace(/,/g, ''));
                if (!isNaN(numericPrice) && numericPrice >= 1 && numericPrice <= 10000) {
                    priceData.push({
                        price: match[0],
                        numericPrice: numericPrice,
                        position: match.index
                    });
                }
            });
            
            // Extract itemIds with positions
            const itemIdData = [];
            const itemIdMatches = [...html.matchAll(/(?:itm\/|item\/)(\d{10,})/g)];
            itemIdMatches.forEach(match => {
                itemIdData.push({
                    itemId: match[1],
                    position: match.index
                });
            });
            
            console.log(`🔍 Found ${titleData.length} titles, ${priceData.length} prices, ${itemIdData.length} itemIds`);
            
            // Debug specific searches
            if (searchTerm === "2024 Topps Chrome" || titleData.length === 0) {
                console.log(`🔍 PARSING DEBUG for "${searchTerm}":`);
                console.log(`   📄 HTML length: ${html.length} characters`);
                console.log(`   🔤 Title patterns tested: ${workingTitlePatterns.length}`);
                console.log(`   📝 Titles found: ${titleData.length}`);
                console.log(`   💰 Prices found: ${priceData.length}`);
                console.log(`   🆔 ItemIds found: ${itemIdData.length}`);
                
                if (titleData.length === 0) {
                    console.log(`❌ NO TITLES FOUND - This explains why search fails!`);
                    console.log(`🔍 Testing title patterns individually...`);
                    
                    for (let p = 0; p < workingTitlePatterns.length; p++) {
                        const matches = [...html.matchAll(workingTitlePatterns[p])];
                        console.log(`   Pattern ${p + 1}: Found ${matches.length} matches`);
                        if (matches.length > 0) {
                            console.log(`      First match: "${matches[0][1]?.substring(0, 100)}..."`);
                        }
                    }
                }
            }

            // Correlate by proximity within 2000 characters
            for (let i = 0; i < Math.min(maxResultsNum, titleData.length); i++) {
                const titleInfo = titleData[i];
                
                // Find closest price
                let closestPrice = null;
                let closestDistance = Infinity;
                priceData.forEach(priceInfo => {
                    const distance = Math.abs(titleInfo.position - priceInfo.position);
                    if (distance < 2000 && distance < closestDistance) {
                        closestPrice = priceInfo;
                        closestDistance = distance;
                    }
                });
                
                // Find closest itemId
                let closestItemId = null;
                itemIdData.forEach(itemInfo => {
                    const distance = Math.abs(titleInfo.position - itemInfo.position);
                    if (distance < 2000) {
                        closestItemId = itemInfo;
                    }
                });
                
                if (closestPrice) {
                    // Special logging for target item
                    if (closestItemId && closestItemId.itemId === '365770463030') {
                        console.log(`🎯 TARGET ITEM 365770463030: "${titleInfo.title}" = ${closestPrice.price} (distance: ${closestDistance})`);
                    }
                    
                    finalResults.push({
                        title: titleInfo.title,
                        price: closestPrice.price,
                        numericPrice: closestPrice.numericPrice,
                        itemUrl: closestItemId ? `https://www.ebay.com/itm/${closestItemId.itemId}` : '',
                        sport: this.detectSportFromTitle(titleInfo.title),
                        grade: expectedGrade || this.detectGradeFromTitle(titleInfo.title),
                        soldDate: 'Recently sold',
                        ebayItemId: closestItemId ? closestItemId.itemId : null
                    });
                }
            }
            
            console.log(`🔍 Created ${finalResults.length} results from proximity-based correlation`);
            
            // Apply filtering
            let filteredResults = this.filterCardsByGrade(finalResults, expectedGrade);
            if (expectedGrade) {
                console.log(`🔍 Grade filtering (${expectedGrade}): ${finalResults.length} → ${filteredResults.length} results`);
            }
            
            // Apply autograph status filtering
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
            
            return filteredResults;
        } catch (error) {
            console.error('Error in parseHtmlForCards:', error);
            return [];
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
                return !matches;
            } else {
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
        
        if (lowerTitle.includes('psa 10') || lowerTitle.includes('psa-10')) {
            return 'PSA 10';
        }
        if (lowerTitle.includes('psa 9') || lowerTitle.includes('psa-9')) {
            return 'PSA 9';
        }
        if (lowerTitle.includes('psa 8') || lowerTitle.includes('psa-8')) {
            return 'PSA 8';
        }
        
        return 'Raw';
    }
}

module.exports = EbayScraperService;
