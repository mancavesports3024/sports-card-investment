const axios = require('axios');
const cheerio = require('cheerio');

class BeckettParallelScraper {
    constructor() {
        this.baseUrl = 'https://www.beckett.com';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    async searchCardSet(setName) {
        try {
            console.log(`🔍 Searching Beckett for: ${setName}`);
            
            // Try multiple search approaches
            const searchUrls = [
                `${this.baseUrl}/search?term=${encodeURIComponent(setName)}`,
                `${this.baseUrl}/search?q=${encodeURIComponent(setName)}`,
                `${this.baseUrl}/cards/search?term=${encodeURIComponent(setName)}`,
                `${this.baseUrl}/cards/search?q=${encodeURIComponent(setName)}`
            ];

            for (const searchUrl of searchUrls) {
                try {
                    console.log(`🔍 Trying search URL: ${searchUrl}`);
                    
                    const response = await axios.get(searchUrl, {
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate',
                            'Connection': 'keep-alive',
                            'Upgrade-Insecure-Requests': '1',
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        },
                        timeout: 15000
                    });

                    const $ = cheerio.load(response.data);
                    
                    // Look for card set links with multiple selectors
                    const setLinks = [];
                    
                    // Try different link patterns
                    const linkSelectors = [
                        'a[href*="/cards/"]',
                        'a[href*="/search/"]',
                        'a[href*="/set/"]',
                        'a[href*="/product/"]',
                        '.card-set-link a',
                        '.search-result a',
                        '.product-link a'
                    ];

                    for (const selector of linkSelectors) {
                        $(selector).each((i, element) => {
                            const href = $(element).attr('href');
                            const text = $(element).text().trim();
                            
                            if (href && text && text.length > 0) {
                                // Check if the text contains keywords from the set name
                                const setNameWords = setName.toLowerCase().split(' ');
                                const textLower = text.toLowerCase();
                                
                                const matches = setNameWords.filter(word => 
                                    word.length > 2 && textLower.includes(word)
                                );
                                
                                if (matches.length >= 2) { // At least 2 words should match
                                    setLinks.push({
                                        url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
                                        text: text,
                                        matchScore: matches.length
                                    });
                                }
                            }
                        });
                    }

                    // Sort by match score and remove duplicates
                    const uniqueLinks = setLinks
                        .filter((link, index, self) => 
                            index === self.findIndex(l => l.url === link.url)
                        )
                        .sort((a, b) => b.matchScore - a.matchScore);

                    if (uniqueLinks.length > 0) {
                        console.log(`📋 Found ${uniqueLinks.length} potential set matches`);
                        return uniqueLinks;
                    }

                } catch (error) {
                    console.log(`⚠️ Search URL failed: ${searchUrl} - ${error.message}`);
                    continue;
                }
            }

            console.log(`❌ No set matches found for: ${setName}`);
            return [];

        } catch (error) {
            console.error(`❌ Error searching for ${setName}:`, error.message);
            return [];
        }
    }

