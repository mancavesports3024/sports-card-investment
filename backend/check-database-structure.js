const NewPricingDatabase = require('./create-new-pricing-database.js');

class DatabaseStructureChecker {
    constructor() {
        this.db = new NewPricingDatabase();
    }

    async connect() {
        await this.db.connect();
        console.log('✅ Connected to database');
    }

    async close() {
        await this.db.close();
        console.log('✅ Database connection closed');
    }

    async checkTableStructure() {
        console.log('🔍 Checking database table structure...\n');
        
        try {
            // Get table info
            const tableInfo = await this.db.allQuery("PRAGMA table_info(cards)");
            console.log('📋 Cards table structure:');
            console.log('Column Name | Type | Not Null | Default | Primary Key');
            console.log('------------|------|----------|---------|-------------');
            
            tableInfo.forEach(column => {
                console.log(`${column.name.padEnd(12)} | ${column.type.padEnd(4)} | ${column.notnull ? 'Yes' : 'No'.padEnd(8)} | ${(column.dflt_value || '').padEnd(7)} | ${column.pk ? 'Yes' : 'No'}`);
            });
            
            console.log('\n📊 Sample data from cards table:');
            const sampleData = await this.db.allQuery("SELECT * FROM cards LIMIT 3");
            
            if (sampleData.length > 0) {
                console.log('Available columns:', Object.keys(sampleData[0]));
                console.log('\nSample records:');
                sampleData.forEach((row, index) => {
                    console.log(`\nRecord ${index + 1}:`);
                    Object.entries(row).forEach(([key, value]) => {
                        console.log(`  ${key}: ${value}`);
                    });
                });
            } else {
                console.log('No data found in cards table');
            }
            
        } catch (error) {
            console.error('❌ Error checking table structure:', error.message);
        }
    }
}

// Main execution
async function main() {
    const checker = new DatabaseStructureChecker();
    
    try {
        await checker.connect();
        await checker.checkTableStructure();
    } catch (error) {
        console.error('❌ Error in main:', error);
    } finally {
        await checker.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { DatabaseStructureChecker };
