require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getStatus } = require('./scheduled-updater');

// Database files
const DATABASE_FILE = path.join(__dirname, 'data', 'psa10_recent_90_days_database.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Get database statistics
function getDatabaseStats() {
  try {
    const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
    const items = data.items;
    
    // Basic stats
    const totalItems = items.length;
    const itemsWithPSA9 = items.filter(item => item.psa9AveragePrice).length;
    const itemsWithRaw = items.filter(item => item.rawAveragePrice).length;
    const itemsWithPriceComparisons = items.filter(item => 
      item.psa9AveragePrice || item.rawAveragePrice
    ).length;
    
    // Date range
    const dates = items.map(item => new Date(item.soldDate)).sort((a, b) => a - b);
    const oldestDate = dates[0];
    const newestDate = dates[dates.length - 1];
    
    // Price statistics
    const prices = items.map(item => parseFloat(item.price.value)).filter(p => !isNaN(p));
    const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Sport breakdown
    const sportCounts = {};
    items.forEach(item => {
      const sport = item.sport || 'Unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    
    // Year breakdown
    const yearCounts = {};
    items.forEach(item => {
      const year = item.year || 'Unknown';
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentItems = items.filter(item => new Date(item.soldDate) >= sevenDaysAgo);
    
    return {
      totalItems,
      itemsWithPSA9,
      itemsWithRaw,
      itemsWithPriceComparisons,
      completionRate: Math.round((itemsWithPriceComparisons / totalItems) * 100),
      dateRange: {
        oldest: oldestDate.toISOString(),
        newest: newestDate.toISOString(),
        daysCovered: Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24))
      },
      priceStats: {
        average: Math.round(avgPrice * 100) / 100,
        minimum: minPrice,
        maximum: maxPrice,
        totalValue: Math.round(prices.reduce((sum, p) => sum + p, 0) * 100) / 100
      },
      sportBreakdown: sportCounts,
      yearBreakdown: yearCounts,
      recentActivity: {
        last7Days: recentItems.length,
        last24Hours: items.filter(item => {
          const soldDate = new Date(item.soldDate);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return soldDate >= yesterday;
        }).length
      },
      lastUpdated: data.metadata?.lastUpdated || 'Unknown'
    };
  } catch (error) {
    console.error('Error getting database stats:', error.message);
    return null;
  }
}

// Get backup information
function getBackupInfo() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return { backups: [], totalBackups: 0 };
    }
    
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);
    
    return {
      backups: backupFiles,
      totalBackups: backupFiles.length,
      latestBackup: backupFiles[0] || null,
      totalBackupSize: backupFiles.reduce((sum, file) => sum + file.size, 0)
    };
  } catch (error) {
    console.error('Error getting backup info:', error.message);
    return { backups: [], totalBackups: 0 };
  }
}

// Get system health
function getSystemHealth() {
  const dbStats = getDatabaseStats();
  const backupInfo = getBackupInfo();
  const updaterStatus = getStatus();
  
  const health = {
    database: {
      status: dbStats ? 'HEALTHY' : 'ERROR',
      totalItems: dbStats?.totalItems || 0,
      completionRate: dbStats?.completionRate || 0,
      lastUpdated: dbStats?.lastUpdated || 'Unknown'
    },
    backups: {
      status: backupInfo.totalBackups > 0 ? 'HEALTHY' : 'WARNING',
      totalBackups: backupInfo.totalBackups,
      latestBackup: backupInfo.latestBackup?.modified || 'None',
      totalSize: backupInfo.totalBackupSize
    },
    updater: {
      status: updaterStatus.lastError ? 'ERROR' : 'HEALTHY',
      lastQuickUpdate: updaterStatus.lastQuickUpdate,
      lastFullUpdate: updaterStatus.lastFullUpdate,
      nextQuickUpdate: updaterStatus.nextQuickUpdate,
      nextFullUpdate: updaterStatus.nextFullUpdate,
      isRunning: updaterStatus.isRunning,
      lastError: updaterStatus.lastError
    },
    overall: 'HEALTHY'
  };
  
  // Determine overall health
  if (health.database.status === 'ERROR' || health.updater.status === 'ERROR') {
    health.overall = 'ERROR';
  } else if (health.database.status === 'WARNING' || health.backups.status === 'WARNING') {
    health.overall = 'WARNING';
  }
  
  return health;
}

