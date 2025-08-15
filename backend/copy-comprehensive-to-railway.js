const fs = require('fs');
const path = require('path');

async function copyComprehensiveToRailway() {
    console.log('🚀 Copying comprehensive database to Railway...');
    
    const sourcePath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    const targetPath = path.join(__dirname, 'data', 'new-scorecard.db');
    
    try {
        // Check if comprehensive database exists
        if (!fs.existsSync(sourcePath)) {
            console.log('❌ Comprehensive database not found at:', sourcePath);
            return;
        }
        
        // Get file size
        const stats = fs.statSync(sourcePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Comprehensive database size: ${fileSizeInMB} MB`);
        
        // Copy the file
        fs.copyFileSync(sourcePath, targetPath);
        
        // Verify the copy
        const targetStats = fs.statSync(targetPath);
        const targetSizeInMB = (targetStats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Successfully copied comprehensive database to Railway`);
        console.log(`📊 Target file size: ${targetSizeInMB} MB`);
        console.log(`🎯 Railway will now use the comprehensive database for learning`);
        
    } catch (error) {
        console.error('❌ Error copying comprehensive database:', error.message);
    }
}

// Run the copy function
copyComprehensiveToRailway();
