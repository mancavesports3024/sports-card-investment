const https = require('https');

async function makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve({ status: 'success', data: result, statusCode: res.statusCode });
                } catch (error) {
                    resolve({ status: 'error', code: res.statusCode, message: 'Invalid JSON response', data: responseData });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ status: 'error', code: 500, message: error.message });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({ status: 'error', code: 408, message: 'Request timeout' });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

function fixSummaryTitle(summaryTitle) {
    if (!summaryTitle) return summaryTitle;
    
    let fixed = summaryTitle;
    
    // 1. Remove team names
    const teamNames = [
        'Florida Gators', 'Gators', 'COWBOYS', 'Cowboys', 'VIKINGS', 'Vikings',
        'BULLS', 'Bulls', 'LAKERS', 'Lakers', 'WARRIORS', 'Warriors',
        'PATRIOTS', 'Patriots', 'BENGALS', 'Bengals', 'RAIDERS', 'Raiders',
        'CHARGERS', 'Chargers', 'COWBOYS', 'Cowboys', 'GIANTS', 'Giants',
        'EAGLES', 'Eagles', 'COMMANDERS', 'Commanders', 'BEARS', 'Bears',
        'LIONS', 'Lions', 'PACKERS', 'Packers', 'VIKINGS', 'Vikings',
        'FALCONS', 'Falcons', 'PANTHERS', 'Panthers', 'SAINTS', 'Saints',
        'BUCCANEERS', 'Buccaneers', 'CARDINALS', 'Cardinals', 'RAMS', 'Rams',
        '49ERS', '49ers', 'SEAHAWKS', 'Seahawks', 'YANKEES', 'Yankees',
        'RED SOX', 'Red Sox', 'BLUE JAYS', 'Blue Jays', 'ORIOLES', 'Orioles',
        'RAYS', 'Rays', 'WHITE SOX', 'White Sox', 'GUARDIANS', 'Guardians',
        'TIGERS', 'Tigers', 'ROYALS', 'Royals', 'TWINS', 'Twins',
        'ASTROS', 'Astros', 'ANGELS', 'Angels', 'ATHLETICS', 'Athletics',
        'MARINERS', 'Mariners', 'RANGERS', 'Rangers', 'BRAVES', 'Braves',
        'MARLINS', 'Marlins', 'METS', 'Mets', 'PHILLIES', 'Phillies',
        'NATIONALS', 'Nationals', 'CUBS', 'Cubs', 'REDS', 'Reds',
        'BREWERS', 'Brewers', 'PIRATES', 'Pirates', 'CARDINALS', 'Cardinals',
        'DIAMONDBACKS', 'Diamondbacks', 'ROCKIES', 'Rockies', 'DODGERS', 'Dodgers',
        'PADRES', 'Padres', 'GIANTS', 'Giants', 'HAWKS', 'Hawks',
        'CELTICS', 'Celtics', 'NETS', 'Nets', 'HORNETS', 'Hornets',
        'BULLS', 'Bulls', 'CAVALIERS', 'Cavaliers', 'MAVERICKS', 'Mavericks',
        'NUGGETS', 'Nuggets', 'PISTONS', 'Pistons', 'WARRIORS', 'Warriors',
        'ROCKETS', 'Rockets', 'PACERS', 'Pacers', 'CLIPPERS', 'Clippers',
        'LAKERS', 'Lakers', 'GRIZZLIES', 'Grizzlies', 'HEAT', 'Heat',
        'BUCKS', 'Bucks', 'TIMBERWOLVES', 'Timberwolves', 'PELICANS', 'Pelicans',
        'KNICKS', 'Knicks', 'THUNDER', 'Thunder', 'MAGIC', 'Magic',
        '76ERS', '76ers', 'SUNS', 'Suns', 'TRAIL BLAZERS', 'Trail Blazers',
        'KINGS', 'Kings', 'SPURS', 'Spurs', 'RAPTORS', 'Raptors',
        'JAZZ', 'Jazz', 'WIZARDS', 'Wizards'
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

async function fixSpecificSummaryIssues() {
    console.log('🔧 Fixing specific summary title issues...\n');
    
    try {
        // Get all cards
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards to check\n`);
        
        let fixedCount = 0;
        let issuesFound = 0;
        
        for (const card of cards) {
            const originalSummary = card.summaryTitle || '';
            const fixedSummary = fixSummaryTitle(originalSummary);
            
            if (fixedSummary !== originalSummary && fixedSummary.length > 0) {
                issuesFound++;
                console.log(`🔍 Card ID: ${card.id}`);
                console.log(`   Player: "${card.playerName}"`);
                console.log(`   Original: "${originalSummary}"`);
                console.log(`   Fixed: "${fixedSummary}"`);
                console.log('');
                
                // Update the card via API
                const updateResponse = await makeRequest('/api/admin/update-summary-title', 'POST', {
                    cardId: card.id,
                    summaryTitle: fixedSummary
                });
                
                if (updateResponse.status === 'success') {
                    fixedCount++;
                    console.log(`✅ Updated card ${card.id}`);
                } else {
                    console.log(`❌ Failed to update card ${card.id}:`, updateResponse);
                }
            }
        }
        
        console.log('\n🎉 Summary Title Fix Complete!');
        console.log(`📊 Total cards checked: ${cards.length}`);
        console.log(`🔍 Issues found: ${issuesFound}`);
        console.log(`✅ Cards fixed: ${fixedCount}`);
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

// Run the fix
fixSpecificSummaryIssues();
