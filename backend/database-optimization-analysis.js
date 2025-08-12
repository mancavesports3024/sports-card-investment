const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseOptimizationAnalyzer {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async analyzeDatabase() {
        console.log('🔍 Starting comprehensive database analysis...\n');

        // 1. Basic Statistics
        await this.analyzeBasicStats();
        
        // 2. Data Quality Issues
        await this.analyzeDataQuality();
        
        // 3. Performance Issues
        await this.analyzePerformance();
        
        // 4. Price Accuracy Issues
        await this.analyzePriceAccuracy();
        
        // 5. Duplicate Detection
        await this.analyzeDuplicates();
        
        // 6. Missing Data Analysis
        await this.analyzeMissingData();
        
        // 7. Index Analysis
        await this.analyzeIndexes();
        
        // 8. Recommendations
        await this.generateRecommendations();
    }

    async analyzeBasicStats() {
        console.log('📊 BASIC STATISTICS');
        console.log('==================');
        
        const stats = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(DISTINCT title) as unique_titles,
                COUNT(DISTINCT sport) as unique_sports,
                COUNT(DISTINCT year) as unique_years,
                COUNT(DISTINCT brand) as unique_brands,
                AVG(raw_average_price) as avg_raw_price,
                AVG(psa10_price) as avg_psa10_price,
                AVG(multiplier) as avg_multiplier,
                MIN(created_at) as earliest_card,
                MAX(created_at) as latest_card
            FROM cards
        `);
        
        console.log(`Total Cards: ${stats[0].total_cards}`);
        console.log(`Unique Titles: ${stats[0].unique_titles}`);
        console.log(`Unique Sports: ${stats[0].unique_sports}`);
        console.log(`Unique Years: ${stats[0].unique_years}`);
        console.log(`Unique Brands: ${stats[0].unique_brands}`);
        console.log(`Average Raw Price: $${stats[0].avg_raw_price?.toFixed(2) || 'N/A'}`);
        console.log(`Average PSA 10 Price: $${stats[0].avg_psa10_price?.toFixed(2) || 'N/A'}`);
        console.log(`Average Multiplier: ${stats[0].avg_multiplier?.toFixed(2) || 'N/A'}`);
        console.log(`Date Range: ${stats[0].earliest_card} to ${stats[0].latest_card}\n`);
    }

    async analyzeDataQuality() {
        console.log('🔍 DATA QUALITY ISSUES');
        console.log('=====================');
        
        // Null/empty values
        const nullStats = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) as null_titles,
                SUM(CASE WHEN sport IS NULL OR sport = '' THEN 1 ELSE 0 END) as null_sports,
                SUM(CASE WHEN year IS NULL THEN 1 ELSE 0 END) as null_years,
                SUM(CASE WHEN raw_average_price IS NULL THEN 1 ELSE 0 END) as null_raw_prices,
                SUM(CASE WHEN psa10_price IS NULL THEN 1 ELSE 0 END) as null_psa10_prices,
                SUM(CASE WHEN multiplier IS NULL THEN 1 ELSE 0 END) as null_multipliers
            FROM cards
        `);
        
        const stats = nullStats[0];
        console.log(`Cards with null titles: ${stats.null_titles} (${((stats.null_titles/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards with null sports: ${stats.null_sports} (${((stats.null_sports/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards with null years: ${stats.null_years} (${((stats.null_years/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards with null raw prices: ${stats.null_raw_prices} (${((stats.null_raw_prices/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards with null PSA 10 prices: ${stats.null_psa10_prices} (${((stats.null_psa10_prices/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards with null multipliers: ${stats.null_multipliers} (${((stats.null_multipliers/stats.total_cards)*100).toFixed(1)}%)\n`);
    }

    async analyzePerformance() {
        console.log('⚡ PERFORMANCE ANALYSIS');
        console.log('======================');
        
        // Check for slow queries
        const slowQueries = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN title LIKE '%PSA 10%' THEN 1 END) as psa10_cards,
                COUNT(CASE WHEN title LIKE '%PSA 9%' THEN 1 END) as psa9_cards,
                COUNT(CASE WHEN title LIKE '%Raw%' THEN 1 END) as raw_cards
            FROM cards
        `);
        
        console.log(`PSA 10 cards: ${slowQueries[0].psa10_cards}`);
        console.log(`PSA 9 cards: ${slowQueries[0].psa9_cards}`);
        console.log(`Raw cards: ${slowQueries[0].raw_cards}\n`);
        
        // Check for large text fields
        const largeFields = await this.runQuery(`
            SELECT 
                AVG(LENGTH(title)) as avg_title_length,
                MAX(LENGTH(title)) as max_title_length,
                AVG(LENGTH(summary_title)) as avg_summary_length,
                MAX(LENGTH(summary_title)) as max_summary_length
            FROM cards
        `);
        
        console.log(`Average title length: ${largeFields[0].avg_title_length?.toFixed(0) || 'N/A'} characters`);
        console.log(`Max title length: ${largeFields[0].max_title_length || 'N/A'} characters`);
        console.log(`Average summary length: ${largeFields[0].avg_summary_length?.toFixed(0) || 'N/A'} characters`);
        console.log(`Max summary length: ${largeFields[0].max_summary_length || 'N/A'} characters\n`);
    }

    async analyzePriceAccuracy() {
        console.log('💰 PRICE ACCURACY ANALYSIS');
        console.log('=========================');
        
        // Check for price anomalies
        const priceAnomalies = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN raw_average_price > psa10_price AND psa10_price IS NOT NULL THEN 1 END) as raw_higher_than_psa10,
                COUNT(CASE WHEN psa9_average_price > psa10_price AND psa10_price IS NOT NULL THEN 1 END) as psa9_higher_than_psa10,
                COUNT(CASE WHEN raw_average_price < 1 THEN 1 END) as very_low_raw_prices,
                COUNT(CASE WHEN psa10_price < 1 THEN 1 END) as very_low_psa10_prices,
                COUNT(CASE WHEN multiplier > 100 THEN 1 END) as extreme_multipliers,
                COUNT(CASE WHEN multiplier < 0.1 THEN 1 END) as very_low_multipliers
            FROM cards
            WHERE raw_average_price IS NOT NULL OR psa10_price IS NOT NULL
        `);
        
        const anomalies = priceAnomalies[0];
        console.log(`Raw prices higher than PSA 10: ${anomalies.raw_higher_than_psa10} cards`);
        console.log(`PSA 9 prices higher than PSA 10: ${anomalies.psa9_higher_than_psa10} cards`);
        console.log(`Very low raw prices (<$1): ${anomalies.very_low_raw_prices} cards`);
        console.log(`Very low PSA 10 prices (<$1): ${anomalies.very_low_psa10_prices} cards`);
        console.log(`Extreme multipliers (>100x): ${anomalies.extreme_multipliers} cards`);
        console.log(`Very low multipliers (<0.1x): ${anomalies.very_low_multipliers} cards\n`);
        
        // Show some examples of price anomalies
        const examples = await this.runQuery(`
            SELECT title, raw_average_price, psa9_average_price, psa10_price, multiplier
            FROM cards
            WHERE (raw_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (psa9_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR multiplier > 100
               OR multiplier < 0.1
            LIMIT 10
        `);
        
        if (examples.length > 0) {
            console.log('Examples of price anomalies:');
            examples.forEach((card, index) => {
                console.log(`${index + 1}. ${card.title}`);
                console.log(`   Raw: $${card.raw_average_price || 'N/A'}, PSA 9: $${card.psa9_average_price || 'N/A'}, PSA 10: $${card.psa10_price || 'N/A'}, Multiplier: ${card.multiplier || 'N/A'}`);
            });
            console.log('');
        }
    }

    async analyzeDuplicates() {
        console.log('🔄 DUPLICATE ANALYSIS');
        console.log('=====================');
        
        // Find potential duplicates by title similarity
        const duplicates = await this.runQuery(`
            SELECT 
                title,
                COUNT(*) as count,
                GROUP_CONCAT(id) as ids,
                GROUP_CONCAT(raw_average_price) as raw_prices,
                GROUP_CONCAT(psa10_price) as psa10_prices
            FROM cards
            GROUP BY title
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 10
        `);
        
        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} titles with duplicates:`);
            duplicates.forEach((dup, index) => {
                console.log(`${index + 1}. "${dup.title}" (${dup.count} copies)`);
                console.log(`   IDs: ${dup.ids}`);
                console.log(`   Raw prices: ${dup.raw_prices}`);
                console.log(`   PSA 10 prices: ${dup.psa10_prices}`);
            });
        } else {
            console.log('No exact title duplicates found');
        }
        console.log('');
    }

    async analyzeMissingData() {
        console.log('❓ MISSING DATA ANALYSIS');
        console.log('========================');
        
        const missingData = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(CASE WHEN sport IS NULL OR sport = '' THEN 1 ELSE 0 END) as missing_sport,
                SUM(CASE WHEN year IS NULL THEN 1 ELSE 0 END) as missing_year,
                SUM(CASE WHEN brand IS NULL OR brand = '' THEN 1 ELSE 0 END) as missing_brand,
                SUM(CASE WHEN set_name IS NULL OR set_name = '' THEN 1 ELSE 0 END) as missing_set,
                SUM(CASE WHEN summary_title IS NULL OR summary_title = '' THEN 1 ELSE 0 END) as missing_summary
            FROM cards
        `);
        
        const stats = missingData[0];
        console.log(`Cards missing sport: ${stats.missing_sport} (${((stats.missing_sport/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards missing year: ${stats.missing_year} (${((stats.missing_year/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards missing brand: ${stats.missing_brand} (${((stats.missing_brand/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards missing set: ${stats.missing_set} (${((stats.missing_set/stats.total_cards)*100).toFixed(1)}%)`);
        console.log(`Cards missing summary: ${stats.missing_summary} (${((stats.missing_summary/stats.total_cards)*100).toFixed(1)}%)\n`);
    }

    async analyzeIndexes() {
        console.log('📋 INDEX ANALYSIS');
        console.log('=================');
        
        const indexes = await this.runQuery("PRAGMA index_list(cards)");
        console.log(`Current indexes on cards table:`);
        indexes.forEach(index => {
            console.log(`   - ${index.name} (${index.unique ? 'UNIQUE' : 'NON-UNIQUE'})`);
        });
        console.log('');
        
        // Check for missing indexes on commonly queried columns
        const missingIndexes = [];
        const commonQueries = [
            'WHERE sport = ?',
            'WHERE year = ?',
            'WHERE brand = ?',
            'WHERE raw_average_price > ?',
            'WHERE psa10_price > ?',
            'WHERE created_at > ?'
        ];
        
        console.log('Recommended additional indexes:');
        console.log('   - CREATE INDEX idx_sport_year ON cards(sport, year)');
        console.log('   - CREATE INDEX idx_brand_set ON cards(brand, set_name)');
        console.log('   - CREATE INDEX idx_price_range ON cards(raw_average_price, psa10_price)');
        console.log('   - CREATE INDEX idx_created_sport ON cards(created_at, sport)');
        console.log('');
    }

    async generateRecommendations() {
        console.log('💡 OPTIMIZATION RECOMMENDATIONS');
        console.log('==============================');
        
        console.log('1. DATA QUALITY IMPROVEMENTS:');
        console.log('   - Implement data validation before insertion');
        console.log('   - Add constraints to prevent invalid price relationships');
        console.log('   - Create data cleaning jobs for existing anomalies');
        console.log('   - Add summary_title generation for cards missing it');
        
        console.log('\n2. PERFORMANCE OPTIMIZATIONS:');
        console.log('   - Add composite indexes for common query patterns');
        console.log('   - Implement query result caching');
        console.log('   - Add database connection pooling');
        console.log('   - Consider partitioning by year or sport');
        
        console.log('\n3. ACCURACY IMPROVEMENTS:');
        console.log('   - Implement price validation rules');
        console.log('   - Add outlier detection for prices');
        console.log('   - Create automated data quality reports');
        console.log('   - Add confidence scores for price data');
        
        console.log('\n4. MONITORING & MAINTENANCE:');
        console.log('   - Set up automated database health checks');
        console.log('   - Create data quality dashboards');
        console.log('   - Implement automated backup and recovery');
        console.log('   - Add performance monitoring');
        
        console.log('\n5. IMMEDIATE ACTIONS:');
        console.log('   - Fix price anomalies (raw > PSA 10)');
        console.log('   - Remove or merge duplicate entries');
        console.log('   - Add missing indexes for performance');
        console.log('   - Implement data validation in insertion scripts');
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const analyzer = new DatabaseOptimizationAnalyzer();
    try {
        await analyzer.connect();
        await analyzer.analyzeDatabase();
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    } finally {
        await analyzer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = DatabaseOptimizationAnalyzer;
