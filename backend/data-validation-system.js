const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DataValidationSystem {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
        this.validationErrors = [];
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

    async runUpdate(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    // Validation rules
    validateCardData(cardData) {
        this.validationErrors = [];
        
        // Required fields
        if (!cardData.title || cardData.title.trim() === '') {
            this.validationErrors.push('Title is required');
        }
        
        if (!cardData.sport || cardData.sport.trim() === '') {
            this.validationErrors.push('Sport is required');
        }
        
        if (!cardData.year || cardData.year < 1900 || cardData.year > 2030) {
            this.validationErrors.push('Valid year (1900-2030) is required');
        }
        
        // Price validation
        if (cardData.raw_average_price !== null && cardData.raw_average_price !== undefined) {
            if (cardData.raw_average_price < 0) {
                this.validationErrors.push('Raw price cannot be negative');
            }
            if (cardData.raw_average_price > 1000000) {
                this.validationErrors.push('Raw price seems unreasonably high (>$1M)');
            }
        }
        
        if (cardData.psa10_price !== null && cardData.psa10_price !== undefined) {
            if (cardData.psa10_price < 0) {
                this.validationErrors.push('PSA 10 price cannot be negative');
            }
            if (cardData.psa10_price > 1000000) {
                this.validationErrors.push('PSA 10 price seems unreasonably high (>$1M)');
            }
        }
        
        if (cardData.psa9_average_price !== null && cardData.psa9_average_price !== undefined) {
            if (cardData.psa9_average_price < 0) {
                this.validationErrors.push('PSA 9 price cannot be negative');
            }
            if (cardData.psa9_average_price > 1000000) {
                this.validationErrors.push('PSA 9 price seems unreasonably high (>$1M)');
            }
        }
        
        // Price relationship validation
        if (cardData.raw_average_price && cardData.psa10_price) {
            if (cardData.raw_average_price > cardData.psa10_price) {
                this.validationErrors.push('Raw price cannot be higher than PSA 10 price');
            }
        }
        
        if (cardData.psa9_average_price && cardData.psa10_price) {
            if (cardData.psa9_average_price > cardData.psa10_price) {
                this.validationErrors.push('PSA 9 price cannot be higher than PSA 10 price');
            }
        }
        
        // Multiplier validation
        if (cardData.multiplier !== null && cardData.multiplier !== undefined) {
            if (cardData.multiplier < 0) {
                this.validationErrors.push('Multiplier cannot be negative');
            }
            if (cardData.multiplier > 1000) {
                this.validationErrors.push('Multiplier seems unreasonably high (>1000x)');
            }
        }
        
        // Title length validation
        if (cardData.title && cardData.title.length > 200) {
            this.validationErrors.push('Title is too long (max 200 characters)');
        }
        
        // Sport validation
        const validSports = ['Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer', 'Other'];
        if (cardData.sport && !validSports.includes(cardData.sport)) {
            this.validationErrors.push(`Invalid sport: ${cardData.sport}. Must be one of: ${validSports.join(', ')}`);
        }
        
        // Brand validation
        const validBrands = ['Panini', 'Topps', 'Upper Deck', 'Bowman', 'Donruss', 'Other'];
        if (cardData.brand && !validBrands.includes(cardData.brand)) {
            this.validationErrors.push(`Invalid brand: ${cardData.brand}. Must be one of: ${validBrands.join(', ')}`);
        }
        
        return this.validationErrors.length === 0;
    }

    // Validate existing data in database
    async validateExistingData() {
        console.log('🔍 Validating existing database data...\n');
        
        const validationResults = {
            totalCards: 0,
            validCards: 0,
            invalidCards: 0,
            errors: []
        };
        
        const cards = await this.runQuery('SELECT * FROM cards');
        validationResults.totalCards = cards.length;
        
        for (const card of cards) {
            const isValid = this.validateCardData(card);
            
            if (isValid) {
                validationResults.validCards++;
            } else {
                validationResults.invalidCards++;
                validationResults.errors.push({
                    id: card.id,
                    title: card.title,
                    errors: [...this.validationErrors]
                });
            }
        }
        
        console.log(`📊 Validation Results:`);
        console.log(`   Total cards: ${validationResults.totalCards}`);
        console.log(`   Valid cards: ${validationResults.validCards}`);
        console.log(`   Invalid cards: ${validationResults.invalidCards}`);
        console.log(`   Success rate: ${((validationResults.validCards / validationResults.totalCards) * 100).toFixed(1)}%\n`);
        
        if (validationResults.invalidCards > 0) {
            console.log('❌ Cards with validation errors:');
            validationResults.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ID ${error.id}: ${error.title}`);
                error.errors.forEach(err => {
                    console.log(`      - ${err}`);
                });
            });
        } else {
            console.log('✅ All cards pass validation!');
        }
        
        return validationResults;
    }

    // Add database constraints
    async addDatabaseConstraints() {
        console.log('🔧 Adding database constraints...\n');
        
        try {
            // Note: SQLite has limited constraint support, so we'll add triggers for validation
            
            // Trigger to validate price relationships
            await this.runUpdate(`
                CREATE TRIGGER IF NOT EXISTS validate_price_relationships
                BEFORE INSERT ON cards
                BEGIN
                    SELECT CASE
                        WHEN NEW.raw_average_price > NEW.psa10_price AND NEW.psa10_price IS NOT NULL
                        THEN RAISE(ABORT, 'Raw price cannot be higher than PSA 10 price')
                        WHEN NEW.psa9_average_price > NEW.psa10_price AND NEW.psa10_price IS NOT NULL
                        THEN RAISE(ABORT, 'PSA 9 price cannot be higher than PSA 10 price')
                        WHEN NEW.raw_average_price < 0
                        THEN RAISE(ABORT, 'Raw price cannot be negative')
                        WHEN NEW.psa10_price < 0
                        THEN RAISE(ABORT, 'PSA 10 price cannot be negative')
                        WHEN NEW.multiplier < 0
                        THEN RAISE(ABORT, 'Multiplier cannot be negative')
                    END;
                END
            `);
            
            console.log('✅ Added price relationship validation trigger');
            
            // Trigger to validate required fields
            await this.runUpdate(`
                CREATE TRIGGER IF NOT EXISTS validate_required_fields
                BEFORE INSERT ON cards
                BEGIN
                    SELECT CASE
                        WHEN NEW.title IS NULL OR NEW.title = ''
                        THEN RAISE(ABORT, 'Title is required')
                        WHEN NEW.sport IS NULL OR NEW.sport = ''
                        THEN RAISE(ABORT, 'Sport is required')
                        WHEN NEW.year IS NULL OR NEW.year < 1900 OR NEW.year > 2030
                        THEN RAISE(ABORT, 'Valid year (1900-2030) is required')
                    END;
                END
            `);
            
            console.log('✅ Added required field validation trigger');
            
            // Trigger to prevent duplicates
            await this.runUpdate(`
                CREATE TRIGGER IF NOT EXISTS prevent_duplicates
                BEFORE INSERT ON cards
                BEGIN
                    SELECT CASE
                        WHEN EXISTS(SELECT 1 FROM cards WHERE title = NEW.title)
                        THEN RAISE(ABORT, 'Card with this title already exists')
                    END;
                END
            `);
            
            console.log('✅ Added duplicate prevention trigger');
            
        } catch (error) {
            console.log('⚠️ Error adding constraints:', error.message);
        }
        
        console.log('');
    }

    // Create data quality monitoring
    async createDataQualityReport() {
        console.log('📊 Generating data quality report...\n');
        
        const report = {
            timestamp: new Date().toISOString(),
            totalCards: 0,
            dataCompleteness: {},
            dataAccuracy: {},
            recommendations: []
        };
        
        // Get basic stats
        const stats = await this.runQuery(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(CASE WHEN title IS NOT NULL AND title != '' THEN 1 ELSE 0 END) as has_title,
                SUM(CASE WHEN sport IS NOT NULL AND sport != '' THEN 1 ELSE 0 END) as has_sport,
                SUM(CASE WHEN year IS NOT NULL THEN 1 ELSE 0 END) as has_year,
                SUM(CASE WHEN raw_average_price IS NOT NULL THEN 1 ELSE 0 END) as has_raw_price,
                SUM(CASE WHEN psa10_price IS NOT NULL THEN 1 ELSE 0 END) as has_psa10_price,
                SUM(CASE WHEN multiplier IS NOT NULL THEN 1 ELSE 0 END) as has_multiplier
            FROM cards
        `);
        
        const data = stats[0];
        report.totalCards = data.total_cards;
        
        // Calculate completeness percentages
        report.dataCompleteness = {
            title: ((data.has_title / data.total_cards) * 100).toFixed(1) + '%',
            sport: ((data.has_sport / data.total_cards) * 100).toFixed(1) + '%',
            year: ((data.has_year / data.total_cards) * 100).toFixed(1) + '%',
            rawPrice: ((data.has_raw_price / data.total_cards) * 100).toFixed(1) + '%',
            psa10Price: ((data.has_psa10_price / data.total_cards) * 100).toFixed(1) + '%',
            multiplier: ((data.has_multiplier / data.total_cards) * 100).toFixed(1) + '%'
        };
        
        // Check for price anomalies
        const anomalies = await this.runQuery(`
            SELECT COUNT(*) as count
            FROM cards
            WHERE (raw_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (psa9_average_price > psa10_price AND psa10_price IS NOT NULL)
        `);
        
        report.dataAccuracy = {
            priceAnomalies: anomalies[0].count,
            anomalyPercentage: ((anomalies[0].count / data.total_cards) * 100).toFixed(1) + '%'
        };
        
        // Generate recommendations
        if (parseFloat(report.dataCompleteness.multiplier) < 100) {
            report.recommendations.push('Calculate missing multipliers');
        }
        
        if (anomalies[0].count > 0) {
            report.recommendations.push('Fix price anomalies');
        }
        
        if (parseFloat(report.dataCompleteness.rawPrice) < 100) {
            report.recommendations.push('Add missing raw prices');
        }
        
        console.log('📋 Data Quality Report:');
        console.log('=======================');
        console.log(`Generated: ${report.timestamp}`);
        console.log(`Total cards: ${report.totalCards}`);
        console.log('');
        console.log('Data Completeness:');
        console.log(`   Title: ${report.dataCompleteness.title}`);
        console.log(`   Sport: ${report.dataCompleteness.sport}`);
        console.log(`   Year: ${report.dataCompleteness.year}`);
        console.log(`   Raw Price: ${report.dataCompleteness.rawPrice}`);
        console.log(`   PSA 10 Price: ${report.dataCompleteness.psa10Price}`);
        console.log(`   Multiplier: ${report.dataCompleteness.multiplier}`);
        console.log('');
        console.log('Data Accuracy:');
        console.log(`   Price Anomalies: ${report.dataAccuracy.priceAnomalies} (${report.dataAccuracy.anomalyPercentage})`);
        console.log('');
        
        if (report.recommendations.length > 0) {
            console.log('Recommendations:');
            report.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        } else {
            console.log('✅ No immediate actions needed');
        }
        
        return report;
    }

    // Validate new card before insertion
    async validateAndInsertCard(cardData) {
        console.log('🔍 Validating new card data...');
        
        const isValid = this.validateCardData(cardData);
        
        if (!isValid) {
            console.log('❌ Validation failed:');
            this.validationErrors.forEach(error => {
                console.log(`   - ${error}`);
            });
            return { success: false, errors: this.validationErrors };
        }
        
        console.log('✅ Validation passed, inserting card...');
        
        try {
            // Insert the card
            const result = await this.runUpdate(`
                INSERT INTO cards (
                    title, summary_title, sport, year, brand, set_name, card_type,
                    condition, grade, raw_average_price, psa9_average_price, psa10_price,
                    psa10_average_price, multiplier, ebay_item_id, image_url, search_term,
                    source, created_at, last_updated, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
            `, [
                cardData.title, cardData.summary_title, cardData.sport, cardData.year,
                cardData.brand, cardData.set_name, cardData.card_type, cardData.condition,
                cardData.grade, cardData.raw_average_price, cardData.psa9_average_price,
                cardData.psa10_price, cardData.psa10_average_price, cardData.multiplier,
                cardData.ebay_item_id, cardData.image_url, cardData.search_term,
                cardData.source, cardData.notes
            ]);
            
            console.log(`✅ Card inserted successfully with ID: ${result.lastID}`);
            return { success: true, cardId: result.lastID };
            
        } catch (error) {
            console.log('❌ Insertion failed:', error.message);
            return { success: false, errors: [error.message] };
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const validator = new DataValidationSystem();
    try {
        await validator.connect();
        
        // Step 1: Validate existing data
        await validator.validateExistingData();
        
        // Step 2: Add database constraints
        await validator.addDatabaseConstraints();
        
        // Step 3: Generate data quality report
        await validator.createDataQualityReport();
        
        console.log('🎉 Data validation system setup complete!');
        
    } catch (error) {
        console.error('❌ Error setting up validation system:', error);
    } finally {
        await validator.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = DataValidationSystem;
