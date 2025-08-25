const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Added missing import for fs

console.log('🔍 Checking all databases...\n');

// Check comprehensive database
const comprehensivePath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
console.log('📚 Comprehensive Database:');
if (fs.existsSync(comprehensivePath)) {
    const db = new sqlite3.Database(comprehensivePath);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('  ❌ Error:', err.message);
        } else {
            console.log('  📋 Tables:', tables.map(t => t.name).join(', '));
            
            // Check sets table
            if (tables.some(t => t.name === 'sets')) {
                db.get("SELECT COUNT(*) as count FROM sets", [], (err, row) => {
                    if (err) {
                        console.error('  ❌ Error getting sets count:', err.message);
                    } else {
                        console.log(`  📊 Sets count: ${row.count}`);
                    }
                    db.close();
                });
            } else {
                console.log('  ⚠️  No sets table found');
                db.close();
            }
        }
    });
} else {
    console.log('  ❌ Database file not found');
}

// Check new-scorecard database
const scorecardPath = path.join(__dirname, 'data', 'new-scorecard.db');
console.log('\n📊 New Scorecard Database:');
if (fs.existsSync(scorecardPath)) {
    const db = new sqlite3.Database(scorecardPath);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('  ❌ Error:', err.message);
        } else {
            console.log('  📋 Tables:', tables.map(t => t.name).join(', '));
            
            // Check cards table
            if (tables.some(t => t.name === 'cards')) {
                db.get("SELECT COUNT(*) as count FROM cards", [], (err, row) => {
                    if (err) {
                        console.error('  ❌ Error getting cards count:', err.message);
                    } else {
                        console.log(`  📊 Cards count: ${row.count}`);
                    }
                    db.close();
                });
            } else {
                console.log('  ⚠️  No cards table found');
                db.close();
            }
        }
    });
} else {
    console.log('  ❌ Database file not found');
}

// Check parallels database
const parallelsPath = path.join(__dirname, 'data', 'parallels-database.db');
console.log('\n🔄 Parallels Database:');
if (fs.existsSync(parallelsPath)) {
    const db = new sqlite3.Database(parallelsPath);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('  ❌ Error:', err.message);
        } else {
            console.log('  📋 Tables:', tables.map(t => t.name).join(', '));
            
            // Check card_sets table
            if (tables.some(t => t.name === 'card_sets')) {
                db.get("SELECT COUNT(*) as count FROM card_sets", [], (err, row) => {
                    if (err) {
                        console.error('  ❌ Error getting card_sets count:', err.message);
                    } else {
                        console.log(`  📊 Card sets count: ${row.count}`);
                    }
                    db.close();
                });
            } else {
                console.log('  ⚠️  No card_sets table found');
                db.close();
            }
        }
    });
} else {
    console.log('  ❌ Database file not found');
}
