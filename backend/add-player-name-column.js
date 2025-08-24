const NewPricingDatabase = require('./create-new-pricing-database.js');

async function addPlayerNameColumn() {
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        console.log('✅ Connected to database');
        
        // Check if player_name column exists
        const structureQuery = `PRAGMA table_info(cards)`;
        const structure = await db.allQuery(structureQuery);
        const hasPlayerName = structure.some(col => col.name === 'player_name');
        
        if (hasPlayerName) {
            console.log('✅ player_name column already exists');
        } else {
            console.log('📝 Adding player_name column...');
            const addColumnQuery = `ALTER TABLE cards ADD COLUMN player_name TEXT`;
            await db.runQuery(addColumnQuery);
            console.log('✅ player_name column added successfully');
        }
        
        // Show current structure
        const newStructure = await db.allQuery(structureQuery);
        console.log('📋 Current table structure:');
        newStructure.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });
        
    } catch (error) {
        console.error('❌ Error adding player_name column:', error);
    } finally {
        await db.close();
        console.log('✅ Database connection closed');
    }
}

addPlayerNameColumn();
