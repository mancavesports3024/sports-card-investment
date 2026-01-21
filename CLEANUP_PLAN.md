# Codebase Cleanup Plan

Based on automated analysis, **179 files** appear to be unused. This document outlines a safe, phased approach to cleanup.

## 📊 Analysis Results

- **Total JavaScript files**: 299
- **Unused files**: 179 (60%)
- **Used files**: 120 (40%)
- **Report generated**: See `backend/unused-code-report.json`

## ⚠️ Important Notes

1. **False Positives Possible**: The analysis may miss some dynamic imports or require patterns
2. **Manual Review Required**: Some "unused" files might be:
   - Called via API endpoints
   - Used in scheduled jobs
   - Manual utility scripts you run occasionally
3. **Backup First**: Create a git branch before deletion

## 🎯 Phase 1: Safe Deletions (High Confidence)

These are clearly test/debug/one-time fix scripts that are safe to delete:

### Test & Debug Scripts (60+ files)
```
test-*.js
debug-*.js
check-*.js
analyze-*.js
```

### One-Time Fix Scripts (50+ files)
```
fix-*.js
update-*.js
add-*.js
remove-*.js
migrate-*.js
```

### Unused Services
- `services/cardbaseService.js` - Duplicate of `getCardBaseService.js`
- `services/collectiblesCardDetailService.js` - Not imported anywhere

### Unused Scripts
- `scripts/buildEnhancedDatabase.js`
- `scripts/runDatabaseBuilder.js`

**Estimated files to delete in Phase 1**: ~150 files

## 🟡 Phase 2: Verification Needed

These need manual verification before deletion:

### Services That May Be Used
- `services/tcdbService.js` - Marked unused but might be used in routes (needs check)
- `services/checklistInsiderService.js` - Used in index.js line 967, verify if endpoint is active

### Maintenance Scripts
These might be called via API or scheduled:
- `railway-maintenance-job.js` - **USED** (imported by 4 files - KEEP)
- `automated-maintenance-job.js` - Check if used
- `fast-batch-pull-new-items.js` - **USED** (imported by 3 files - KEEP)

## ✅ Files to KEEP (Confirmed Used)

These are actively used and should NOT be deleted:
- `create-new-pricing-database.js` (used by 83 files!)
- `services/ebayScraperService.js` (24 files)
- `services/130pointService.js` (17 files)
- `generate-standardized-summary-titles-database-driven.js` (14 files)
- `ebay-price-updater.js` (11 files)
- `services/cacheService.js` (6 files)
- `services/ebayService.js` (4 files)
- All files in `routes/` directory
- All files in `services/` that are marked as used

## 🚀 Recommended Action Plan

### Step 1: Create Backup Branch
```bash
git checkout -b cleanup/unused-code
```

### Step 2: Delete Phase 1 Files (Safe)
Use the provided deletion script (see below)

### Step 3: Test After Deletion
1. Start the server
2. Test all major features:
   - Search functionality
   - Card set analysis
   - Release calendar
   - Admin endpoints
   - API routes

### Step 4: Manual Review of Phase 2
Review the remaining files manually before deletion

### Step 5: Commit Changes
```bash
git add .
git commit -m "Cleanup: Remove unused test/debug/fix scripts"
```

## 📝 Deletion Script

A safe deletion script is provided at `backend/scripts/safe-delete-unused.js`

**Usage**:
```bash
# Dry run (shows what would be deleted)
node backend/scripts/safe-delete-unused.js --dry-run

# Actual deletion
node backend/scripts/safe-delete-unused.js
```

## 🔍 Manual Verification Checklist

Before deleting Phase 2 files, verify:

- [ ] Check if `services/tcdbService.js` is used in routes (grep for it)
- [ ] Check if `checklistInsiderService` endpoint is actually called
- [ ] Review maintenance scripts - are they called via API?
- [ ] Check scheduled jobs - do they reference any of these files?

## 📈 Expected Impact

- **Code reduction**: ~60% of backend files
- **Maintainability**: Much easier to navigate codebase
- **Deployment**: Faster builds (fewer files to process)
- **Risk**: Low (for Phase 1), Medium (for Phase 2)

## ⚠️ Rollback Plan

If something breaks after deletion:
```bash
git checkout main
git branch -D cleanup/unused-code
```

Or restore specific files:
```bash
git checkout main -- path/to/file.js
```

