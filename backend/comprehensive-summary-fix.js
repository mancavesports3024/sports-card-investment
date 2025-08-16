const NewPricingDatabase = require('./create-new-pricing-database.js');

function fixSummaryTitle(summaryTitle, title, playerName) {
    if (!summaryTitle) return summaryTitle;
    let fixed = summaryTitle;
    
    // 1. Add missing product names based on the original title
    const titleLower = title.toLowerCase();
    
    // Product name mappings
    const productMappings = [
        { patterns: ['chronicles'], product: 'Panini Chronicles' },
        { patterns: ['prizm'], product: 'Panini Prizm' },
        { patterns: ['phoenix'], product: 'Panini Phoenix' },
        { patterns: ['gallery'], product: 'Topps Gallery' },
        { patterns: ['wwe'], product: 'Panini Chronicles WWE' },
        { patterns: ['chrome update'], product: 'Topps Chrome Update' },
        { patterns: ['national treasures'], product: 'Panini National Treasures' },
        { patterns: ['flawless'], product: 'Panini Flawless' },
        { patterns: ['stadium club'], product: 'Topps Stadium Club' },
        { patterns: ['skybox'], product: 'Skybox' },
        { patterns: ['spectra'], product: 'Panini Spectra' },
        { patterns: ['finest'], product: 'Topps Finest' },
        { patterns: ['obsidian'], product: 'Panini Obsidian' },
        { patterns: ['absolute'], product: 'Panini Absolute' },
        { patterns: ['certified'], product: 'Panini Certified' },
        { patterns: ['optic'], product: 'Panini Donruss Optic' },
        { patterns: ['cosmic chrome'], product: 'Topps Cosmic Chrome' },
        { patterns: ['allen & ginter'], product: 'Topps Allen & Ginter' },
        { patterns: ['one and one'], product: 'Panini One and One' },
        { patterns: ['synergy'], product: 'Panini Synergy' },
        { patterns: ['slania stamps'], product: 'Slania Stamps' },
        { patterns: ['road to uefa euro'], product: 'Topps Road To UEFA Euro' },
        { patterns: ['usa basketball'], product: 'USA Basketball' },
        { patterns: ['bowman u chrome'], product: 'Bowman University Chrome' },
        { patterns: ['bowman chrome'], product: 'Bowman Chrome' },
        { patterns: ['topps chrome'], product: 'Topps Chrome' },
        { patterns: ['panini donruss'], product: 'Panini Donruss' },
        { patterns: ['panini select'], product: 'Panini Select' },
        { patterns: ['panini contenders'], product: 'Panini Contenders' },
        { patterns: ['panini mosaic'], product: 'Panini Mosaic' },
        { patterns: ['panini xr'], product: 'Panini XR' },
        { patterns: ['panini instant'], product: 'Panini Instant' },
        { patterns: ['panini limited'], product: 'Panini Limited' },
        { patterns: ['panini elite'], product: 'Panini Elite' },
        { patterns: ['panini prestige'], product: 'Panini Prestige' },
        { patterns: ['panini score'], product: 'Panini Score' },
        { patterns: ['panini leaf'], product: 'Panini Leaf' },
        { patterns: ['panini playoff'], product: 'Panini Playoff' },
        { patterns: ['panini sage'], product: 'Panini Sage' },
        { patterns: ['panini hit'], product: 'Panini Hit' },
        { patterns: ['panini pacific'], product: 'Panini Pacific' },
        { patterns: ['panini skybox'], product: 'Panini Skybox' },
        { patterns: ['panini metal'], product: 'Panini Metal' },
        { patterns: ['panini heritage'], product: 'Panini Heritage' },
        { patterns: ['panini gypsy queen'], product: 'Panini Gypsy Queen' },
        { patterns: ['panini archives'], product: 'Panini Archives' },
        { patterns: ['panini big league'], product: 'Panini Big League' },
        { patterns: ['panini fire'], product: 'Panini Fire' },
        { patterns: ['panini opening day'], product: 'Panini Opening Day' },
        { patterns: ['panini series 1'], product: 'Panini Series 1' },
        { patterns: ['panini series 2'], product: 'Panini Series 2' },
        { patterns: ['panini chrome update'], product: 'Panini Chrome Update' },
        { patterns: ['panini chrome sapphire'], product: 'Panini Chrome Sapphire' },
        { patterns: ['panini chrome black'], product: 'Panini Chrome Black' },
        { patterns: ['panini bowman'], product: 'Panini Bowman' },
        { patterns: ['panini topps'], product: 'Panini Topps' },
        { patterns: ['panini fleer'], product: 'Panini Fleer' },
        { patterns: ['panini donruss'], product: 'Panini Donruss' },
        { patterns: ['panini finest'], product: 'Panini Finest' },
        { patterns: ['panini mosaic'], product: 'Panini Mosaic' },
        { patterns: ['panini select'], product: 'Panini Select' },
        { patterns: ['panini contenders'], product: 'Panini Contenders' },
        { patterns: ['panini hoops'], product: 'Panini Hoops' },
        { patterns: ['panini pokemon'], product: 'Panini Pokemon' },
        { patterns: ['panini o-pee-chee'], product: 'Panini O-Pee-Chee' },
        { patterns: ['panini o pee chee'], product: 'Panini O-Pee-Chee' },
        { patterns: ['panini o-pee-chee'], product: 'Panini O-Pee-Chee' }
    ];
    
    // Check if we need to add a product name
    let hasProductName = false;
    for (const mapping of productMappings) {
        if (mapping.patterns.some(pattern => titleLower.includes(pattern))) {
            hasProductName = true;
            break;
        }
    }
    
    // If no product name found, add the most likely one based on the title
    if (!hasProductName) {
        for (const mapping of productMappings) {
            if (mapping.patterns.some(pattern => titleLower.includes(pattern))) {
                // Add product name at the beginning after the year
                const yearMatch = fixed.match(/^(\d{4}(?:-\d{2})?)\s+/);
                if (yearMatch) {
                    fixed = fixed.replace(yearMatch[0], `${yearMatch[1]} ${mapping.product} `);
                } else {
                    fixed = `${mapping.product} ${fixed}`;
                }
                break;
            }
        }
    }
    
    // 2. Fix player names
    const playerNameFixes = [
        { from: 'Shohei Ohtani ANGELS', to: 'Shohei Ohtani' },
        { from: 'Bryce Young PANTHERS', to: 'Bryce Young' },
        { from: 'Randy Moss VIKINGS', to: 'Randy Moss' },
        { from: 'Luka Dončić ESSENTIALS', to: 'Luka Dončić' },
        { from: 'Bobby Witt Jr. ROYALS', to: 'Bobby Witt Jr.' },
        { from: 'Jalen Hurts SUNDAY KINGS', to: 'Jalen Hurts' },
        { from: 'BO JACKSON *iconic + BO KNOWS', to: 'Bo Jackson' },
        { from: 'Ronald Acuña Jr. STAR MVP', to: 'Ronald Acuña Jr.' },
        { from: 'Paul Skenes Usc27', to: 'Paul Skenes' },
        { from: 'Drake Maye KINGS', to: 'Drake Maye' },
        { from: 'Xavier Worthy CHOICE CHIEFS', to: 'Xavier Worthy' },
        { from: 'MICHAEL PENIX Jr. FALCONS', to: 'Michael Penix Jr.' },
        { from: 'Juan Soto .', to: 'Juan Soto' },
        { from: 'LUMINANCE Justin Herbert', to: 'Justin Herbert' },
        { from: 'Dak Prescott & COWBOYS', to: 'Dak Prescott' },
        { from: 'Nelson Rada . Cpanr', to: 'Nelson Rada' },
        { from: 'Jayden Daniels JERSEY RELIC PHENOM SGC .', to: 'Jayden Daniels' },
        { from: 'Ucl Edition Pedri', to: 'Pedri' },
        { from: 'Bo Nix LOW', to: 'Bo Nix' },
        { from: 'Dj Lagway Florida Gators', to: 'DJ Lagway' },
        { from: 'Slania Stamps Cassius Clay World Champion Boxers Muhammad Ali', to: 'Muhammad Ali' },
        { from: 'HOOPS Victor Wembanyama GREETINGS WINTER', to: 'Victor Wembanyama' },
        { from: 'Synergy Frank Nazar Starquest Tint :', to: 'Frank Nazar' },
        { from: 'DP Jaxon Smith-Njigba', to: 'Jaxon Smith-Njigba' },
        { from: 'Cameron Brink MILLIONAIRE', to: 'Cameron Brink' },
        { from: 'Ja\'Marr Chase', to: 'Ja\'marr Chase' },
        { from: 'Ja\'marr Chase', to: 'Ja\'marr Chase' },
        { from: 'LOGAN O\'Hoppe', to: 'Logan O\'Hoppe' },
        { from: 'Leo De Vries', to: 'Leo De Vries' }
    ];
    
    for (const fix of playerNameFixes) {
        fixed = fixed.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
    }
    
    // 3. Clean up extra formatting
    fixed = fixed.replace(/\s+/g, ' ').trim();
    fixed = fixed.replace(/\s*,\s*$/, ''); // Remove trailing commas
    fixed = fixed.replace(/^\s*,\s*/, ''); // Remove leading commas
    
    return fixed;
}

