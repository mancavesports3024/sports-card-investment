const fs = require('fs');
const path = require('path');

function checkJobStatus() {
    console.log('🔍 JOB STATUS MONITOR');
    console.log('====================');
    
    // Check for running Node.js processes
    const { execSync } = require('child_process');
    
    try {
        const processes = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8' });
        const nodeProcesses = processes.split('\n').filter(line => line.includes('node.exe'));
        
        console.log(`📊 Node.js processes running: ${nodeProcesses.length - 1}`); // -1 for header
        
        if (nodeProcesses.length > 1) {
            console.log('✅ Node.js processes detected:');
            nodeProcesses.slice(1).forEach(process => {
                console.log(`   - ${process}`);
            });
        } else {
            console.log('❌ No Node.js processes running');
        }
        
    } catch (error) {
        console.log('❌ Could not check processes:', error.message);
    }
    
    // Check database for recent updates
    try {
        const databasePath = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
        const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const items = database.items || database;
        
        const cardsWithPrices = items.filter(card => 
            card.priceComparisons && card.priceComparisons.raw && card.priceComparisons.psa9
        );
        
        console.log(`\n📈 DATABASE STATUS:`);
        console.log(`Total cards: ${items.length}`);
        console.log(`Cards with price data: ${cardsWithPrices.length}`);
        console.log(`Coverage: ${Math.round(cardsWithPrices.length/items.length*100)}%`);
        
        // Check for recent backups
        const backupDir = path.join(__dirname, 'data', 'backups');
        if (fs.existsSync(backupDir)) {
            const backups = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));
            const recentBackups = backups
                .map(file => ({
                    name: file,
                    time: fs.statSync(path.join(backupDir, file)).mtime
                }))
                .sort((a, b) => b.time - a.time)
                .slice(0, 3);
            
            console.log(`\n💾 Recent backups:`);
            recentBackups.forEach(backup => {
                console.log(`   - ${backup.name} (${backup.time.toLocaleString()})`);
            });
        }
        
    } catch (error) {
        console.log('❌ Could not check database:', error.message);
    }
    
    console.log('\n🔍 To start a job, run: node hybrid-price-comparisons.js [number]');
    console.log('🔍 To start targeted update: node update-missing-prices.js');
}

// Run the monitor
checkJobStatus(); 