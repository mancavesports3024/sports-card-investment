@echo off
echo Database Update Tools
echo ====================
echo.

if "%1"=="quick" (
    echo Running Quick Update...
    node database-updater.js --quick
) else if "%1"=="full" (
    echo Running Full Update...
    node database-updater.js --full
) else if "%1"=="start" (
    echo Starting Scheduled Updater...
    node scheduled-updater.js --start
) else if "%1"=="status" (
    echo Checking Status...
    node database-monitor.js
) else if "%1"=="health" (
    echo Checking System Health...
    node database-monitor.js --health
) else (
    echo Usage:
    echo   update-database.bat quick   - Quick update (new items only)
    echo   update-database.bat full    - Full update (everything)
    echo   update-database.bat start   - Start scheduled updater
    echo   update-database.bat status  - Show database status
    echo   update-database.bat health  - Show system health
    echo.
    echo Examples:
    echo   update-database.bat quick
    echo   update-database.bat full
    echo   update-database.bat status
) 