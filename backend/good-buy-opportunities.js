require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { search130point } = require('./services/130pointService');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const DATABASE_FILE = path.join(DATABASE_DIR, 'new-scorecard.db');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'good_buy_opportunities.json');
const GOOD_BUYS_SUMMARY_FILE = path.join(DATABASE_DIR, 'good_buy_opportunities_summary.json');

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10; // Minimum raw card price to consider
const MIN_PSA10_PRICE = 25; // Minimum PSA 10 price to consider

// Batch processing configuration
const BATCH_SIZE = 1000; // Process items in batches to manage memory
const MAX_CONCURRENT_SEARCHES = 5; // Limit concurrent API calls

class GoodBuyAnalyzer {
  constructor() {
    this.goodBuys = [];
    this.db = null;
    this.stats = {
      totalProcessed: 0,
      goodBuysFound: 0,
      apiCalls: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DATABASE_FILE, (err) => {
        if (err) {
          console.error('❌ Database connection failed:', err.message);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }

  // Get cards from SQLite database
  async getCardsFromDatabase() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, title, summary_title, sport, psa10_price, raw_average_price, psa9_average_price, multiplier
        FROM cards 
        WHERE psa10_price IS NOT NULL AND psa10_price > 0
        ORDER BY psa10_price DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
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

  // Search for raw and PSA 9 versions of a card
  async searchCardVersions(cardIdentifier, year) {
    const searches = [];
    
    // Create search queries
    const baseQuery = year ? `${cardIdentifier} ${year}` : cardIdentifier;
    
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
        
        const searchResults = await search130point(search.query, 50);
        
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error searching for ${search.type}:`, error.message);
        this.stats.errors++;
      }
    }
    
    return results;
  }

  // Process a batch of PSA 10 cards
  async processBatch(psa10Cards) {
    const batchPromises = [];
    
    for (const card of psa10Cards) {
      const psa10Price = parseFloat(card.psa10_price || 0);
      
      // Skip if PSA 10 price is too low
      if (psa10Price < MIN_PSA10_PRICE) continue;
      
      const { identifier, year } = this.extractCardIdentifier(card.title);
      
      // Skip if no meaningful identifier
      if (!identifier || identifier.length < 3) continue;
      
      batchPromises.push(this.processCard(card, identifier, year, psa10Price));
    }
    
    // Process with concurrency limit
    const results = [];
    for (let i = 0; i < batchPromises.length; i += MAX_CONCURRENT_SEARCHES) {
      const batch = batchPromises.slice(i, i + MAX_CONCURRENT_SEARCHES);
      const batchResults = await Promise.allSettled(batch);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
      
      // Rate limiting between batches
      if (i + MAX_CONCURRENT_SEARCHES < batchPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  // Process a single card
  async processCard(psa10Card, identifier, year, psa10Price) {
    try {
      // Use existing raw and PSA9 prices from database if available
      const rawPrice = parseFloat(psa10Card.raw_average_price || 0);
      const psa9Price = parseFloat(psa10Card.psa9_average_price || 0);
      
      // If we have raw price data, use it directly
      if (rawPrice >= MIN_RAW_PRICE) {
        const multiplier = psa10Price / rawPrice;
        
        if (multiplier >= TARGET_MULTIPLIER) {
          const opportunity = {
            card: {
              title: psa10Card.title,
              summaryTitle: psa10Card.summary_title,
              sport: psa10Card.sport,
              psa10Price,
              identifier,
              year,
              id: psa10Card.id
            },
            raw: {
              avgPrice: rawPrice,
              minPrice: rawPrice,
              maxPrice: rawPrice,
              allPrices: [rawPrice]
            },
            psa9: psa9Price > 0 ? {
              avgPrice: psa9Price,
              minPrice: psa9Price,
              maxPrice: psa9Price,
              allPrices: [psa9Price]
            } : null,
            multiplier,
            potentialProfit: psa10Price - rawPrice,
            roi: ((psa10Price - rawPrice) / rawPrice) * 100
          };
          
          this.goodBuys.push(opportunity);
          this.stats.goodBuysFound++;
          
          console.log(`✅ Good buy found: ${identifier} (${year || 'N/A'}) - ${multiplier.toFixed(2)}x multiplier`);
          console.log(`   Raw: $${rawPrice.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)} | Profit: $${opportunity.potentialProfit.toFixed(2)}`);
          
          return opportunity;
        }
      }
      
      // If no raw price data, try searching online
      const versions = await this.searchCardVersions(identifier, year);
      
      if (versions.raw && versions.raw.avgPrice >= MIN_RAW_PRICE) {
        const multiplier = psa10Price / versions.raw.avgPrice;
        
        if (multiplier >= TARGET_MULTIPLIER) {
          const opportunity = {
            card: {
              title: psa10Card.title,
              summaryTitle: psa10Card.summary_title,
              sport: psa10Card.sport,
              psa10Price,
              identifier,
              year,
              id: psa10Card.id
            },
            raw: versions.raw,
            psa9: versions.psa9,
            multiplier,
            potentialProfit: psa10Price - versions.raw.avgPrice,
            roi: ((psa10Price - versions.raw.avgPrice) / versions.raw.avgPrice) * 100
          };
          
          this.goodBuys.push(opportunity);
          this.stats.goodBuysFound++;
          
          console.log(`✅ Good buy found (online search): ${identifier} (${year || 'N/A'}) - ${multiplier.toFixed(2)}x multiplier`);
          console.log(`   Raw: $${versions.raw.avgPrice.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)} | Profit: $${opportunity.potentialProfit.toFixed(2)}`);
          
          return opportunity;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Error processing card ${identifier}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  // Load and process database in batches
  async analyzeDatabase() {
    console.log('🚀 Starting good buy analysis...');
    console.log(`📊 Target multiplier: ${TARGET_MULTIPLIER}x`);
    console.log(`💰 Min raw price: $${MIN_RAW_PRICE}`);
    console.log(`💰 Min PSA 10 price: $${MIN_PSA10_PRICE}`);
    
    try {
      await this.connect();

      // Get cards from SQLite database
      const psa10Cards = await this.getCardsFromDatabase();
      const items = psa10Cards || [];
      
      console.log(`📦 Total items to process: ${items.length}`);
      
      // Process in batches
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        console.log(`\n📋 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`);
        
        await this.processBatch(batch);
        this.stats.totalProcessed += batch.length;
        
        // Save progress periodically
        if (this.goodBuys.length > 0 && this.goodBuys.length % 10 === 0) {
          this.saveResults();
        }
      }
      
      console.log('\n✅ Analysis complete!');
      this.printStats();
      this.saveResults();
      
    } catch (error) {
      console.error('❌ Error loading database:', error.message);
    } finally {
      await this.close();
    }
  }

  // Save results to files
  saveResults() {
    try {
      // Sort by ROI (highest first)
      const sortedGoodBuys = this.goodBuys.sort((a, b) => b.roi - a.roi);
      
      // Save detailed results
      const results = {
        metadata: {
          created: new Date().toISOString(),
          targetMultiplier: TARGET_MULTIPLIER,
          minRawPrice: MIN_RAW_PRICE,
          minPsa10Price: MIN_PSA10_PRICE,
          totalProcessed: this.stats.totalProcessed,
          goodBuysFound: this.stats.goodBuysFound,
          apiCalls: this.stats.apiCalls,
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

  // Create summary statistics
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
    
    fs.writeFileSync(GOOD_BUYS_SUMMARY_FILE, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary saved to ${GOOD_BUYS_SUMMARY_FILE}`);
  }

  // Print statistics
  printStats() {
    const processingTime = (Date.now() - this.stats.startTime) / 1000;
    console.log('\n📈 ANALYSIS STATISTICS:');
    console.log(`⏱️  Processing time: ${processingTime.toFixed(2)} seconds`);
    console.log(`📊 Total cards processed: ${this.stats.totalProcessed}`);
    console.log(`✅ Good buys found: ${this.stats.goodBuysFound}`);
    console.log(`🌐 API calls made: ${this.stats.apiCalls}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log(`📈 Success rate: ${((this.stats.goodBuysFound / this.stats.totalProcessed) * 100).toFixed(2)}%`);
  }
}

// Main execution
async function main() {
  const analyzer = new GoodBuyAnalyzer();
  await analyzer.analyzeDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = GoodBuyAnalyzer; 