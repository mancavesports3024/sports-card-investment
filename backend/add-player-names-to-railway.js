const { DatabaseDrivenStandardizedTitleGenerator } = require('./generate-standardized-summary-titles-database-driven.js');

async function addPlayerNamesToRailway() {
    console.log('🎯 Adding Player Names to Railway Database...\n');
    
    const generator = new DatabaseDrivenStandardizedTitleGenerator();
    
    try {
        // Connect to database
        await generator.connect();
        
        // Ensure player_name column exists
        await generator.ensurePlayerNameColumn();
        
        // Get all cards that don't have player names yet
        const cards = await generator.runQuery(`
            SELECT id, title, summary_title, player_name 
            FROM cards 
            WHERE player_name IS NULL OR player_name = ''
        `);
        
        console.log(`📊 Found ${cards.length} cards without player names`);
        
        if (cards.length === 0) {
            console.log('✅ All cards already have player names!');
            return;
        }
        
        let updated = 0;
        let errors = 0;
        
        for (const card of cards) {
            try {
                const extractedPlayer = generator.extractPlayer(card.title);
                
                if (extractedPlayer) {
                    await generator.runUpdate(
                        'UPDATE cards SET player_name = ? WHERE id = ?',
                        [extractedPlayer, card.id]
                    );
                    
                    console.log(`✅ Updated card ${card.id}: "${extractedPlayer}"`);
                    updated++;
                } else {
                    console.log(`⚠️ Could not extract player name for card ${card.id}: "${card.title.substring(0, 50)}..."`);
                }
            } catch (error) {
                console.error(`❌ Error processing card ${card.id}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n🎉 Player Name Addition Complete!');
        console.log('================================');
        console.log(`📊 Total cards processed: ${cards.length}`);
        console.log(`✅ Updated: ${updated}`);
        console.log(`❌ Errors: ${errors}`);
        
        // Show some examples
        console.log('\n📋 Sample cards with player names:');
        const sampleCards = await generator.runQuery(`
            SELECT id, title, player_name 
            FROM cards 
            WHERE player_name IS NOT NULL 
            LIMIT 5
        `);
        
        sampleCards.forEach((card, i) => {
            console.log(`${i + 1}. ID: ${card.id}`);
            console.log(`   Title: ${card.title.substring(0, 60)}...`);
            console.log(`   Player: ${card.player_name}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error adding player names:', error);
        throw error;
    } finally {
        if (generator.db) {
            generator.db.close();
        }
    }
}

// Run the script
addPlayerNamesToRailway().catch(console.error);
