/**
 * Integration Example: Centralized Player Name Extraction System
 * 
 * This file demonstrates how to integrate the SimplePlayerExtractor
 * into your existing ScoreCard application.
 */

const SimplePlayerExtractor = require('./simple-player-extraction.js');

// Initialize the extractor once (can be reused)
const playerExtractor = new SimplePlayerExtractor();

/**
 * Example 1: Basic Integration
 * Replace existing player name extraction logic
 */
function processNewCardListing(cardTitle) {
    // OLD WAY: Complex extraction logic
    // const playerName = complexExtractPlayerName(cardTitle);
    
    // NEW WAY: Centralized extraction
    const playerName = playerExtractor.extractPlayerName(cardTitle);
    
    return {
        title: cardTitle,
        playerName: playerName,
        processedAt: new Date().toISOString()
    };
}

/**
 * Example 2: Batch Processing
 * Process multiple card titles efficiently
 */
function processBatchCardListings(cardTitles) {
    return cardTitles.map(title => ({
        originalTitle: title,
        playerName: playerExtractor.extractPlayerName(title),
        processedAt: new Date().toISOString()
    }));
}

/**
 * Example 3: Database Integration
 * Update existing database records with standardized player names
 */
async function updateDatabasePlayerNames() {
    // Example database query and update
    const cards = await getCardsFromDatabase(); // Your database function
    
    for (const card of cards) {
        const extractedPlayerName = playerExtractor.extractPlayerName(card.title);
        
        if (extractedPlayerName && extractedPlayerName !== card.playerName) {
            await updateCardPlayerName(card.id, extractedPlayerName);
            console.log(`Updated ${card.id}: "${card.playerName}" → "${extractedPlayerName}"`);
        }
    }
}

/**
 * Example 4: API Endpoint Integration
 * Use in your API routes
 */
function createCardListingEndpoint(req, res) {
    const { title, price, condition } = req.body;
    
    // Extract player name using centralized system
    const playerName = playerExtractor.extractPlayerName(title);
    
    // Create card listing with standardized player name
    const cardListing = {
        title: title,
        playerName: playerName,
        price: price,
        condition: condition,
        createdAt: new Date().toISOString()
    };
    
    // Save to database
    saveCardListing(cardListing);
    
    res.json({
        success: true,
        cardListing: cardListing,
        message: `Card listing created for ${playerName}`
    });
}

/**
 * Example 5: Search Functionality
 * Improve search with standardized player names
 */
function searchCardsByPlayer(searchTerm) {
    // Extract player name from search term to handle variations
    const extractedSearchTerm = playerExtractor.extractPlayerName(searchTerm);
    
    // Search database using standardized player name
    return searchDatabaseByPlayerName(extractedSearchTerm);
}

/**
 * Example 6: Data Import/Export
 * Standardize player names during data operations
 */
function importCardData(rawCardData) {
    return rawCardData.map(card => ({
        ...card,
        playerName: playerExtractor.extractPlayerName(card.title),
        importedAt: new Date().toISOString()
    }));
}

/**
 * Example 7: Validation
 * Validate that player names are properly extracted
 */
function validateCardListing(cardTitle) {
    const playerName = playerExtractor.extractPlayerName(cardTitle);
    
    if (!playerName || playerName.trim() === '') {
        return {
            isValid: false,
            error: 'Could not extract player name from title',
            title: cardTitle
        };
    }
    
    return {
        isValid: true,
        playerName: playerName,
        title: cardTitle
    };
}

// Example usage
if (require.main === module) {
    console.log('🧪 Testing Centralized Player Extraction Integration\n');
    
    const testTitles = [
        "2024 Panini Prizm Malik Nabers Los Angeles Chargers Blue Ice #19 /99 PSA 10",
        "2023 Topps Chrome J.J. McCarthy Orange Refractor #350 PSA 10",
        "2024 Bowman Chrome Xavier Worthy Texas Longhorns Case Hit #123 PSA 10",
        "2023 Donruss Optic Ja'Marr Chase Cincinnati Bengals Blue Ice #234 PSA 10"
    ];
    
    console.log('📋 Processing Test Cards:\n');
    
    testTitles.forEach((title, index) => {
        const result = processNewCardListing(title);
        console.log(`${index + 1}. "${result.title}"`);
        console.log(`   → Player: "${result.playerName}"\n`);
    });
    
    console.log('✅ Integration test completed!');
}

// Export functions for use in other modules
module.exports = {
    processNewCardListing,
    processBatchCardListings,
    updateDatabasePlayerNames,
    createCardListingEndpoint,
    searchCardsByPlayer,
    importCardData,
    validateCardListing,
    playerExtractor // Export the extractor instance for direct use
};
