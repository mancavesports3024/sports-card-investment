const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function runRailwayOptimizations() {
    console.log('🚀 Running Railway database optimizations...\n');
    
    try {
        // 1. Run price anomaly fixes
        console.log('🔧 Step 1: Fixing price anomalies...');
        const priceFixResponse = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/fix-price-anomalies\' -Method POST"');
        console.log('✅ Price anomaly fixes triggered');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Run duplicate fixes
        console.log('\n🔧 Step 2: Fixing duplicates...');
        const duplicateFixResponse = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/fix-duplicates\' -Method POST"');
        console.log('✅ Duplicate fixes triggered');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. Add performance indexes
        console.log('\n🔧 Step 3: Adding performance indexes...');
        const indexResponse = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/add-indexes\' -Method POST"');
        console.log('✅ Performance indexes triggered');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. Run data validation
        console.log('\n🔧 Step 4: Running data validation...');
        const validationResponse = await execAsync('powershell -Command "Invoke-WebRequest -Uri \'https://web-production-9efa.up.railway.app/api/admin/run-validation\' -Method POST"');
        console.log('✅ Data validation triggered');
        
        console.log('\n🎉 All Railway optimizations have been triggered!');
        console.log('📊 Check the Railway logs to see the results.');
        
    } catch (error) {
        console.error('❌ Error running Railway optimizations:', error.message);
    }
}

runRailwayOptimizations();
