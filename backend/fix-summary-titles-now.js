const NewPricingDatabase = require('./create-new-pricing-database.js');

async function fixSummaryTitlesNow() {
    console.log('🔧 Fixing Summary Titles Now...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Get all cards with short summary titles
        const cards = await db.allQuery(`
            SELECT id, title, summary_title 
            FROM cards 
            WHERE LENGTH(summary_title) < 30
            LIMIT 50
        `);
        
        console.log(`📊 Found ${cards.length} cards with short summary titles\n`);
        
        let fixed = 0;
        
        for (const card of cards) {
            const title = card.title || '';
            const currentSummary = card.summary_title || '';
            
            // Extract player name from title
            let playerName = '';
            const titleWords = title.split(' ');
            
            // Look for player name patterns (first 2-3 words that aren't brands/years)
            for (let i = 0; i < Math.min(4, titleWords.length); i++) {
                const potentialName = titleWords.slice(0, i + 1).join(' ');
                if (potentialName.length >= 3 && 
                    !potentialName.toLowerCase().includes('topps') &&
                    !potentialName.toLowerCase().includes('panini') &&
                    !potentialName.toLowerCase().includes('bowman') &&
                    !potentialName.toLowerCase().includes('chrome') &&
                    !potentialName.toLowerCase().includes('prizm') &&
                    !potentialName.toLowerCase().includes('psa') &&
                    !potentialName.toLowerCase().includes('auto') &&
                    !potentialName.toLowerCase().includes('rc') &&
                    !potentialName.toLowerCase().includes('2024') &&
                    !potentialName.toLowerCase().includes('2023') &&
                    !potentialName.toLowerCase().includes('2010') &&
                    !potentialName.toLowerCase().includes('1964')) {
                    playerName = potentialName;
                    break;
                }
            }
            
            // Extract brand
            let brand = '';
            if (title.toLowerCase().includes('topps')) brand = 'Topps';
            else if (title.toLowerCase().includes('panini')) brand = 'Panini';
            else if (title.toLowerCase().includes('bowman')) brand = 'Bowman';
            else if (title.toLowerCase().includes('slania')) brand = 'Slania';
            
            // Extract year
            const yearMatch = title.match(/\b(19|20)\d{2}(?:[-]\d{2})?\b/);
            const year = yearMatch ? yearMatch[0] : '';
            
            // Generate better summary title
            let newSummary = '';
            if (year) newSummary += year + ' ';
            if (brand) {
                newSummary += brand;
                if (title.toLowerCase().includes('chrome')) newSummary += ' Chrome';
                if (title.toLowerCase().includes('prizm')) newSummary += ' Prizm';
                newSummary += ' ';
            }
            if (playerName) newSummary += playerName + ' ';
            if (title.toLowerCase().includes('auto')) newSummary += 'Auto ';
            if (title.toLowerCase().includes('rc') || title.toLowerCase().includes('rookie')) newSummary += 'RC ';
            
            // Add card number if present
            const numberMatch = title.match(/#\d+/);
            if (numberMatch) newSummary += numberMatch[0] + ' ';
            
            newSummary = newSummary.trim();
            
            if (newSummary !== currentSummary && newSummary.length > currentSummary.length && newSummary.length > 10) {
                await db.runQuery(
                    'UPDATE cards SET summary_title = ? WHERE id = ?',
                    [newSummary, card.id]
                );
                
                console.log(`✅ Fixed card ${card.id}:`);
                console.log(`   Old: "${currentSummary}"`);
                console.log(`   New: "${newSummary}"`);
                console.log(`   Player: "${playerName}", Brand: "${brand}", Year: "${year}"`);
                console.log('');
                
                fixed++;
            }
        }
        
        console.log(`🎉 Fixed ${fixed} out of ${cards.length} cards`);
        
        // Check health score
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
