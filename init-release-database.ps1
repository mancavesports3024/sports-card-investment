# Initialize and migrate release calendar database
$baseUrl = "https://web-production-9efa.up.railway.app"

Write-Host "🚀 Initializing release calendar database..." -ForegroundColor Cyan

# Step 1: Initialize database tables
Write-Host "`n📋 Step 1: Creating database tables..." -ForegroundColor Yellow
try {
    $initResponse = Invoke-WebRequest -Uri "$baseUrl/api/releases/init" -Method POST -UseBasicParsing
    $initResult = $initResponse.Content | ConvertFrom-Json
    
    if ($initResult.success) {
        Write-Host "✅ Database tables created successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create tables: $($initResult.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error initializing database: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

# Wait a moment for tables to be ready
Write-Host "`n⏳ Waiting 2 seconds for tables to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Step 2: Run migration
Write-Host "`n📦 Step 2: Migrating existing releases to database..." -ForegroundColor Yellow
Write-Host "⚠️  Note: This requires admin authentication. If it fails, you may need to run migration manually." -ForegroundColor Yellow

try {
    $migrateResponse = Invoke-WebRequest -Uri "$baseUrl/api/releases/migrate" -Method POST -UseBasicParsing
    $migrateResult = $migrateResponse.Content | ConvertFrom-Json
    
    if ($migrateResult.success) {
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed: $($migrateResult.error)" -ForegroundColor Red
        Write-Host "You may need to authenticate or run migration manually." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error running migration: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This is likely due to authentication. You may need to:" -ForegroundColor Yellow
    Write-Host "  1. Log in to your app first" -ForegroundColor Yellow
    Write-Host "  2. Or run the migration via Railway console" -ForegroundColor Yellow
    Write-Host "  3. Or use: node backend/scripts/migrate-releases-to-database.js" -ForegroundColor Yellow
}

Write-Host "`n✅ Script completed!" -ForegroundColor Green

