const fs = require('fs');
const path = require('path');

async function showAllDatabases() {
    console.log('🔍 Scanning for All Databases on Railway...\n');
    
    // Define all possible database locations
    const possiblePaths = [
        // Backend directory
        path.join(__dirname, 'data', 'new-scorecard.db'),
        path.join(__dirname, 'new-scorecard.db'),
        path.join(__dirname, 'data', 'comprehensive-card-database.db'),
        
        // Root directory
        path.join(process.cwd(), 'backend', 'data', 'new-scorecard.db'),
        path.join(process.cwd(), 'backend', 'new-scorecard.db'),
        path.join(process.cwd(), 'data', 'new-scorecard.db'),
        path.join(process.cwd(), 'new-scorecard.db'),
        
        // Railway volume mount path
        process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'new-scorecard.db') : null,
        process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'comprehensive-card-database.db') : null
    ].filter(Boolean); // Remove null values
    
    console.log('📁 Current working directory:', process.cwd());
    console.log('📁 __dirname:', __dirname);
    if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
        console.log('📁 RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH);
    }
    console.log('');
    
    const foundDatabases = [];
    
    for (const dbPath of possiblePaths) {
        try {
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                const sizeInKB = (stats.size / 1024).toFixed(2);
                
                foundDatabases.push({
                    path: dbPath,
                    size: stats.size,
                    sizeInMB: sizeInMB,
                    sizeInKB: sizeInKB,
                    lastModified: stats.mtime
                });
                
                console.log(`✅ FOUND: ${dbPath}`);
                console.log(`   Size: ${sizeInMB} MB (${sizeInKB} KB)`);
                console.log(`   Last Modified: ${stats.mtime.toISOString()}`);
                
                // Try to check if it's a valid SQLite database
                try {
                    const sqlite3 = require('sqlite3').verbose();
                    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                        if (err) {
                            console.log(`   ❌ Not a valid SQLite database: ${err.message}`);
                        } else {
                            console.log(`   ✅ Valid SQLite database`);
                            
                            // Check tables
                            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                                if (err) {
                                    console.log(`   ❌ Error reading tables: ${err.message}`);
                                } else {
                                    console.log(`   📋 Tables: ${tables.map(t => t.name).join(', ')}`);
                                    
                                    // Check cards table if it exists
                                    const cardsTable = tables.find(t => t.name === 'cards');
                                    if (cardsTable) {
                                        db.get('SELECT COUNT(*) as count FROM cards', (err, result) => {
                                            if (err) {
                                                console.log(`   ❌ Error counting cards: ${err.message}`);
                                            } else {
                                                console.log(`   📊 Cards in database: ${result.count}`);
                                            }
                                            db.close();
                                        });
                                    } else {
                                        console.log(`   📊 No cards table found`);
                                        db.close();
                                    }
                                }
                            });
                        }
                    });
                } catch (error) {
                    console.log(`   ❌ Error checking SQLite: ${error.message}`);
                }
                console.log('');
            } else {
                console.log(`❌ NOT FOUND: ${dbPath}`);
            }
        } catch (error) {
            console.log(`❌ ERROR checking ${dbPath}: ${error.message}`);
        }
    }
    
    console.log('📊 SUMMARY:');
    console.log(`   Total databases found: ${foundDatabases.length}`);
    
    if (foundDatabases.length > 0) {
        console.log('\n📋 All Found Databases:');
        foundDatabases.forEach((db, index) => {
            console.log(`   ${index + 1}. ${db.path}`);
            console.log(`      Size: ${db.sizeInMB} MB`);
            console.log(`      Modified: ${db.lastModified.toISOString()}`);
        });
    } else {
        console.log('   No databases found in any expected location');
    }
}

showAllDatabases().catch(error => {
    console.error('❌ Script failed:', error);
});

