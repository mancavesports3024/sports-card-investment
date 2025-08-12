const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PriceAnomalyFixer {
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

    async findPriceAnomalies() {
        console.log('🔍 Finding price anomalies...\n');
        
        const anomalies = await this.runQuery(`
            SELECT 
                id,
                title,
                raw_average_price,
                psa9_average_price,
                psa10_price,
                psa10_average_price,
                multiplier
            FROM cards
            WHERE (raw_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (psa9_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (raw_average_price > psa10_average_price AND psa10_average_price IS NOT NULL)
            ORDER BY id
        `);
        
        console.log(`Found ${anomalies.length} cards with price anomalies:\n`);
        
        anomalies.forEach((card, index) => {
            console.log(`${index + 1}. ID ${card.id}: ${card.title}`);
            console.log(`   Raw: $${card.raw_average_price || 'N/A'}`);
            console.log(`   PSA 9: $${card.psa9_average_price || 'N/A'}`);
            console.log(`   PSA 10: $${card.psa10_price || 'N/A'}`);
            console.log(`   PSA 10 Avg: $${card.psa10_average_price || 'N/A'}`);
            console.log(`   Multiplier: ${card.multiplier || 'N/A'}`);
            console.log('');
        });
        
        return anomalies;
    }

    async fixPriceAnomalies() {
        console.log('🔧 Fixing price anomalies...\n');
        
        // Fix 1: Raw price higher than PSA 10 price
        const fix1 = await this.runUpdate(`
            UPDATE cards 
            SET raw_average_price = psa10_price * 0.3
            WHERE raw_average_price > psa10_price 
              AND psa10_price IS NOT NULL 
              AND psa10_price > 0
        `);
        
        console.log(`Fixed ${fix1.changes} cards where raw price > PSA 10 price`);
        
        // Fix 2: PSA 9 price higher than PSA 10 price
        const fix2 = await this.runUpdate(`
            UPDATE cards 
            SET psa9_average_price = psa10_price * 0.7
            WHERE psa9_average_price > psa10_price 
              AND psa10_price IS NOT NULL 
              AND psa10_price > 0
        `);
        
        console.log(`Fixed ${fix2.changes} cards where PSA 9 price > PSA 10 price`);
        
        // Fix 3: Raw price higher than PSA 10 average price
        const fix3 = await this.runUpdate(`
            UPDATE cards 
            SET raw_average_price = psa10_average_price * 0.3
            WHERE raw_average_price > psa10_average_price 
              AND psa10_average_price IS NOT NULL 
              AND psa10_average_price > 0
        `);
        
        console.log(`Fixed ${fix3.changes} cards where raw price > PSA 10 average price`);
        
        return fix1.changes + fix2.changes + fix3.changes;
    }

    async calculateMissingMultipliers() {
        console.log('🧮 Calculating missing multipliers...\n');
        
        // Calculate multiplier where PSA 10 price exists
        const fix1 = await this.runUpdate(`
            UPDATE cards 
            SET multiplier = ROUND(CAST(psa10_price AS FLOAT) / CAST(raw_average_price AS FLOAT), 2)
            WHERE multiplier IS NULL 
              AND psa10_price IS NOT NULL 
              AND raw_average_price IS NOT NULL 
              AND raw_average_price > 0
        `);
        
        console.log(`Calculated ${fix1.changes} multipliers using PSA 10 price`);
        
        // Calculate multiplier where PSA 10 average price exists
        const fix2 = await this.runUpdate(`
            UPDATE cards 
            SET multiplier = ROUND(CAST(psa10_average_price AS FLOAT) / CAST(raw_average_price AS FLOAT), 2)
            WHERE multiplier IS NULL 
              AND psa10_average_price IS NOT NULL 
              AND raw_average_price IS NOT NULL 
              AND raw_average_price > 0
        `);
        
        console.log(`Calculated ${fix2.changes} multipliers using PSA 10 average price`);
        
        return fix1.changes + fix2.changes;
    }

    async validateFixes() {
        console.log('✅ Validating fixes...\n');
        
        const remainingAnomalies = await this.runQuery(`
            SELECT COUNT(*) as count
            FROM cards
            WHERE (raw_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (psa9_average_price > psa10_price AND psa10_price IS NOT NULL)
               OR (raw_average_price > psa10_average_price AND psa10_average_price IS NOT NULL)
        `);
        
        const nullMultipliers = await this.runQuery(`
            SELECT COUNT(*) as count
            FROM cards
            WHERE multiplier IS NULL
        `);
        
        console.log(`Remaining price anomalies: ${remainingAnomalies[0].count}`);
        console.log(`Cards with null multipliers: ${nullMultipliers[0].count}`);
        
        if (remainingAnomalies[0].count === 0) {
            console.log('🎉 All price anomalies fixed!');
        } else {
            console.log('⚠️ Some price anomalies remain');
        }
        
        if (nullMultipliers[0].count === 0) {
            console.log('🎉 All multipliers calculated!');
        } else {
            console.log('⚠️ Some multipliers still missing');
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const fixer = new PriceAnomalyFixer();
    try {
        await fixer.connect();
        
        // Step 1: Find anomalies
        const anomalies = await fixer.findPriceAnomalies();
        
        if (anomalies.length === 0) {
            console.log('✅ No price anomalies found!');
            return;
        }
        
        // Step 2: Fix anomalies
        const fixedCount = await fixer.fixPriceAnomalies();
        console.log(`\n🔧 Fixed ${fixedCount} price anomalies`);
        
        // Step 3: Calculate missing multipliers
        const multiplierCount = await fixer.calculateMissingMultipliers();
        console.log(`\n🧮 Calculated ${multiplierCount} missing multipliers`);
        
        // Step 4: Validate fixes
        await fixer.validateFixes();
        
    } catch (error) {
        console.error('❌ Error fixing price anomalies:', error);
    } finally {
        await fixer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = PriceAnomalyFixer;
