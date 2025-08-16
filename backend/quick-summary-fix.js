const NewPricingDatabase = require('./create-new-pricing-database.js');

async function quickSummaryFix() {
    console.log('🔧 Quick Summary Title Fix...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        
        // Fix the most obvious issues
        const fixes = [
            {
                id: 705,
                old: '2010 Auto RC',
                new: '2010 Topps Chrome Demaryius Thomas Auto RC'
            },
            {
                id: 704,
                old: '2024-25 Instant RC #1',
                new: '2024-25 Panini Instant WNBA Caitlin Clark RC #1'
            },
            {
                id: 703,
                old: '2024 #12',
                new: '2024 Panini Prizm Stephon Castle Luck of the Lottery Fast Break #12'
            },
            {
                id: 702,
                old: '2023 Prizm Select #200',
                new: '2023 Panini Select Josh Allen Dragon Scale Prizm #200 /70'
            },
            {
                id: 701,
                old: '1964 Stamps #23',
                new: '1964 Slania Stamps Cassius Clay World Champion Boxers Muhammad Ali #23'
            }
        ];
        
        let fixed = 0;
        
        for (const fix of fixes) {
            try {
                await db.runQuery(
                    'UPDATE cards SET summary_title = ? WHERE id = ?',
                    [fix.new, fix.id]
                );
                
                console.log(`✅ Fixed card ${fix.id}:`);
                console.log(`   Old: "${fix.old}"`);
                console.log(`   New: "${fix.new}"`);
                console.log('');
                
                fixed++;
            } catch (error) {
                console.error(`❌ Error fixing card ${fix.id}:`, error);
            }
        }
        
        console.log(`🎉 Fixed ${fixed} out of ${fixes.length} cards`);
        
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
        console.error('❌ Error in quick summary fix:', error);
        await db.close();
    }
}

// Run the fix
quickSummaryFix().catch(console.error);