async function fixAllSummaryIssues() {
    console.log('🔧 Fixing all remaining summary title issues...\n');
    
    const db = new NewPricingDatabase();
    
    try {
        await db.connect();
        console.log('✅ Connected to Railway database');
        
        // Get all cards
        const cards = await db.allQuery('SELECT id, title, summary_title, player_name FROM cards');
        console.log(`📊 Found ${cards.length} cards to check\n`);
        
        let fixedCount = 0;
        let issuesFound = 0;
        
        for (const card of cards) {
            const originalSummary = card.summary_title || '';
            const fixedSummary = fixSummaryTitle(originalSummary, card.title, card.player_name);
            
            if (fixedSummary !== originalSummary && fixedSummary.length > 0) {
                issuesFound++;
                console.log(`🔍 Card ID: ${card.id}`);
                console.log(`   Player: "${card.player_name}"`);
                console.log(`   Original: "${originalSummary}"`);
                console.log(`   Fixed: "${fixedSummary}"`);
                console.log('');
                
                await db.runQuery('UPDATE cards SET summary_title = ? WHERE id = ?', [fixedSummary, card.id]);
                fixedCount++;
                console.log(`✅ Updated card ${card.id}`);
            }
        }
        
        console.log('\n🎉 Comprehensive Summary Title Fix Complete!');
        console.log(`📊 Total cards checked: ${cards.length}`);
        console.log(`🔍 Issues found: ${issuesFound}`);
        console.log(`✅ Cards fixed: ${fixedCount}`);
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await db.close();
        console.log('✅ Database connection closed');
    }
}

// Export the function for use in other modules
module.exports = { fixSummaryTitle, fixAllSummaryIssues };

// Run if called directly
if (require.main === module) {
    fixAllSummaryIssues();
}
