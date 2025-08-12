// Script to check what files exist on Railway and find the actual card data
const fs = require('fs');
const path = require('path');

async function checkRailwayFiles() {
    console.log('🔍 Checking Railway file system...');
    
    // Check common database locations
    const possibleDbPaths = [
        '/app/new-scorecard.db',
        '/app/data/new-scorecard.db',
        '/app/scorecard.db',
        '/app/data/scorecard.db',
        '/app/database.db',
        '/app/data/database.db'
    ];
    
    console.log('📁 Checking possible database locations:');
    possibleDbPaths.forEach(dbPath => {
        try {
            const exists = fs.existsSync(dbPath);
            const stats = exists ? fs.statSync(dbPath) : null;
            const size = exists ? stats.size : 0;
            console.log(`   ${exists ? '✅' : '❌'} ${dbPath} (${size} bytes)`);
        } catch (error) {
            console.log(`   ❌ ${dbPath} (error: ${error.message})`);
        }
    });
    
    // Check what's in the current directory
    console.log('\n📁 Current directory contents:');
    try {
        const files = fs.readdirSync('/app');
        files.forEach(file => {
            try {
                const filePath = path.join('/app', file);
                const stats = fs.statSync(filePath);
                const isDir = stats.isDirectory();
                console.log(`   ${isDir ? '📁' : '📄'} ${file} (${stats.size} bytes)`);
            } catch (error) {
                console.log(`   ❌ ${file} (error: ${error.message})`);
            }
        });
    } catch (error) {
        console.log(`   ❌ Error reading directory: ${error.message}`);
    }
    
    // Check if data directory exists
    console.log('\n📁 Checking data directory:');
    try {
        const dataDir = '/app/data';
        const dataExists = fs.existsSync(dataDir);
        console.log(`   ${dataExists ? '✅' : '❌'} /app/data exists`);
        
        if (dataExists) {
            const dataFiles = fs.readdirSync(dataDir);
            dataFiles.forEach(file => {
                try {
                    const filePath = path.join(dataDir, file);
                    const stats = fs.statSync(filePath);
                    console.log(`   📄 ${file} (${stats.size} bytes)`);
                } catch (error) {
                    console.log(`   ❌ ${file} (error: ${error.message})`);
                }
            });
        }
    } catch (error) {
        console.log(`   ❌ Error checking data directory: ${error.message}`);
    }
    
    // Check environment variables that might indicate database location
    console.log('\n🔧 Environment variables:');
    const relevantEnvVars = [
        'DATABASE_URL',
        'DB_PATH',
        'SQLITE_PATH',
        'NODE_ENV',
        'RAILWAY_ENVIRONMENT'
    ];
    
    relevantEnvVars.forEach(envVar => {
        const value = process.env[envVar];
        if (value) {
            console.log(`   ${envVar}: ${value}`);
        } else {
            console.log(`   ${envVar}: (not set)`);
        }
    });
}

// Export the function for use in API endpoint
module.exports = { checkRailwayFiles };

// Run the check if called directly
if (require.main === module) {
    checkRailwayFiles().catch(console.error);
}
