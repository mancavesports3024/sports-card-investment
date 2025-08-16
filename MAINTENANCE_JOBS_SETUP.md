# 🚀 Railway Maintenance Jobs Setup Guide

## 📋 Overview

This guide explains how to set up and run the automated maintenance jobs for your ScoreCard application.

## 🎯 Available Jobs

### 1. **Full Maintenance Job** (`run-railway-maintenance-direct.js`)
- **What it does**: Complete database maintenance
- **Includes**: Health check, auto fix, price updates
- **When to run**: Daily or weekly maintenance

### 2. **Health Check Only** (`health-check-only.js`)
- **What it does**: Analyzes database health and auto-fixes issues
- **Includes**: Health analysis, automatic issue fixing
- **When to run**: Every 6 hours (monitoring)

### 3. **Price Updates Only** (`price-updates-only.js`)
- **What it does**: Updates prices for items older than 10 days
- **Includes**: Price refresh for stale data
- **When to run**: Daily at 4 AM

### 4. **Manual Job Runner** (`manual-jobs.js`)
- **What it does**: Run any job type on demand
- **Includes**: All job types with command-line interface
- **When to run**: Whenever you need manual control

## ⚙️ Setup Options

### Option 1: Railway Cron Jobs (Recommended)

The `railway.json` file is configured with automated cron jobs:

```json
{
  "cron": {
    "maintenance-job": {
      "schedule": "0 2 * * *",        // Daily at 2 AM
      "command": "node backend/run-railway-maintenance-direct.js"
    },
    "health-check": {
      "schedule": "0 */6 * * *",      // Every 6 hours
      "command": "node backend/health-check-only.js"
    },
    "price-updates": {
      "schedule": "0 4 * * *",        // Daily at 4 AM
      "command": "node backend/price-updates-only.js"
    }
  }
}
```

**Cron Schedule Explanation:**
- `0 2 * * *` = Daily at 2:00 AM
- `0 */6 * * *` = Every 6 hours (00:00, 06:00, 12:00, 18:00)
- `0 4 * * *` = Daily at 4:00 AM

### Option 2: Manual Execution

Run jobs manually using the command-line interface:

```bash
# Health check only
node backend/manual-jobs.js health-check

# Auto fix only
node backend/manual-jobs.js auto-fix

# Price updates only
node backend/manual-jobs.js price-updates

# Full maintenance job
node backend/manual-jobs.js full-maintenance

# Fast batch pull (when integrated)
node backend/manual-jobs.js fast-batch-pull
```

### Option 3: Direct Script Execution

Run individual scripts directly:

```bash
# Full maintenance job
node backend/run-railway-maintenance-direct.js

# Health check only
node backend/health-check-only.js

# Price updates only
node backend/price-updates-only.js
```

## 🚀 Deployment Steps

1. **Deploy the files** (already done):
   ```bash
   git add .
   git commit -m "Add maintenance job setup"
   git push
   ```

2. **Verify deployment** on Railway dashboard

3. **Test the jobs** manually first:
   ```bash
   node backend/manual-jobs.js health-check
   ```

## 📊 Monitoring & Logs

### Railway Dashboard
- Check Railway dashboard for cron job execution logs
- Monitor job success/failure rates
- View execution times and resource usage

### Job Output Examples

**Successful Health Check:**
```
🏥 Health Check Only - Cron Job
📅 Started at: 2025-08-16T12:00:00.000Z

📊 Health Check Results:
   - Health Score: 96.2%
   - Total Cards: 531
   - Player Name Issues: 16
   - Summary Title Issues: 5
   - Total Issues: 21

🔧 Issues detected! Triggering auto fix...
✅ Auto fix completed: 21 fixes applied

📅 Completed at: 2025-08-16T12:01:30.000Z
```

**Successful Price Updates:**
```
💰 Price Updates Only - Cron Job
📅 Started at: 2025-08-16T04:00:00.000Z

📊 Price Update Results:
   - Cards Needing Updates: 50
   - Successfully Updated: 50
   - Errors: 0

✅ Successfully updated 50 card prices

📅 Completed at: 2025-08-16T04:02:15.000Z
```

## 🔧 Customization

### Adjusting Schedules

Edit `railway.json` to change cron schedules:

```json
{
  "cron": {
    "maintenance-job": {
      "schedule": "0 1 * * *",        // Change to 1 AM
      "command": "node backend/run-railway-maintenance-direct.js"
    }
  }
}
```

### Adding New Jobs

1. Create a new script (e.g., `backend/new-job.js`)
2. Add to `railway.json`:
   ```json
   {
     "cron": {
       "new-job": {
         "schedule": "0 3 * * *",
         "command": "node backend/new-job.js"
       }
     }
   }
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Job fails with database error**
   - Check database connection
   - Verify database file exists
   - Check file permissions

2. **Job times out**
   - Jobs are designed to work within Railway's limits
   - Check for infinite loops or heavy operations

3. **Cron jobs not running**
   - Verify `railway.json` is properly formatted
   - Check Railway dashboard for cron job status
   - Ensure scripts have proper shebang (`#!/usr/bin/env node`)

### Debug Commands

```bash
# Test health check manually
node backend/health-check-only.js

# Test full maintenance
node backend/run-railway-maintenance-direct.js

# Check manual job runner
node backend/manual-jobs.js health-check
```

## 📈 Performance Optimization

### Recommended Settings

- **Health Check**: Every 6 hours (monitoring)
- **Price Updates**: Daily at 4 AM (low traffic)
- **Full Maintenance**: Daily at 2 AM (comprehensive)

### Resource Usage

- **Health Check**: ~30 seconds, low CPU
- **Price Updates**: ~2-5 minutes, moderate CPU
- **Full Maintenance**: ~5-10 minutes, high CPU

## 🎉 Success Metrics

Monitor these metrics to ensure jobs are working:

- **Health Score**: Should stay above 95%
- **Issue Count**: Should decrease over time
- **Price Freshness**: Cards should be updated within 10 days
- **Job Success Rate**: Should be 95%+ for all jobs

---

## 🚀 Quick Start

1. **Deploy**: Files are already deployed
2. **Test**: Run `node backend/manual-jobs.js health-check`
3. **Monitor**: Check Railway dashboard for cron job logs
4. **Optimize**: Adjust schedules based on your needs

Your maintenance jobs are now ready to keep your database healthy and up-to-date! 🎉
