const NewPricingDatabase = require('./create-new-pricing-database.js');

async function checkDatabaseStructure() {
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        console.log('✅ Connected to database');
        
        // Check what tables exist
        const tablesQuery = `SELECT name FROM sqlite_master WHERE type='table'`;
        const tables = await db.allQuery(tablesQuery);
        console.log('📋 Tables in database:', tables.map(t => t.name));
        
        // Check if cards table exists
        if (tables.some(t => t.name === 'cards')) {
            console.log('✅ Cards table exists');
            
            // Check table structure
            const structureQuery = `PRAGMA table_info(cards)`;
            const structure = await db.allQuery(structureQuery);
            console.log('📋 Cards table structure:');
            structure.forEach(col => {
                console.log(`  - ${col.name} (${col.type})`);
            });
            
            // Check total count
            const countQuery = `SELECT COUNT(*) as total FROM cards`;
            const countResult = await db.getQuery(countQuery);
            console.log(`📊 Total cards: ${countResult.total}`);
            
            // Show sample data
            const sampleQuery = `SELECT * FROM cards LIMIT 3`;
            const sampleData = await db.allQuery(sampleQuery);
            console.log('📋 Sample data:');
            sampleData.forEach((row, index) => {
                console.log(`  Row ${index + 1}:`, row);
            });
            
        } else {
            console.log('❌ Cards table does not exist');
        }
        
    } catch (error) {
        console.error('❌ Error checking database structure:', error);
    } finally {
        await db.close();
        console.log('✅ Database connection closed');
    }
}

checkDatabaseStructure();
