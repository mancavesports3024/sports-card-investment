const axios = require('axios');

class EbayScraperService {
    constructor() {
        this.baseUrl = 'https://www.ebay.com';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
        this.currentUserAgent = 0;
    }

    getRandomUserAgent() {
        this.currentUserAgent = (this.currentUserAgent + 1) % this.userAgents.length;
        return this.userAgents[this.currentUserAgent];
    }

    buildSearchUrl(searchTerm, sport = null, expectedGrade = null, originalIsAutograph = null) {
        // Clean and encode the search term (preserve negative keywords properly)
        const cleanTerm = searchTerm.replace(/[^\w\s\-\+]/g, ' ').replace(/\s+/g, '+');
        
        let searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${cleanTerm}&_sacat=0&LH_Complete=1&LH_Sold=1`;
        
        // Add grade-specific parameters
        if (expectedGrade === 'PSA 10' || expectedGrade === 'PSA 9') {
            searchUrl += '&_oaa=1&Graded=Yes&_dcat=261328&rt=nc';
            
            if (expectedGrade === 'PSA 10') {
                searchUrl += '&Grade=10';
            } else {
                searchUrl += '&Grade=9';
            }
            searchUrl += '&Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529';
        } else if (expectedGrade === 'Raw') {
            searchUrl += '&_oaa=1&rt=nc&Graded=No&_dcat=261328';
        }
        
        // Only add autographed filter when explicitly specified
        if (originalIsAutograph === true) {
            searchUrl += '&Autographed=Yes';
        } else if (originalIsAutograph === false) {
            searchUrl += '&Autographed=No';
        }
        // If originalIsAutograph is null, don't add any autograph filter (for general searches)
        
        return searchUrl;
    }

    async searchSoldCards(searchTerm, sport = null, maxResults = 20, expectedGrade = null, originalIsAutograph = null, targetPrintRun = null) {
        try {
            const searchUrl = this.buildSearchUrl(searchTerm, sport, expectedGrade, originalIsAutograph);
            console.log(`🔍 Search URL: ${searchUrl}`);
            
            // Make HTTP request
            const response = await axios.get(searchUrl, {
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
            });

            if (response.data) {
                console.log('✅ Direct HTTP request successful, parsing HTML...');
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
            const maxResultsNum = parseInt(maxResults) || 20;
            
            console.log(`🔍 Parsing HTML for card data with proximity-based correlation...`);
            
            // Extract titles with positions using proven patterns
            const titleData = [];
            const workingTitlePatterns = [
                />([^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*(?:2024|Bowman|Chrome|Draft|Sapphire|PSA|Refractor)[^<]*)</gi,
                />([^<]*(?:2024)[^<]*(?:Bowman|Chrome|Draft)[^<]*(?:KONNOR GRIFFIN|Konnor Griffin)[^<]*)</gi,
                /<h3[^>]*>([^<]+)<\/h3>/gi,
                /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi
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
