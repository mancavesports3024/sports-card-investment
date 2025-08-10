const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class ComprehensiveDatabaseRecreator {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
    this.jsonPath = path.join(__dirname, 'data', 'comprehensiveCardDatabase.json');
  }

  async recreateDatabase() {
    try {
      console.log('🔄 Starting comprehensive database recreation on Railway...');
      
      // Check if JSON file exists
      if (!fs.existsSync(this.jsonPath)) {
        throw new Error(`JSON file not found: ${this.jsonPath}`);
      }

      console.log('📖 Reading JSON data...');
      const jsonData = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      const sets = jsonData.sets || jsonData;

      console.log(`📊 Found ${sets.length} sets to import`);

      // Create database and tables
      await this.createTables();

      // Insert data
      await this.insertData(sets);

      // Get final stats
      const stats = await this.getDatabaseStats();
      
      console.log('✅ Comprehensive database recreation completed!');
      console.log(`📈 Final stats: ${stats.count} sets, ${stats.size} bytes`);
      
      return stats;

    } catch (error) {
      console.error('❌ Error recreating comprehensive database:', error);
      throw error;
    }
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          sport TEXT,
          year TEXT,
          brand TEXT,
          setName TEXT,
          source TEXT,
          searchText TEXT,
          displayName TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('❌ Error creating tables:', err);
            reject(err);
          } else {
            console.log('✅ Tables created successfully');
            resolve();
          }
        });
      });

      db.close();
    });
  }

  insertData(sets) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sets 
          (name, sport, year, brand, setName, source, searchText, displayName) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = sets.length;

        sets.forEach((set, index) => {
          stmt.run([
            set.name || '',
            set.sport || '',
            set.year || '',
            set.brand || '',
            set.setName || '',
            set.source || '',
            set.searchText || '',
            set.displayName || ''
          ], (err) => {
            if (err) {
              console.error(`❌ Error inserting set ${index}:`, err);
            }
            
            completed++;
            if (completed % 1000 === 0) {
              console.log(`📊 Progress: ${completed}/${total} sets processed`);
            }
            
            if (completed === total) {
              stmt.finalize((err) => {
                if (err) {
                  console.error('❌ Error finalizing statement:', err);
                  reject(err);
                } else {
                  console.log('✅ All data inserted successfully');
                  resolve();
                }
              });
            }
          });
        });
      });

      db.close();
    });
  }

  getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get('SELECT COUNT(*) as count FROM sets', (err, row) => {
        if (err) {
          reject(err);
        } else {
          const stats = fs.statSync(this.dbPath);
          resolve({
            count: row.count,
            size: stats.size
          });
        }
      });

      db.close();
    });
  }
}

// Export for use in other files
module.exports = ComprehensiveDatabaseRecreator;

// If run directly, execute the recreation
if (require.main === module) {
  const recreator = new ComprehensiveDatabaseRecreator();
  recreator.recreateDatabase()
    .then(stats => {
      console.log('🎉 Comprehensive database recreation completed successfully!');
      console.log('Final stats:', stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed to recreate comprehensive database:', error);
      process.exit(1);
    });
}
