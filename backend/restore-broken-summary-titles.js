const NewPricingDatabase = require('./create-new-pricing-database.js');

async function restoreBrokenSummaryTitles() {
    console.log('🚨 EMERGENCY: Restoring broken summary titles...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Get all cards with broken summary titles (too short)
        const cards = await db.allQuery(`
            SELECT id, title, summary_title 
            FROM cards 
            WHERE LENGTH(summary_title) < 40
            LIMIT 100
        `);
        
        console.log(`📊 Found ${cards.length} cards with broken summary titles\n`);
        
        let fixed = 0;
        
        for (const card of cards) {
            const title = card.title || '';
            const currentSummary = card.summary_title || '';
            
            // Extract player name from title (look for the actual player name)
            let playerName = '';
            const titleWords = title.split(' ');
            
            // Look for player name patterns (skip brands, years, etc.)
            for (let i = 0; i < Math.min(6, titleWords.length); i++) {
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
                    !potentialName.toLowerCase().includes('rookie') &&
                    !potentialName.toLowerCase().includes('2024') &&
                    !potentialName.toLowerCase().includes('2023') &&
                    !potentialName.toLowerCase().includes('2010') &&
                    !potentialName.toLowerCase().includes('1964') &&
                    !potentialName.toLowerCase().includes('instant') &&
                    !potentialName.toLowerCase().includes('select') &&
                    !potentialName.toLowerCase().includes('stamps') &&
                    !potentialName.toLowerCase().includes('football') &&
                    !potentialName.toLowerCase().includes('basketball') &&
                    !potentialName.toLowerCase().includes('wnba') &&
                    !potentialName.toLowerCase().includes('fever') &&
                    !potentialName.toLowerCase().includes('luck') &&
                    !potentialName.toLowerCase().includes('lottery') &&
                    !potentialName.toLowerCase().includes('fast') &&
                    !potentialName.toLowerCase().includes('break') &&
                    !potentialName.toLowerCase().includes('dragon') &&
                    !potentialName.toLowerCase().includes('scale') &&
                    !potentialName.toLowerCase().includes('world') &&
                    !potentialName.toLowerCase().includes('champion') &&
                    !potentialName.toLowerCase().includes('boxers') &&
                    !potentialName.toLowerCase().includes('muhammad') &&
                    !potentialName.toLowerCase().includes('ali')) {
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
            
            // Generate proper summary title
            let newSummary = '';
            if (year) newSummary += year + ' ';
            if (brand) {
                newSummary += brand;
                if (title.toLowerCase().includes('chrome')) newSummary += ' Chrome';
                if (title.toLowerCase().includes('prizm')) newSummary += ' Prizm';
                if (title.toLowerCase().includes('instant')) newSummary += ' Instant';
                if (title.toLowerCase().includes('select')) newSummary += ' Select';
                newSummary += ' ';
            }
            if (playerName) newSummary += playerName + ' ';
            if (title.toLowerCase().includes('auto')) newSummary += 'Auto ';
            if (title.toLowerCase().includes('rc') || title.toLowerCase().includes('rookie')) newSummary += 'RC ';
            
            // Add special features
            if (title.toLowerCase().includes('luck of the lottery')) newSummary += 'Luck of the Lottery Fast Break ';
            if (title.toLowerCase().includes('dragon scale')) newSummary += 'Dragon Scale Prizm ';
            if (title.toLowerCase().includes('world champion boxers')) newSummary += 'World Champion Boxers ';
            
            // Add card number if present
            const numberMatch = title.match(/#\d+/);
            if (numberMatch) newSummary += numberMatch[0] + ' ';
            
            // Add parallel info
            const parallelMatch = title.match(/\/(\d+)/);
            if (parallelMatch) newSummary += '/' + parallelMatch[1] + ' ';
            
            newSummary = newSummary.trim();
            
            if (newSummary !== currentSummary && newSummary.length > currentSummary.length && newSummary.length > 15) {
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
        console.error('❌ Error restoring summary titles:', error);
        await db.close();
    }
}

// Export the function
module.exports = { restoreBrokenSummaryTitles };

// Run the emergency restore if called directly
if (require.main === module) {
    restoreBrokenSummaryTitles().catch(console.error);
}
