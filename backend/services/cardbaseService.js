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
            
            // Build the exact URL format with proper encoding
            // Replace spaces with + and encode special characters like apostrophes
            const encodedSearch = searchQuery
                .replace(/'/g, '%27')  // Encode apostrophes as %27
                .replace(/ /g, '+');   // Replace spaces with +
            
            const url = `${this.baseUrl}/search?page=1&search=${encodedSearch}&target_types[0]=Category&target_ids[0]=1&target_values[0]=Sport+Cards&index=collectibles-catalog_items`;
            
            console.log(`🌐 Making request to: ${url}`);

            const response = await axios.get(url, {
                headers: this.defaultHeaders,
                timeout: 10000
            });

            console.log(`✅ CardBase API response status: ${response.status}`);
            console.log(`📊 CardBase found ${response.data?.items?.length || 0} results`);

            return {
                success: true,
                data: response.data,
                searchQuery: searchQuery,
                url: url
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

        // Use the CardBase title directly - it's already perfectly formatted!
        const cardbaseTitle = cardInfo.title;
        
        console.log(`🔄 Title improvement:`);
        console.log(`   Original: ${originalTitle}`);
        console.log(`   CardBase: ${cardbaseTitle}`);

        return cardbaseTitle || originalTitle;
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