    async getParallelsFromSetPage(setUrl) {
        try {
            console.log(`🔍 Scraping parallels from: ${setUrl}`);
            
            const response = await axios.get(setUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 20000
            });

            const $ = cheerio.load(response.data);
            const parallels = [];

            // Look for parallel information in various sections with multiple strategies
            const parallelSelectors = [
                '.parallel', '.variation', '.insert', 
                '[class*="parallel"]', '[class*="variation"]', '[class*="insert"]',
                '.card-type', '.card-variant', '.card-parallel',
                '.parallel-name', '.variation-name', '.insert-name',
                '.card-description', '.card-info', '.product-info',
                '[class*="description"]', '[class*="info"]', '[class*="type"]'
            ];

            // Strategy 1: Look for elements with parallel-related classes
            for (const selector of parallelSelectors) {
                $(selector).each((i, element) => {
                    const text = $(element).text().trim();
                    if (text && text.length > 0 && text.length < 100) {
                        parallels.push(text);
                    }
                });
            }

            // Strategy 2: Look for text containing parallel keywords
            const parallelKeywords = [
                'parallel', 'variation', 'insert', 'prizm', 'refractor', 'holo', 'chrome',
                'gold', 'silver', 'black', 'red', 'blue', 'green', 'orange', 'purple', 'pink',
                'yellow', 'bronze', 'white', 'teal', 'neon', 'ice', 'wave', 'sparkle', 'shimmer',
                'camo', 'checker', 'snake', 'dragon', 'tiger', 'zebra', 'peacock', 'chameleon',
                'butterfly', 'alligator', 'deer', 'elephant', 'giraffe', 'leopard', 'parrot'
            ];

            $('*').each((i, element) => {
                const text = $(element).text().trim();
                if (text && text.length > 0 && text.length < 200) {
                    const textLower = text.toLowerCase();
                    const hasKeyword = parallelKeywords.some(keyword => textLower.includes(keyword));
                    
                    if (hasKeyword) {
                        // Extract potential parallel names
                        const words = text.split(/\s+/);
                        for (let j = 0; j < words.length - 1; j++) {
                            const potentialParallel = words.slice(j, j + 3).join(' ').trim();
                            if (potentialParallel.length > 3 && potentialParallel.length < 50) {
                                const hasParallelKeyword = parallelKeywords.some(keyword => 
                                    potentialParallel.toLowerCase().includes(keyword)
                                );
                                if (hasParallelKeyword) {
                                    parallels.push(potentialParallel);
                                }
                            }
                        }
                    }
                }
            });

            // Strategy 3: Look for specific patterns in the HTML
            const html = $.html();
            const parallelPatterns = [
                /([A-Za-z\s\-&,]+(?:parallel|variation|insert|prizm|refractor|holo|chrome|gold|silver|black|red|blue|green|orange|purple|pink|yellow|bronze|white|teal|neon|ice|wave|sparkle|shimmer|camo|checker|snake|dragon|tiger|zebra|peacock|chameleon|butterfly|alligator|deer|elephant|giraffe|leopard|parrot))/gi,
                /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:parallel|variation|insert|prizm|refractor|holo|chrome|gold|silver|black|red|blue|green|orange|purple|pink|yellow|bronze|white|teal|neon|ice|wave|sparkle|shimmer|camo|checker|snake|dragon|tiger|zebra|peacock|chameleon|butterfly|alligator|deer|elephant|giraffe|leopard|parrot))/gi
            ];

            for (const pattern of parallelPatterns) {
                const matches = html.match(pattern);
                if (matches) {
                    parallels.push(...matches);
                }
            }

            // Remove duplicates and clean up
            const uniqueParallels = [...new Set(parallels)]
                .map(p => p.trim())
                .filter(p => p.length > 0 && p.length < 50)
                .filter(p => {
                    const pLower = p.toLowerCase();
                    return !pLower.includes('parallel') || pLower.includes('parallel') || 
                           pLower.includes('prizm') || pLower.includes('refractor') ||
                           pLower.includes('holo') || pLower.includes('chrome');
                });

            console.log(`📊 Found ${uniqueParallels.length} unique parallels`);
            return uniqueParallels;

        } catch (error) {
            console.error(`❌ Error scraping parallels from ${setUrl}:`, error.message);
            return [];
        }
    }

    async scrapeParallelsForSet(setName) {
        try {
            console.log(`🚀 Starting parallel scrape for: ${setName}`);
            
            // Search for the card set
            const setLinks = await this.searchCardSet(setName);
            
            if (setLinks.length === 0) {
                console.log(`❌ No set matches found for: ${setName}`);
                return [];
            }

            // Get parallels from the first (most relevant) set link
            const parallels = await this.getParallelsFromSetPage(setLinks[0].url);
            
            console.log(`✅ Scraped ${parallels.length} parallels for ${setName}`);
            return parallels;

        } catch (error) {
            console.error(`❌ Error scraping parallels for ${setName}:`, error.message);
            return [];
        }
    }

    generatePatternCode(parallels, setName) {
        if (parallels.length === 0) {
            return `// No parallels found for ${setName}`;
        }

        let code = `// ${setName} Parallels (from Beckett)\n`;
        
        parallels.forEach(parallel => {
            const cleanName = parallel.replace(/[^\w\s\-&]/g, '').trim();
            const patternName = cleanName.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
            
            if (cleanName && patternName) {
                code += `{ pattern: /\\b(${cleanName.toLowerCase().replace(/[^\w\s]/g, '\\$&')})\\b/gi, name: '${patternName}' },\n`;
            }
        });

        return code;
    }

    async scrapeMultipleSets(setNames) {
        const results = {};
        
        for (const setName of setNames) {
            console.log(`\n📦 Processing: ${setName}`);
            const parallels = await this.scrapeParallelsForSet(setName);
            results[setName] = parallels;
            
            // Add a small delay to be respectful to Beckett's servers
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return results;
    }
}

// Example usage
async function main() {
    const scraper = new BeckettParallelScraper();
    
    // Example card sets to scrape
    const cardSets = [
        '2023 Panini Prizm Football',
        '2023 Topps Chrome Baseball',
        '2023 Bowman Chrome Baseball',
        '2023 Panini Select Football'
    ];

    console.log('🚀 Starting Beckett parallel scraper...\n');
    
    const results = await scraper.scrapeMultipleSets(cardSets);
    
    console.log('\n📋 Results Summary:');
    console.log('==================');
    
    Object.entries(results).forEach(([setName, parallels]) => {
        console.log(`\n${setName}:`);
        console.log(`Found ${parallels.length} parallels`);
        if (parallels.length > 0) {
            console.log('Sample parallels:', parallels.slice(0, 5).join(', '));
        }
    });

    // Generate code for the first set as an example
    if (Object.keys(results).length > 0) {
        const firstSet = Object.keys(results)[0];
        const firstParallels = results[firstSet];
        
        console.log('\n💻 Generated Pattern Code:');
        console.log('==========================');
        console.log(scraper.generatePatternCode(firstParallels, firstSet));
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = BeckettParallelScraper;
