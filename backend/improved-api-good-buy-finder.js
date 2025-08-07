require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'improved_api_good_buy_opportunities.json');
const CACHE_FILE = path.join(DATABASE_DIR, 'improved_api_good_buy_cache.json');

// API Configuration
const API_BASE_URL = 'https://web-production-9efa.up.railway.app';
const SEARCH_ENDPOINT = '/api/search-cards';

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;

class ImprovedApiGoodBuyFinder {
  constructor() {
    this.goodBuys = [];
    this.cache = this.loadCache();
    this.stats = {
      totalProcessed: 0,
      goodBuysFound: 0,
      apiCalls: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  // Load cache from file
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
        return JSON.parse(cacheData);
      }
    } catch (error) {
      console.log('⚠️ Could not load cache, starting fresh');
    }
    return {};
  }

  // Save cache to file
  saveCache() {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.log('⚠️ Could not save cache:', error.message);
    }
  }

  // Create a clean summary title from PSA 10 title
  createSummaryTitle(psa10Title) {
    let summary = psa10Title
      // Remove grading terms
      .replace(/\bpsa\s*10\b/gi, '')
      .replace(/\bgraded\b/gi, '')
      .replace(/\bauthentic\b/gi, '')
      .replace(/\bgenuine\b/gi, '')
      .replace(/\bgem\s*mint\b/gi, '')
      .replace(/\bmint\b/gi, '')
      .replace(/\bperfect\b/gi, '')
      .replace(/\bpristine\b/gi, '')
      .replace(/\bflawless\b/gi, '')
      // Remove standalone grade numbers (but not card numbers)
      .replace(/\b10\b(?!\s*#)/g, '')  // 10 but not followed by #
      .replace(/\b9\b(?!\s*#)/g, '')   // 9 but not followed by #
      .replace(/\b8\b(?!\s*#)/g, '')   // 8 but not followed by #
      .replace(/\b7\b(?!\s*#)/g, '')   // 7 but not followed by #
      .replace(/\b6\b(?!\s*#)/g, '')   // 6 but not followed by #
      .replace(/\b5\b(?!\s*#)/g, '')   // 5 but not followed by #
      .replace(/\b4\b(?!\s*#)/g, '')   // 4 but not followed by #
      .replace(/\b3\b(?!\s*#)/g, '')   // 3 but not followed by #
      .replace(/\b2\b(?!\s*#)/g, '')   // 2 but not followed by #
      .replace(/\b1\b(?!\s*#)/g, '')   // 1 but not followed by #
      // Remove RC/rookie terms to make searches more flexible
      .replace(/\brookie\b/gi, '')
      .replace(/\brookie\s*card\b/gi, '')
      .replace(/\brc\b/gi, '')
      .replace(/\brookie\b/gi, '')
      // Normalize auto terms
      .replace(/\bautograph\b/gi, 'auto')
      .replace(/\bautographed\b/gi, 'auto')
      // Clean up extra spaces and formatting
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim();

    return summary;
  }

  // Extract card identifier with improved search strategies
  extractCardIdentifier(psa10Title) {
    const originalTitle = psa10Title;
    const summaryTitle = this.createSummaryTitle(psa10Title);
    const yearMatch = summaryTitle.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    const searchStrategies = [];

    // Strategy 1: Clean summary title (your suggested approach)
    searchStrategies.push({ 
      name: 'Summary Title', 
      query: summaryTitle, 
      priority: 1 
    });

    // Strategy 2: Player + Parallel + Card Number
    // FIXED: Use the same logic as validation to distinguish set names from parallel names
    const setNames = ['hoops', 'donruss', 'topps', 'fleer', 'score', 'prestige', 'absolute', 'immaculate', 'flawless', 'national treasures', 'playoff', 'optic', 'prizm', 'chrome', 'select', 'contenders'];
    const parallelNames = ['light blue', 'silver', 'gold', 'red', 'blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'black', 'white', 'rainbow', 'color blast', 'stained glass', 'hyper', 'refractor', 'teal', 'explosion', 'neon', 'fluorescent', 'holographic', 'holo', 'platinum', 'diamond', 'winter', 'checkerboard', 'lava', 'shimmer', 'xfractor', 'shock', 'fast break'];
    
    // First, check for parallel names (these are the actual parallels)
    let parallel = null;
    for (const parallelName of parallelNames) {
      if (summaryTitle.toLowerCase().includes(parallelName)) {
        parallel = parallelName;
        break;
      }
    }
    
    const numberMatch = summaryTitle.match(/#(\d+)/);
    const cardNumber = numberMatch ? numberMatch[1] : null;
    
    if (parallel && numberMatch && year) {
      // Extract player name more flexibly - look for capitalized names before the parallel/card number
      const beforeParallel = summaryTitle.substring(0, summaryTitle.toLowerCase().indexOf(parallel)).trim();
      const playerMatch = beforeParallel.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      
      if (playerMatch) {
        const player = playerMatch[1].trim();
        // Remove "II", "III", "IV" etc. from player names
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Player Parallel Number',
          query: `${simplifiedPlayer} ${parallel} #${cardNumber} ${year}`,
          priority: 2
        });
      }
    }

    // Strategy 3: Simplified parallel search
    if (parallel && year) {
      // Extract player name more flexibly
      const beforeParallel = summaryTitle.substring(0, summaryTitle.toLowerCase().indexOf(parallel)).trim();
      const playerMatch = beforeParallel.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      
      if (playerMatch) {
        const player = playerMatch[1].trim();
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Parallel Only',
          query: `${simplifiedPlayer} ${parallel} ${year}`,
          priority: 3
        });
      }
    }

    // Strategy 4: Player + Year (without RC)
    if (year) {
      // Extract player name from the beginning of the title
      const playerMatch = summaryTitle.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (playerMatch) {
        const player = playerMatch[1].trim();
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Player Year',
          query: `${simplifiedPlayer} ${year}`,
          priority: 4
        });
      }
    }

    return { 
      searchStrategies: searchStrategies.sort((a, b) => a.priority - b.priority), 
      year, 
      originalTitle,
      summaryTitle
    };
  }

  // Search using your API
  async searchCardVersions(cardInfo) {
    const { searchStrategies, originalTitle, summaryTitle } = cardInfo;
    
    for (const strategy of searchStrategies) {
      const cacheKey = `raw_${strategy.query}`;
      
      // Check cache first
      if (this.cache[cacheKey]) {
        console.log(`📋 Using cached results for: "${strategy.query}"`);
        const cachedResults = this.cache[cacheKey];
        if (cachedResults.raw && cachedResults.raw.length > 0) {
          return {
            raw: cachedResults.raw,
            psa9: cachedResults.psa9 || [],
            psa10: cachedResults.psa10 || [],
            priceAnalysis: cachedResults.priceAnalysis || null,
            strategy: strategy.name
          };
        }
        continue;
      }

      try {
        console.log(`🔍 Testing: "${strategy.query}" (${strategy.name})`);
        
        // Call your API
        const response = await axios.post(`${API_BASE_URL}${SEARCH_ENDPOINT}`, {
          searchQuery: strategy.query,
          numSales: 100
        }, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        this.stats.apiCalls++;
        
        if (response.data && response.data.results) {
          const results = response.data.results;
          
          // Cache the results
          this.cache[cacheKey] = {
            raw: results.raw || [],
            psa9: results.psa9 || [],
            psa10: results.psa10 || [],
            priceAnalysis: response.data.priceAnalysis || null,
            timestamp: Date.now()
          };
          
          // Check if we found raw cards
          if (results.raw && results.raw.length > 0) {
            console.log(`✅ Found ${results.raw.length} raw cards using strategy: ${strategy.name}`);
            return {
              raw: results.raw,
              psa9: results.psa9 || [],
              psa10: results.psa10 || [],
              priceAnalysis: response.data.priceAnalysis || null,
              strategy: strategy.name
            };
          }
        }
        
        // Rate limiting
        await this.delay(1000 + Math.random() * 2000);
        
      } catch (error) {
        console.log(`❌ API call failed for "${strategy.query}": ${error.message}`);
        this.stats.errors++;
        
        // Rate limiting on error
        await this.delay(2000 + Math.random() * 3000);
      }
    }
    
    return { raw: [], psa9: [], psa10: [], priceAnalysis: null, strategy: 'No results found' };
  }

  // Validate that search results match the specific card
  validateCardMatches(searchResults, originalTitle, searchType) {
    const validatedResults = [];
    const originalLower = originalTitle.toLowerCase();
    const summaryLower = this.createSummaryTitle(originalTitle).toLowerCase();
    
    // Extract key characteristics from summary title
    // FIXED: Better set extraction for multi-word sets
    let exactSet = null;
    
    // First, try to match common multi-word sets
    const multiWordSetMatch = summaryLower.match(/(donruss optic|topps chrome|panini threads|panini mosaic|panini chronicles|panini obsidian|panini absolute|panini immaculate|panini flawless|national treasures|playoff contenders)/);
    if (multiWordSetMatch) {
      exactSet = multiWordSetMatch[0];
    } else {
      // Fall back to single word sets
      const setMatch = summaryLower.match(/(panini|topps|fleer|score|prestige|absolute|immaculate|flawless|national treasures|playoff|donruss|optic|prizm|chrome|select|contenders|hoops)/g);
      exactSet = setMatch ? setMatch.join(' ') : null;
    }
    
    // Extract parallel information
    const parallelNames = ['light blue', 'silver', 'gold', 'red', 'blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'black', 'white', 'rainbow', 'color blast', 'stained glass', 'hyper', 'refractor', 'teal', 'explosion', 'neon', 'fluorescent', 'holographic', 'holo', 'platinum', 'diamond', 'winter', 'checkerboard', 'lava', 'shimmer', 'xfractor', 'shock', 'fast break'];
    
    // First, check for parallel names (these are the actual parallels)
    let parallel = null;
    for (const parallelName of parallelNames) {
      if (summaryLower.includes(parallelName)) {
        parallel = parallelName;
        break;
      }
    }
    
    // If no parallel found, check if this is a base set (no specific parallel)
    let isBaseSet = false;
    if (!parallel && exactSet) {
      isBaseSet = true;
    }
    
    const numberMatch = summaryLower.match(/#(\d+)/);
    const cardNumber = numberMatch ? numberMatch[1] : null;
    const numberedMatch = summaryLower.match(/(\d+)\/(\d+)/);
    const isNumbered = numberedMatch !== null;
    const hasAuto = summaryLower.includes('auto') || summaryLower.includes('autograph');
    // Note: We're not requiring RC designation anymore for validation

    console.log(`🔍 Validating ${searchResults.length} ${searchType} results for: "${originalTitle}"`);
    console.log(`   Target parallel: ${parallel || 'none (base set)'}`);
    console.log(`   Target set: ${exactSet || 'none'}`);
    console.log(`   Target card number: ${cardNumber || 'none'}`);
    console.log(`   Is base set: ${isBaseSet}`);

    for (const result of searchResults) {
      const resultLower = result.title.toLowerCase();
      let isValid = true;
      let rejectionReason = '';

      // CRITICAL: For raw cards, exclude any graded cards
      if (searchType === 'raw') {
        if (resultLower.includes('psa') || resultLower.includes('bgs') || resultLower.includes('cgc') || 
            resultLower.includes('sgc') || resultLower.includes('tag') || resultLower.includes('graded') ||
            resultLower.includes('mint') || resultLower.includes('gem')) {
          isValid = false;
          rejectionReason = 'Graded card in raw section';
        }
      }

      // Check for key characteristics
      if (parallel && !resultLower.includes(parallel)) { 
        isValid = false; 
        rejectionReason = `Missing target parallel: ${parallel}`;
      }
      
      // FIXED: More flexible card number validation - accept with or without # symbol
      if (cardNumber && !resultLower.includes(`#${cardNumber}`) && !resultLower.includes(` ${cardNumber} `) && !resultLower.includes(` ${cardNumber}`) && !resultLower.endsWith(` ${cardNumber}`)) { 
        isValid = false; 
        rejectionReason = `Missing card number: ${cardNumber} (with or without #)`;
      }
      
      if (isNumbered && !resultLower.match(/\d+\/\d+/)) { 
        isValid = false; 
        rejectionReason = 'Missing numbered parallel';
      }
      if (hasAuto && !resultLower.includes('auto')) { 
        isValid = false; 
        rejectionReason = 'Missing auto designation';
      }
      // Note: Removed RC validation requirement

      // CRITICAL: Check for unwanted parallel types that would skew the price
      if (isValid) {
        // If we're looking for a base set (no specific parallel), reject any colored/special parallels
        if (isBaseSet && !parallel) {
          for (const parallelName of parallelNames) {
            if (resultLower.includes(parallelName)) {
              // This result has a colored/special parallel, but we want base set - exclude it
              isValid = false;
              rejectionReason = `Colored/special parallel: ${parallelName} (wanted base set)`;
              break;
            }
          }
        }
        
        // If we're looking for a specific parallel, make sure we get the exact match
        if (parallel) {
          for (const parallelName of parallelNames) {
            if (resultLower.includes(parallelName) && parallelName !== parallel) {
              // This has a different parallel than what we want - exclude it
              isValid = false;
              rejectionReason = `Wrong parallel: ${parallelName} (wanted: ${parallel})`;
              break;
            }
          }
        }
      }

      // Additional validation: ensure the set/series matches exactly
      if (isValid && exactSet) {
        // FIXED: Require exact phrase match instead of individual word matching
        // For multi-word sets like "donruss optic", require the exact phrase to be present
        const targetSetLower = exactSet.toLowerCase();
        const resultLower = result.title.toLowerCase();
        
        // Check if the exact set phrase is present in the result
        if (!resultLower.includes(targetSetLower)) {
          // Set doesn't match exactly - exclude it
          isValid = false;
          rejectionReason = `Set mismatch: missing exact phrase "${targetSetLower}"`;
        }
      }

      if (isValid) {
        validatedResults.push(result);
        console.log(`   ✅ ACCEPTED: "${result.title}"`);
      } else {
        console.log(`   ❌ REJECTED: "${result.title}" - ${rejectionReason}`);
      }
    }
    
    console.log(`   📊 Validation complete: ${validatedResults.length}/${searchResults.length} cards accepted`);
    return validatedResults;
  }

  // Calculate average price from search results
  calculateAveragePrice(cards) {
    if (!cards || cards.length === 0) return null;
    
    const validPrices = cards
      .map(card => parseFloat(card.price?.value || 0))
      .filter(price => price > 0);
    
    if (validPrices.length === 0) return null;
    
    const average = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
    return Math.round(average * 100) / 100;
  }

  // Process a single card
  async processCard(psa10Card) {
    const databasePsa10Price = parseFloat(psa10Card.price?.value || 0);
    
    // Skip if PSA 10 price is too low
    if (databasePsa10Price < MIN_PSA10_PRICE) {
      return null;
    }

    // Extract card identifier
    const cardInfo = this.extractCardIdentifier(psa10Card.title);
    
    // Search for raw and PSA 9 versions
    const searchResults = await this.searchCardVersions(cardInfo);
    
    if (searchResults.raw.length === 0) {
      return null; // No raw cards found
    }

    // Validate raw results
    const validatedRaw = this.validateCardMatches(searchResults.raw, cardInfo.originalTitle, 'raw');
    const validatedPSA9 = this.validateCardMatches(searchResults.psa9, cardInfo.originalTitle, 'psa9');
    
    if (validatedRaw.length === 0) {
      return null; // No validated raw cards
    }

    // Calculate average prices
    const rawPrice = this.calculateAveragePrice(validatedRaw);
    const psa9Price = this.calculateAveragePrice(validatedPSA9);
    
    if (!rawPrice || rawPrice < MIN_RAW_PRICE) {
      return null; // Raw price too low
    }

    // FIXED: Use our own validated PSA 10 results instead of API's priceAnalysis
    // The API's priceAnalysis includes unvalidated cards that don't match our specific card
    let psa10Price = databasePsa10Price;
    
    // If we have validated PSA 10 results from our search, use their average
    if (searchResults.psa10 && searchResults.psa10.length > 0) {
      const validatedPSA10 = this.validateCardMatches(searchResults.psa10, cardInfo.originalTitle, 'psa10');
      if (validatedPSA10.length > 0) {
        const validatedPsa10Price = this.calculateAveragePrice(validatedPSA10);
        if (validatedPsa10Price && validatedPsa10Price > 0) {
          psa10Price = validatedPsa10Price;
          console.log(`📊 Using validated PSA 10 avg: $${psa10Price} (vs database: $${databasePsa10Price})`);
        } else {
          console.log(`📊 Using database PSA 10 price: $${psa10Price} (no valid PSA 10 avg available)`);
        }
      } else {
        console.log(`📊 Using database PSA 10 price: $${psa10Price} (no validated PSA 10 matches)`);
      }
    } else {
      console.log(`📊 Using database PSA 10 price: $${psa10Price} (no PSA 10 results from API)`);
    }

    // Calculate multiplier
    const multiplier = psa10Price / rawPrice;
    
    if (multiplier >= TARGET_MULTIPLIER) {
      const opportunity = {
        title: cardInfo.summaryTitle, // Use summary title for display
        psa10Price,
        rawPrice,
        psa9Price,
        multiplier: Math.round(multiplier * 100) / 100,
        potentialProfit: Math.round((psa10Price - rawPrice) * 100) / 100,
        roi: Math.round(((psa10Price - rawPrice) / rawPrice * 100) * 100) / 100,
        searchStrategy: searchResults.strategy,
        validatedMatches: validatedRaw.length,
        psa9CardsFound: validatedPSA9.length,
        originalTitle: cardInfo.originalTitle, // Keep original for reference
        databasePsa10Price, // Keep original database price for reference
        apiPsa10AvgPrice: null, // We're not using API's priceAnalysis anymore
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Good buy found: ${multiplier.toFixed(2)}x multiplier`);
      console.log(`   Raw: $${rawPrice} | PSA 10: $${psa10Price} | Strategy: ${searchResults.strategy}`);
      
      return opportunity;
    }
    
    return null;
  }

  // Process all cards
  async processCards(cards, maxCards = null) {
    console.log(`🚀 Starting Improved API Good Buy Finder...`);
    console.log(`📊 Processing ${maxCards || cards.length} cards...\n`);
    
    const cardsToProcess = maxCards ? cards.slice(0, maxCards) : cards;
    
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i];
      this.stats.totalProcessed++;
      
      if (this.stats.totalProcessed % 10 === 0) {
        console.log(`📊 Processed ${this.stats.totalProcessed}/${cardsToProcess.length} cards...`);
      }
      
      try {
        const opportunity = await this.processCard(card);
        if (opportunity) {
          this.goodBuys.push(opportunity);
          this.stats.goodBuysFound++;
        }
      } catch (error) {
        console.log(`❌ Error processing card "${card.title}": ${error.message}`);
        this.stats.errors++;
      }
      
      // Rate limiting between cards
      if (i < cardsToProcess.length - 1) {
        await this.delay(500 + Math.random() * 1000);
      }
    }
    
    // Save results
    this.saveResults();
    this.saveCache();
    
    // Print statistics
    this.printStats();
  }

  // Save results to file
  saveResults() {
    const results = {
      opportunities: this.goodBuys,
      metadata: {
        created: new Date().toISOString(),
        totalProcessed: this.stats.totalProcessed,
        goodBuysFound: this.stats.goodBuysFound,
        targetMultiplier: TARGET_MULTIPLIER,
        minRawPrice: MIN_RAW_PRICE,
        minPSA10Price: MIN_PSA10_PRICE
      }
    };
    
    try {
      fs.writeFileSync(GOOD_BUYS_FILE, JSON.stringify(results, null, 2));
      console.log(`💾 Saved ${this.goodBuys.length} opportunities to ${GOOD_BUYS_FILE}`);
    } catch (error) {
      console.log('❌ Error saving results:', error.message);
    }
  }

  // Print statistics
  printStats() {
    const processingTime = (Date.now() - this.stats.startTime) / 1000;
    const successRate = this.stats.totalProcessed > 0 ? 
      ((this.stats.goodBuysFound / this.stats.totalProcessed) * 100).toFixed(2) : 0;
    
    console.log('\n📈 IMPROVED API GOOD BUY FINDER STATISTICS:');
    console.log(`⏱️  Processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`📊 Cards processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Good buys found: ${this.stats.goodBuysFound}`);
    console.log(`🌐 API calls made: ${this.stats.apiCalls}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log(`📈 Success rate: ${successRate}%`);
  }

  // Utility function for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    // Load PSA 10 database
    console.log('📂 Loading PSA 10 database...');
    const databaseData = JSON.parse(fs.readFileSync(PSA10_DATABASE_FILE, 'utf8'));
    const cards = databaseData.items || [];
    
    if (cards.length === 0) {
      console.log('❌ No cards found in database');
      return;
    }
    
    console.log(`📊 Loaded ${cards.length} PSA 10 cards`);
    
    // Create finder and process cards
    const finder = new ImprovedApiGoodBuyFinder();
    
    // Process first 50 cards for testing
    await finder.processCards(cards, 50);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ImprovedApiGoodBuyFinder;