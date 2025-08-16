const NewPricingDatabase = require('./create-new-pricing-database.js');

function fixSummaryTitle(summaryTitle, title, playerName) {
    if (!summaryTitle) return summaryTitle;
    
    let fixed = summaryTitle;
    
    // 0. Add missing product names based on the original title
    if (title) {
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
    }
    
    // 0.5. Fix player names
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
    
    // 1. Remove team names
    const teamNames = [
        'Florida Gators', 'Gators', 'COWBOYS', 'Cowboys', 'VIKINGS', 'Vikings',
        'BULLS', 'Bulls', 'LAKERS', 'Lakers', 'WARRIORS', 'Warriors',
        'PATRIOTS', 'Patriots', 'BENGALS', 'Bengals', 'RAIDERS', 'Raiders',
        'CHARGERS', 'Chargers', 'GIANTS', 'Giants', 'EAGLES', 'Eagles',
        'COMMANDERS', 'Commanders', 'BEARS', 'Bears', 'LIONS', 'Lions',
        'PACKERS', 'Packers', 'FALCONS', 'Falcons', 'PANTHERS', 'Panthers',
        'SAINTS', 'Saints', 'BUCCANEERS', 'Buccaneers', 'CARDINALS', 'Cardinals',
        'RAMS', 'Rams', '49ERS', '49ers', 'SEAHAWKS', 'Seahawks', 'YANKEES', 'Yankees',
        'RED SOX', 'Red Sox', 'BLUE JAYS', 'Blue Jays', 'ORIOLES', 'Orioles',
        'RAYS', 'Rays', 'WHITE SOX', 'White Sox', 'GUARDIANS', 'Guardians',
        'TIGERS', 'Tigers', 'ROYALS', 'Royals', 'TWINS', 'Twins',
        'ASTROS', 'Astros', 'ANGELS', 'Angels', 'ATHLETICS', 'Athletics',
        'MARINERS', 'Mariners', 'RANGERS', 'Rangers', 'BRAVES', 'Braves',
        'MARLINS', 'Marlins', 'METS', 'Mets', 'PHILLIES', 'Phillies',
        'NATIONALS', 'Nationals', 'CUBS', 'Cubs', 'REDS', 'Reds',
        'BREWERS', 'Brewers', 'PIRATES', 'Pirates', 'DIAMONDBACKS', 'Diamondbacks',
        'ROCKIES', 'Rockies', 'DODGERS', 'Dodgers', 'PADRES', 'Padres',
        'GIANTS', 'Giants', 'HAWKS', 'Hawks', 'CELTICS', 'Celtics',
        'NETS', 'Nets', 'HORNETS', 'Hornets', 'CAVALIERS', 'Cavaliers',
        'MAVERICKS', 'Mavericks', 'NUGGETS', 'Nuggets', 'PISTONS', 'Pistons',
        'ROCKETS', 'Rockets', 'PACERS', 'Pacers', 'CLIPPERS', 'Clippers',
        'GRIZZLIES', 'Grizzlies', 'HEAT', 'Heat', 'BUCKS', 'Bucks',
        'TIMBERWOLVES', 'Timberwolves', 'PELICANS', 'Pelicans', 'KNICKS', 'Knicks',
        'THUNDER', 'Thunder', 'MAGIC', 'Magic', '76ERS', '76ers',
        'SUNS', 'Suns', 'TRAIL BLAZERS', 'Trail Blazers', 'KINGS', 'Kings',
        'SPURS', 'Spurs', 'RAPTORS', 'Raptors', 'JAZZ', 'Jazz', 'WIZARDS', 'Wizards'
    ];
    
    teamNames.forEach(team => {
        const regex = new RegExp(`\\b${team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        fixed = fixed.replace(regex, '');
    });
    
    // 2. Remove grading terms that might be parsed as numbers
    const gradingTerms = [
        'SGC 9.5', 'SGC 10', 'SGC 9', 'SGC 8', 'SGC 7', 'SGC 6', 'SGC 5', 'SGC 4', 'SGC 3', 'SGC 2', 'SGC 1',
        'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6', 'PSA 5', 'PSA 4', 'PSA 3', 'PSA 2', 'PSA 1',
        'BGS 10', 'BGS 9.5', 'BGS 9', 'BGS 8.5', 'BGS 8', 'BGS 7.5', 'BGS 7', 'BGS 6.5', 'BGS 6', 'BGS 5.5', 'BGS 5',
        'GEM MINT', 'Gem Mint', 'MINT', 'Mint', 'MT', 'NM-MT', 'NM', 'EX-MT', 'EX', 'VG-EX', 'VG', 'GOOD', 'Good'
    ];
    
    gradingTerms.forEach(term => {
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        fixed = fixed.replace(regex, '');
    });
    
    // 3. Remove "LOW" (grading/population term)
    fixed = fixed.replace(/\bLOW\b/gi, '');
    
    // 4. Remove "Edition" from product names
    fixed = fixed.replace(/\bEdition\b/gi, '');
    
    // 5. Fix "Ucl" to "UCL"
    fixed = fixed.replace(/\bUcl\b/gi, 'UCL');
    
    // 6. Remove ". Cpanr Prospect" parsing errors
    fixed = fixed.replace(/\.\s*Cpanr\s+Prospect/gi, '');
    
    // 7. Remove other parsing errors and unnecessary terms
    fixed = fixed.replace(/\bSGC\s*\.\s*#\d+\s*#\d+/gi, ''); // Remove "SGC . #9 #5" type patterns
    fixed = fixed.replace(/\b&\s*COWBOYS\b/gi, ''); // Remove "& COWBOYS" patterns
    
    // Clean up extra spaces and formatting
    fixed = fixed.replace(/\s+/g, ' ').trim();
    fixed = fixed.replace(/\s*,\s*$/, ''); // Remove trailing commas
    fixed = fixed.replace(/^\s*,\s*/, ''); // Remove leading commas
    
    return fixed;
}

async function fixSummaryIssuesDirect() {
    console.log('🔧 Fixing summary title issues directly in Railway database...\n');
    
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
                
                // Update the card directly in the database
                await db.runQuery('UPDATE cards SET summary_title = ? WHERE id = ?', [fixedSummary, card.id]);
                fixedCount++;
                console.log(`✅ Updated card ${card.id}`);
            }
        }
        
        console.log('\n🎉 Summary Title Fix Complete!');
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

// Run the fix
fixSummaryIssuesDirect();
