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
            
            const params = {
                page: 1,
                search: searchQuery,
                'target_types[0]': 'Category',
                'target_ids[0]': '1',
                'target_values[0]': 'Sport Cards',
                index: 'collectibles-catalog_items'
            };

            const response = await axios.get(`${this.baseUrl}/search`, {
                params,
                headers: this.defaultHeaders,
                timeout: 10000
            });

            console.log(`✅ CardBase API response status: ${response.status}`);
            console.log(`📊 CardBase found ${response.data?.data?.length || 0} results`);

            return {
                success: true,
                data: response.data,
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

    /**
     * Extract standardized card information from CardBase response
     * @param {Object} cardbaseData - Response from CardBase API
     * @returns {Object} Standardized card information
     */
    extractCardInfo(cardbaseData) {
        if (!cardbaseData?.success || !cardbaseData?.data?.data?.length) {
            return null;
        }

        const card = cardbaseData.data.data[0]; // Get the first (best) match
        
        return {
            title: card.attributes?.title || card.attributes?.name,
            year: card.attributes?.year,
            brand: card.attributes?.brand,
            set: card.attributes?.set,
            player: card.attributes?.player,
            cardNumber: card.attributes?.card_number,
            parallel: card.attributes?.parallel,
            sport: card.attributes?.sport,
            team: card.attributes?.team,
            rookie: card.attributes?.rookie,
            autograph: card.attributes?.autograph,
            memorabilia: card.attributes?.memorabilia,
            printRun: card.attributes?.print_run,
            condition: card.attributes?.condition,
            grade: card.attributes?.grade,
            // Additional metadata
            cardbaseId: card.id,
            slug: card.attributes?.slug,
            imageUrl: card.attributes?.image_url,
            marketData: card.attributes?.market_data
        };
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

        const parts = [];

        // Year
        if (cardInfo.year) {
            parts.push(cardInfo.year);
        }

        // Brand
        if (cardInfo.brand) {
            parts.push(cardInfo.brand);
        }

        // Set
        if (cardInfo.set) {
            parts.push(cardInfo.set);
        }

        // Parallel/Variant
        if (cardInfo.parallel) {
            parts.push(cardInfo.parallel);
        }

        // Player name
        if (cardInfo.player) {
            parts.push(cardInfo.player);
        }

        // Autograph indicator
        if (cardInfo.autograph) {
            parts.push('auto');
        }

        // Card number
        if (cardInfo.cardNumber) {
            parts.push(`#${cardInfo.cardNumber}`);
        }

        // Print run
        if (cardInfo.printRun) {
            parts.push(cardInfo.printRun);
        }

        const improvedTitle = parts.join(' ').trim();
        
        console.log(`🔄 Title improvement:`);
        console.log(`   Original: ${originalTitle}`);
        console.log(`   Improved: ${improvedTitle}`);

        return improvedTitle || originalTitle;
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
                cardCount: result.data?.data?.length || 0,
                sampleCard: result.data?.data?.[0] || null
            });

            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }
}

module.exports = { CardBaseService };
