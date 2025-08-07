require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'api_good_buy_opportunities.json');
const CACHE_FILE = path.join(DATABASE_DIR, 'api_good_buy_cache.json');

// API Configuration
const API_BASE_URL = 'https://web-production-9efa.up.railway.app';
const SEARCH_ENDPOINT = '/api/search-cards';

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;
const MAX_CONCURRENT_SEARCHES = 3;

class ApiGoodBuyFinder {
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

  // Extract card identifier with smart search strategies
  extractCardIdentifier(psa10Title) {
    const originalTitle = psa10Title;
    const yearMatch = psa10Title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    const searchStrategies = [];

    // Strategy 1: Full card details (remove grading terms)
    let strategy1 = psa10Title
      .toLowerCase()
      .replace(/\bpsa\s*10\b/g, '')
      .replace(/\bgraded\b/g, '')
      .replace(/\bauthentic\b/g, '')
      .replace(/\bgenuine\b/g, '')
      .replace(/\bcard\b/g, '')
      .replace(/\bautograph\b/g, 'auto')
      .replace(/\bautographed\b/g, 'auto')
      .replace(/\b10\b/g, '')
      .replace(/\b9\b/g, '')
      .replace(/\b8\b/g, '')
      .replace(/\b7\b/g, '')
      .replace(/\b6\b/g, '')
      .replace(/\b5\b/g, '')
      .replace(/\b4\b/g, '')
      .replace(/\b3\b/g, '')
      .replace(/\b2\b/g, '')
      .replace(/\b1\b/g, '')
      .replace(/\b\s+/g, ' ')
      .trim();
    
    if (year) {
      strategy1 = strategy1.replace(/\b(19|20)\d{2}\b/, '').trim();
    }
    searchStrategies.push({ name: 'Full Card Details', query: strategy1, priority: 1 });

    // Strategy 2: Player + Parallel + Card Number (your suggested strategy)
    const parallelMatch = psa10Title.match(/(light blue|silver|gold|red|blue|green|purple|orange|pink|yellow|black|white|rainbow|color blast|stained glass|hyper|prizm|refractor|chrome|select|optic|contenders|donruss|prizm|topps|fleer|score|prestige|absolute|immaculate|flawless|national treasures|playoff)/i);
    const numberMatch = psa10Title.match(/#(\d+)/);
    
    if (parallelMatch && numberMatch && year) {
      const parallel = parallelMatch[1].toLowerCase();
      const cardNumber = numberMatch[1];
      const playerMatch = psa10Title.match(/([A-Za-z\s]+)\s+(?:RC|rookie|rookie card)/i);
      
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

    // Strategy 3: Simplified parallel search (remove numbered info)
    if (parallelMatch && year) {
      const parallel = parallelMatch[1].toLowerCase();
      const playerMatch = psa10Title.match(/([A-Za-z\s]+)\s+(?:RC|rookie|rookie card)/i);
      
      if (playerMatch) {
        const player = playerMatch[1].trim();
        // Remove "II", "III", "IV" etc. from player names
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Parallel Only',
          query: `${simplifiedPlayer} ${parallel} ${year}`,
          priority: 3
        });
      }
    }

    // Strategy 4: Player + RC + Year (simplified)
    const playerMatch2 = psa10Title.match(/([A-Za-z\s]+)\s+(?:RC|rookie|rookie card)/i);
    if (playerMatch2 && year) {
      const player = playerMatch2[1].trim();
      // Remove "II", "III", "IV" etc. from player names
      const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
      
      searchStrategies.push({
        name: 'Player RC',
        query: `${simplifiedPlayer} rc ${year}`,
        priority: 4
      });
    }

    // Strategy 5: Just player + year (most basic)
    if (year) {
      const playerMatch3 = psa10Title.match(/([A-Za-z\s]+)\s+\d{4}/i);
      if (playerMatch3) {
        const player = playerMatch3[1].trim();
        // Remove "II", "III", "IV" etc. from player names
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Player Year',
          query: `${simplifiedPlayer} ${year}`,
          priority: 5
        });
      }
    }

    return { 
      searchStrategies: searchStrategies.sort((a, b) => a.priority - b.priority), 
      year, 
      originalTitle 
    };
  }

  // Search using your API
  async searchCardVersions(cardInfo) {
    const { searchStrategies, originalTitle } = cardInfo;
    
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
            strategy: strategy.name
          };
        }
        continue; // Try next strategy if no raw results in cache
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
            timestamp: Date.now()
          };
          
          // Check if we found raw cards
          if (results.raw && results.raw.length > 0) {
            console.log(`✅ Found ${results.raw.length} raw cards using strategy: ${strategy.name}`);
            return {
              raw: results.raw,
              psa9: results.psa9 || [],
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
    
    return { raw: [], psa9: [], strategy: 'No results found' };
  }

  // Validate that search results match the specific card
  validateCardMatches(searchResults, originalTitle, searchType) {
    const validatedResults = [];
    const originalLower = originalTitle.toLowerCase();
    
    // Extract key characteristics
    const parallelMatch = originalLower.match(/(light blue|silver|gold|red|blue|green|purple|orange|pink|yellow|black|white|rainbow|color blast|stained glass|hyper|prizm|refractor|chrome|select|optic|contenders|donruss|prizm|topps|fleer|score|prestige|absolute|immaculate|flawless|national treasures|playoff)/);
    const parallel = parallelMatch ? parallelMatch[1] : null;
    const numberMatch = originalLower.match(/#(\d+)/);
    const cardNumber = numberMatch ? numberMatch[1] : null;
    const numberedMatch = originalLower.match(/(\d+)\/(\d+)/);
    const isNumbered = numberedMatch !== null;
    const hasAuto = originalLower.includes('auto') || originalLower.includes('autograph');
    const hasRC = originalLower.includes('rc') || originalLower.includes('rookie');

    for (const result of searchResults) {
      const resultLower = result.title.toLowerCase();
      let isValid = true;

      // Check for key characteristics
      if (parallel && !resultLower.includes(parallel)) { isValid = false; }
      if (cardNumber && !resultLower.includes(`#${cardNumber}`)) { isValid = false; }
      if (isNumbered && !resultLower.match(/\d+\/\d+/)) { isValid = false; }
      if (hasAuto && !resultLower.includes('auto')) { isValid = false; }
      if (hasRC && !resultLower.includes('rc') && !resultLower.includes('rookie')) { isValid = false; }

      if (isValid) {
        validatedResults.push(result);
      }
    }
    
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
    return Math.round(average * 100) / 100; // Round to 2 decimal places
  }

  // Process a single card
  async processCard(psa10Card) {
    const psa10Price = parseFloat(psa10Card.price?.value || 0);
    
    // Skip if PSA 10 price is too low
    if (psa10Price < MIN_PSA10_PRICE) {
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

    // Calculate multiplier
    const multiplier = psa10Price / rawPrice;
    
    if (multiplier >= TARGET_MULTIPLIER) {
      const opportunity = {
        psa10Card: {
          title: psa10Card.title,
          price: psa10Price,
          soldDate: psa10Card.soldDate
        },
        rawPrice,
        psa9Price,
        multiplier: Math.round(multiplier * 100) / 100,
        potentialProfit: Math.round((psa10Price - rawPrice) * 100) / 100,
        roi: Math.round(((psa10Price - rawPrice) / rawPrice * 100) * 100) / 100,
        searchStrategy: searchResults.strategy,
        rawCardsFound: validatedRaw.length,
        psa9CardsFound: validatedPSA9.length,
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
    console.log(`🚀 Starting API Good Buy Finder...`);
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
    
    console.log('\n📈 API GOOD BUY FINDER STATISTICS:');
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
    const finder = new ApiGoodBuyFinder();
    
    // Process first 100 cards for testing
    await finder.processCards(cards, 100);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ApiGoodBuyFinder; 