# Database Management Guide

This guide covers how to keep your PSA 10 sports card database updated and healthy.

## 📊 Current Database Status

Your database contains **12,039 PSA 10 cards** from the last 90 days, with price comparisons being added automatically.

## 🛠️ Available Tools

### 1. Database Updater (`database-updater.js`)
Main tool for updating the database with fresh data.

**Commands:**
```bash
# Quick update (add new items only)
node database-updater.js --quick

# Full update (everything)
node database-updater.js --full

# Default update (recommended)
node database-updater.js
```

### 2. Scheduled Updater (`scheduled-updater.js`)
Automated system that runs updates on a schedule.

**Commands:**
```bash
# Start the scheduler (runs continuously)
node scheduled-updater.js --start

# Manual quick update
node scheduled-updater.js --quick

# Manual full update
node scheduled-updater.js --full

# Check updater status
node scheduled-updater.js --status
```

### 3. Database Monitor (`database-monitor.js`)
Monitor database health and performance.

**Commands:**
```bash
# Full status report
node database-monitor.js

# System health check
node database-monitor.js --health

# Database statistics
node database-monitor.js --stats

# Backup information
node database-monitor.js --backups
```

### 4. Windows Batch File (`update-database.bat`)
Easy-to-use Windows commands.

**Commands:**
```bash
# Quick update
update-database.bat quick

# Full update
update-database.bat full

# Start scheduler
update-database.bat start

# Check status
update-database.bat status

# Check health
update-database.bat health
```

## 📅 Update Schedule

### Automatic Schedule
- **Quick Updates:** Every 6 hours
- **Full Updates:** Every 24 hours
- **Backups:** Created before each update

### Manual Schedule (Recommended)
- **Daily:** Run quick update to add new items
- **Weekly:** Run full update to refresh everything
- **Monthly:** Check system health and clean old backups

## 🔄 Update Types

### Quick Update
- ✅ Adds new items from recent searches
- ✅ Fast (5-10 minutes)
- ✅ Low resource usage
- ❌ Doesn't update existing items
- ❌ Doesn't remove old items

### Full Update
- ✅ Updates existing items with fresh data
- ✅ Adds new items
- ✅ Removes items older than 90 days
- ✅ Creates backup
- ❌ Takes longer (30-60 minutes)
- ❌ Higher resource usage

## 📈 Database Statistics

### Current Data
- **Total Items:** 12,039
- **Price Comparisons:** Being added (currently running)
- **Date Range:** Last 90 days
- **Sports:** Baseball, Football, Basketball, Hockey, Soccer, Pokemon, Magic
- **Average Price:** Calculated automatically

### Data Fields
Each item contains:
- Basic info (title, price, sold date, image)
- Summary title (year, product, player, card number, card type)
- PSA 9 average price (when available)
- Raw average price (when available)
- Price differences and percentages
- Investment metrics

## 💾 Backup System

### Automatic Backups
- Created before each update
- Stored in `data/backups/` directory
- Timestamped filenames
- Keeps last 10 backups

### Manual Backups
```bash
# Create backup now
node database-updater.js --backup

# Restore from backup (if needed)
cp data/backups/psa10_database_backup_YYYY-MM-DD.json data/psa10_recent_90_days_database.json
```

## 🏥 Health Monitoring

### System Health Levels
- **HEALTHY:** Everything working normally
- **WARNING:** Minor issues detected
- **ERROR:** Critical issues requiring attention

### Health Checks
- Database accessibility
- Backup availability
- Updater status
- Price comparison completion rate
- Recent activity levels

## 🚀 Getting Started

### 1. Initial Setup
```bash
# Check current status
node database-monitor.js

# Run first quick update
node database-updater.js --quick

# Start scheduled updates
node scheduled-updater.js --start
```

### 2. Daily Operations
```bash
# Check status
update-database.bat status

# Run quick update if needed
update-database.bat quick
```

### 3. Weekly Maintenance
```bash
# Run full update
update-database.bat full

# Check system health
update-database.bat health

# Review logs
type logs\updater.log
```

## 📋 Best Practices

### 1. Regular Monitoring
- Check status daily
- Monitor for errors
- Review backup health

### 2. Update Strategy
- Use quick updates for daily maintenance
- Use full updates weekly
- Monitor completion rates

### 3. Backup Management
- Keep recent backups
- Test restore procedures
- Monitor backup sizes

### 4. Performance
- Run updates during off-peak hours
- Monitor system resources
- Check for rate limiting

## 🔧 Troubleshooting

### Common Issues

**1. Update Fails**
```bash
# Check logs
type logs\updater.log

# Check system health
node database-monitor.js --health

# Try manual update
node database-updater.js --quick
```

**2. Database Corrupted**
```bash
# Restore from backup
cp data/backups/psa10_database_backup_YYYY-MM-DD.json data/psa10_recent_90_days_database.json

# Verify restoration
node database-monitor.js --stats
```

**3. Low Completion Rate**
```bash
# Check price comparison progress
node database-monitor.js --stats

# Restart price comparison script if needed
node add-price-comparisons.js
```

### Error Messages

- **"Rate limiting"** - Normal, script will wait
- **"No sales found"** - Common for rare cards
- **"Connection error"** - Check internet connection
- **"File not found"** - Check file paths

## 📞 Support

### Log Files
- **Updater Logs:** `logs/updater.log`
- **Status File:** `data/updater-status.json`
- **Database:** `data/psa10_recent_90_days_database.json`

### Monitoring Commands
```bash
# Real-time status
node database-monitor.js

# Detailed health check
node database-monitor.js --health

# Recent activity
node database-monitor.js --stats
```

## 🎯 Next Steps

1. **Start the scheduler** for automatic updates
2. **Monitor daily** for the first week
3. **Adjust schedule** based on your needs
4. **Set up alerts** for critical issues
5. **Regular maintenance** following this guide

Your database will stay fresh and provide valuable investment insights for your sports card platform! 