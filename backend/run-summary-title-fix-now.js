const NewPricingDatabase = require('./create-new-pricing-database.js');

async function fixSummaryTitlesNow() {
    console.log('🔧 Running immediate summary title fix on Railway...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Get all cards with problematic summary titles
        const cards = await db.allQuery(`
            SELECT id, title, summary_title 
            FROM cards 
            WHERE summary_title IS NOT NULL 
            AND (
                summary_title LIKE '%  %' OR
                summary_title LIKE '%DEMARYIUS THOMAS%' OR
                summary_title LIKE '%DRAGON SCALE%' OR
                summary_title LIKE '%LUCK OF LOTTERY%' OR
                summary_title LIKE '%KYLE HARRISON%' OR
                summary_title LIKE '%DJ LAGWAY%' OR
                summary_title LIKE '%SAQUON BARKLEY%' OR
                summary_title LIKE '%BO NIX%' OR
                summary_title LIKE '%PEDRI%'
            )
            LIMIT 20
        `);
        
        console.log(`📊 Found ${cards.length} cards with obvious issues to fix\n`);
        
        let fixed = 0;
        
        for (const card of cards) {
            const title = card.title || '';
            const currentSummary = card.summary_title || '';
            
            // Simple fixes based on the patterns we saw
            let newSummary = currentSummary;
            
            // Fix duplicate player names
            if (currentSummary.includes('Demaryius Thomas  Chrome DEMARYIUS THOMAS')) {
                newSummary = '2010 Topps Chrome Demaryius Thomas Auto';
            }
            else if (currentSummary.includes('Josh DRAGON SCALE Allen')) {
                newSummary = '2023 Panini Select Josh Allen Dragon Scale Prizm #200 /70';
            }
            else if (currentSummary.includes('LUCK OF LOTTERY Stephon Castle')) {
                newSummary = '2024 Panini Prizm Stephon Castle Luck of the Lottery Fast Break #12';
            }
            else if (currentSummary.includes('Kyle Harrison  Chrome KYLE HARRISON')) {
                newSummary = '2024 Bowman Chrome Kyle Harrison Blue Refractor /150 Auto';
            }
            else if (currentSummary.includes('Dj Lagway Florida Gators  University Chrome DJ LAGWAY')) {
                newSummary = '2024 Bowman U Chrome DJ Lagway Florida Gators #63 1st RC';
            }
            else if (currentSummary.includes('Saquon Barkley RED WHITE BLUE')) {
                newSummary = '2018 Panini Prizm Saquon Barkley Red White Blue RC';
            }
            else if (currentSummary.includes('Bo Nix LOW #309')) {
                newSummary = '2024 Panini Prizm Bo Nix RC #309';
            }
            else if (currentSummary.includes('Ucl Edition Pedri  Chrome UCL EDITION PEDRI')) {
                newSummary = '2020-21 Topps Chrome UCL Sapphire Edition Pedri #61 RC';
            }
            
            // Clean up extra spaces
            newSummary = newSummary.replace(/\s+/g, ' ').trim();
            
            if (newSummary !== currentSummary) {
                await db.runQuery(
                    'UPDATE cards SET summary_title = ? WHERE id = ?',
                    [newSummary, card.id]
                );
                
                console.log(`✅ Fixed card ${card.id}:`);
                console.log(`   Old: "${currentSummary}"`);
                console.log(`   New: "${newSummary}"`);
                console.log('');
                
                fixed++;
            }
        }
        
        console.log(`🎉 Fixed ${fixed} out of ${cards.length} cards`);
        
        // Check health score after fixes
        const allCards = await db.allQuery('SELECT * FROM cards');
        let summaryTitleIssues = 0;
        
        allCards.forEach(card => {
            const title = card.title || '';
            const summaryTitle = card.summary_title || '';
            const playerName = title.split(' ').slice(0, 2).join(' ').trim();
            
            if (!summaryTitle || (playerName && !summaryTitle.includes(playerName)) || 
                !summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman)\b/i)) {
                summaryTitleIssues++;
            }
        });
        
        const healthScore = allCards.length > 0 ? ((allCards.length - summaryTitleIssues) / allCards.length * 100).toFixed(1) : 0;
        
        console.log(`📊 Updated Health Score: ${healthScore}%`);
        console.log(`📊 Remaining Summary Title Issues: ${summaryTitleIssues}`);
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Error fixing summary titles:', error);
        await db.close();
    }
}

// Run the fix
fixSummaryTitlesNow().catch(console.error);
