require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { quickUpdate, fullUpdate } = require('./database-updater');

// Configuration
const CONFIG = {
  // Update schedule (in hours)
  quickUpdateInterval: 6,    // Quick update every 6 hours
  fullUpdateInterval: 24,    // Full update every 24 hours
  
  // Log file
  logFile: path.join(__dirname, 'logs', 'updater.log'),
  
  // Status file
  statusFile: path.join(__dirname, 'data', 'updater-status.json')
};

// Ensure logs directory exists
const logsDir = path.dirname(CONFIG.logFile);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logging function
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  
  console.log(logMessage);
  
  // Write to log file
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

// Save status
function saveStatus(status) {
  try {
    fs.writeFileSync(CONFIG.statusFile, JSON.stringify(status, null, 2));
  } catch (error) {
    log(`Failed to save status: ${error.message}`, 'ERROR');
  }
}

// Load status
function loadStatus() {
  try {
    if (fs.existsSync(CONFIG.statusFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.statusFile, 'utf8'));
    }
  } catch (error) {
    log(`Failed to load status: ${error.message}`, 'ERROR');
  }
  
  return {
    lastQuickUpdate: null,
    lastFullUpdate: null,
    totalQuickUpdates: 0,
    totalFullUpdates: 0,
    lastError: null,
    isRunning: false
  };
}

// Run quick update
async function runQuickUpdate() {
  const status = loadStatus();
  
  if (status.isRunning) {
    log('Update already running, skipping...', 'WARN');
    return;
  }
  
  status.isRunning = true;
  status.lastQuickUpdate = new Date().toISOString();
  saveStatus(status);
  
  try {
    log('Starting quick update...', 'INFO');
    await quickUpdate();
    status.totalQuickUpdates++;
    status.lastError = null;
    log('Quick update completed successfully', 'INFO');
  } catch (error) {
    status.lastError = error.message;
    log(`Quick update failed: ${error.message}`, 'ERROR');
  } finally {
    status.isRunning = false;
    saveStatus(status);
  }
}

// Run full update
async function runFullUpdate() {
  const status = loadStatus();
  
  if (status.isRunning) {
    log('Update already running, skipping...', 'WARN');
    return;
  }
  
  status.isRunning = true;
  status.lastFullUpdate = new Date().toISOString();
  saveStatus(status);
  
  try {
    log('Starting full update...', 'INFO');
    await fullUpdate();
    status.totalFullUpdates++;
    status.lastError = null;
    log('Full update completed successfully', 'INFO');
  } catch (error) {
    status.lastError = error.message;
    log(`Full update failed: ${error.message}`, 'ERROR');
  } finally {
    status.isRunning = false;
    saveStatus(status);
  }
}

// Check if update is needed
function shouldUpdate(lastUpdate, intervalHours) {
  if (!lastUpdate) return true;
  
  const lastUpdateTime = new Date(lastUpdate);
  const now = new Date();
  const hoursSinceLastUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);
  
  return hoursSinceLastUpdate >= intervalHours;
}

// Main scheduler
async function startScheduler() {
  log('Starting database updater scheduler...', 'INFO');
  
  // Initial status
  const status = loadStatus();
  log(`Current status: ${JSON.stringify(status, null, 2)}`, 'INFO');
  
  // Check for immediate updates
  if (shouldUpdate(status.lastQuickUpdate, CONFIG.quickUpdateInterval)) {
    log('Quick update overdue, running now...', 'INFO');
    await runQuickUpdate();
  }
  
  if (shouldUpdate(status.lastFullUpdate, CONFIG.fullUpdateInterval)) {
    log('Full update overdue, running now...', 'INFO');
    await runFullUpdate();
  }
  
  // Set up periodic checks
  setInterval(async () => {
    const currentStatus = loadStatus();
    
    // Check for quick update
    if (shouldUpdate(currentStatus.lastQuickUpdate, CONFIG.quickUpdateInterval)) {
      log('Scheduled quick update starting...', 'INFO');
      await runQuickUpdate();
    }
    
    // Check for full update
    if (shouldUpdate(currentStatus.lastFullUpdate, CONFIG.fullUpdateInterval)) {
      log('Scheduled full update starting...', 'INFO');
      await runFullUpdate();
    }
  }, 60 * 60 * 1000); // Check every hour
  
  log('Scheduler started successfully', 'INFO');
}

// Manual update functions
async function manualQuickUpdate() {
  log('Manual quick update requested', 'INFO');
  await runQuickUpdate();
}

async function manualFullUpdate() {
  log('Manual full update requested', 'INFO');
  await runFullUpdate();
}

// Get status
function getStatus() {
  const status = loadStatus();
  const now = new Date();
  
  const quickUpdateDue = status.lastQuickUpdate ? 
    new Date(status.lastQuickUpdate).getTime() + (CONFIG.quickUpdateInterval * 60 * 60 * 1000) : 
    now.getTime();
  
  const fullUpdateDue = status.lastFullUpdate ? 
    new Date(status.lastFullUpdate).getTime() + (CONFIG.fullUpdateInterval * 60 * 60 * 1000) : 
    now.getTime();
  
  return {
    ...status,
    nextQuickUpdate: new Date(quickUpdateDue).toISOString(),
    nextFullUpdate: new Date(fullUpdateDue).toISOString(),
    quickUpdateOverdue: now.getTime() > quickUpdateDue,
    fullUpdateOverdue: now.getTime() > fullUpdateDue
  };
}

// Export functions
module.exports = {
  startScheduler,
  manualQuickUpdate,
  manualFullUpdate,
  getStatus,
  runQuickUpdate,
  runFullUpdate
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--start') || args.includes('-s')) {
    startScheduler();
  } else if (args.includes('--quick') || args.includes('-q')) {
    manualQuickUpdate();
  } else if (args.includes('--full') || args.includes('-f')) {
    manualFullUpdate();
  } else if (args.includes('--status') || args.includes('--info')) {
    const status = getStatus();
    console.log('Database Updater Status:');
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log('Database Updater - Scheduled Updates');
    console.log('====================================');
    console.log('');
    console.log('Usage:');
    console.log('  node scheduled-updater.js --start   # Start scheduler');
    console.log('  node scheduled-updater.js --quick   # Manual quick update');
    console.log('  node scheduled-updater.js --full    # Manual full update');
    console.log('  node scheduled-updater.js --status  # Show status');
    console.log('');
    console.log('Schedule:');
    console.log(`  Quick updates: Every ${CONFIG.quickUpdateInterval} hours`);
    console.log(`  Full updates: Every ${CONFIG.fullUpdateInterval} hours`);
  }
} 