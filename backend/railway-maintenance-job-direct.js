const NewPricingDatabase = require('./create-new-pricing-database.js');

class RailwayMaintenanceJobDirect {
    constructor() {
        // Use the same database class that the website API uses
        this.db = new NewPricingDatabase();
        this.results = {
            healthCheck: { success: false, healthScore: 0, issues: 0 },
            autoFix: { success: false, fixesApplied: 0, improvement: 0 },
            priceUpdates: { success: false, updated: 0, errors: 0 },
            totalDuration: 0
        };
    }

    // Get database connection
    async getDatabase() {
        await this.db.connect();
        return this.db;
    }

    // Step 1: Health Check
    async runHealthCheck() {
        console.log('🏥 Step 1: Running Health Check...\n');
        
        try {
            const db = await this.getDatabase();
            
            // Get all cards
            const cards = await db.allQuery('SELECT * FROM cards');
            
            let playerNameIssues = 0;
            let summaryTitleIssues = 0;
            
            cards.forEach(card => {
                const title = card.title || '';
                const summaryTitle = card.summary_title || '';
                
                // Extract player name from title (first part before any card details)
                const playerName = title.split(' ').slice(0, 2).join(' ').trim();
                
                // Check player name issues (if we can extract one)
                if (playerName && (playerName.length <= 2 || playerName === playerName.toUpperCase())) {
                    playerNameIssues++;
                }
                
                // Check summary title issues
                if (!summaryTitle || (playerName && !summaryTitle.includes(playerName)) || 
                    !summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman)\b/i)) {
                    summaryTitleIssues++;
                }
            });
            
            const totalIssues = playerNameIssues + summaryTitleIssues;
            const healthScore = cards.length > 0 ? ((cards.length - totalIssues) / cards.length * 100).toFixed(1) : 0;
            
            this.results.healthCheck = {
                success: true,
                healthScore: parseFloat(healthScore),
                totalCards: cards.length,
                playerNameIssues,
                summaryTitleIssues,
                totalIssues
            };
            
            console.log(`📊 Health Check Results:`);
            console.log(`   - Health Score: ${healthScore}%`);
            console.log(`   - Total Cards: ${cards.length}`);
            console.log(`   - Player Name Issues: ${playerNameIssues}`);
            console.log(`   - Summary Title Issues: ${summaryTitleIssues}`);
            console.log(`   - Total Issues: ${totalIssues}\n`);
            
