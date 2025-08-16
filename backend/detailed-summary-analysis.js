const https = require('https');

async function makeRequest(endpoint, method = 'GET') {
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
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({
                        status: 'success',
                        data: result
                    });
                } catch (error) {
                    resolve({
                        status: 'error',
                        code: res.statusCode,
                        message: 'Invalid JSON response',
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                status: 'error',
                code: 500,
                message: error.message
            });
        });

        req.setTimeout(30000, () => {
            req.destroy();
            resolve({
                status: 'error',
                code: 408,
                message: 'Request timeout'
            });
        });

        req.end();
    });
}

async function detailedSummaryAnalysis() {
    console.log('🔍 Detailed Summary Title Analysis...\n');
    
    try {
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return;
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards to analyze\n`);
        
        // Get all cards with issues
        const problematicCards = [];
        
        cards.forEach((card, index) => {
            const summaryTitle = card.summaryTitle || '';
            const playerName = card.playerName || '';
            const title = card.title || '';
            const cardId = card.id;
            
            // Check for various issues
            let issues = [];
            
            // Missing product names
            const hasProduct = summaryTitle.includes('Topps') || 
                             summaryTitle.includes('Panini') || 
                             summaryTitle.includes('Upper Deck') ||
                             summaryTitle.includes('Chronicles') ||
                             summaryTitle.includes('Prizm') ||
                             summaryTitle.includes('Chrome') ||
                             summaryTitle.includes('Stadium Club') ||
                             summaryTitle.includes('Gallery') ||
                             summaryTitle.includes('Flawless') ||
                             summaryTitle.includes('National Treasures') ||
                             summaryTitle.includes('Contenders') ||
                             summaryTitle.includes('Absolute') ||
                             summaryTitle.includes('Phoenix') ||
                             summaryTitle.includes('Spectra') ||
                             summaryTitle.includes('USA Basketball') ||
                             summaryTitle.includes('Skybox') ||
                             summaryTitle.includes('Metal') ||
                             summaryTitle.includes('Certified') ||
                             summaryTitle.includes('E-X2001') ||
                             summaryTitle.includes('Road To UEFA') ||
                             summaryTitle.includes('Monopoly') ||
                             summaryTitle.includes('One and One') ||
                             summaryTitle.includes('Downtown') ||
                             summaryTitle.includes('Helmet Heroes') ||
                             summaryTitle.includes('Color Blast') ||
                             summaryTitle.includes('Emergent') ||
                             summaryTitle.includes('Reactive') ||
                             summaryTitle.includes('Wave') ||
                             summaryTitle.includes('Shimmer') ||
                             summaryTitle.includes('Disco') ||
                             summaryTitle.includes('Optic') ||
                             summaryTitle.includes('Select') ||
                             summaryTitle.includes('Refractor') ||
                             summaryTitle.includes('X-Fractor') ||
                             summaryTitle.includes('Green Refractor') ||
                             summaryTitle.includes('Pink Refractor') ||
                             summaryTitle.includes('Blue Refractor') ||
                             summaryTitle.includes('Silver') ||
                             summaryTitle.includes('Gold') ||
                             summaryTitle.includes('Black') ||
                             summaryTitle.includes('Purple') ||
                             summaryTitle.includes('Orange') ||
                             summaryTitle.includes('Red') ||
                             summaryTitle.includes('Blue') ||
                             summaryTitle.includes('Green') ||
                             summaryTitle.includes('Prizm Black') ||
                             summaryTitle.includes('Prizm Silver') ||
                             summaryTitle.includes('Prizm Gold') ||
                             summaryTitle.includes('Prizm Orange') ||
                             summaryTitle.includes('Prizm Purple') ||
                             summaryTitle.includes('Prizm Green') ||
                             summaryTitle.includes('Prizm Blue') ||
                             summaryTitle.includes('Prizm Red') ||
                             summaryTitle.includes('Bowman') ||
                             summaryTitle.includes('Fleer') ||
                             summaryTitle.includes('Donruss') ||
                             summaryTitle.includes('Score') ||
                             summaryTitle.includes('Finest') ||
                             summaryTitle.includes('Mosaic') ||
                             summaryTitle.includes('Focus') ||
                             summaryTitle.includes('Allen & Ginter');
            
            if (!hasProduct && summaryTitle.length > 10) {
                issues.push('Missing Product Name');
            }
            
            // Missing player name
            if (playerName && !summaryTitle.includes(playerName)) {
                issues.push('Missing Player Name');
            }
            
            // Check for formatting issues
            if (summaryTitle.includes('  ') || summaryTitle.startsWith(' ') || summaryTitle.endsWith(' ')) {
                issues.push('Extra Spaces');
            }
            
            if (summaryTitle.endsWith(',') || summaryTitle.includes(',,')) {
                issues.push('Trailing Commas');
            }
            
            if (summaryTitle === summaryTitle.toUpperCase() && summaryTitle.length > 10) {
                issues.push('ALL CAPS');
            }
            
            // Check for suspicious patterns
            if (summaryTitle.includes('undefined') || 
                summaryTitle.includes('null') || 
                summaryTitle.includes('NaN') ||
                summaryTitle.includes('|') ||
                summaryTitle.includes('\\n') ||
                summaryTitle.includes('\\t')) {
                issues.push('Suspicious Patterns');
            }
            
            // Check for too short or too long
            if (summaryTitle.length < 15) {
                issues.push('Too Short');
            }
            
            if (summaryTitle.length > 150) {
                issues.push('Too Long');
            }
            
            if (issues.length > 0) {
                problematicCards.push({
                    cardNumber: index + 1,
                    id: cardId,
                    summaryTitle: summaryTitle,
                    playerName: playerName,
                    originalTitle: title,
                    issues: issues
                });
            }
        });
        
        // Display detailed results
        console.log('📋 DETAILED SUMMARY TITLE ISSUES:\n');
        
        if (problematicCards.length === 0) {
            console.log('✅ All summary titles look good!');
            return;
        }
        
        // Group by issue type
        const issueGroups = {};
        problematicCards.forEach(card => {
            card.issues.forEach(issue => {
                if (!issueGroups[issue]) {
                    issueGroups[issue] = [];
                }
                issueGroups[issue].push(card);
            });
        });
        
        Object.keys(issueGroups).forEach(issueType => {
            const cardsWithIssue = issueGroups[issueType];
            console.log(`⚠️  ${issueType.toUpperCase()} (${cardsWithIssue.length} cards):`);
            
            cardsWithIssue.slice(0, 15).forEach(card => {
                console.log(`   ${card.cardNumber}. ID: ${card.id}`);
                console.log(`      Player: "${card.playerName}"`);
                console.log(`      Current Summary: "${card.summaryTitle}"`);
                console.log(`      Original Title: "${card.originalTitle}"`);
                console.log('');
            });
            
            if (cardsWithIssue.length > 15) {
                console.log(`   ... and ${cardsWithIssue.length - 15} more`);
            }
            console.log('');
        });
        
        // Show some examples of what the fixes should look like
        console.log('🔧 SUGGESTED FIXES EXAMPLES:\n');
        
        const fixExamples = problematicCards.slice(0, 10);
        fixExamples.forEach((card, index) => {
            console.log(`${index + 1}. Card ID: ${card.id}`);
            console.log(`   Player: "${card.playerName}"`);
            console.log(`   Current: "${card.summaryTitle}"`);
            
            // Suggest a better format based on the original title
            let suggested = card.summaryTitle;
            
            // Try to extract year, product, player, card type, number from original
            const yearMatch = card.originalTitle.match(/(\d{4})/);
            const year = yearMatch ? yearMatch[1] : '';
            
            // Extract product names from original
            const productMatch = card.originalTitle.match(/(Topps|Panini|Upper Deck|Chronicles|Prizm|Chrome|Stadium Club|Gallery|Flawless|National Treasures|Contenders|Absolute|Phoenix|Spectra|USA Basketball|Skybox|Metal|Certified|E-X2001|Bowman|Fleer|Donruss|Score|Finest|Mosaic|Focus|Allen & Ginter)/i);
            const product = productMatch ? productMatch[1] : '';
            
            // Extract card type
            const typeMatch = card.originalTitle.match(/(Refractor|X-Fractor|Silver|Gold|Black|Purple|Orange|Red|Blue|Green|Prizm|Chrome|Auto|Autograph|Rookie|RC|Prospect|Wave|Shimmer|Disco|Optic|Select|Color Blast|Emergent|Reactive|Downtown|Helmet Heroes)/i);
            const cardType = typeMatch ? typeMatch[1] : '';
            
            // Extract card number
            const numberMatch = card.originalTitle.match(/#(\d+)/);
            const cardNumber = numberMatch ? numberMatch[1] : '';
            
            // Build suggested format
            if (year && product && card.playerName) {
                suggested = `${year} ${product}`;
                if (cardType) suggested += ` ${cardType}`;
                suggested += ` ${card.playerName}`;
                if (cardNumber) suggested += ` #${cardNumber}`;
            }
            
            console.log(`   Suggested: "${suggested}"`);
            console.log(`   Issues: ${card.issues.join(', ')}`);
            console.log('');
        });
        
        // Show summary statistics
        console.log('📊 SUMMARY STATISTICS:');
        console.log(`- Total cards analyzed: ${cards.length}`);
        console.log(`- Cards with issues: ${problematicCards.length}`);
        console.log(`- Percentage with issues: ${((problematicCards.length / cards.length) * 100).toFixed(1)}%`);
        
        Object.keys(issueGroups).forEach(issueType => {
            console.log(`- ${issueType}: ${issueGroups[issueType].length} cards`);
        });
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    }
}

// Run the analysis
detailedSummaryAnalysis();
