require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'quick_good_buy_test.json');

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;
const MAX_CARDS_TO_TEST = 50; // Only test first 50 cards

class QuickGoodBuyTest {
  constructor() {
    this.goodBuys = [];
    this.stats = {
      totalProcessed: 0,
      goodBuysFound: 0,
      apiCalls: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  // Extract card identifier with your exact strategy
  extractCardIdentifier(psa10Title) {
    const originalTitle = psa10Title;
    
    // Extract year first
    const yearMatch = psa10Title.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    
    // Create search strategies
    const searchStrategies = [];
    
    // Strategy 1: Player + Parallel + Card Number (your exact strategy)
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
          priority: 1
        });
      }
    }

    // Strategy 2: Simplified parallel search
    if (parallelMatch) {
      const parallel = parallelMatch[1].toLowerCase();
      const playerMatch = psa10Title.match(/([A-Za-z\s]+)\s+(?:RC|rookie|rookie card)/i);
      
      if (playerMatch && year) {
        const player = playerMatch[1].trim();
        const simplifiedPlayer = player.replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/i, '').trim();
        
        searchStrategies.push({
          name: 'Parallel Only',
          query: `${simplifiedPlayer} ${parallel}`,
          priority: 2
        });
      }
    }

    return { 
      searchStrategies: searchStrategies.sort((a, b) => a.priority - b.priority),
      year,
      originalTitle 
    };
  }

  // Search card versions with validation
  async searchCardVersions(cardInfo) {
    const { searchStrategies, year, originalTitle } = cardInfo;
    
    // Try each search strategy until we find good results
    for (const strategy of searchStrategies) {
      const baseQuery = year ? `${strategy.query} ${year}` : strategy.query;
      
      // Raw card search (exclude graded terms)
      const rawQuery = `${baseQuery} -psa -bgs -cgc -sgc -tag -graded`;
      
      try {
        this.stats.apiCalls++;
        console.log(`🔍 Testing: "${rawQuery}" (${strategy.name})`);
        
        const searchResults = await search130point(rawQuery, 30);
        
        if (searchResults && searchResults.length > 0) {
          // Validate results to ensure they match the specific card type
          const validatedResults = this.validateCardMatches(searchResults, originalTitle);
          
          if (validatedResults.length > 0) {
            // Calculate average price
            const validPrices = validatedResults
              .filter(item => item.price && item.price.value && parseFloat(item.price.value) > 0)
              .map(item => parseFloat(item.price.value));
            
            if (validPrices.length > 0) {
              const avgPrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
              
              return {
                raw: {
                  avgPrice,
                  count: validPrices.length,
                  minPrice: Math.min(...validPrices),
                  maxPrice: Math.max(...validPrices),
                  validatedCount: validatedResults.length,
                  strategy: strategy.name
                }
              };
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error:`, error.message);
        this.stats.errors++;
      }
    }
    
    return null;
  }

  // Validate card matches
  validateCardMatches(searchResults, originalTitle) {
    const validatedResults = [];
    const originalLower = originalTitle.toLowerCase();
    
    // Extract key identifiers
    const parallelMatch = originalLower.match(/(light blue|silver|gold|red|blue|green|purple|orange|pink|yellow|black|white|rainbow|color blast|stained glass|hyper|prizm|refractor|chrome|select|optic|contenders|donruss|prizm|topps|fleer|score|prestige|absolute|immaculate|flawless|national treasures|playoff)/);
    const parallel = parallelMatch ? parallelMatch[1] : null;
    const numberMatch = originalLower.match(/#(\d+)/);
    const cardNumber = numberMatch ? numberMatch[1] : null;
    const hasRC = originalLower.includes('rc') || originalLower.includes('rookie');
    
    for (const result of searchResults) {
      const resultLower = result.title.toLowerCase();
      let isValid = true;
      
      // Check parallel type
      if (parallel && !resultLower.includes(parallel)) {
        isValid = false;
      }
      
      // Check card number
      if (cardNumber && !resultLower.includes(`#${cardNumber}`)) {
        isValid = false;
      }
      
      // Check RC designation
      if (hasRC && !resultLower.includes('rc') && !resultLower.includes('rookie')) {
        isValid = false;
      }
      
      if (isValid) {
        validatedResults.push(result);
      }
    }
    
    return validatedResults;
  }

  // Process a single card
  async processCard(card) {
    const psa10Price = parseFloat(card.price?.value || 0);
    
    if (psa10Price < MIN_PSA10_PRICE) {
      return; // Skip low-value cards
    }
    
    const cardInfo = this.extractCardIdentifier(card.title);
    
    if (cardInfo.searchStrategies.length === 0) {
      return; // Skip cards without search strategies
    }
    
    const versions = await this.searchCardVersions(cardInfo);
    
    if (versions && versions.raw && versions.raw.avgPrice >= MIN_RAW_PRICE) {
      const multiplier = psa10Price / versions.raw.avgPrice;
      
      if (multiplier >= TARGET_MULTIPLIER) {
        const opportunity = {
          title: card.title,
          psa10Price,
          rawPrice: versions.raw.avgPrice,
          multiplier,
          roi: ((psa10Price - versions.raw.avgPrice) / versions.raw.avgPrice) * 100,
          potentialProfit: psa10Price - versions.raw.avgPrice,
          searchStrategy: versions.raw.strategy,
          validatedMatches: versions.raw.validatedCount || 0
        };
        
        this.goodBuys.push(opportunity);
        console.log(`✅ Good buy found: ${multiplier.toFixed(2)}x multiplier`);
        console.log(`   Raw: $${versions.raw.avgPrice.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)} | Strategy: ${versions.raw.strategy}`);
        console.log('');
      }
    }
    
    this.stats.totalProcessed++;
  }

  // Run the quick test
  async runQuickTest() {
    try {
      console.log('📊 Loading PSA 10 database...');
      const data = JSON.parse(fs.readFileSync(PSA10_DATABASE_FILE, 'utf8'));
      
      if (!data.items || data.items.length === 0) {
        console.log('❌ No items found in database');
        return;
      }
      
      console.log(`📦 Total items in database: ${data.items.length}`);
      console.log(`🧪 Testing first ${MAX_CARDS_TO_TEST} cards...\n`);
      
      // Process only the first MAX_CARDS_TO_TEST cards
      const cardsToTest = data.items.slice(0, MAX_CARDS_TO_TEST);
      
      for (const card of cardsToTest) {
        await this.processCard(card);
        
        // Show progress
        if (this.stats.totalProcessed % 10 === 0) {
          console.log(`📊 Processed ${this.stats.totalProcessed}/${MAX_CARDS_TO_TEST} cards...`);
        }
      }
      
      // Save results
      this.saveResults();
      this.printStats();
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  // Save results
  saveResults() {
    try {
      const sortedOpportunities = this.goodBuys.sort((a, b) => b.multiplier - a.multiplier);
      fs.writeFileSync(GOOD_BUYS_FILE, JSON.stringify(sortedOpportunities, null, 2));
      console.log(`💾 Saved ${sortedOpportunities.length} opportunities to ${GOOD_BUYS_FILE}`);
    } catch (error) {
      console.error('❌ Error saving results:', error.message);
    }
  }

  // Print statistics
  printStats() {
    const processingTime = (Date.now() - this.stats.startTime) / 1000;
    const successRate = this.stats.totalProcessed > 0 ? (this.goodBuys.length / this.stats.totalProcessed) * 100 : 0;
    
    console.log('\n📈 QUICK TEST STATISTICS:');
    console.log(`⏱️  Processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`📊 Cards processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Good buys found: ${this.goodBuys.length}`);
    console.log(`🌐 API calls made: ${this.stats.apiCalls}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log(`📈 Success rate: ${successRate.toFixed(2)}%`);
  }
}

async function main() {
  const test = new QuickGoodBuyTest();
  await test.runQuickTest();
}

if (require.main === module) {
  main().catch(console.error);
} 