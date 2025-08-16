const https = require('https');

class AutomatedMaintenanceJob {
    constructor() {
        this.baseUrl = 'web-production-9efa.up.railway.app';
        this.jobResults = {
            fastBatchPull: { success: false, newItems: 0, errors: 0 },
            healthCheck: { success: false, healthScore: 0, issues: 0 },
            autoFix: { success: false, fixesApplied: 0, improvement: 0 },
            priceUpdates: { success: false, updated: 0, errors: 0 },
            totalDuration: 0
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

            req.setTimeout(300000, () => { // 5 minute timeout for long operations
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

    // Step 1: Fast Batch Pull
    async runFastBatchPull() {
        console.log('🚀 Step 1: Running Fast Batch Pull...\n');
        
        try {
            const response = await this.makeRequest('/api/admin/run-fast-batch-pull', 'POST');
            
            if (response.status === 'success') {
                console.log('✅ Fast batch pull completed successfully');
                const results = response.data.results || {};
                
                this.jobResults.fastBatchPull = {
                    success: true,
                    newItems: results.newItems || 0,
                    errors: results.errors || 0,
                    searches: results.searches || 0
                };
                
                console.log(`📊 Fast Batch Pull Results:`);
                console.log(`   - New items found: ${this.jobResults.fastBatchPull.newItems}`);
                console.log(`   - Searches performed: ${this.jobResults.fastBatchPull.searches}`);
                console.log(`   - Errors: ${this.jobResults.fastBatchPull.errors}\n`);
                
                return true;
            } else {
                console.log('❌ Fast batch pull failed:', response.message);
                this.jobResults.fastBatchPull.success = false;
                return false;
            }
        } catch (error) {
            console.log('❌ Fast batch pull error:', error.message);
            this.jobResults.fastBatchPull.success = false;
            return false;
        }
    }

    // Step 2: Health Check
    async runHealthCheck() {
        console.log('🏥 Step 2: Running Health Check...\n');
        
        try {
            const response = await this.makeRequest('/api/admin/health-check', 'POST');
            
            if (response.status === 'success') {
                console.log('✅ Health check completed successfully');
                const health = response.data.health || {};
                
                this.jobResults.healthCheck = {
                    success: true,
                    healthScore: parseFloat(health.healthScore) || 0,
                    totalCards: health.totalCards || 0,
                    playerNameIssues: health.playerNameIssues || 0,
                    summaryTitleIssues: health.summaryTitleIssues || 0,
                    totalIssues: health.totalIssues || 0
                };
                
                console.log(`📊 Health Check Results:`);
                console.log(`   - Health Score: ${this.jobResults.healthCheck.healthScore}%`);
                console.log(`   - Total Cards: ${this.jobResults.healthCheck.totalCards}`);
                console.log(`   - Player Name Issues: ${this.jobResults.healthCheck.playerNameIssues}`);
                console.log(`   - Summary Title Issues: ${this.jobResults.healthCheck.summaryTitleIssues}`);
                console.log(`   - Total Issues: ${this.jobResults.healthCheck.totalIssues}\n`);
                
                return true;
            } else {
                console.log('❌ Health check failed:', response.message);
                this.jobResults.healthCheck.success = false;
                return false;
            }
        } catch (error) {
            console.log('❌ Health check error:', error.message);
            this.jobResults.healthCheck.success = false;
            return false;
        }
    }

    // Step 3: Auto Fix Issues
    async runAutoFix() {
        console.log('🔧 Step 3: Running Auto Fix...\n');
        
        try {
            const response = await this.makeRequest('/api/admin/run-automated-fix', 'POST');
            
            if (response.status === 'success') {
                console.log('✅ Auto fix completed successfully');
                const results = response.data.results || {};
                
                this.jobResults.autoFix = {
                    success: true,
                    fixesApplied: results.stats?.playerNames + results.stats?.summaryTitles || 0,
                    improvement: parseFloat(results.improvement) || 0,
                    remainingIssues: results.remainingIssues || 0,
                    playerNameFixes: results.stats?.playerNames || 0,
                    summaryTitleFixes: results.stats?.summaryTitles || 0
                };
                
                console.log(`📊 Auto Fix Results:`);
                console.log(`   - Fixes Applied: ${this.jobResults.autoFix.fixesApplied}`);
                console.log(`   - Player Name Fixes: ${this.jobResults.autoFix.playerNameFixes}`);
                console.log(`   - Summary Title Fixes: ${this.jobResults.autoFix.summaryTitleFixes}`);
                console.log(`   - Improvement: ${this.jobResults.autoFix.improvement}%`);
                console.log(`   - Remaining Issues: ${this.jobResults.autoFix.remainingIssues}\n`);
                
                return true;
            } else {
                console.log('❌ Auto fix failed:', response.message);
                this.jobResults.autoFix.success = false;
                return false;
            }
        } catch (error) {
            console.log('❌ Auto fix error:', error.message);
            this.jobResults.autoFix.success = false;
            return false;
        }
    }

    // Step 4: Price Updates for Items Older Than 10 Days
    async runPriceUpdates() {
        console.log('💰 Step 4: Running Price Updates...\n');
        
        try {
            // First, get cards that need price updates (older than 10 days)
            const cardsResponse = await this.makeRequest('/api/admin/cards?limit=1000', 'GET');
            
            if (cardsResponse.status !== 'success') {
                console.log('❌ Failed to fetch cards for price updates');
                this.jobResults.priceUpdates.success = false;
                return false;
            }
            
            const cards = cardsResponse.data.cards || [];
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            
            const cardsNeedingUpdates = cards.filter(card => {
                const lastUpdated = card.lastUpdated ? new Date(card.lastUpdated) : null;
                return !lastUpdated || lastUpdated < tenDaysAgo;
            });
            
            console.log(`📊 Found ${cardsNeedingUpdates.length} cards needing price updates (older than 10 days)`);
            
            if (cardsNeedingUpdates.length === 0) {
                console.log('✅ No cards need price updates\n');
                this.jobResults.priceUpdates = {
                    success: true,
                    updated: 0,
                    errors: 0,
                    totalChecked: cards.length
                };
                return true;
            }
            
            // Run price updates
            const priceUpdateResponse = await this.makeRequest('/api/admin/update-prices', 'POST');
            
            if (priceUpdateResponse.status === 'success') {
                console.log('✅ Price updates completed successfully');
                const results = priceUpdateResponse.data || {};
                
                this.jobResults.priceUpdates = {
                    success: true,
                    updated: results.updated || 0,
                    errors: results.errors || 0,
                    totalChecked: cards.length,
                    cardsNeedingUpdates: cardsNeedingUpdates.length
                };
                
                console.log(`📊 Price Update Results:`);
                console.log(`   - Cards Checked: ${this.jobResults.priceUpdates.totalChecked}`);
                console.log(`   - Cards Needing Updates: ${this.jobResults.priceUpdates.cardsNeedingUpdates}`);
                console.log(`   - Successfully Updated: ${this.jobResults.priceUpdates.updated}`);
                console.log(`   - Errors: ${this.jobResults.priceUpdates.errors}\n`);
                
                return true;
            } else {
                console.log('❌ Price updates failed:', priceUpdateResponse.message);
                this.jobResults.priceUpdates.success = false;
                return false;
            }
        } catch (error) {
            console.log('❌ Price updates error:', error.message);
            this.jobResults.priceUpdates.success = false;
            return false;
        }
    }

    // Run the complete automated maintenance job
    async runMaintenanceJob() {
        const startTime = Date.now();
        
        console.log('🤖 Starting Automated Maintenance Job...\n');
        console.log('🔄 This job will:');
        console.log('   1. Run fast batch pull to find new cards');
        console.log('   2. Check database health');
        console.log('   3. Auto-fix any issues found');
        console.log('   4. Update prices for items older than 10 days\n');
        
        try {
            // Step 1: Fast Batch Pull
            const fastBatchSuccess = await this.runFastBatchPull();
            
            // Step 2: Health Check
            const healthCheckSuccess = await this.runHealthCheck();
            
            // Step 3: Auto Fix (only if there are issues)
            let autoFixSuccess = true;
            if (this.jobResults.healthCheck.totalIssues > 0) {
                autoFixSuccess = await this.runAutoFix();
            } else {
                console.log('🔧 Step 3: Skipping Auto Fix (no issues found)\n');
            }
            
            // Step 4: Price Updates
            const priceUpdateSuccess = await this.runPriceUpdates();
            
            // Calculate total duration
            this.jobResults.totalDuration = Math.round((Date.now() - startTime) / 1000);
            
            // Generate final report
            this.generateFinalReport();
            
            return {
                success: fastBatchSuccess && healthCheckSuccess && autoFixSuccess && priceUpdateSuccess,
                results: this.jobResults
            };
            
        } catch (error) {
            console.error('❌ Maintenance job failed:', error);
            this.jobResults.totalDuration = Math.round((Date.now() - startTime) / 1000);
            return {
                success: false,
                error: error.message,
                results: this.jobResults
            };
        }
    }

    // Generate comprehensive final report
    generateFinalReport() {
        console.log('📋 FINAL MAINTENANCE JOB REPORT\n');
        console.log('=' .repeat(50));
        
        // Fast Batch Pull Summary
        console.log('🚀 FAST BATCH PULL:');
        if (this.jobResults.fastBatchPull.success) {
            console.log(`   ✅ Success - ${this.jobResults.fastBatchPull.newItems} new items found`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Health Check Summary
        console.log('\n🏥 HEALTH CHECK:');
        if (this.jobResults.healthCheck.success) {
            console.log(`   ✅ Success - ${this.jobResults.healthCheck.healthScore}% health score`);
            console.log(`   📊 ${this.jobResults.healthCheck.totalIssues} issues found`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Auto Fix Summary
        console.log('\n🔧 AUTO FIX:');
        if (this.jobResults.autoFix.success) {
            console.log(`   ✅ Success - ${this.jobResults.autoFix.fixesApplied} fixes applied`);
            console.log(`   📈 ${this.jobResults.autoFix.improvement}% improvement`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Price Updates Summary
        console.log('\n💰 PRICE UPDATES:');
        if (this.jobResults.priceUpdates.success) {
            console.log(`   ✅ Success - ${this.jobResults.priceUpdates.updated} prices updated`);
            console.log(`   📊 ${this.jobResults.priceUpdates.cardsNeedingUpdates} cards needed updates`);
        } else {
            console.log('   ❌ Failed');
        }
        
        // Overall Summary
        console.log('\n📊 OVERALL SUMMARY:');
        console.log(`   ⏱️  Total Duration: ${this.jobResults.totalDuration} seconds`);
        
        const successCount = [
            this.jobResults.fastBatchPull.success,
            this.jobResults.healthCheck.success,
            this.jobResults.autoFix.success,
            this.jobResults.priceUpdates.success
        ].filter(Boolean).length;
        
        const totalSteps = 4;
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
module.exports = AutomatedMaintenanceJob;

// If run directly, execute the maintenance job
if (require.main === module) {
    const maintenanceJob = new AutomatedMaintenanceJob();
    maintenanceJob.runMaintenanceJob().then(result => {
        console.log('\n🎉 Automated maintenance job completed!');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Maintenance job failed:', error);
        process.exit(1);
    });
}