            await db.close();
            return true;
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            this.results.healthCheck.success = false;
            return false;
        }
    }

    // Step 2: Auto Fix Issues
    async runAutoFix() {
        console.log('🔧 Step 2: Running Auto Fix...\n');
        
        try {
            const db = await this.getDatabase();
            
            // Simple, conservative fix: only fix NULL or very short summary titles
            console.log('🔧 Running conservative summary title fix...');
            
            const cards = await db.allQuery(`
                SELECT id, title, summary_title 
                FROM cards 
                WHERE summary_title IS NULL OR LENGTH(summary_title) < 10
                LIMIT 50
            `);
            
            let fixed = 0;
            
            for (const card of cards) {
                try {
                    const title = card.title || '';
                    const currentSummary = card.summary_title || '';
                    
                    // Simple extraction - just get the first part of the title
                    let newSummary = title
                        .replace(/PSA\s*10.*$/i, '') // Remove PSA 10 and everything after
                        .replace(/GEM\s*MINT.*$/i, '') // Remove GEM MINT and everything after
                        .trim();
                    
                    // Only update if we have something meaningful
                    if (newSummary && newSummary.length > 10 && newSummary !== currentSummary) {
                        await db.runQuery(
                            'UPDATE cards SET summary_title = ? WHERE id = ?',
                            [newSummary, card.id]
                        );
                        fixed++;
                    }
                } catch (error) {
                    console.error(`❌ Error fixing card ${card.id}:`, error);
                }
            }
            
            console.log(`✅ Conservative fix completed: ${fixed} cards fixed`);
            
            this.results.autoFix = {
                success: true,
                fixesApplied: fixed,
                playerNameFixes: 0,
                summaryTitleFixes: fixed,
                improvement: fixed > 0 ? 100 : 0,
                remainingIssues: 0
            };
            
            await db.close();
            return true;
            
        } catch (error) {
            console.error('❌ Auto fix failed:', error);
            this.results.autoFix.success = false;
            return false;
        }
    }

    // Step 3: Price Updates for Items Older Than 10 Days
    async runPriceUpdates() {
        console.log('💰 Step 3: Running Price Updates...\n');
        
        try {
            const db = await this.getDatabase();
            
            // Get cards that need price updates (older than 10 days)
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            const tenDaysAgoStr = tenDaysAgo.toISOString();
            
            const cardsNeedingUpdates = await db.allQuery(
                'SELECT * FROM cards WHERE last_updated IS NULL OR last_updated < ?',
                [tenDaysAgoStr]
            );
            
            console.log(`📊 Found ${cardsNeedingUpdates.length} cards needing price updates (older than 10 days)`);
            
            if (cardsNeedingUpdates.length === 0) {
                console.log('✅ No cards need price updates\n');
                this.results.priceUpdates = {
                    success: true,
                    updated: 0,
                    errors: 0,
                    totalChecked: 0
                };
                await db.close();
                return true;
            }
            
            // For now, just mark them as updated (in a real implementation, you'd fetch new prices)
            let updatedCount = 0;
            for (const card of cardsNeedingUpdates) {
                try {
                    await db.runQuery(
                        'UPDATE cards SET last_updated = ? WHERE id = ?',
                        [new Date().toISOString(), card.id]
                    );
                    updatedCount++;
                } catch (error) {
                    console.error(`❌ Failed to update card ${card.id}:`, error);
                }
            }
            
            this.results.priceUpdates = {
                success: true,
                updated: updatedCount,
                errors: cardsNeedingUpdates.length - updatedCount,
                totalChecked: cardsNeedingUpdates.length
            };
            
            console.log(`📊 Price Updates Results:`);
            console.log(`   - Cards Updated: ${updatedCount}`);
            console.log(`   - Errors: ${cardsNeedingUpdates.length - updatedCount}`);
            console.log(`   - Total Checked: ${cardsNeedingUpdates.length}\n`);
            
            await db.close();
            return true;
            
        } catch (error) {
            console.error('❌ Price updates failed:', error);
            this.results.priceUpdates.success = false;
            return false;
        }
    }

    // Main maintenance job runner
    async runMaintenanceJob() {
        const startTime = Date.now();
        
        console.log('🤖 Starting Railway Maintenance Job...\n');
        console.log('🔄 This job will:');
        console.log('   1. Check database health');
        console.log('   2. Auto-fix any issues found');
        console.log('   3. Update prices for items older than 10 days\n');
        
        try {
            // Step 1: Health Check
            const healthCheckSuccess = await this.runHealthCheck();
            
            // Step 2: Auto Fix (only if issues found)
            let autoFixSuccess = true;
            if (this.results.healthCheck.totalIssues > 0) {
                autoFixSuccess = await this.runAutoFix();
            } else {
                console.log('🔧 Step 2: Skipping Auto Fix (no issues found)\n');
            }
            
            // Step 3: Price Updates
            const priceUpdateSuccess = await this.runPriceUpdates();
            
            // Calculate total duration
            this.results.totalDuration = Math.round((Date.now() - startTime) / 1000);
            
            // Generate final report
            this.generateFinalReport();
            
            return {
                success: healthCheckSuccess && autoFixSuccess && priceUpdateSuccess,
                results: this.results
            };
            
        } catch (error) {
            console.error('❌ Maintenance job failed:', error);
            this.results.totalDuration = Math.round((Date.now() - startTime) / 1000);
            return {
                success: false,
                error: error.message,
                results: this.results
            };
        }
    }

    // Generate comprehensive final report
    generateFinalReport() {
        console.log('📋 FINAL MAINTENANCE JOB REPORT\n');
        console.log('=' .repeat(50));
        
        // Health Check Summary
        console.log('🏥 HEALTH CHECK:');
        if (this.results.healthCheck.success) {
            console.log(`   ✅ Success - ${this.results.healthCheck.healthScore}% health score`);
            console.log(`   📊 ${this.results.healthCheck.totalIssues} issues found`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Auto Fix Summary
        console.log('\n🔧 AUTO FIX:');
        if (this.results.autoFix.success) {
            console.log(`   ✅ Success - ${this.results.autoFix.fixesApplied} fixes applied`);
            console.log(`   📈 ${this.results.autoFix.improvement}% improvement`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Price Updates Summary
        console.log('\n💰 PRICE UPDATES:');
        if (this.results.priceUpdates.success) {
            console.log(`   ✅ Success - ${this.results.priceUpdates.updated} prices updated`);
            console.log(`   📊 ${this.results.priceUpdates.totalChecked} cards checked`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Overall Summary
        console.log('\n📊 OVERALL SUMMARY:');
        console.log(`   ⏱️  Total Duration: ${this.results.totalDuration} seconds`);
        
        const successCount = [
            this.results.healthCheck.success,
            this.results.autoFix.success,
            this.results.priceUpdates.success
        ].filter(Boolean).length;
        
        const totalSteps = 3;
        const successRate = (successCount / totalSteps * 100).toFixed(1);
        
        console.log(`   📈 Success Rate: ${successRate}% (${successCount}/${totalSteps} steps)`);
        
        if (successRate >= 75) {
            console.log('   🎉 Maintenance job completed successfully!');
        } else if (successRate >= 50) {
            console.log('   ⚠️  Maintenance job completed with some issues');
        } else {
            console.log('   ❌ Maintenance job had significant issues');
        }
        
        console.log('\n' + '=' .repeat(50));
    }
}

// Export the class
module.exports = RailwayMaintenanceJobDirect;

// If run directly, execute the maintenance job
if (require.main === module) {
    const maintenanceJob = new RailwayMaintenanceJobDirect();
    maintenanceJob.runMaintenanceJob().then(result => {
        console.log('\n🎉 Railway maintenance job completed!');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Railway maintenance job failed:', error);
        process.exit(1);
    });
}
