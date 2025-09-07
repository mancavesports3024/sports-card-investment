#!/usr/bin/env node

const NewPricingDatabase = require('./create-new-pricing-database.js');

async function debugSpecificDuplicates() {
    console.log('🔍 Debugging specific duplicate cases...\n');
    
    const db = new NewPricingDatabase();
    await db.connect();
    
    try {
        // Look for Cam Caminiti cards
        console.log('🔍 Searching for Cam Caminiti cards:');
        const camCards = await db.allQuery(`
            SELECT id, title, player_name, card_number, year, card_set, summary_title
            FROM cards 
            WHERE player_name LIKE '%Cam%Caminiti%' OR title LIKE '%Cam%Caminiti%'
            ORDER BY id
        `);
        
        console.log(`Found ${camCards.length} Cam Caminiti cards:`);
        camCards.forEach(card => {
            console.log(`  ID:${card.id} | Player:"${card.player_name}" | Number:"${card.card_number}" | Year:${card.year}`);
            console.log(`    Title: "${card.title}"`);
            console.log(`    Summary: "${card.summary_title}"`);
            console.log('---');
        });
        
        // Look for Nick Kurtz cards
        console.log('\n🔍 Searching for Nick Kurtz cards:');
        const nickCards = await db.allQuery(`
            SELECT id, title, player_name, card_number, year, card_set, summary_title
            FROM cards 
            WHERE player_name LIKE '%Nick%Kurtz%' OR title LIKE '%Nick%Kurtz%'
            ORDER BY id
        `);
        
        console.log(`Found ${nickCards.length} Nick Kurtz cards:`);
        nickCards.forEach(card => {
            console.log(`  ID:${card.id} | Player:"${card.player_name}" | Number:"${card.card_number}" | Year:${card.year}`);
            console.log(`    Title: "${card.title}"`);
            console.log(`    Summary: "${card.summary_title}"`);
            console.log('---');
        });
        
        // Test our normalization logic
        console.log('\n🧪 Testing card number normalization:');
        const testNumbers = ['BDC-20', 'BDC20', '#BDC-20', 'BDC56', '#BDC56'];
        testNumbers.forEach(num => {
            const normalized = num.toLowerCase().replace(/[#\-\s]/g, '').trim();
            console.log(`  "${num}" → "${normalized}"`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await db.close();
    }
}

debugSpecificDuplicates().catch(console.error);
