require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { search130point } = require('./services/130pointService');

// Configuration
const DATABASE_DIR = path.join(__dirname, 'data');
const PSA10_DATABASE_FILE = path.join(DATABASE_DIR, 'psa10_recent_90_days_database.json');
const GOOD_BUYS_FILE = path.join(DATABASE_DIR, 'simple_good_buy_opportunities.json');

// Target multiplier for good buy opportunities
const TARGET_MULTIPLIER = 2.3;
const MIN_RAW_PRICE = 10;
const MIN_PSA10_PRICE = 25;
const TEST_SAMPLE_SIZE = 5; // Start with just 5 cards for testing

// Extract card identifier from PSA 10 title
function extractCardIdentifier(psa10Title) {
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
async function searchCardVersions(identifier, year) {
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
      console.log(`🔍 Searching for ${search.type}: "${search.query}"`);
      
      const searchResults = await search130point(search.query, 20);
      
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error searching for ${search.type}:`, error.message);
    }
  }
  
  return results;
}

// Process a single card
async function processCard(card) {
  try {
    const psa10Price = parseFloat(card.price?.value || 0);
    
    // Skip if PSA 10 price is too low
    if (psa10Price < MIN_PSA10_PRICE) {
      console.log(`⏭️ Skipping ${card.title} - price too low: $${psa10Price}`);
      return null;
    }
    
    const { identifier, year } = extractCardIdentifier(card.title);
    
    // Skip if no meaningful identifier
    if (!identifier || identifier.length < 3) {
      console.log(`⏭️ Skipping ${card.title} - no meaningful identifier`);
      return null;
    }
    
    console.log(`\n📋 Processing: ${card.title}`);
    console.log(`   Identifier: ${identifier} (${year || 'N/A'})`);
    console.log(`   PSA 10 Price: $${psa10Price}`);
    
    const versions = await searchCardVersions(identifier, year);
    
    if (versions.raw && versions.raw.avgPrice >= MIN_RAW_PRICE) {
      const multiplier = psa10Price / versions.raw.avgPrice;
      
      console.log(`   Raw Avg Price: $${versions.raw.avgPrice.toFixed(2)}`);
      console.log(`   Multiplier: ${multiplier.toFixed(2)}x`);
      
      if (multiplier >= TARGET_MULTIPLIER) {
        const opportunity = {
          card: {
            title: card.title,
            psa10Price,
            identifier,
            year,
            soldDate: card.soldDate,
            itemUrl: card.itemUrl
          },
          raw: versions.raw,
          psa9: versions.psa9,
          multiplier,
          potentialProfit: psa10Price - versions.raw.avgPrice,
          roi: ((psa10Price - versions.raw.avgPrice) / versions.raw.avgPrice) * 100
        };
        
        console.log(`✅ GOOD BUY FOUND!`);
        console.log(`   Raw: $${versions.raw.avgPrice.toFixed(2)} | PSA 10: $${psa10Price.toFixed(2)}`);
        console.log(`   Multiplier: ${multiplier.toFixed(2)}x | ROI: ${opportunity.roi.toFixed(1)}%`);
        console.log(`   Potential Profit: $${opportunity.potentialProfit.toFixed(2)}`);
        if (versions.psa9) {
          console.log(`   PSA 9: $${versions.psa9.avgPrice.toFixed(2)}`);
        }
        
        return opportunity;
      } else {
        console.log(`❌ Multiplier too low: ${multiplier.toFixed(2)}x < ${TARGET_MULTIPLIER}x`);
      }
    } else {
      console.log(`❌ No valid raw card data found`);
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error processing card ${card.title}:`, error.message);
    return null;
  }
}

// Main function
async function findGoodBuys() {
  console.log('🚀 Starting simple good buy analysis...');
  console.log(`📊 Target multiplier: ${TARGET_MULTIPLIER}x`);
  console.log(`💰 Min raw price: $${MIN_RAW_PRICE}`);
  console.log(`💰 Min PSA 10 price: $${MIN_PSA10_PRICE}`);
  console.log(`🧪 Testing with ${TEST_SAMPLE_SIZE} cards...`);
  
  try {
    // Load database
    const database = JSON.parse(fs.readFileSync(PSA10_DATABASE_FILE, 'utf8'));
    const items = database.items || [];
    
    console.log(`📦 Total items in database: ${items.length}`);
    
    // Take a small sample for testing
    const testSample = items.slice(0, TEST_SAMPLE_SIZE);
    console.log(`🧪 Testing with ${testSample.length} cards...`);
    
    const goodBuys = [];
    
    // Process each card
    for (const card of testSample) {
      const opportunity = await processCard(card);
      if (opportunity) {
        goodBuys.push(opportunity);
      }
    }
    
    console.log('\n✅ Analysis complete!');
    console.log(`📊 Found ${goodBuys.length} good buy opportunities`);
    
    if (goodBuys.length > 0) {
      // Sort by ROI (highest first)
      const sortedGoodBuys = goodBuys.sort((a, b) => b.roi - a.roi);
      
      const results = {
        metadata: {
          created: new Date().toISOString(),
          targetMultiplier: TARGET_MULTIPLIER,
          minRawPrice: MIN_RAW_PRICE,
          minPsa10Price: MIN_PSA10_PRICE,
          totalProcessed: testSample.length,
          goodBuysFound: goodBuys.length
        },
        opportunities: sortedGoodBuys
      };
      
      fs.writeFileSync(GOOD_BUYS_FILE, JSON.stringify(results, null, 2));
      console.log(`💾 Saved ${sortedGoodBuys.length} opportunities to ${GOOD_BUYS_FILE}`);
      
      console.log('\n📋 Top Opportunities:');
      sortedGoodBuys.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.card.title}`);
        console.log(`   Raw: $${opp.raw.avgPrice.toFixed(2)} | PSA 10: $${opp.card.psa10Price.toFixed(2)}`);
        console.log(`   Multiplier: ${opp.multiplier.toFixed(2)}x | ROI: ${opp.roi.toFixed(1)}%`);
        console.log(`   Potential Profit: $${opp.potentialProfit.toFixed(2)}`);
        if (opp.psa9) {
          console.log(`   PSA 9: $${opp.psa9.avgPrice.toFixed(2)}`);
        }
        console.log('');
      });
    } else {
      console.log('\n❌ No good buy opportunities found in test sample');
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Run the analysis
if (require.main === module) {
  findGoodBuys().catch(console.error);
}

module.exports = { findGoodBuys, extractCardIdentifier, searchCardVersions }; 