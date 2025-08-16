# 🤖 Automated Title Fixer System

## Overview
The Automated Title Fixer is a comprehensive system that automatically detects and fixes issues with player names and summary titles in your ScoreCard database.

## Features

### ✅ What It Fixes
- **Player Name Issues:**
  - Empty player names
  - ALL CAPS player names
  - Very short player names (2 characters or less)

- **Summary Title Issues:**
  - Missing product names (Topps, Panini, etc.)
  - Missing player names in summary titles
  - Formatting issues

### 📊 Health Monitoring
- Real-time health score calculation
- Detailed issue reporting
- Before/after comparison

## Usage

### Command Line Interface

#### 1. Health Check
```bash
node backend/run-automated-fix.js health
```
**What it does:** Analyzes your database and reports the current health status.

**Output example:**
```
📊 HEALTH CHECK RESULTS:
- Total cards: 478
- Player name issues: 0
- Summary title issues: 2
- Total issues: 2
- Health score: 99.6%
✅ Database is in excellent health!
```

#### 2. Analysis Only
```bash
node backend/run-automated-fix.js analyze
```
**What it does:** Scans for issues without making any changes.

**Output example:**
```
📊 Analysis complete:
- Player name issues: 0
- Summary title issues: 2
- Total cards needing fixes: 2
```

#### 3. Full Automated Fix
```bash
node backend/run-automated-fix.js fix
```
**What it does:** Analyzes, fixes, and verifies all issues automatically.

**Output example:**
```
🎉 SUCCESS!
📊 Results: Automated fix completed successfully
📈 Improvement: 100%
🔧 Remaining issues: 0
```

### API Endpoints

#### Health Check API
```http
POST /api/admin/health-check
```
**Response:**
```json
{
  "success": true,
  "message": "Health check completed successfully",
  "health": {
    "totalCards": 478,
    "playerNameIssues": 0,
    "summaryTitleIssues": 2,
    "totalIssues": 2,
    "healthScore": "99.6"
  }
}
```

#### Automated Fix API
```http
POST /api/admin/run-automated-fix
```
**Response:**
```json
{
  "success": true,
  "message": "Automated fix completed successfully",
  "results": {
    "success": true,
    "message": "Automated fix completed successfully",
    "stats": {
      "playerNames": 0,
      "summaryTitles": 1,
      "totalCards": 478
    },
    "improvement": "100",
    "remainingIssues": 0
  }
}
```

## Health Score Categories

- **95%+ (Excellent):** ✅ Database is in excellent health!
- **90-94% (Good):** ⚠️ Database is in good health, minor issues detected
- **80-89% (Needs Attention):** ⚠️ Database needs attention, several issues detected
- **<80% (Critical):** ❌ Database needs immediate attention, many issues detected

## How It Works

### 1. Analysis Phase
- Scans all cards in the database
- Identifies player name issues (empty, ALL CAPS, too short)
- Identifies summary title issues (missing products, missing players)
- Calculates health score

### 2. Fix Phase
- **Player Names:** Calls the specific player name fix endpoint
- **Summary Titles:** Runs the summary title update process
- Applies fixes with proper error handling

### 3. Verification Phase
- Re-scans the database after fixes
- Calculates improvement percentage
- Reports final results

## Integration with Existing Systems

The Automated Title Fixer integrates seamlessly with your existing:
- ✅ Fast batch pull system
- ✅ Player name extraction
- ✅ Summary title generation
- ✅ Database management

## Best Practices

### When to Run
- **Daily:** Health check to monitor database health
- **After Fast Batch Pulls:** To fix any new issues from new cards
- **Weekly:** Full automated fix to maintain optimal health
- **Before Major Updates:** To ensure clean data

### Monitoring
- Track health score trends over time
- Monitor improvement percentages
- Set up alerts for health scores below 90%

## Troubleshooting

### Common Issues
1. **Timeout Errors:** Increase timeout values in the scripts
2. **Database Connection Issues:** Check Railway deployment status
3. **No Cards Found:** Database may be empty or reset

### Error Handling
- All operations include comprehensive error handling
- Failed fixes are logged but don't stop the process
- Health checks continue even if some operations fail

## Performance

- **Analysis:** ~5-10 seconds for 500 cards
- **Fixes:** ~10-30 seconds depending on number of issues
- **Verification:** ~5-10 seconds
- **Total Time:** Usually under 1 minute for full automated fix

## Future Enhancements

- Scheduled automatic runs
- Email notifications for health issues
- More detailed issue categorization
- Custom fix rules and patterns
- Integration with web interface

---

# 🤖 Automated Maintenance Job

## Overview
The Automated Maintenance Job is a comprehensive system that runs multiple maintenance tasks in sequence to keep your ScoreCard database fully optimized.

## What It Does

### 🔄 Complete Workflow
1. **Fast Batch Pull:** Searches for new PSA 10 cards using 130point service
2. **Health Check:** Analyzes database health and identifies issues
3. **Auto Fix:** Automatically fixes any player name or summary title issues
4. **Price Updates:** Updates prices for cards older than 10 days

### 📊 Smart Logic
- **Conditional Auto Fix:** Only runs auto fix if issues are detected
- **Smart Price Updates:** Only updates cards that haven't been updated in 10+ days
- **Comprehensive Reporting:** Detailed results for each step
- **Error Handling:** Continues even if individual steps fail

## Usage

### Command Line
```bash
# Run the complete maintenance job
node backend/run-maintenance-job.js

# Or run the class directly
node backend/automated-maintenance-job.js
```

### API Endpoint
```http
POST /api/admin/run-maintenance-job
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance job completed successfully",
  "results": {
    "success": true,
    "results": {
      "fastBatchPull": { "success": true, "newItems": 5, "errors": 0 },
      "healthCheck": { "success": true, "healthScore": 99.6, "totalIssues": 2 },
      "autoFix": { "success": true, "fixesApplied": 2, "improvement": 100 },
      "priceUpdates": { "success": true, "updated": 15, "errors": 0 },
      "totalDuration": 180
    }
  }
}
```

## Performance

- **Total Duration:** Usually 2-5 minutes
- **Fast Batch Pull:** 1-2 minutes
- **Health Check:** 5-10 seconds
- **Auto Fix:** 10-30 seconds
- **Price Updates:** 1-3 minutes

## Best Practices

### When to Run
- **Daily:** For active trading and monitoring
- **Weekly:** For regular maintenance
- **After Major Events:** New releases, market changes
- **Before Analysis:** Ensure data is current and clean

### Monitoring
- Track success rates over time
- Monitor duration trends
- Set up alerts for failed jobs
- Review detailed reports

---

**🎉 Your ScoreCard database is now protected by an intelligent automated fixer that keeps your data clean and consistent!**
