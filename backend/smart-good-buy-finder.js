require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'smart_good_buy_opportunities.json');
const CACHE_FILE = path.join(DATABASE_DIR, 'smart_good_buy_cache.json');
const SEARCH_HISTORY_FILE = path.join(DATABASE_DIR, 'search_history.json');

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;
const MAX_CONCURRENT_SEARCHES = 3;

class SmartGoodBuyFinder {
  constructor() {
    this.goodBuys = [];
    this.cache = this.loadCache();
    this.searchHistory = this.loadSearchHistory();
    this.stats = {
      totalProcessed: 0,
      goodBuysFound: 0,
      apiCalls: 0,
      cacheHits: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  // Load existing cache
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch (error) {
      console.log('⚠️ No cache found, starting fresh');
    }
    return {};
  }

  // Load search history for additional data
  loadSearchHistory() {
    try {
      if (fs.existsSync(SEARCH_HISTORY_FILE)) {
        const history = JSON.parse(fs.readFileSync(SEARCH_HISTORY_FILE, 'utf8'));
        return history.searches || [];
      }
    } catch (error) {
      console.log('⚠️ No search history found');
    }
    return [];
  }

  // Save cache
  saveCache() {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('❌ Error saving cache:', error.message);
    }
  }

  // SMART: Extract card identifier with simplified strategies
  extractCardIdentifier(psa10Title) {
    const originalTitle = psa10Title;
    
    // Extract year first
    const yearMatch = psa10Title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    
    // Create multiple simplified search strategies
    const searchStrategies = [];
    
    // Strategy 1: Full card details but simplified
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
      .replace(/\b0\b/g, '')
      .replace(/\b\.5\b/g, '')
      .replace(/\b\.0\b/g, '')
      .replace(/\b\.\b/g, '')
      .replace(/\b\s+/g, ' ')
      .trim();

    // Remove year from strategy1
    if (year) {
      strategy1 = strategy1.replace(/\b(19|20)\d{2}\b/, '').trim();
    }
    
    searchStrategies.push({
      name: 'Full Card',
      query: strategy1,
      priority: 1
    });

    // Strategy 2: Player + Parallel + Card Number (your exact strategy)
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
          query: `${simplifiedPlayer} ${parallel} #${cardNumber}`,
          priority: 2
        });
      }
    }

    // Strategy 3: Simplified parallel search (remove numbered info)
    if (parallelMatch) {
      const parallel = parallelMatch[1].toLowerCase();
      const playerMatch = psa10Title.match(/([A-Za-z\s]+)\s+(?:RC|rookie|rookie card)/i);
      
      if (playerMatch && year) {
        const player = playerMatch[1].trim();
        // Remove "II", "III", "IV" etc. from player names
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Parallel Only',
          query: `${simplifiedPlayer} ${parallel}`,
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
        query: `${simplifiedPlayer} rc`,
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

  // Check if we have cached data for this card
  getCachedData(identifier, year) {
    const key = `${identifier}_${year || 'no_year'}`;
    return this.cache[key];
  }

  // Check search history for existing data
  findInSearchHistory(identifier, year) {
    const baseQuery = year ? `${identifier} ${year}` : identifier;
    
    for (const search of this.searchHistory) {
      if (search.searchQuery && search.searchQuery.toLowerCase().includes(identifier.toLowerCase())) {
        if (search.priceAnalysis) {
          return {
            raw: search.priceAnalysis.raw,
            psa9: search.priceAnalysis.psa9,
            psa10: search.priceAnalysis.psa10
          };
        }
      }
    }
    
    return null;
  }

  // SMART: Search card versions with strict validation
  async searchCardVersions(cardInfo) {
    const { searchStrategies, year, originalTitle } = cardInfo;
    
    // Try each search strategy until we find good results
    for (const strategy of searchStrategies) {
      const cacheKey = `${strategy.query}_${year || 'no_year'}_${strategy.name}`;
      
      // Check cache first
      if (this.cache[cacheKey]) {
        this.stats.cacheHits++;
        console.log(`📋 Cache hit for: ${strategy.query} (${strategy.name})`);
        return this.cache[cacheKey];
      }

      // Check search history
      const historyData = this.findInSearchHistory(strategy.query, year);
      if (historyData && historyData.raw && historyData.raw.avgPrice > 0) {
        console.log(`📚 Found in search history: ${strategy.query} (${strategy.name})`);
        this.cache[cacheKey] = historyData;
        this.saveCache();
        return historyData;
      }

      const searches = [];
      const baseQuery = year ? `${strategy.query} ${year}` : strategy.query;
      
      // Raw card search (exclude graded terms)
      searches.push({
        query: `${baseQuery} -psa -bgs -cgc -sgc -tag -graded`,
        type: 'raw'
      });
      
      // PSA 9 search
      searches.push({
        query: `${baseQuery} psa 9`,
        type: 'psa9'
      });

      const results = { raw: null, psa9: null };
      
      // Execute searches with rate limiting
      for (const search of searches) {
        try {
          this.stats.apiCalls++;
          console.log(`🔍 Searching for ${search.type}: "${search.query}" (${strategy.name})`);
          
          const searchResults = await search130point(search.query, 30);
          
          if (searchResults && searchResults.length > 0) {
            // STRICT VALIDATION: Only use results that match the specific card type
            const validatedResults = this.validateCardMatches(searchResults, originalTitle, search.type);
            
            if (validatedResults.length > 0) {
              // Filter and calculate average price
              const validPrices = validatedResults
                .filter(item => item.price && item.price.value && parseFloat(item.price.value) > 0)
                .map(item => parseFloat(item.price.value));
              
              if (validPrices.length > 0) {
                // Remove outliers (prices > 2x median)
                const sortedPrices = validPrices.sort((a, b) => a - b);
                const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
                const filteredPrices = sortedPrices.filter(price => price <= median * 2);
                
                if (filteredPrices.length > 0) {
                  const avgPrice = filteredPrices.reduce((a, b) => a + b, 0) / filteredPrices.length;
                  results[search.type] = {
                    avgPrice,
                    count: filteredPrices.length,
                    minPrice: Math.min(...filteredPrices),
                    maxPrice: Math.max(...filteredPrices),
                    allPrices: filteredPrices,
                    validatedCount: validatedResults.length,
                    strategy: strategy.name
                  };
                }
              }
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (error) {
          console.error(`❌ Error searching for ${search.type}:`, error.message);
          this.stats.errors++;
        }
      }
      
      // If we found good results, cache and return
      if (results.raw && results.raw.avgPrice > 0) {
        console.log(`✅ Found good results with strategy: ${strategy.name} (${results.raw.validatedCount} validated matches)`);
        this.cache[cacheKey] = results;
        this.saveCache();
        return results;
      }
    }
    
    // If no strategy worked, return null (no fake data)
    console.log(`❌ No search strategy found good results for: ${originalTitle}`);
    return null;
  }

  // STRICT VALIDATION: Ensure search results match the specific card type
  validateCardMatches(searchResults, originalTitle, searchType) {
    const validatedResults = [];
    
    // Extract key identifiers from original PSA 10 title
    const originalLower = originalTitle.toLowerCase();
    
    // Extract parallel type if present
    const parallelMatch = originalLower.match(/(light blue|silver|gold|red|blue|green|purple|orange|pink|yellow|black|white|rainbow|color blast|stained glass|hyper|prizm|refractor|chrome|select|optic|contenders|donruss|prizm|topps|fleer|score|prestige|absolute|immaculate|flawless|national treasures|playoff)/);
    const parallel = parallelMatch ? parallelMatch[1] : null;
    
    // Extract card number if present
    const numberMatch = originalLower.match(/#(\d+)/);
    const cardNumber = numberMatch ? numberMatch[1] : null;
    
    // Extract numbered parallel info if present
    const numberedMatch = originalLower.match(/(\d+)\/(\d+)/);
    const isNumbered = numberedMatch !== null;
    
    // Extract auto info
    const hasAuto = originalLower.includes('auto') || originalLower.includes('autograph');
    
    // Extract RC info
    const hasRC = originalLower.includes('rc') || originalLower.includes('rookie');
    
    // Extract player name (simplified)
    const playerMatch = originalLower.match(/([a-z\s]+)\s+(?:rc|rookie|rookie card)/i);
    const player = playerMatch ? playerMatch[1].trim() : null;
    
    for (const result of searchResults) {
      const resultLower = result.title.toLowerCase();
      let isValid = true;
      
      // Check if result has the same parallel type (if original has one)
      if (parallel && !resultLower.includes(parallel)) {
        isValid = false;
      }
      
      // Check if result has the same card number (if original has one)
      if (cardNumber && !resultLower.includes(`#${cardNumber}`)) {
        isValid = false;
      }
      
      // Check if result has numbered parallel info (if original has it)
      if (isNumbered && !resultLower.match(/\d+\/\d+/)) {
        isValid = false;
      }
      
      // Check if result has auto (if original has it)
      if (hasAuto && !resultLower.includes('auto')) {
        isValid = false;
      }
      
      // Check if result has RC designation (if original has it)
      if (hasRC && !resultLower.includes('rc') && !resultLower.includes('rookie')) {
        isValid = false;
      }
      
      // Check if result has the same player (simplified)
      if (player) {
        const simplifiedPlayer = player.replace(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)\b/i, '').trim();
        const resultPlayerMatch = resultLower.match(/([a-z\s]+)\s+(?:rc|rookie|rookie card)/i);
        if (resultPlayerMatch) {
          const resultPlayer = resultPlayerMatch[1].trim();
          const simplifiedResultPlayer = resultPlayer.replace(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)\b/i, '').trim();
          
          if (simplifiedPlayer !== simplifiedResultPlayer) {
            isValid = false;
          }
        } else {
          // If no RC match, check if player name appears anywhere
          if (!resultLower.includes(simplifiedPlayer)) {
            isValid = false;
          }
        }
      }
      
      if (isValid) {
        validatedResults.push(result);
      }
    }
    
    return validatedResults;
  }

  // Pre-filter PSA 10 cards to reduce processing
  preFilterCards(psa10Cards) {
    return psa10Cards.filter(card => {
      const price = parseFloat(card.price?.value || 0);
      return price >= MIN_PSA10_PRICE;
    });
  }

  // Process cards efficiently
  async processCards(psa10Cards) {
    console.log(`🔍 Pre-filtering ${psa10Cards.length} PSA 10 cards...`);
    const filteredCards = this.preFilterCards(psa10Cards);
    console.log(`📊 After filtering: ${filteredCards.length} cards meet minimum price criteria`);
    
    // Group similar cards to reduce API calls
    const cardGroups = this.groupSimilarCards(filteredCards);
    console.log(`📦 Grouped into ${cardGroups.length} unique card types`);
    
    // Process each group
    for (let i = 0; i < cardGroups.length; i += MAX_CONCURRENT_SEARCHES) {
      const batch = cardGroups.slice(i, i + MAX_CONCURRENT_SEARCHES);
      console.log(`\n📋 Processing batch ${Math.floor(i / MAX_CONCURRENT_SEARCHES) + 1}/${Math.ceil(cardGroups.length / MAX_CONCURRENT_SEARCHES)}`);
      
      await Promise.all(batch.map(group => this.processCardGroup(group)));
    }
  }

  // Group similar cards to reduce API calls
  groupSimilarCards(cards) {
    const groups = {};
    
    cards.forEach(card => {
      const cardInfo = this.extractCardIdentifier(card.title);
      const key = cardInfo.searchStrategies[0].query + '_' + (cardInfo.year || 'no_year');
      
      if (!groups[key]) {
        groups[key] = {
          cards: [],
          cardInfo: cardInfo
        };
      }
      groups[key].cards.push(card);
    });
    
    return Object.values(groups);
  }

  // Process a group of similar cards
  async processCardGroup(group) {
    const { cards, cardInfo } = group;
    const psa10Price = parseFloat(cards[0].price?.value || 0);
    
    // Search for raw and PSA 9 versions
    const versions = await this.searchCardVersions(cardInfo);
    
    if (versions && versions.raw && versions.raw.avgPrice >= MIN_RAW_PRICE) {
      const multiplier = psa10Price / versions.raw.avgPrice;
      
      if (multiplier >= TARGET_MULTIPLIER) {
        const opportunity = {
          title: cards[0].title,
          psa10Price,
          rawPrice: versions.raw.avgPrice,
          psa9Price: versions.psa9?.avgPrice || 0,
          multiplier,
          roi: ((psa10Price - versions.raw.avgPrice) / versions.raw.avgPrice) * 100,
          potentialProfit: psa10Price - versions.raw.avgPrice,
          count: cards.length,
          searchStrategy: versions.raw.strategy,
          validatedMatches: versions.raw.validatedCount || 0,
          rawData: versions.raw,
          psa9Data: versions.psa9
        };
        
        this.goodBuys.push(opportunity);
        console.log(`✅ Good buy group found: ${cardInfo.searchStrategies[0].query} (${cardInfo.year || 'N/A'}) - ${multiplier.toFixed(2)}x multiplier`);
        console.log(`   Raw: $${versions.raw.avgPrice.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)} | Count: ${cards.length} | Validated: ${versions.raw.validatedCount || 0}`);
      }
    }
    
    this.stats.totalProcessed += cards.length;
  }

  // Analyze the entire database
  async analyzeDatabase() {
    try {
      console.log('📊 Loading PSA 10 database...');
      const data = JSON.parse(fs.readFileSync(PSA10_DATABASE_FILE, 'utf8'));
      
      if (!data.items || data.items.length === 0) {
        console.log('❌ No items found in database');
        return;
      }
      
      console.log(`📦 Total items in database: ${data.items.length}`);
      
      // Process all cards
      await this.processCards(data.items);
      
      // Save results
      this.saveResults();
      
      // Print statistics
      this.printStats();
      
    } catch (error) {
      console.error('❌ Error analyzing database:', error.message);
    }
  }

  // Save results to file
  saveResults() {
    try {
      // Sort by multiplier (highest first)
      const sortedOpportunities = this.goodBuys.sort((a, b) => b.multiplier - a.multiplier);
      
      // Save detailed results
      fs.writeFileSync(GOOD_BUYS_FILE, JSON.stringify(sortedOpportunities, null, 2));
      console.log(`💾 Saved ${sortedOpportunities.length} opportunities to ${GOOD_BUYS_FILE}`);
      
      // Create and save summary
      const summary = this.createSummary(sortedOpportunities);
      const summaryFile = GOOD_BUYS_FILE.replace('.json', '_summary.json');
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
      console.log(`📊 Summary saved to ${summaryFile}`);
      
    } catch (error) {
      console.error('❌ Error saving results:', error.message);
    }
  }

  // Create summary statistics
  createSummary(opportunities) {
    const totalOpportunities = opportunities.length;
    const totalPotentialProfit = opportunities.reduce((sum, opp) => sum + opp.potentialProfit, 0);
    const avgMultiplier = opportunities.reduce((sum, opp) => sum + opp.multiplier, 0) / totalOpportunities;
    const avgROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / totalOpportunities;
    
    return {
      totalOpportunities,
      totalPotentialProfit,
      avgMultiplier,
      avgROI,
      topOpportunities: opportunities.slice(0, 10).map(opp => ({
        title: opp.title,
        multiplier: opp.multiplier,
        roi: opp.roi,
        potentialProfit: opp.potentialProfit,
        rawPrice: opp.rawPrice,
        psa10Price: opp.psa10Price,
        validatedMatches: opp.validatedMatches,
        searchStrategy: opp.searchStrategy
      })),
      processingStats: this.stats
    };
  }

  // Print processing statistics
  printStats() {
    const processingTime = (Date.now() - this.stats.startTime) / 1000;
    const successRate = this.stats.totalProcessed > 0 ? (this.goodBuys.length / this.stats.totalProcessed) * 100 : 0;
    const cacheEfficiency = this.stats.apiCalls > 0 ? (this.stats.cacheHits / this.stats.apiCalls) * 100 : 0;
    
    console.log('\n📈 ANALYSIS STATISTICS:');
    console.log(`⏱️  Processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`📊 Total cards processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Good buys found: ${this.goodBuys.length}`);
    console.log(`🌐 API calls made: ${this.stats.apiCalls}`);
    console.log(`📋 Cache hits: ${this.stats.cacheHits}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log(`📈 Success rate: ${successRate.toFixed(2)}%`);
    console.log(`💾 Cache efficiency: ${cacheEfficiency.toFixed(2)}%`);
  }
}

async function main() {
  const finder = new SmartGoodBuyFinder();
  await finder.analyzeDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SmartGoodBuyFinder; 