// Generate detailed report
function generateReport() {
  console.log('📊 Database Monitor Report');
  console.log('==========================\n');
  
  const health = getSystemHealth();
  const dbStats = getDatabaseStats();
  const backupInfo = getBackupInfo();
  const updaterStatus = getStatus();
  
  // Overall Health
  console.log(`🏥 Overall Health: ${health.overall}`);
  console.log('');
  
  // Database Status
  console.log('📊 Database Status:');
  console.log(`   Status: ${health.database.status}`);
  console.log(`   Total Items: ${health.database.totalItems.toLocaleString()}`);
  console.log(`   Price Comparisons: ${dbStats?.itemsWithPriceComparisons.toLocaleString()} (${health.database.completionRate}%)`);
  console.log(`   PSA 9 Data: ${dbStats?.itemsWithPSA9.toLocaleString()}`);
  console.log(`   Raw Data: ${dbStats?.itemsWithRaw.toLocaleString()}`);
  console.log(`   Last Updated: ${health.database.lastUpdated}`);
  console.log('');
  
  // Price Statistics
  if (dbStats) {
    console.log('💰 Price Statistics:');
    console.log(`   Average Price: $${dbStats.priceStats.average.toLocaleString()}`);
    console.log(`   Price Range: $${dbStats.priceStats.minimum.toLocaleString()} - $${dbStats.priceStats.maximum.toLocaleString()}`);
    console.log(`   Total Value: $${dbStats.priceStats.totalValue.toLocaleString()}`);
    console.log('');
  }
  
  // Recent Activity
  if (dbStats) {
    console.log('📈 Recent Activity:');
    console.log(`   Last 24 Hours: ${dbStats.recentActivity.last24Hours} sales`);
    console.log(`   Last 7 Days: ${dbStats.recentActivity.last7Days} sales`);
    console.log('');
  }
  
  // Sport Breakdown
  if (dbStats && Object.keys(dbStats.sportBreakdown).length > 0) {
    console.log('🏈 Sport Breakdown:');
    Object.entries(dbStats.sportBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([sport, count]) => {
        console.log(`   ${sport}: ${count.toLocaleString()} items`);
      });
    console.log('');
  }
  
  // Backup Status
  console.log('💾 Backup Status:');
  console.log(`   Status: ${health.backups.status}`);
  console.log(`   Total Backups: ${health.backups.totalBackups}`);
  console.log(`   Latest Backup: ${health.backups.latestBackup || 'None'}`);
  console.log(`   Total Size: ${(health.backups.totalSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log('');
  
  // Updater Status
  console.log('🔄 Updater Status:');
  console.log(`   Status: ${health.updater.status}`);
  console.log(`   Currently Running: ${health.updater.isRunning ? 'Yes' : 'No'}`);
  console.log(`   Last Quick Update: ${health.updater.lastQuickUpdate || 'Never'}`);
  console.log(`   Last Full Update: ${health.updater.lastFullUpdate || 'Never'}`);
  console.log(`   Next Quick Update: ${health.updater.nextQuickUpdate || 'Unknown'}`);
  console.log(`   Next Full Update: ${health.updater.nextFullUpdate || 'Unknown'}`);
  if (health.updater.lastError) {
    console.log(`   Last Error: ${health.updater.lastError}`);
  }
  console.log('');
  
  // Recommendations
  console.log('💡 Recommendations:');
  if (health.overall === 'ERROR') {
    console.log('   ❌ Critical issues detected - immediate attention required');
  }
  if (health.database.completionRate < 50) {
    console.log('   ⚠️  Low price comparison completion rate - consider running price comparison script');
  }
  if (health.backups.totalBackups === 0) {
    console.log('   ⚠️  No backups found - consider creating initial backup');
  }
  if (health.updater.status === 'ERROR') {
    console.log('   ⚠️  Updater has errors - check logs for details');
  }
  if (health.overall === 'HEALTHY') {
    console.log('   ✅ System is healthy and running well');
  }
}

// Export functions
module.exports = {
  getDatabaseStats,
  getBackupInfo,
  getSystemHealth,
  generateReport
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--health') || args.includes('-h')) {
    const health = getSystemHealth();
    console.log('System Health:');
    console.log(JSON.stringify(health, null, 2));
  } else if (args.includes('--stats') || args.includes('-s')) {
    const stats = getDatabaseStats();
    console.log('Database Statistics:');
    console.log(JSON.stringify(stats, null, 2));
  } else if (args.includes('--backups') || args.includes('-b')) {
    const backups = getBackupInfo();
    console.log('Backup Information:');
    console.log(JSON.stringify(backups, null, 2));
  } else {
    generateReport();
  }
} 