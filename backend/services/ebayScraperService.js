const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
    }

    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }
    
    async warmUpSession() {
        if (this.warmedUp) return;
        
        try {
            console.log('🔥 Warming up session with eBay homepage...');
            const warmUpHeaders = {
                'User-Agent': this.getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            };
            
            const proxyAgent = this.getNextProxy();
            const config = { headers: warmUpHeaders, timeout: 30000 };
            if (proxyAgent) config.httpsAgent = proxyAgent;
            
            await axios.get(this.baseUrl, config);
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
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&_from=R40&LH_Complete=1&LH_Sold=1&rt=nc&_dcat=261328&_udlo=11&_udhi=3000`;
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
            // Warm up session first
            await this.warmUpSession();
            
            const searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph, cardType, season);
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
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0',
                    'Referer': 'https://www.ebay.com/',
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
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
                    // Rotate User-Agent each attempt
                    requestConfig.headers['User-Agent'] = this.getRandomUserAgent();
                    
                    // Add random delay between attempts
                    if (attempt > 1) {
                        const delay = 2000 + Math.random() * 3000; // 2-5 seconds
                        console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    response = await axios.get(searchUrl, requestConfig);
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
                
                const results = this.parseHtmlForCards(response.data, maxResults, searchTerm, sport, expectedGrade, false, originalIsAutograph, targetPrintRun);
                
                if (results.length > 0) {
                    console.log(`✅ Found ${results.length} cards via direct HTTP request`);
                    return {
                        success: true,
                        results: results,
                        method: 'direct_http',
                        searchUrl
                    };
                }
            }

            return {
                success: false,
                results: [],
                method: 'direct_http_failed',
                searchUrl
            };

        } catch (error) {
            console.error('Error in searchSoldCards:', error.message);
            return {
                success: false,
                results: [],
                error: error.message,
                searchUrl
            };
        }
    }

    parseHtmlForCards(html, maxResults, searchTerm = null, sport = null, expectedGrade = null, shouldRemoveAutos = false, originalIsAutograph = false, targetPrintRun = null) {
        try {
            const finalResults = [];
            const maxResultsNum = parseInt(maxResults) || 50;
            
            console.log(`🔍 Parsing HTML for card data with proximity-based correlation...`);
            
            // Extract titles with much broader patterns to capture all possible card titles
            const titleData = [];
            const workingTitlePatterns = [
                // JSON title fields
                /"title"\s*:\s*"([^"]+)"/gi,
                // Common eBay title containers
                /<h3[^>]*>([^<]+)<\/h3>/gi,
                /<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/gi,
                /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi,
                /<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/gi,
                // s-item patterns (eBay's standard)
                /<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/span>/gi,
                /<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*>([^<]+)<\/a>/gi,
                /<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/gi,
                // Generic patterns for any text that might be a title
                /<span[^>]*>([^<]{20,200})<\/span>/gi,
                /<div[^>]*>([^<]{20,200})<\/div>/gi,
                /<a[^>]*>([^<]{20,200})<\/a>/gi,
                // Alt text and aria labels
                /alt\s*=\s*["']([^"']{20,200})["']/gi,
                /aria-label\s*=\s*["']([^"']{20,200})["']/gi,
                // Data attributes
                /data-title\s*=\s*["']([^"']+)["']/gi,
                /data-name\s*=\s*["']([^"']+)["']/gi
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
            
            // Post-filter titles using query tokens (player/brand/code/print-run)
            const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\/#\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const qn = normalize(searchTerm);
            const baseTokens = qn.split(' ').filter(t => t && t.length > 2);
            const extraTokens = [];
            if (/bcp\s*-?\s*50/.test(qn)) extraTokens.push('bcp-50','bcp50','bcp 50');
            if (/\/?350/.test(qn) || /\b350\b/.test(qn)) extraTokens.push('/350','350');
            const anchorTokens = ['bowman','chrome','jesus','made'];
            const allTokens = Array.from(new Set([...baseTokens, ...extraTokens]));

            const scoredTitles = titleData.map(t => {
                const tn = normalize(t.title);
                let score = 0;
                allTokens.forEach(tok => { if (tok && tn.includes(tok)) score++; });
                const hasAnchor = anchorTokens.some(tok => tn.includes(tok));
                return { ...t, score, hasAnchor };
            });

            // More lenient filtering - accept titles with score >= 1 OR has anchor tokens
            const filteredTitleData = scoredTitles
                .filter(t => t.score >= 1 || t.hasAnchor)
                .map(({title, position}) => ({ title, position }));

            console.log(`🔍 Found ${titleData.length} titles (pre-filter), ${filteredTitleData.length} after token filter; ${priceData.length} prices, ${itemIdData.length} itemIds`);
            
            // Debug specific searches
            if (searchTerm.includes("Jesus Made") || titleData.length === 0) {
                console.log(`🔍 PARSING DEBUG for "${searchTerm}":`);
                console.log(`   📄 HTML length: ${html.length} characters`);
                console.log(`   🔤 Title patterns tested: ${workingTitlePatterns.length}`);
                console.log(`   📝 Titles found: ${titleData.length}`);
                console.log(`   📝 Filtered titles: ${filteredTitleData.length}`);
                console.log(`   💰 Prices found: ${priceData.length}`);
                console.log(`   🆔 ItemIds found: ${itemIdData.length}`);
                
                if (filteredTitleData.length > 0) {
                    console.log(`🔍 Sample filtered titles:`);
                    filteredTitleData.slice(0, 10).forEach((t, i) => {
                        console.log(`   ${i+1}. "${t.title}"`);
                    });
                }
                
                if (priceData.length > 0) {
                    console.log(`🔍 Sample prices:`);
                    priceData.slice(0, 10).forEach((p, i) => {
                        console.log(`   ${i+1}. ${p.price} (numeric: ${p.numericPrice})`);
                    });
                }
                
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
                
                // Look for specific patterns that should match
                console.log(`🔍 Looking for specific patterns in HTML...`);
                const jesusMatches = [...html.matchAll(/jesus made/gi)];
                console.log(`   "Jesus Made" mentions: ${jesusMatches.length}`);
                
                const psaMatches = [...html.matchAll(/psa\s*9/gi)];
                console.log(`   "PSA 9" mentions: ${psaMatches.length}`);
                
                const bowmanMatches = [...html.matchAll(/bowman/gi)];
                console.log(`   "Bowman" mentions: ${bowmanMatches.length}`);
            }

            // Correlate by proximity within 2000 characters
            for (let i = 0; i < Math.min(maxResultsNum, filteredTitleData.length); i++) {
                const titleInfo = filteredTitleData[i];
                
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
