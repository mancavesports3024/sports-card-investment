const https = require('https');

class AutomatedTitleFixer {
    constructor() {
        this.baseUrl = 'web-production-9efa.up.railway.app';
        this.fixesApplied = {
            playerNames: 0,
            summaryTitles: 0,
            totalCards: 0
        };
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
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
                        resolve({
                            status: 'success',
                            data: result,
                            statusCode: res.statusCode
                        });
                    } catch (error) {
                        resolve({
                            status: 'error',
                            code: res.statusCode,
                            message: 'Invalid JSON response',
                            data: responseData
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

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    // Analyze cards and identify issues
    async analyzeCards() {
        console.log('🔍 Analyzing cards for issues...\n');
        
        const response = await this.makeRequest('/api/admin/cards?limit=1000');
        
        if (response.status !== 'success') {
            console.error('❌ Failed to fetch cards:', response);
            return [];
        }
        
        const cards = response.data.cards || [];
        console.log(`📊 Found ${cards.length} cards to analyze\n`);
        
        const issues = {
            playerNameIssues: [],
            summaryTitleIssues: [],
            cardsNeedingFixes: []
        };
        
        cards.forEach((card, index) => {
            const playerName = card.playerName || '';
            const summaryTitle = card.summaryTitle || '';
            const title = card.title || '';
            const cardId = card.id;
            
            let hasPlayerNameIssue = false;
            let hasSummaryTitleIssue = false;
            
            // Check player name issues
            if (!playerName || playerName.trim() === '') {
                issues.playerNameIssues.push({
                    id: cardId,
                    type: 'empty',
                    current: playerName,
                    title: title
                });
                hasPlayerNameIssue = true;
            } else if (playerName === playerName.toUpperCase() && playerName.length > 3) {
                issues.playerNameIssues.push({
                    id: cardId,
                    type: 'all_caps',
                    current: playerName,
                    title: title
                });
                hasPlayerNameIssue = true;
            } else if (playerName.length <= 2) {
                issues.playerNameIssues.push({
                    id: cardId,
                    type: 'too_short',
                    current: playerName,
                    title: title
                });
                hasPlayerNameIssue = true;
            }
            
            // Check summary title issues
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
                             summaryTitle.includes('Bowman') ||
                             summaryTitle.includes('Fleer') ||
                             summaryTitle.includes('Donruss') ||
                             summaryTitle.includes('Score') ||
                             summaryTitle.includes('Finest') ||
                             summaryTitle.includes('Mosaic') ||
                             summaryTitle.includes('Focus') ||
                             summaryTitle.includes('Allen & Ginter') ||
                             summaryTitle.includes('Hoops') ||
                             summaryTitle.includes('Pokemon') ||
                             summaryTitle.includes('O-Pee-Chee');
            
            if (!hasProduct && summaryTitle.length > 10) {
                issues.summaryTitleIssues.push({
                    id: cardId,
                    type: 'missing_product',
                    current: summaryTitle,
                    title: title
                });
                hasSummaryTitleIssue = true;
            }
            
            if (playerName && !summaryTitle.includes(playerName)) {
                issues.summaryTitleIssues.push({
                    id: cardId,
                    type: 'missing_player',
                    current: summaryTitle,
                    playerName: playerName,
                    title: title
                });
                hasSummaryTitleIssue = true;
            }
            
            if (hasPlayerNameIssue || hasSummaryTitleIssue) {
                issues.cardsNeedingFixes.push({
                    id: cardId,
                    playerNameIssue: hasPlayerNameIssue,
                    summaryTitleIssue: hasSummaryTitleIssue,
                    currentPlayerName: playerName,
                    currentSummaryTitle: summaryTitle,
                    originalTitle: title
                });
            }
        });
        
        this.fixesApplied.totalCards = cards.length;
        
        return issues;
    }

    // Fix player name issues
    async fixPlayerNames(issues) {
        console.log('🔧 Fixing player name issues...\n');
        
        let fixedCount = 0;
        
        for (const issue of issues.playerNameIssues) {
            try {
                // Call the specific player name fix endpoint
                const response = await this.makeRequest('/api/admin/fix-specific-player-names', 'POST');
                
                if (response.status === 'success') {
                    fixedCount++;
                    console.log(`✅ Fixed player name for card ${issue.id}`);
                } else {
                    console.log(`❌ Failed to fix player name for card ${issue.id}:`, response.message);
                }
                
                // Add a small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.log(`❌ Error fixing player name for card ${issue.id}:`, error.message);
            }
        }
        
        this.fixesApplied.playerNames = fixedCount;
        console.log(`✅ Fixed ${fixedCount} player name issues\n`);
        
        return fixedCount;
    }

    // Fix summary title issues
    async fixSummaryTitles() {
        console.log('🔧 Fixing summary title issues...\n');
        
        try {
            const response = await this.makeRequest('/api/admin/update-summary-titles', 'POST');
            
            if (response.status === 'success') {
                console.log('✅ Summary titles updated successfully');
                this.fixesApplied.summaryTitles = 1; // Batch update
                return true;
            } else {
                console.log('❌ Failed to update summary titles:', response.message);
                return false;
            }
        } catch (error) {
            console.log('❌ Error updating summary titles:', error.message);
            return false;
        }
    }

    // Run the complete automated fix process
    async runAutomatedFix() {
        console.log('🤖 Starting Automated Title Fixer...\n');
        console.log('🔄 This will analyze and fix player names and summary titles automatically\n');
        
        try {
            // Step 1: Analyze cards
            const issues = await this.analyzeCards();
            
            if (issues.cardsNeedingFixes.length === 0) {
                console.log('✅ No issues found! All cards are clean.\n');
                return {
                    success: true,
                    message: 'No issues found',
                    stats: this.fixesApplied
                };
            }
            
            console.log(`📊 Found ${issues.playerNameIssues.length} player name issues`);
            console.log(`📊 Found ${issues.summaryTitleIssues.length} summary title issues`);
            console.log(`📊 Total cards needing fixes: ${issues.cardsNeedingFixes.length}\n`);
            
            // Step 2: Fix player names
            if (issues.playerNameIssues.length > 0) {
                await this.fixPlayerNames(issues);
            }
            
            // Step 3: Fix summary titles
            if (issues.summaryTitleIssues.length > 0) {
                await this.fixSummaryTitles();
            }
            
            // Step 4: Verify fixes
            console.log('🔍 Verifying fixes...\n');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for updates to process
            
            const verificationIssues = await this.analyzeCards();
            
            console.log('📊 FINAL RESULTS:\n');
            console.log(`- Total cards processed: ${this.fixesApplied.totalCards}`);
            console.log(`- Player name fixes applied: ${this.fixesApplied.playerNames}`);
            console.log(`- Summary title fixes applied: ${this.fixesApplied.summaryTitles}`);
            console.log(`- Remaining issues: ${verificationIssues.cardsNeedingFixes.length}`);
            
            const improvement = this.fixesApplied.totalCards > 0 ? 
                ((issues.cardsNeedingFixes.length - verificationIssues.cardsNeedingFixes.length) / issues.cardsNeedingFixes.length * 100).toFixed(1) : 0;
            
            console.log(`- Improvement: ${improvement}%`);
            
            return {
                success: true,
                message: 'Automated fix completed successfully',
                stats: this.fixesApplied,
                improvement: improvement,
                remainingIssues: verificationIssues.cardsNeedingFixes.length
            };
            
        } catch (error) {
            console.error('❌ Automated fix failed:', error);
            return {
                success: false,
                message: 'Automated fix failed',
                error: error.message
            };
        }
    }

    // Run a quick health check
    async healthCheck() {
        console.log('🏥 Running health check...\n');
        
        try {
            const issues = await this.analyzeCards();
            
            const health = {
                totalCards: this.fixesApplied.totalCards,
                playerNameIssues: issues.playerNameIssues.length,
                summaryTitleIssues: issues.summaryTitleIssues.length,
                totalIssues: issues.cardsNeedingFixes.length,
                healthScore: 0
            };
            
            if (health.totalCards > 0) {
                health.healthScore = ((health.totalCards - health.totalIssues) / health.totalCards * 100).toFixed(1);
            }
            
            console.log('📊 HEALTH CHECK RESULTS:');
            console.log(`- Total cards: ${health.totalCards}`);
            console.log(`- Player name issues: ${health.playerNameIssues}`);
            console.log(`- Summary title issues: ${health.summaryTitleIssues}`);
            console.log(`- Total issues: ${health.totalIssues}`);
            console.log(`- Health score: ${health.healthScore}%`);
            
            if (health.healthScore >= 95) {
                console.log('✅ Database is in excellent health!');
            } else if (health.healthScore >= 90) {
                console.log('⚠️ Database is in good health, minor issues detected');
            } else if (health.healthScore >= 80) {
                console.log('⚠️ Database needs attention, several issues detected');
            } else {
                console.log('❌ Database needs immediate attention, many issues detected');
            }
            
            return health;
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return null;
        }
    }
}

// Export the class
module.exports = AutomatedTitleFixer;

// If run directly, execute the automated fix
if (require.main === module) {
    const fixer = new AutomatedTitleFixer();
    fixer.runAutomatedFix().then(result => {
        console.log('\n🎉 Automated fix process completed!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Automated fix failed:', error);
        process.exit(1);
    });
}
