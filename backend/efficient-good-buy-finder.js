require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'efficient_good_buy_opportunities.json');
const CACHE_FILE = path.join(DATABASE_DIR, 'good_buy_cache.json');
const SEARCH_HISTORY_FILE = path.join(DATABASE_DIR, 'search_history.json');

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;
const MAX_CONCURRENT_SEARCHES = 3;

class EfficientGoodBuyFinder {
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

  // Extract card identifier from PSA 10 title
  extractCardIdentifier(psa10Title) {
    // Remove PSA 10 and common grading terms
    let identifier = psa10Title
      .toLowerCase()
      .replace(/\bpsa\s*10\b/g, '')
      .replace(/\bgraded\b/g, '')
      .replace(/\bauthentic\b/g, '')
      .replace(/\bgenuine\b/g, '')
      .replace(/\bcard\b/g, '')
      .replace(/\bautograph\b/g, 'auto')
      .replace(/\bautographed\b/g, 'auto')
      .replace(/\bpatch\b/g, '')
      .replace(/\brelic\b/g, '')
      .replace(/\bnumbered\b/g, '')
      .replace(/\bparallel\b/g, '')
      .replace(/\brefractor\b/g, '')
      .replace(/\bchrome\b/g, '')
      .replace(/\bprizm\b/g, '')
      .replace(/\bselect\b/g, '')
      .replace(/\boptic\b/g, '')
      .replace(/\bcontenders\b/g, '')
      .replace(/\bpanini\b/g, '')
      .replace(/\btopps\b/g, '')
      .replace(/\bdonruss\b/g, '')
      .replace(/\bfleer\b/g, '')
      .replace(/\bscore\b/g, '')
      .replace(/\bprestige\b/g, '')
      .replace(/\babsolute\b/g, '')
      .replace(/\bimmaculate\b/g, '')
      .replace(/\bflawless\b/g, '')
      .replace(/\bnational\s*treasures\b/g, '')
      .replace(/\bcontenders\b/g, '')
      .replace(/\bplayoff\b/g, '')
      .replace(/\bselect\b/g, '')
      .replace(/\bprizm\b/g, '')
      .replace(/\boptic\b/g, '')
      .replace(/\bchrome\b/g, '')
      .replace(/\brefractor\b/g, '')
      .replace(/\bparallel\b/g, '')
      .replace(/\bnumbered\b/g, '')
      .replace(/\bpatch\b/g, '')
      .replace(/\brelic\b/g, '')
      .replace(/\bauto\b/g, '')
      .replace(/\bautograph\b/g, '')
      .replace(/\bautographed\b/g, '')
      .replace(/\bgenuine\b/g, '')
      .replace(/\bauthentic\b/g, '')
      .replace(/\bcard\b/g, '')
      .replace(/\bgraded\b/g, '')
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

    // Extract year if present
    const yearMatch = identifier.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    
    // Remove year from identifier for better matching
    if (year) {
      identifier = identifier.replace(/\b(19|20)\d{2}\b/, '').trim();
    }

    return { identifier, year };
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

  // Search for card versions with caching
  async searchCardVersions(identifier, year) {
    const cacheKey = `${identifier}_${year || 'no_year'}`;
    
    // Check cache first
    if (this.cache[cacheKey]) {
      this.stats.cacheHits++;
      console.log(`📋 Cache hit for: ${identifier} (${year || 'N/A'})`);
      return this.cache[cacheKey];
    }

    // Check search history
    const historyData = this.findInSearchHistory(identifier, year);
    if (historyData && historyData.raw && historyData.raw.avgPrice > 0) {
      console.log(`📚 Found in search history: ${identifier} (${year || 'N/A'})`);
      this.cache[cacheKey] = historyData;
      this.saveCache();
      return historyData;
    }

    const searches = [];
    const baseQuery = year ? `${identifier} ${year}` : identifier;
    
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
        console.log(`🔍 Searching for ${search.type}: "${search.query}"`);
        
        const searchResults = await search130point(search.query, 30);
        
        if (searchResults && searchResults.length > 0) {
          // Filter and calculate average price
          const validPrices = searchResults
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
                allPrices: filteredPrices
              };
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
    
    // Cache the results
    this.cache[cacheKey] = results;
    this.saveCache();
    
    return results;
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
    
    const opportunities = [];
    
    // Process each group
    for (let i = 0; i < cardGroups.length; i += MAX_CONCURRENT_SEARCHES) {
      const batch = cardGroups.slice(i, i + MAX_CONCURRENT_SEARCHES);
      console.log(`\n📋 Processing batch ${Math.floor(i / MAX_CONCURRENT_SEARCHES) + 1}/${Math.ceil(cardGroups.length / MAX_CONCURRENT_SEARCHES)}`);
      
      const batchPromises = batch.map(group => this.processCardGroup(group));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          opportunities.push(...result.value);
        }
      }
      
      // Rate limiting between batches
      if (i + MAX_CONCURRENT_SEARCHES < cardGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    return opportunities;
  }

  // Group similar cards to reduce API calls
  groupSimilarCards(cards) {
    const groups = {};
    
    for (const card of cards) {
      const { identifier, year } = this.extractCardIdentifier(card.title);
      
      if (!identifier || identifier.length < 3) continue;
      
      const key = `${identifier}_${year || 'no_year'}`;
      
      if (!groups[key]) {
        groups[key] = {
          identifier,
          year,
          cards: [],
          avgPsa10Price: 0
        };
      }
      
      groups[key].cards.push(card);
    }
    
    // Calculate average PSA 10 price for each group
    Object.values(groups).forEach(group => {
      const prices = group.cards.map(card => parseFloat(card.price?.value || 0)).filter(p => p > 0);
      group.avgPsa10Price = prices.reduce((a, b) => a + b, 0) / prices.length;
    });
    
    return Object.values(groups);
  }

  // Process a group of similar cards
  async processCardGroup(group) {
    try {
      const versions = await this.searchCardVersions(group.identifier, group.year);
      
      if (versions.raw && versions.raw.avgPrice >= MIN_RAW_PRICE) {
        const multiplier = group.avgPsa10Price / versions.raw.avgPrice;
        
        if (multiplier >= TARGET_MULTIPLIER) {
          const opportunities = group.cards.map(card => {
            const psa10Price = parseFloat(card.price?.value || 0);
            return {
              card: {
                title: card.title,
                psa10Price,
                identifier: group.identifier,
                year: group.year,
                soldDate: card.soldDate,
                itemUrl: card.itemUrl
              },
              raw: versions.raw,
              psa9: versions.psa9,
              multiplier,
              potentialProfit: psa10Price - versions.raw.avgPrice,
              roi: ((psa10Price - versions.raw.avgPrice) / versions.raw.avgPrice) * 100
            };
          });
          
          this.goodBuys.push(...opportunities);
          this.stats.goodBuysFound += opportunities.length;
          
          console.log(`✅ Good buy group found: ${group.identifier} (${group.year || 'N/A'}) - ${multiplier.toFixed(2)}x multiplier`);
          console.log(`   Raw: $${versions.raw.avgPrice.toFixed(2)} | PSA 10: $${group.avgPsa10Price.toFixed(2)} | Count: ${opportunities.length}`);
          
          return opportunities;
        }
      }
      
      return [];
      
    } catch (error) {
      console.error(`❌ Error processing card group ${group.identifier}:`, error.message);
      this.stats.errors++;
      return [];
    }
  }

  // Main analysis function
  async analyzeDatabase() {
    console.log('🚀 Starting efficient good buy analysis...');
    console.log(`📊 Target multiplier: ${TARGET_MULTIPLIER}x`);
    console.log(`💰 Min raw price: $${MIN_RAW_PRICE}`);
    console.log(`💰 Min PSA 10 price: $${MIN_PSA10_PRICE}`);
    
    try {
      // Load database
      const database = JSON.parse(fs.readFileSync(PSA10_DATABASE_FILE, 'utf8'));
      const items = database.items || [];
      
      console.log(`📦 Total items in database: ${items.length}`);
      
      // Process cards
      await this.processCards(items);
      this.stats.totalProcessed = items.length;
      
      console.log('\n✅ Analysis complete!');
      this.printStats();
      this.saveResults();
      
    } catch (error) {
      console.error('❌ Error loading database:', error.message);
    }
  }

  // Save results
  saveResults() {
    try {
      // Sort by ROI (highest first)
      const sortedGoodBuys = this.goodBuys.sort((a, b) => b.roi - a.roi);
      
      const results = {
        metadata: {
          created: new Date().toISOString(),
          targetMultiplier: TARGET_MULTIPLIER,
          minRawPrice: MIN_RAW_PRICE,
          minPsa10Price: MIN_PSA10_PRICE,
          totalProcessed: this.stats.totalProcessed,
          goodBuysFound: this.stats.goodBuysFound,
          apiCalls: this.stats.apiCalls,
          cacheHits: this.stats.cacheHits,
          errors: this.stats.errors,
          processingTime: Date.now() - this.stats.startTime
        },
        opportunities: sortedGoodBuys
      };
      
      fs.writeFileSync(GOOD_BUYS_FILE, JSON.stringify(results, null, 2));
      console.log(`💾 Saved ${sortedGoodBuys.length} opportunities to ${GOOD_BUYS_FILE}`);
      
      // Create summary
      this.createSummary(sortedGoodBuys);
      
    } catch (error) {
      console.error('❌ Error saving results:', error.message);
    }
  }

  // Create summary
  createSummary(opportunities) {
    const summary = {
      totalOpportunities: opportunities.length,
      averageMultiplier: opportunities.reduce((sum, opp) => sum + opp.multiplier, 0) / opportunities.length,
      averageROI: opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length,
      averagePotentialProfit: opportunities.reduce((sum, opp) => sum + opp.potentialProfit, 0) / opportunities.length,
      topOpportunities: opportunities.slice(0, 20).map(opp => ({
        title: opp.card.title,
        multiplier: opp.multiplier,
        roi: opp.roi,
        rawPrice: opp.raw.avgPrice,
        psa10Price: opp.card.psa10Price,
        potentialProfit: opp.potentialProfit
      })),
      priceRanges: {
        under50: opportunities.filter(opp => opp.raw.avgPrice < 50).length,
        under100: opportunities.filter(opp => opp.raw.avgPrice < 100).length,
        under200: opportunities.filter(opp => opp.raw.avgPrice < 200).length,
        over200: opportunities.filter(opp => opp.raw.avgPrice >= 200).length
      },
      multiplierRanges: {
        '2.3-3x': opportunities.filter(opp => opp.multiplier >= 2.3 && opp.multiplier < 3).length,
        '3-5x': opportunities.filter(opp => opp.multiplier >= 3 && opp.multiplier < 5).length,
        '5-10x': opportunities.filter(opp => opp.multiplier >= 5 && opp.multiplier < 10).length,
        '10x+': opportunities.filter(opp => opp.multiplier >= 10).length
      }
    };
    
    const summaryFile = GOOD_BUYS_FILE.replace('.json', '_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary saved to ${summaryFile}`);
  }

  // Print statistics
  printStats() {
    const processingTime = (Date.now() - this.stats.startTime) / 1000;
    console.log('\n📈 ANALYSIS STATISTICS:');
    console.log(`⏱️  Processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`📊 Total cards processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Good buys found: ${this.stats.goodBuysFound}`);
    console.log(`🌐 API calls made: ${this.stats.apiCalls}`);
    console.log(`📋 Cache hits: ${this.stats.cacheHits}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log(`📈 Success rate: ${((this.stats.goodBuysFound / this.stats.totalProcessed) * 100).toFixed(2)}%`);
    console.log(`💾 Cache efficiency: ${((this.stats.cacheHits / (this.stats.apiCalls + this.stats.cacheHits)) * 100).toFixed(2)}%`);
  }
}

// Main execution
async function main() {
  const finder = new EfficientGoodBuyFinder();
  await finder.analyzeDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EfficientGoodBuyFinder; 