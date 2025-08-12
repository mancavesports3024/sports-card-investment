const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DuplicateFixer {
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

    async findDuplicates() {
        console.log('🔍 Finding duplicate cards...\n');
        
        const duplicates = await this.runQuery(`
            SELECT 
                title,
                COUNT(*) as count,
                GROUP_CONCAT(id) as ids,
                GROUP_CONCAT(raw_average_price) as raw_prices,
                GROUP_CONCAT(psa9_average_price) as psa9_prices,
                GROUP_CONCAT(psa10_price) as psa10_prices,
                GROUP_CONCAT(psa10_average_price) as psa10_avg_prices,
                GROUP_CONCAT(multiplier) as multipliers,
                GROUP_CONCAT(created_at) as created_dates,
                GROUP_CONCAT(last_updated) as updated_dates
            FROM cards
            GROUP BY title
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);
        
        console.log(`Found ${duplicates.length} titles with duplicates:\n`);
        
        duplicates.forEach((dup, index) => {
            console.log(`${index + 1}. "${dup.title}" (${dup.count} copies)`);
            console.log(`   IDs: ${dup.ids}`);
            console.log(`   Raw prices: ${dup.raw_prices}`);
            console.log(`   PSA 9 prices: ${dup.psa9_prices}`);
            console.log(`   PSA 10 prices: ${dup.psa10_prices}`);
            console.log(`   PSA 10 avg prices: ${dup.psa10_avg_prices}`);
            console.log(`   Multipliers: ${dup.multipliers}`);
            console.log(`   Created: ${dup.created_dates}`);
            console.log(`   Updated: ${dup.updated_dates}`);
            console.log('');
        });
        
        return duplicates;
    }

    async mergeDuplicates() {
        console.log('🔧 Merging duplicate cards...\n');
        
        // Get all duplicates
        const duplicates = await this.runQuery(`
            SELECT 
                title,
                GROUP_CONCAT(id) as ids,
                GROUP_CONCAT(raw_average_price) as raw_prices,
                GROUP_CONCAT(psa9_average_price) as psa9_prices,
                GROUP_CONCAT(psa10_price) as psa10_prices,
                GROUP_CONCAT(psa10_average_price) as psa10_avg_prices,
                GROUP_CONCAT(multiplier) as multipliers
            FROM cards
            GROUP BY title
            HAVING COUNT(*) > 1
        `);
        
        let mergedCount = 0;
        
        for (const dup of duplicates) {
            const ids = dup.ids.split(',').map(id => parseInt(id));
            const rawPrices = dup.raw_prices.split(',').map(p => parseFloat(p) || 0);
            const psa9Prices = dup.psa9_prices.split(',').map(p => parseFloat(p) || 0);
            const psa10Prices = dup.psa10_prices.split(',').map(p => parseFloat(p) || 0);
            const psa10AvgPrices = dup.psa10_avg_prices.split(',').map(p => parseFloat(p) || 0);
            const multipliers = dup.multipliers.split(',').map(m => parseFloat(m) || 0);
            
            // Keep the first ID and merge the data
            const keepId = ids[0];
            const deleteIds = ids.slice(1);
            
            // Calculate averages for numeric fields
            const avgRawPrice = rawPrices.filter(p => p > 0).length > 0 
                ? rawPrices.filter(p => p > 0).reduce((a, b) => a + b, 0) / rawPrices.filter(p => p > 0).length 
                : null;
            
            const avgPsa9Price = psa9Prices.filter(p => p > 0).length > 0 
                ? psa9Prices.filter(p => p > 0).reduce((a, b) => a + b, 0) / psa9Prices.filter(p => p > 0).length 
                : null;
            
            const avgPsa10Price = psa10Prices.filter(p => p > 0).length > 0 
                ? psa10Prices.filter(p => p > 0).reduce((a, b) => a + b, 0) / psa10Prices.filter(p => p > 0).length 
                : null;
            
            const avgPsa10AvgPrice = psa10AvgPrices.filter(p => p > 0).length > 0 
                ? psa10AvgPrices.filter(p => p > 0).reduce((a, b) => a + b, 0) / psa10AvgPrices.filter(p => p > 0).length 
                : null;
            
            const avgMultiplier = multipliers.filter(m => m > 0).length > 0 
                ? multipliers.filter(m => m > 0).reduce((a, b) => a + b, 0) / multipliers.filter(m => m > 0).length 
                : null;
            
            // Update the kept record with merged data
            await this.runUpdate(`
                UPDATE cards 
                SET 
                    raw_average_price = ?,
                    psa9_average_price = ?,
                    psa10_price = ?,
                    psa10_average_price = ?,
                    multiplier = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [avgRawPrice, avgPsa9Price, avgPsa10Price, avgPsa10AvgPrice, avgMultiplier, keepId]);
            
            // Delete the duplicate records
            const placeholders = deleteIds.map(() => '?').join(',');
            await this.runUpdate(`
                DELETE FROM cards 
                WHERE id IN (${placeholders})
            `, deleteIds);
            
            console.log(`Merged "${dup.title}": kept ID ${keepId}, deleted IDs ${deleteIds.join(', ')}`);
            mergedCount += deleteIds.length;
        }
        
        return mergedCount;
    }

    async validateMerges() {
        console.log('✅ Validating merges...\n');
        
        const remainingDuplicates = await this.runQuery(`
            SELECT 
                title,
                COUNT(*) as count
            FROM cards
            GROUP BY title
            HAVING COUNT(*) > 1
        `);
        
        if (remainingDuplicates.length === 0) {
            console.log('🎉 All duplicates successfully merged!');
        } else {
            console.log(`⚠️ ${remainingDuplicates.length} titles still have duplicates:`);
            remainingDuplicates.forEach(dup => {
                console.log(`   - "${dup.title}" (${dup.count} copies)`);
            });
        }
        
        // Show final card count
        const totalCards = await this.runQuery('SELECT COUNT(*) as count FROM cards');
        console.log(`\nTotal cards after merging: ${totalCards[0].count}`);
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const fixer = new DuplicateFixer();
    try {
        await fixer.connect();
        
        // Step 1: Find duplicates
        const duplicates = await fixer.findDuplicates();
        
        if (duplicates.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }
        
        // Step 2: Merge duplicates
        const mergedCount = await fixer.mergeDuplicates();
        console.log(`\n🔧 Merged ${mergedCount} duplicate cards`);
        
        // Step 3: Validate merges
        await fixer.validateMerges();
        
    } catch (error) {
        console.error('❌ Error fixing duplicates:', error);
    } finally {
        await fixer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = DuplicateFixer;
