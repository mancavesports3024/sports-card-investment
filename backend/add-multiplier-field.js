const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MultiplierFieldAdder {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'new-scorecard.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
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

    async addMultiplierColumn() {
        console.log('🔧 Adding multiplier column to database...');
        
        try {
            // Check if column already exists
            const columns = await this.getTableColumns();
            const hasMultiplier = columns.some(col => col.name === 'multiplier');
            
            if (hasMultiplier) {
                console.log('✅ Multiplier column already exists');
                return;
            }

            // Add the multiplier column
            await this.runQuery(`
                ALTER TABLE cards 
                ADD COLUMN multiplier DECIMAL(10,2)
            `);
            
            console.log('✅ Multiplier column added successfully');
            
        } catch (error) {
            console.error('❌ Error adding multiplier column:', error);
            throw error;
        }
    }

    async calculateMultipliers() {
        console.log('🧮 Calculating multipliers for existing cards...');
        
        try {
            const cards = await this.getCardsWithPrices();
            console.log(`📊 Found ${cards.length} cards with both raw and PSA 10 prices`);
            
            let updatedCount = 0;
            
            for (const card of cards) {
                if (card.raw_average_price && card.psa10_price && card.raw_average_price > 0) {
                    const multiplier = (card.psa10_price / card.raw_average_price).toFixed(2);
                    
                    await this.runQuery(`
                        UPDATE cards 
                        SET multiplier = ? 
                        WHERE id = ?
                    `, [multiplier, card.id]);
                    
                    updatedCount++;
                    
                    if (updatedCount % 10 === 0) {
                        console.log(`✅ Updated ${updatedCount} cards...`);
                    }
                }
            }
            
            console.log(`✅ Multiplier calculation complete!`);
            console.log(`📊 Total cards updated: ${updatedCount}`);
            
        } catch (error) {
            console.error('❌ Error calculating multipliers:', error);
            throw error;
        }
    }

    async getTableColumns() {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(cards)", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getCardsWithPrices() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, raw_average_price, psa10_price 
                FROM cards 
                WHERE raw_average_price IS NOT NULL 
                AND psa10_price IS NOT NULL
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close(() => {
                console.log('✅ Database connection closed');
                resolve();
            });
        });
    }
}

async function main() {
    const adder = new MultiplierFieldAdder();
    
    try {
        await adder.connect();
        await adder.addMultiplierColumn();
        await adder.calculateMultipliers();
    } catch (error) {
        console.error('❌ Error in main:', error);
        process.exit(1);
    } finally {
        await adder.close();
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('✅ Multiplier field addition completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Multiplier field addition failed:', error);
            process.exit(1);
        });
}

module.exports = { MultiplierFieldAdder };
