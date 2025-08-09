const FastSQLitePriceUpdater = require('./fast-sqlite-price-updater.js');

class DatabaseQualityAnalyzer {
  constructor() {
    this.updater = new FastSQLitePriceUpdater();
  }

  async connect() {
    await this.updater.connect();
  }

  async analyzeDataQuality() {
    console.log('🔍 Analyzing database quality...\n');
    
    // Get total count
    const totalCards = await this.getCount('SELECT COUNT(*) as count FROM cards');
    console.log(`📊 Total cards in database: ${totalCards}`);
    
    // Analyze missing price data
    await this.analyzeMissingPrices();
    
    // Analyze sport distribution
    await this.analyzeSportDistribution();
    
    // Analyze title quality
    await this.analyzeTitleQuality();
    
    // Analyze price consistency
    await this.analyzePriceConsistency();
    
    // Analyze recent additions
    await this.analyzeRecentAdditions();
    
    console.log('\n🔍 Database quality analysis complete!');
  }

  async getCount(query, params = []) {
    return new Promise((resolve, reject) => {
      this.updater.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  async getRows(query, params = []) {
    return new Promise((resolve, reject) => {
      this.updater.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async analyzeMissingPrices() {
    console.log('\n💰 PRICE DATA ANALYSIS:');
    console.log('=' .repeat(50));
    
    // Missing price counts
    const missingPsa10 = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE psa10Price IS NULL OR psa10Price = 0');
    const missingRaw = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice IS NULL OR rawAveragePrice = 0');
    const missingPsa9 = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE psa9AveragePrice IS NULL OR psa9AveragePrice = 0');
    
    const totalCards = await this.getCount('SELECT COUNT(*) as count FROM cards');
    
    console.log(`❌ Missing PSA 10 prices: ${missingPsa10} (${(missingPsa10/totalCards*100).toFixed(1)}%)`);
    console.log(`❌ Missing Raw prices: ${missingRaw} (${(missingRaw/totalCards*100).toFixed(1)}%)`);
    console.log(`❌ Missing PSA 9 prices: ${missingPsa9} (${(missingPsa9/totalCards*100).toFixed(1)}%)`);
    
    // Cards with NO price data at all
    const noPrices = await this.getCount(`
      SELECT COUNT(*) as count FROM cards 
      WHERE (psa10Price IS NULL OR psa10Price = 0) 
      AND (rawAveragePrice IS NULL OR rawAveragePrice = 0) 
      AND (psa9AveragePrice IS NULL OR psa9AveragePrice = 0)
    `);
    console.log(`🚫 No price data at all: ${noPrices} (${(noPrices/totalCards*100).toFixed(1)}%)`);
    
    // Cards with complete price data
    const completePrices = await this.getCount(`
      SELECT COUNT(*) as count FROM cards 
      WHERE psa10Price > 0 AND rawAveragePrice > 0 AND psa9AveragePrice > 0
    `);
    console.log(`✅ Complete price data: ${completePrices} (${(completePrices/totalCards*100).toFixed(1)}%)`);
  }

  async analyzeSportDistribution() {
    console.log('\n🏈 SPORT DISTRIBUTION:');
    console.log('=' .repeat(50));
    
    const sports = await this.getRows(`
      SELECT sport, COUNT(*) as count 
      FROM cards 
      GROUP BY sport 
      ORDER BY count DESC
    `);
    
    sports.forEach(sport => {
      console.log(`${sport.sport || 'Unknown'}: ${sport.count} cards`);
    });
  }

  async analyzeTitleQuality() {
    console.log('\n📝 TITLE QUALITY ISSUES:');
    console.log('=' .repeat(50));
    
    // Cards with missing summaryTitle
    const missingSummary = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE summaryTitle IS NULL OR summaryTitle = ""');
    console.log(`❌ Missing summaryTitle: ${missingSummary}`);
    
    // Cards where title = summaryTitle (not cleaned)
    const uncleaned = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE title = summaryTitle');
    console.log(`⚠️  Uncleaned titles (title = summaryTitle): ${uncleaned}`);
    
    // Titles with "lot" in them (should be cleaned)
    const lotTitles = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE title LIKE "%lot%" OR summaryTitle LIKE "%lot%"');
    console.log(`⚠️  Titles containing "lot": ${lotTitles}`);
    
    // Very short titles (likely incomplete)
    const shortTitles = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE LENGTH(title) < 20');
    console.log(`⚠️  Very short titles (<20 chars): ${shortTitles}`);
    
    // Very long titles (likely uncleaned)
    const longTitles = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE LENGTH(title) > 150');
    console.log(`⚠️  Very long titles (>150 chars): ${longTitles}`);
  }

  async analyzePriceConsistency() {
    console.log('\n💲 PRICE CONSISTENCY ISSUES:');
    console.log('=' .repeat(50));
    
    // PSA 10 lower than Raw (suspicious)
    const psa10LowerThanRaw = await this.getCount(`
      SELECT COUNT(*) as count FROM cards 
      WHERE psa10Price > 0 AND rawAveragePrice > 0 
      AND psa10Price < rawAveragePrice
    `);
    console.log(`⚠️  PSA 10 < Raw price: ${psa10LowerThanRaw}`);
    
    // PSA 9 higher than PSA 10 (suspicious)
    const psa9HigherThanPsa10 = await this.getCount(`
      SELECT COUNT(*) as count FROM cards 
      WHERE psa9AveragePrice > 0 AND psa10Price > 0 
      AND psa9AveragePrice > psa10Price
    `);
    console.log(`⚠️  PSA 9 > PSA 10 price: ${psa9HigherThanPsa10}`);
    
    // Extremely high prices (potential outliers)
    const highPsa10 = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE psa10Price > 10000');
    const highRaw = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE rawAveragePrice > 5000');
    console.log(`⚠️  PSA 10 > $10,000: ${highPsa10}`);
    console.log(`⚠️  Raw > $5,000: ${highRaw}`);
    
    // Extremely low prices (potential issues)
    const lowPsa10 = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE psa10Price > 0 AND psa10Price < 5');
    console.log(`⚠️  PSA 10 < $5: ${lowPsa10}`);
  }

  async analyzeRecentAdditions() {
    console.log('\n📅 RECENT ADDITIONS:');
    console.log('=' .repeat(50));
    
    // Recent additions (last 7 days)
    const recentCards = await this.getRows(`
      SELECT COUNT(*) as count, 
             MIN(lastUpdated) as earliest, 
             MAX(lastUpdated) as latest
      FROM cards 
      WHERE lastUpdated >= datetime('now', '-7 days')
    `);
    
    if (recentCards[0]) {
      console.log(`📈 Cards added last 7 days: ${recentCards[0].count}`);
      console.log(`📅 Date range: ${recentCards[0].earliest} to ${recentCards[0].latest}`);
    }
    
    // Cards never updated
    const neverUpdated = await this.getCount('SELECT COUNT(*) as count FROM cards WHERE lastUpdated IS NULL');
    console.log(`❌ Never updated: ${neverUpdated}`);
  }

  async showWorstExamples() {
    console.log('\n🔍 WORST DATA QUALITY EXAMPLES:');
    console.log('=' .repeat(50));
    
    // Show examples of bad data
    const badExamples = await this.getRows(`
      SELECT id, title, summaryTitle, sport, psa10Price, rawAveragePrice, psa9AveragePrice, lastUpdated
      FROM cards 
      WHERE (psa10Price IS NULL OR psa10Price = 0)
      AND (rawAveragePrice IS NULL OR rawAveragePrice = 0)
      AND (psa9AveragePrice IS NULL OR psa9AveragePrice = 0)
      LIMIT 10
    `);
    
    console.log('\n📋 Cards with NO price data:');
    badExamples.forEach((card, i) => {
      console.log(`${i + 1}. ${card.title}`);
      console.log(`   Summary: ${card.summaryTitle || 'MISSING'}`);
      console.log(`   Sport: ${card.sport || 'MISSING'}`);
      console.log(`   Prices: PSA10=$${card.psa10Price || 0}, Raw=$${card.rawAveragePrice || 0}, PSA9=$${card.psa9AveragePrice || 0}`);
      console.log('');
    });
  }

  async generateCleanupRecommendations() {
    console.log('\n🛠️  CLEANUP RECOMMENDATIONS:');
    console.log('=' .repeat(50));
    
    console.log('1. 🔄 Re-run price updates for cards with missing prices');
    console.log('2. 🧹 Clean up summary titles for better search accuracy');
    console.log('3. 🚫 Remove cards with "lot" in titles (bulk sales)');
    console.log('4. 🏷️  Fix sport detection for unknown/missing sports');
    console.log('5. 💰 Investigate price inconsistencies (PSA 10 < Raw)');
    console.log('6. 📏 Review very short/long titles for completeness');
    console.log('7. 🔍 Enhance search strategies for better data collection');
  }
}

// Run if called directly
if (require.main === module) {
  const analyzer = new DatabaseQualityAnalyzer();
  
  analyzer.connect()
    .then(() => analyzer.analyzeDataQuality())
    .then(() => analyzer.showWorstExamples())
    .then(() => analyzer.generateCleanupRecommendations())
    .then(() => {
      analyzer.updater.db.close();
      console.log('\n✅ Analysis complete!');
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseQualityAnalyzer;
