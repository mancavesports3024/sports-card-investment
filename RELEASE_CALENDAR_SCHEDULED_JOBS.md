# Release Calendar Scheduled Jobs

## ✅ Setup Complete

The release calendar scheduled jobs have been configured and will automatically run when the server starts.

## 📅 Scheduled Jobs

### 1. Daily Status Update
- **Schedule**: Every day at midnight (00:00) Central Time
- **Cron Expression**: `0 0 * * *`
- **What it does**:
  - Updates release statuses automatically based on dates
  - Marks past releases as "Released"
  - Marks upcoming releases (next 30 days) as "Upcoming"
  - Marks future releases as "Announced"
  - Clears cache to reflect new statuses

### 2. Weekly Scraper Sync
- **Schedule**: Every Sunday at 2:00 AM Central Time
- **Cron Expression**: `0 2 * * 0`
- **What it does**:
  - Scrapes latest releases from Bleacher Seats
  - Syncs new releases to the database
  - Updates statuses after syncing
  - Clears cache

### 3. Monthly Cleanup (Optional)
- **Schedule**: 1st of every month at 3:00 AM Central Time
- **Cron Expression**: `0 3 1 * *`
- **What it does**:
  - Identifies releases older than 1 year
  - Logs them for review
  - Currently just logs (archiving can be enabled later)

## 🔧 How It Works

1. **Automatic Start**: When the server starts, the scheduler automatically initializes all jobs
2. **Timezone**: All jobs run in Central Time (America/Chicago)
3. **Error Handling**: Each job has error handling and logs errors without crashing
4. **Manual Triggers**: Jobs can still be triggered manually via API endpoints

## 📍 Manual Triggers

You can manually trigger jobs via API endpoints:

```bash
# Update statuses
POST /api/releases/jobs/update-statuses

# Sync scraper
POST /api/releases/sync

# Run all jobs
POST /api/releases/jobs/run-all
```

## 🔍 Monitoring

Check server logs to see when jobs run:
- Look for `⏰ [Cron]` messages
- Success messages: `✅ [Scheduled Job]`
- Error messages: `❌ [Cron]`

## 🛠️ Configuration

The scheduler is configured in:
- **File**: `backend/services/releaseCalendarScheduler.js`
- **Integration**: `backend/index.js` (starts on server startup)

## 📝 Notes

- Jobs run in the same process as the web server
- If the server restarts, jobs will automatically restart
- All jobs use Central Time (America/Chicago) timezone
- Jobs are designed to be idempotent (safe to run multiple times)

## 🚀 Deployment

The scheduled jobs will automatically start when deployed to Railway. No additional configuration needed!

