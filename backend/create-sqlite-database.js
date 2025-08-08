const fs = require('fs');
const path = require('path');
const Database = require('sqlite');

async function createDatabase() {
    console.log('🗄️ Creating SQLite database...');
    
    const dbPath = path.join(__dirname, 'data', 'scorecard.db');
    const db = await Database.open(dbPath);
    
    // Create cards table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            summaryTitle TEXT,
            psa10Price REAL,
            psa10PriceDate TEXT,
            rawAveragePrice REAL,
            psa9AveragePrice REAL,
            sport TEXT,
            filterInfo TEXT,
            priceComparisons TEXT,
            lastUpdated TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create indexes for fast queries
    await db.exec('CREATE INDEX IF NOT EXISTS idx_missing_prices ON cards(rawAveragePrice, psa9AveragePrice)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_sport ON cards(sport)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_last_updated ON cards(lastUpdated)');
    
    console.log('✅ Database schema created successfully');
    return db;
}

async function migrateData() {
    console.log('📦 Migrating data from JSON to SQLite...');
    
    try {
        // Load JSON data
        const jsonPath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const items = jsonData.items || jsonData;
        
        console.log(`📊 Found ${items.length} cards to migrate`);
        
        // Create database
        const db = await createDatabase();
        
        // Begin transaction for faster inserts
        await db.exec('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
            INSERT INTO cards (
                title, summaryTitle, psa10Price, psa10PriceDate,
                rawAveragePrice, psa9AveragePrice, sport, filterInfo,
                priceComparisons, lastUpdated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        
        for (const card of items) {
            // Extract price comparison data
            let rawPrice = null;
            let psa9Price = null;
            let priceComparisons = null;
            
            if (card.priceComparisons) {
                rawPrice = card.priceComparisons.raw?.avgPrice || null;
                psa9Price = card.priceComparisons.psa9?.avgPrice || null;
                priceComparisons = JSON.stringify(card.priceComparisons);
            }
            
            await stmt.run([
                card.title || '',
                card.summaryTitle || '',
                card.psa10Price || null,
                card.psa10PriceDate || null,
                rawPrice,
                psa9Price,
                card.sport || null,
                card.filterInfo ? JSON.stringify(card.filterInfo) : null,
                priceComparisons,
                card.lastUpdated || null
            ]);
            
            inserted++;
            
            if (inserted % 1000 === 0) {
                console.log(`📈 Migrated ${inserted}/${items.length} cards...`);
            }
        }
        
        stmt.finalize();
        await db.exec('COMMIT');
        
        console.log(`✅ Successfully migrated ${inserted} cards to SQLite`);
        
        // Verify migration
        const countRow = await db.get('SELECT COUNT(*) as count FROM cards');
        console.log(`📊 Database now contains ${countRow.count} cards`);
        
        // Check missing prices
        const missingRow = await db.get(`
            SELECT COUNT(*) as count 
            FROM cards 
            WHERE rawAveragePrice IS NULL OR psa9AveragePrice IS NULL
        `);
        console.log(`🔄 ${missingRow.count} cards still missing price data`);
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Error during migration:', error);
        throw error;
    }
}

// Export functions for use in other modules
module.exports = { createDatabase, migrateData };

// Run migration if called directly
if (require.main === module) {
    migrateData().then(() => {
        console.log('🎉 Database migration completed successfully!');
    }).catch((error) => {
        console.error('❌ Migration failed:', error);
    });
} 