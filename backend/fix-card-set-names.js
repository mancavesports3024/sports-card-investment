const RailwayParallelsDatabase = require('./railway-parallels-db');

class CardSetNameFixer {
    constructor() {
        this.parallelsDb = new RailwayParallelsDatabase();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing card set name fixer...');
            await this.parallelsDb.connectDatabase();
            console.log('✅ Connected to parallels database');
        } catch (error) {
            console.error('❌ Error initializing:', error);
            throw error;
        }
    }

    generateCorrectSetName(setName, year, brand) {
        if (!setName) return '';
        
        // Clean up the set name - remove "Unknown" if it's just a placeholder
        let cleanSetName = setName.trim();
        
        // Start with year first
        let name = '';
        if (year && year !== 'Unknown') {
            name = `${year} `;
        }
        
        // Add brand if it's not "Unknown" and not already in the set name
        if (brand && brand !== 'Unknown' && !cleanSetName.toLowerCase().includes(brand.toLowerCase())) {
            name += `${brand} `;
        }
        
        // For the set name, if it's "Unknown", try to derive a better name
        if (cleanSetName === 'Unknown' || cleanSetName === '') {
            // If we have brand info, use that as the set name
            if (brand && brand !== 'Unknown') {
                name += brand;
            } else {
                // Default to "Base" if no other info
                name += 'Base';
            }
        } else {
            // Use the original set name if it's not "Unknown"
            name += cleanSetName;
        }
        
        return name.trim();
    }

    async fixAllCardSetNames() {
        try {
            console.log('🔍 Getting all card sets...');
            const cardSets = await this.parallelsDb.getAllCardSets();
            console.log(`📊 Found ${cardSets.length} card sets to process`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const cardSet of cardSets) {
                try {
                    // Generate the correct name
                    const correctName = this.generateCorrectSetName(
                        cardSet.set_name, 
                        cardSet.year, 
                        cardSet.brand
                    );

                    // Check if the name needs to be updated
                    if (correctName !== cardSet.set_name) {
                        console.log(`🔄 Updating: "${cardSet.set_name}" → "${correctName}"`);
                        
                        // Update the card set name in the database
                        await this.updateCardSetName(cardSet.id, correctName);
                        updatedCount++;
                    } else {
                        console.log(`✅ Already correct: "${cardSet.set_name}"`);
                        skippedCount++;
                    }

                } catch (error) {
                    console.error(`❌ Error processing card set ${cardSet.set_name}:`, error);
                }
            }

            console.log(`\n✅ Card set name fixing completed!`);
            console.log(`📊 Updated: ${updatedCount} card sets`);
            console.log(`⏭️  Skipped: ${skippedCount} card sets (already correct)`);

        } catch (error) {
            console.error('❌ Error fixing card set names:', error);
            throw error;
        }
    }

    async updateCardSetName(cardSetId, newName) {
        try {
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            const client = await pool.connect();
            
            const query = 'UPDATE card_sets SET set_name = $1 WHERE id = $2';
            await client.query(query, [newName, cardSetId]);
            
            client.release();
            await pool.end();

        } catch (error) {
            console.error(`❌ Error updating card set name:`, error);
            throw error;
        }
    }

    async close() {
        try {
            if (this.parallelsDb) {
                await this.parallelsDb.closeDatabase();
                console.log('✅ Database connection closed');
            }
        } catch (error) {
            console.error('❌ Error closing:', error);
        }
    }
}

// Main execution
async function main() {
    const fixer = new CardSetNameFixer();
    
    try {
        await fixer.initialize();
        await fixer.fixAllCardSetNames();
        
    } catch (error) {
        console.error('❌ Card set name fixing failed:', error);
        process.exit(1);
    } finally {
        await fixer.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { CardSetNameFixer };
