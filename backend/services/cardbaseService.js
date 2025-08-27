const axios = require('axios');

class CardBaseService {
    constructor() {
        this.baseUrl = 'https://api.getcardbase.com/collectibles/api/shared/v1';
        this.defaultHeaders = {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Origin': 'https://collectibles.com',
            'Referer': 'https://collectibles.com/'
        };
    }

    /**
     * Search for a card using the CardBase API
     * @param {string} searchQuery - The search query (e.g., "2022 Panini Select Red Prizm Ja'Marr Chase")
     * @returns {Object} Card information from CardBase
     */
    async searchCard(searchQuery) {
        try {
            console.log(`🔍 Searching CardBase for: "${searchQuery}"`);
            
            // Check if original query has autograph
            const hasAuto = this.hasAutograph(searchQuery);
            
            // Try multiple search strategies with increasing specificity
            let searchStrategies = [
                // Strategy 1: Full search query
                searchQuery,
                // Strategy 2: Remove card number and try player + year + brand
                this.createPlayerYearBrandQuery(searchQuery),
                // Strategy 3: Just player name + year
                this.createPlayerYearQuery(searchQuery),
                // Strategy 4: Just player name
                this.createPlayerOnlyQuery(searchQuery)
            ];
            
            // If original has autograph, add autograph-specific searches
            if (hasAuto) {
                const autoStrategies = [
                    // Strategy 1.5: Full search with "autograph" explicitly added
                    searchQuery + ' autograph',
                    // Strategy 2.5: Player + year + brand + autograph
                    this.createPlayerYearBrandQuery(searchQuery + ' autograph'),
                    // Strategy 3.5: Player + year + autograph
                    this.createPlayerYearQuery(searchQuery + ' autograph')
                ];
                
                // Insert autograph strategies after the first strategy
                searchStrategies.splice(1, 0, ...autoStrategies);
            }
            
            for (let i = 0; i < searchStrategies.length; i++) {
                const strategy = searchStrategies[i];
                if (!strategy) continue;
                
                console.log(`🔍 Trying search strategy ${i + 1}: "${strategy}"`);
                
                try {
                    const result = await this.performSearch(strategy);
                    if (result.success && result.data?.items?.length > 0) {
                        console.log(`✅ Found ${result.data.items.length} results with strategy ${i + 1}`);
                        return result;
                    }
                } catch (error) {
                    console.log(`❌ Strategy ${i + 1} failed: ${error.message}`);
                    continue;
                }
            }
            
            console.log(`❌ No results found with any search strategy`);
            return {
                success: false,
                error: 'No results found with any search strategy',
                searchQuery: searchQuery
            };
            
        } catch (error) {
            console.error('❌ CardBase API error:', error.message);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }

            return {
                success: false,
                error: error.message,
                searchQuery: searchQuery
            };
        }
    }

    async performSearch(searchQuery) {
        // Build the exact URL format with proper encoding
        const encodedSearch = searchQuery
            .replace(/'/g, '%27')  // Encode apostrophes as %27
            .replace(/ /g, '+');   // Replace spaces with +
        
        const url = `${this.baseUrl}/search?page=1&search=${encodedSearch}&target_types[0]=Category&target_ids[0]=1&target_values[0]=Sport+Cards&index=collectibles-catalog_items`;
        
        console.log(`🌐 Making request to: ${url}`);

        const response = await axios.get(url, {
            headers: this.defaultHeaders,
            timeout: 15000  // Increased timeout
        });

        console.log(`✅ CardBase API response status: ${response.status}`);
        console.log(`📊 CardBase found ${response.data?.items?.length || 0} results`);

        return {
            success: true,
            data: response.data,
            searchQuery: searchQuery,
            url: url
        };
    }

    createPlayerYearBrandQuery(searchQuery) {
        // Extract player name, year, and brand from search query
        const yearMatch = searchQuery.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : '';
        
        // Common brand names
        const brands = ['Panini', 'Topps', 'Bowman', 'Upper Deck', 'Donruss', 'Fleer'];
        let brand = '';
        for (const b of brands) {
            if (searchQuery.toLowerCase().includes(b.toLowerCase())) {
                brand = b;
                break;
            }
        }
        
        // Extract player name (simplified)
        const words = searchQuery.split(' ');
        const playerWords = words.filter(word => 
            !word.match(/^\d/) && 
            !brands.some(b => word.toLowerCase().includes(b.toLowerCase())) &&
            !['Select', 'Chrome', 'Prizm', 'Finest', 'Bowman', 'Topps'].some(s => word.toLowerCase().includes(s.toLowerCase())) &&
            word.length > 2
        );
        
        const player = playerWords.slice(0, 3).join(' '); // Take first 3 words as player name
        
        // Check if original query has autograph
        const hasAuto = this.hasAutograph(searchQuery);
        
        if (year && brand && player) {
            let query = `${year} ${brand} ${player}`;
            if (hasAuto) {
                query += ' autograph';
            }
            return query;
        }
        return null;
    }

    createPlayerYearQuery(searchQuery) {
        const yearMatch = searchQuery.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : '';
        
        const words = searchQuery.split(' ');
        const playerWords = words.filter(word => 
            !word.match(/^\d/) && 
            !['Select', 'Chrome', 'Prizm', 'Finest', 'Bowman', 'Topps', 'Panini'].some(s => word.toLowerCase().includes(s.toLowerCase())) &&
            word.length > 2
        );
        
        const player = playerWords.slice(0, 3).join(' ');
        
        if (year && player) {
            return `${year} ${player}`;
        }
        return null;
    }

    createPlayerOnlyQuery(searchQuery) {
        const words = searchQuery.split(' ');
        const playerWords = words.filter(word => 
            !word.match(/^\d/) && 
            !['Select', 'Chrome', 'Prizm', 'Finest', 'Bowman', 'Topps', 'Panini'].some(s => word.toLowerCase().includes(s.toLowerCase())) &&
            word.length > 2
        );
        
        const player = playerWords.slice(0, 2).join(' '); // Take first 2 words as player name
        return player || null;
    }

    /**
     * Extract standardized card information from CardBase response
     * @param {Object} cardbaseData - Response from CardBase API
     * @returns {Object} Standardized card information
     */
    extractCardInfo(cardbaseData) {
        if (!cardbaseData?.success || !cardbaseData?.data?.items?.length) {
            return null;
        }

        const card = cardbaseData.data.items[0]; // Get the first (best) match
        
        // Parse the card name to extract components
        const cardName = card.name || '';
        const parsedInfo = this.parseCardName(cardName);
        
        return {
            title: card.name,
            year: parsedInfo.year,
            brand: parsedInfo.brand,
            set: parsedInfo.set,
            player: parsedInfo.player,
            cardNumber: parsedInfo.cardNumber,
            parallel: parsedInfo.parallel,
            sport: 'Baseball', // Default, could be enhanced with sport detection
            team: parsedInfo.team,
            rookie: parsedInfo.rookie,
            autograph: parsedInfo.autograph,
            memorabilia: parsedInfo.memorabilia,
            printRun: parsedInfo.printRun,
            condition: 'Raw', // Default
            grade: null,
            // Additional metadata
            cardbaseId: card.id,
            slug: card.url_slug,
            imageUrl: card.front_image?.url,
            rarityNumber: card.rarity_number,
            ownersCount: card.owners_count
        };
    }

    /**
     * Parse card name to extract components
     * @param {string} cardName - Full card name from CardBase
     * @returns {Object} Parsed card components
     */
    parseCardName(cardName) {
        const parts = cardName.split(' ');
        const result = {
            year: null,
            brand: null,
            set: null,
            player: null,
            cardNumber: null,
            parallel: null,
            team: null,
            rookie: false,
            autograph: false,
            memorabilia: false,
            printRun: null
        };

        // Extract year (first 4-digit number)
        const yearMatch = cardName.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            result.year = yearMatch[0];
        }

        // Extract card number (pattern like #123 or #MT-1)
        const cardNumberMatch = cardName.match(/#([A-Z0-9\-]+)/);
        if (cardNumberMatch) {
            result.cardNumber = cardNumberMatch[1];
        }

        // Check for autograph indicators
        if (cardName.toLowerCase().includes('autograph') || cardName.toLowerCase().includes('auto')) {
            result.autograph = true;
        }

        // Check for memorabilia indicators
        if (cardName.toLowerCase().includes('relic') || cardName.toLowerCase().includes('memorabilia')) {
            result.memorabilia = true;
        }

        // Check for rookie indicators
        if (cardName.toLowerCase().includes('rookie') || cardName.toLowerCase().includes('rc')) {
            result.rookie = true;
        }

        // Extract brand and set (this is more complex and would need refinement)
        // For now, let's extract common patterns
        const brandSetMatch = cardName.match(/(\d{4})\s+([A-Za-z]+)\s+([A-Za-z\s]+?)(?=\s+#|\s+[A-Z][a-z]+\s+[A-Z][a-z]+|$)/);
        if (brandSetMatch) {
            result.brand = brandSetMatch[2];
            result.set = brandSetMatch[3].trim();
        }

        // Extract player name (usually at the end, before card number)
        const playerMatch = cardName.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)(?=\s+#|\s*$)/);
        if (playerMatch) {
            result.player = playerMatch[1].trim();
        }

        return result;
    }

    /**
     * Generate an improved summary title using CardBase data
     * @param {Object} cardInfo - Card information from CardBase
     * @param {string} originalTitle - Original title from eBay
     * @returns {string} Improved summary title
     */
    generateImprovedTitle(cardInfo, originalTitle) {
        if (!cardInfo) {
            return originalTitle;
        }

        const cardbaseTitle = cardInfo.title;
        
        console.log(`🔄 Title improvement:`);
        console.log(`   Original: ${originalTitle}`);
        console.log(`   CardBase: ${cardbaseTitle}`);

        // Check for important characteristics that shouldn't be lost
        const originalHasAuto = this.hasAutograph(originalTitle);
        const cardbaseHasAuto = this.hasAutograph(cardbaseTitle);
        
        const originalHasRookie = this.hasRookie(originalTitle);
        const cardbaseHasRookie = this.hasRookie(cardbaseTitle);
        
        const originalHasNumbered = this.hasNumbered(originalTitle);
        const cardbaseHasNumbered = this.hasNumbered(cardbaseTitle);

        // Extract player names for comparison
        const originalPlayer = this.extractPlayerName(originalTitle);
        const cardbasePlayer = this.extractPlayerName(cardbaseTitle);

        // Don't change player names unless they're very similar (typo fixes)
        if (originalPlayer && cardbasePlayer && !this.arePlayerNamesSimilar(originalPlayer, cardbasePlayer)) {
            console.log(`⚠️ Rejecting improvement: Player name changed from "${originalPlayer}" to "${cardbasePlayer}"`);
            return originalTitle;
        }

        // Don't downgrade from autograph to non-autograph
        if (originalHasAuto && !cardbaseHasAuto) {
            console.log(`⚠️ Rejecting improvement: Original has autograph, CardBase result doesn't`);
            return originalTitle;
        }

        // Don't downgrade from rookie to non-rookie
        if (originalHasRookie && !cardbaseHasRookie) {
            console.log(`⚠️ Rejecting improvement: Original has rookie, CardBase result doesn't`);
            return originalTitle;
        }

        // Don't downgrade from numbered to non-numbered
        if (originalHasNumbered && !cardbaseHasNumbered) {
            console.log(`⚠️ Rejecting improvement: Original has numbered print run, CardBase result doesn't`);
            return originalTitle;
        }

        console.log(`✅ Accepting improvement: All important characteristics preserved`);
        return cardbaseTitle || originalTitle;
    }

    /**
     * Check if a title contains autograph indicators
     */
    hasAutograph(title) {
        const autoTerms = ['auto', 'autograph', 'au', 'signature', 'signed'];
        return autoTerms.some(term => title.toLowerCase().includes(term));
    }

    /**
     * Check if a title contains rookie indicators
     */
    hasRookie(title) {
        const rookieTerms = ['rookie', 'rc', 'yg', 'young guns', '1st bowman', 'first bowman'];
        return rookieTerms.some(term => title.toLowerCase().includes(term));
    }

    /**
     * Check if a title contains numbered print run
     */
    hasNumbered(title) {
        return /\/(\d+)/.test(title) || /\b(\d+)\/(\d+)\b/.test(title);
    }

    /**
     * Extract player name from title using the main database's simplified function
     */
    extractPlayerName(title) {
        // Use the main database's simplified player extraction function
        const NewPricingDatabase = require('../create-new-pricing-database.js');
        const db = new NewPricingDatabase();
        return db.extractPlayerName(title);
    }

    /**
     * Check if two player names are similar (for typo fixes)
     */
    arePlayerNamesSimilar(name1, name2) {
        if (!name1 || !name2) return false;
        
        const n1 = name1.toLowerCase().replace(/[^a-z\s]/g, '');
        const n2 = name2.toLowerCase().replace(/[^a-z\s]/g, '');
        
        // Exact match
        if (n1 === n2) return true;
        
        // Check if one is contained in the other (for partial matches)
        if (n1.includes(n2) || n2.includes(n1)) return true;
        
        // Check for common variations (e.g., "J.J." vs "JJ")
        const normalized1 = n1.replace(/\s+/g, '').replace(/\./g, '');
        const normalized2 = n2.replace(/\s+/g, '').replace(/\./g, '');
        
        if (normalized1 === normalized2) return true;
        
        // Check for initials vs full names
        const words1 = n1.split(/\s+/);
        const words2 = n2.split(/\s+/);
        
        if (words1.length === 1 && words2.length === 1) {
            // Single word names - check if they're similar
            return this.calculateSimilarity(n1, n2) > 0.8;
        }
        
        return false;
    }

    /**
     * Calculate string similarity (simple Levenshtein-based)
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Check if a word is a common card term (not a player name)
     */
    isCommonCardTerm(word) {
        const commonTerms = [
            'auto', 'autograph', 'rc', 'rookie', 'refractor', 'prizm', 'chrome',
            'select', 'finest', 'bowman', 'topps', 'panini', 'upper', 'deck',
            'donruss', 'fleer', 'signatures', 'intimidators', 'legends', 'legend',
            'gold', 'silver', 'blue', 'red', 'green', 'orange', 'purple', 'black',
            'wave', 'shimmer', 'crackle', 'holo', 'foil', 'parallel', 'variation',
            'insert', 'base', 'numbered', 'limited', 'exclusive', 'mega', 'hobby',
            'jumbo', 'value', 'fat', 'pack', 'box', 'case', 'hit', 'ssp', 'sp'
        ];
        
        return commonTerms.includes(word.toLowerCase());
    }

    /**
     * Test the CardBase API with a sample search
     * @returns {Object} Test results
     */
    async testCardBaseAPI() {
        const testQueries = [
            "2022 Panini Select Red Prizm Ja'Marr Chase",
            "2023 Topps Chrome Junior Caminero Orange Wave Refractor",
            "2021 Bowman Chrome Mike Trout Refractor"
        ];

        const results = [];

        for (const query of testQueries) {
            console.log(`\n🧪 Testing CardBase API with: "${query}"`);
            
            const result = await this.searchCard(query);
            results.push({
                query,
                success: result.success,
                cardCount: result.data?.items?.length || 0,
                sampleCard: result.data?.items?.[0] || null
            });

            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }
}

module.exports = { CardBaseService };
