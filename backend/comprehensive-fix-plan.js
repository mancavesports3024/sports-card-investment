const https = require('https');

async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'web-production-9efa.up.railway.app',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve(response);
                } catch (error) {
                    resolve(body);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function analyzeAndPlanFixes() {
    console.log('🔍 ANALYZING: All Issues for Comprehensive Fix Plan\n');

    try {
        const response = await makeRequest('/api/admin/cards?limit=1000');
        
        if (response.success && response.cards) {
            const cards = response.cards;
            console.log(`📊 Analyzing ${cards.length} cards to plan fixes...\n`);

            // 1. Analyze period issues
            const periodIssues = cards.filter(card => {
                const playerName = card.playerName || '';
                return playerName.includes('.') && playerName.length > 3;
            });

            console.log(`1️⃣  PERIOD ISSUES (${periodIssues.length} cards):`);
            const periodPatterns = new Map();
            periodIssues.forEach(card => {
                const playerName = card.playerName || '';
                const count = periodPatterns.get(playerName) || 0;
                periodPatterns.set(playerName, count + 1);
            });
            
            // Sort by frequency
            const sortedPeriodIssues = Array.from(periodPatterns.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15);
            
            sortedPeriodIssues.forEach(([playerName, count], index) => {
                console.log(`   ${index + 1}. "${playerName}" (${count} cards)`);
            });
            console.log('');

            // 2. Analyze single word issues
            const singleWordIssues = cards.filter(card => {
                const playerName = card.playerName || '';
                const wordCount = playerName.trim().split(/\s+/).length;
                return wordCount === 1 && playerName.length > 3;
            });

            console.log(`2️⃣  SINGLE WORD ISSUES (${singleWordIssues.length} cards):`);
            const singleWordPatterns = new Map();
            singleWordIssues.forEach(card => {
                const playerName = card.playerName || '';
                const count = singleWordPatterns.get(playerName) || 0;
                singleWordPatterns.set(playerName, count + 1);
            });
            
            // Sort by frequency
            const sortedSingleWordIssues = Array.from(singleWordPatterns.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15);
            
            sortedSingleWordIssues.forEach(([playerName, count], index) => {
                console.log(`   ${index + 1}. "${playerName}" (${count} cards)`);
            });
            console.log('');

            // 3. Plan fixes
            console.log('🔧 COMPREHENSIVE FIX PLAN:');
            console.log('');
            
            console.log('📝 1. INITIALS CLEANUP (Simple approach):');
            console.log('   - Add regex patterns to clean up periods in initials');
            console.log('   - Target: "Cj.s.troud" → "CJ Stroud"');
            console.log('   - Target: "Cj.k.ayfus" → "CJ Kayfus"');
            console.log('   - Target: "Cc.l.amine" → "CC Lamine"');
            console.log('   - Target: "Dp.j.axon" → "DP Jaxon"');
            console.log('   - Target: "El.j.asson" → "EL Jasson"');
            console.log('   - Target: "Jr.t.ie" → "JR Tie"');
            console.log('   - Target: "Ud.h.ubert" → "UD Hubert"');
            console.log('   - Target: "Ii.b.ig" → "II Big"');
            console.log('');

            console.log('📝 2. KNOWN PLAYERS MAPPINGS:');
            console.log('   - Add mappings for single word names to full names');
            console.log('   - "Daniels" → "Jayden Daniels"');
            console.log('   - "Bowers" → "Brock Bowers"');
            console.log('   - "Worthy" → "Xavier Worthy"');
            console.log('   - "Ohtani" → "Shohei Ohtani"');
            console.log('   - "Bryan" → "Bryan Woo"');
            console.log('   - "CJ Stroud" → "CJ Stroud" (after cleanup)');
            console.log('   - "CJ Kayfus" → "CJ Kayfus" (after cleanup)');
            console.log('   - "CC Lamine" → "CC Lamine" (after cleanup)');
            console.log('   - "DP Jaxon" → "DP Jaxon" (after cleanup)');
            console.log('   - "EL Jasson" → "EL Jasson" (after cleanup)');
            console.log('   - "JR Tie" → "JR Tie" (after cleanup)');
            console.log('   - "UD Hubert" → "Hubert Davis"');
            console.log('   - "II Big" → "Patrick Mahomes II"');
            console.log('');

            console.log('📝 3. IMPLEMENTATION ORDER:');
            console.log('   1. Add initials cleanup regex patterns');
            console.log('   2. Add comprehensive knownPlayers mappings');
            console.log('   3. Test locally to ensure no syntax errors');
            console.log('   4. Push to production only after all fixes are complete');
            console.log('');

            console.log('🎯 EXPECTED RESULTS:');
            console.log(`   - Current issues: ${periodIssues.length + singleWordIssues.length}`);
            console.log('   - Target: Reduce to < 20 issues');
            console.log('   - Focus on high-frequency patterns first');

        } else {
            console.log('❌ Failed to get cards from Railway API');
        }

    } catch (error) {
        console.error('❌ Error analyzing Railway database:', error);
    }
}

analyzeAndPlanFixes();
