#!/usr/bin/env node

/**
 * Automated Sitemap Update Script
 * 
 * This script can be run:
 * 1. Manually: node auto-update-sitemap.js
 * 2. Via cron job: 0 0 * * * cd /path/to/backend && node auto-update-sitemap.js
 * 3. Via GitHub Actions (on deployment)
 * 4. Via Railway post-deploy hook
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Starting automated sitemap update...');
console.log(`📅 Time: ${new Date().toISOString()}`);

try {
  // Run the sitemap generator
  execSync('npm run sitemap', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('✅ Sitemap updated successfully!');
  
  // Optional: Add git commit if in a git repository
  try {
    execSync('git add ../frontend/public/sitemap.xml', { 
      stdio: 'pipe',
      cwd: __dirname 
    });
    execSync('git commit -m "Auto-update sitemap"', { 
      stdio: 'pipe',
      cwd: __dirname 
    });
    console.log('📝 Git commit created for sitemap update');
  } catch (gitError) {
    console.log('ℹ️  Git operations skipped (not in git repo or no changes)');
  }
  
} catch (error) {
  console.error('❌ Error updating sitemap:', error.message);
  process.exit(1);
}

console.log('🎉 Sitemap automation completed!');