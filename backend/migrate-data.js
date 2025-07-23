#!/usr/bin/env node

/**
 * Data Migration Script for Scorecard
 * 
 * This script helps migrate search history data to persistent storage
 * and sets up proper data directories for Railway deployment.
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SEARCH_HISTORY_FILE = path.join(DATA_DIR, 'search_history.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

async function ensureDirectories() {
  console.log('📁 Setting up directories...');
  
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('✅ Data directory created:', DATA_DIR);
    
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log('✅ Backup directory created:', BACKUP_DIR);
    
  } catch (error) {
    console.error('❌ Error creating directories:', error);
    throw error;
  }
}

async function backupExistingData() {
  console.log('💾 Backing up existing data...');
  
  try {
    // Check if search history file exists
    try {
      await fs.access(SEARCH_HISTORY_FILE);
    } catch {
      console.log('ℹ️ No existing search history file found');
      return;
    }
    
    // Read existing data
    const data = await fs.readFile(SEARCH_HISTORY_FILE, 'utf8');
    const searchHistory = JSON.parse(data);
    
    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `search_history_backup_${timestamp}.json`);
    
    await fs.writeFile(backupFile, JSON.stringify(searchHistory, null, 2));
    console.log('✅ Backup created:', backupFile);
    console.log(`📊 Backed up ${searchHistory.length} search records`);
    
  } catch (error) {
    console.error('❌ Error backing up data:', error);
    throw error;
  }
}

async function createInitialData() {
  console.log('📝 Creating initial data structure...');
  
  try {
    // Check if search history file already exists
    try {
      await fs.access(SEARCH_HISTORY_FILE);
      console.log('ℹ️ Search history file already exists');
      return;
    } catch {
      // File doesn't exist, create it
    }
    
    // Create empty search history array
    const initialData = [];
    await fs.writeFile(SEARCH_HISTORY_FILE, JSON.stringify(initialData, null, 2));
    console.log('✅ Initial search history file created');
    
  } catch (error) {
    console.error('❌ Error creating initial data:', error);
    throw error;
  }
}

async function validateData() {
  console.log('🔍 Validating data structure...');
  
  try {
    const data = await fs.readFile(SEARCH_HISTORY_FILE, 'utf8');
    const searchHistory = JSON.parse(data);
    
    if (!Array.isArray(searchHistory)) {
      throw new Error('Search history is not an array');
    }
    
    console.log(`✅ Data validation passed: ${searchHistory.length} search records found`);
    
    // Show some stats
    if (searchHistory.length > 0) {
      const uniqueUsers = new Set(searchHistory.map(s => s.userId).filter(Boolean));
      const recentSearches = searchHistory.slice(0, 5);
      
      console.log(`👥 Unique users: ${uniqueUsers.size}`);
      console.log('📋 Recent searches:');
      recentSearches.forEach((search, index) => {
        console.log(`  ${index + 1}. ${search.query} (${search.timestamp})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Data validation failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting data migration...');
  console.log('📁 Data directory:', DATA_DIR);
  console.log('📁 Search history file:', SEARCH_HISTORY_FILE);
  
  try {
    await ensureDirectories();
    await backupExistingData();
    await createInitialData();
    await validateData();
    
    console.log('✅ Data migration completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Deploy to Railway with volume configuration');
    console.log('2. Set DATA_DIR environment variable if needed');
    console.log('3. Monitor logs for data persistence');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  ensureDirectories,
  backupExistingData,
  createInitialData,
  validateData
}; 