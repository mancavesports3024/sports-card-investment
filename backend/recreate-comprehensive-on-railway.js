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

      // Create database and tables
      await this.createTables();

      // Create minimal sport detection data instead of full JSON import
      await this.createMinimalSportData();

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

  createMinimalSportData() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);

      // Create minimal sport detection data for common card types
      const minimalData = [
        // Baseball
        { name: 'Topps Baseball', sport: 'Baseball', year: '1952', brand: 'Topps', setName: 'Topps', searchText: 'topps baseball', displayName: 'Topps Baseball' },
        { name: 'Bowman Baseball', sport: 'Baseball', year: '1948', brand: 'Bowman', setName: 'Bowman', searchText: 'bowman baseball', displayName: 'Bowman Baseball' },
        { name: 'Donruss Baseball', sport: 'Baseball', year: '1981', brand: 'Donruss', setName: 'Donruss', searchText: 'donruss baseball', displayName: 'Donruss Baseball' },
        { name: 'Fleer Baseball', sport: 'Baseball', year: '1981', brand: 'Fleer', setName: 'Fleer', searchText: 'fleer baseball', displayName: 'Fleer Baseball' },
        { name: 'Upper Deck Baseball', sport: 'Baseball', year: '1989', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck baseball', displayName: 'Upper Deck Baseball' },
        { name: 'Panini Baseball', sport: 'Baseball', year: '2010', brand: 'Panini', setName: 'Panini', searchText: 'panini baseball', displayName: 'Panini Baseball' },

        // Football
        { name: 'Topps Football', sport: 'Football', year: '1955', brand: 'Topps', setName: 'Topps', searchText: 'topps football', displayName: 'Topps Football' },
        { name: 'Bowman Football', sport: 'Football', year: '1950', brand: 'Bowman', setName: 'Bowman', searchText: 'bowman football', displayName: 'Bowman Football' },
        { name: 'Donruss Football', sport: 'Football', year: '1984', brand: 'Donruss', setName: 'Donruss', searchText: 'donruss football', displayName: 'Donruss Football' },
        { name: 'Fleer Football', sport: 'Football', year: '1984', brand: 'Fleer', setName: 'Fleer', searchText: 'fleer football', displayName: 'Fleer Football' },
        { name: 'Upper Deck Football', sport: 'Football', year: '1990', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck football', displayName: 'Upper Deck Football' },
        { name: 'Panini Football', sport: 'Football', year: '2010', brand: 'Panini', setName: 'Panini', searchText: 'panini football', displayName: 'Panini Football' },

        // Basketball
        { name: 'Topps Basketball', sport: 'Basketball', year: '1957', brand: 'Topps', setName: 'Topps', searchText: 'topps basketball', displayName: 'Topps Basketball' },
        { name: 'Fleer Basketball', sport: 'Basketball', year: '1986', brand: 'Fleer', setName: 'Fleer', searchText: 'fleer basketball', displayName: 'Fleer Basketball' },
        { name: 'Upper Deck Basketball', sport: 'Basketball', year: '1990', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck basketball', displayName: 'Upper Deck Basketball' },
        { name: 'Panini Basketball', sport: 'Basketball', year: '2009', brand: 'Panini', setName: 'Panini', searchText: 'panini basketball', displayName: 'Panini Basketball' },

        // Hockey
        { name: 'Topps Hockey', sport: 'Hockey', year: '1954', brand: 'Topps', setName: 'Topps', searchText: 'topps hockey', displayName: 'Topps Hockey' },
        { name: 'O-Pee-Chee Hockey', sport: 'Hockey', year: '1933', brand: 'O-Pee-Chee', setName: 'O-Pee-Chee', searchText: 'o-pee-chee hockey', displayName: 'O-Pee-Chee Hockey' },
        { name: 'Upper Deck Hockey', sport: 'Hockey', year: '1990', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck hockey', displayName: 'Upper Deck Hockey' },

        // Pokemon
        { name: 'Pokemon Base Set', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Base Set', searchText: 'pokemon base set', displayName: 'Pokemon Base Set' },
        { name: 'Pokemon Jungle', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Jungle', searchText: 'pokemon jungle', displayName: 'Pokemon Jungle' },
        { name: 'Pokemon Fossil', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Fossil', searchText: 'pokemon fossil', displayName: 'Pokemon Fossil' }
      ];

      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sets
          (name, sport, year, brand, setName, source, searchText, displayName)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = minimalData.length;

        minimalData.forEach((set, index) => {
          stmt.run([
            set.name,
            set.sport,
            set.year,
            set.brand,
            set.setName,
            'minimal',
            set.searchText,
            set.displayName
          ], (err) => {
            if (err) {
              console.error(`❌ Error inserting set ${index}:`, err);
            }

            completed++;
            if (completed % 5 === 0) {
              console.log(`📊 Progress: ${completed}/${total} sets processed`);
            }

            if (completed === total) {
              stmt.finalize((err) => {
                if (err) {
                  console.error('❌ Error finalizing statement:', err);
                  reject(err);
                } else {
                  console.log('✅ Minimal sport data inserted successfully');
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
