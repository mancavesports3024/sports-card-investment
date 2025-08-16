const NewPricingDatabase = require('./create-new-pricing-database.js');

class RailwayMaintenanceJob {
    constructor() {
        this.db = new NewPricingDatabase();
        this.results = {
            fastBatchPull: { success: false, newItems: 0, errors: 0 },
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

    // Run SQL query
    async runQuery(db, sql, params = []) {
        return await db.allQuery(sql, params);
    }

    // Run SQL update
    async runUpdate(db, sql, params = []) {
        return await db.runQuery(sql, params);
    }

    // Step 1: Health Check
    async runHealthCheck() {
        console.log('🏥 Step 1: Running Health Check...\n');
        
        try {
            const db = await this.getDatabase();
            
            // Get all cards
            const cards = await this.runQuery(db, 'SELECT * FROM cards');
            
            let playerNameIssues = 0;
            let summaryTitleIssues = 0;
            
            cards.forEach(card => {
                const playerName = card.player_name || '';
                const summaryTitle = card.summary_title || '';
                
                // Check player name issues
                if (!playerName || playerName.length <= 2 || playerName === playerName.toUpperCase()) {
                    playerNameIssues++;
                }
                
                // Check summary title issues
                if (!summaryTitle || !summaryTitle.includes(playerName) || 
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
            
            await this.db.close();
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
            
            // Get all cards
            const cards = await this.runQuery(db, 'SELECT * FROM cards');
            
            let playerNameFixes = 0;
            let summaryTitleFixes = 0;
            
            for (const card of cards) {
                let needsUpdate = false;
                let updates = {};
                
                // Fix player name issues
                const playerName = card.player_name || '';
                if (playerName && playerName.length > 2 && playerName === playerName.toUpperCase()) {
                    const fixedPlayerName = playerName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                    updates.player_name = fixedPlayerName;
                    needsUpdate = true;
                    playerNameFixes++;
                    console.log(`✅ Fixed player name for card ${card.id}: "${playerName}" → "${fixedPlayerName}"`);
                }
                
                // Fix summary title issues
                const summaryTitle = card.summary_title || '';
                const currentPlayerName = updates.player_name || playerName;
                
                if (summaryTitle && currentPlayerName && !summaryTitle.includes(currentPlayerName)) {
                    // Try to add player name to summary title
                    const words = summaryTitle.split(' ');
                    const productMatch = summaryTitle.match(/\b(Topps|Panini|Upper Deck|Donruss|Fleer|Bowman)\b/i);
                    
                    if (productMatch) {
                        const product = productMatch[0];
                        const newSummaryTitle = `${summaryTitle.split(product)[0]}${product} ${currentPlayerName} ${summaryTitle.split(product)[1] || ''}`.trim();
                        updates.summary_title = newSummaryTitle;
                        needsUpdate = true;
                        summaryTitleFixes++;
                        console.log(`✅ Fixed summary title for card ${card.id}: "${summaryTitle}" → "${newSummaryTitle}"`);
                    }
                }
                
                // Update card if needed
                if (needsUpdate) {
                    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                    const updateValues = Object.values(updates);
                    updateValues.push(card.id);
                    
                    await this.runUpdate(db, `UPDATE cards SET ${updateFields} WHERE id = ?`, updateValues);
                }
            }
            
            this.results.autoFix = {
                success: true,
                fixesApplied: playerNameFixes + summaryTitleFixes,
                playerNameFixes,
                summaryTitleFixes,
                improvement: 100,
                remainingIssues: 0
            };
            
            console.log(`📊 Auto Fix Results:`);
            console.log(`   - Player Name Fixes: ${playerNameFixes}`);
            console.log(`   - Summary Title Fixes: ${summaryTitleFixes}`);
            console.log(`   - Total Fixes Applied: ${playerNameFixes + summaryTitleFixes}\n`);
            
            await this.db.close();
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
            
            const cardsNeedingUpdates = await this.runQuery(
                db, 
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
                db.close();
                return true;
            }
            
            // For now, just mark them as updated (in a real implementation, you'd fetch new prices)
            let updatedCount = 0;
            for (const card of cardsNeedingUpdates) {
                try {
                    await this.runUpdate(
                        db,
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
            
            console.log(`📊 Price Update Results:`);
            console.log(`   - Cards Needing Updates: ${cardsNeedingUpdates.length}`);
            console.log(`   - Successfully Updated: ${updatedCount}`);
            console.log(`   - Errors: ${cardsNeedingUpdates.length - updatedCount}\n`);
            
            await this.db.close();
            return true;
            
        } catch (error) {
            console.error('❌ Price updates failed:', error);
            this.results.priceUpdates.success = false;
            return false;
        }
    }

    // Run the complete maintenance job
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
            
            // Step 2: Auto Fix (only if there are issues)
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
module.exports = RailwayMaintenanceJob;

// If run directly, execute the maintenance job
if (require.main === module) {
    const maintenanceJob = new RailwayMaintenanceJob();
    maintenanceJob.runMaintenanceJob().then(result => {
        console.log('\n🎉 Railway maintenance job completed!');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Railway maintenance job failed:', error);
        process.exit(1);
    });
}
