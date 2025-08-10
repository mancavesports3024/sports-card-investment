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
      console.log(`📁 Database path: ${this.dbPath}`);

      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        console.log(`📁 Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Remove existing database file if it exists
      if (fs.existsSync(this.dbPath)) {
        console.log(`🗑️ Removing existing database file: ${this.dbPath}`);
        fs.unlinkSync(this.dbPath);
      }

      // Create database and tables
      await this.createTables();

      // Create enhanced sport detection data
      await this.createEnhancedSportData();

      // Verify file was created
      if (fs.existsSync(this.dbPath)) {
        console.log(`✅ Database file created successfully: ${this.dbPath}`);
        const stats = fs.statSync(this.dbPath);
        console.log(`📊 File size: ${stats.size} bytes`);
      } else {
        throw new Error(`Database file was not created at ${this.dbPath}`);
      }

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
      console.log('📋 Creating database tables...');
      
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err);
          reject(err);
          return;
        }
        console.log('✅ Database opened successfully');
      });

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
            db.close();
            reject(err);
          } else {
            console.log('✅ Tables created successfully');
            db.close((err) => {
              if (err) {
                console.error('❌ Error closing database:', err);
                reject(err);
              } else {
                console.log('✅ Database closed successfully');
                resolve();
              }
            });
          }
        });
      });
    });
  }

  createEnhancedSportData() {
    return new Promise((resolve, reject) => {
      console.log('📊 Inserting enhanced sport data...');
      
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database for data insertion:', err);
          reject(err);
          return;
        }
      });

      // Enhanced sport detection data with proper searchText formatting
      const enhancedData = [
        // Football - Panini Donruss
        { name: 'Panini Donruss Football', sport: 'Football', year: '2010', brand: 'Panini', setName: 'Donruss', searchText: 'panini donruss football', displayName: 'Panini Donruss Football' },
        { name: 'Panini Donruss Optic Football', sport: 'Football', year: '2016', brand: 'Panini', setName: 'Donruss Optic', searchText: 'panini donruss optic football', displayName: 'Panini Donruss Optic Football' },
        { name: 'Panini Prizm Football', sport: 'Football', year: '2012', brand: 'Panini', setName: 'Prizm', searchText: 'panini prizm football', displayName: 'Panini Prizm Football' },
        { name: 'Panini Select Football', sport: 'Football', year: '2013', brand: 'Panini', setName: 'Select', searchText: 'panini select football', displayName: 'Panini Select Football' },
        { name: 'Panini Mosaic Football', sport: 'Football', year: '2020', brand: 'Panini', setName: 'Mosaic', searchText: 'panini mosaic football', displayName: 'Panini Mosaic Football' },
        
        // Basketball - Various brands
        { name: 'Skybox Basketball', sport: 'Basketball', year: '1990', brand: 'Skybox', setName: 'Skybox', searchText: 'skybox basketball', displayName: 'Skybox Basketball' },
        { name: 'Upper Deck Basketball', sport: 'Basketball', year: '1990', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck basketball', displayName: 'Upper Deck Basketball' },
        { name: 'Topps Chrome Basketball', sport: 'Basketball', year: '1997', brand: 'Topps', setName: 'Chrome', searchText: 'topps chrome basketball', displayName: 'Topps Chrome Basketball' },
        { name: 'Panini Prizm Basketball', sport: 'Basketball', year: '2012', brand: 'Panini', setName: 'Prizm', searchText: 'panini prizm basketball', displayName: 'Panini Prizm Basketball' },
        { name: 'Panini Select Basketball', sport: 'Basketball', year: '2013', brand: 'Panini', setName: 'Select', searchText: 'panini select basketball', displayName: 'Panini Select Basketball' },
        
        // Baseball - Topps
        { name: 'Topps Baseball', sport: 'Baseball', year: '1952', brand: 'Topps', setName: 'Topps', searchText: 'topps baseball', displayName: 'Topps Baseball' },
        { name: 'Topps Chrome Baseball', sport: 'Baseball', year: '1997', brand: 'Topps', setName: 'Chrome', searchText: 'topps chrome baseball', displayName: 'Topps Chrome Baseball' },
        { name: 'Topps Heritage Baseball', sport: 'Baseball', year: '2001', brand: 'Topps', setName: 'Heritage', searchText: 'topps heritage baseball', displayName: 'Topps Heritage Baseball' },
        { name: 'Topps Stadium Club Baseball', sport: 'Baseball', year: '1991', brand: 'Topps', setName: 'Stadium Club', searchText: 'topps stadium club baseball', displayName: 'Topps Stadium Club Baseball' },
        { name: 'Topps Allen & Ginter Baseball', sport: 'Baseball', year: '2006', brand: 'Topps', setName: 'Allen & Ginter', searchText: 'topps allen ginter baseball', displayName: 'Topps Allen & Ginter Baseball' },
        
        // Pokemon
        { name: 'Pokemon Base Set', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Base Set', searchText: 'pokemon base set', displayName: 'Pokemon Base Set' },
        { name: 'Pokemon Jungle', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Jungle', searchText: 'pokemon jungle', displayName: 'Pokemon Jungle' },
        { name: 'Pokemon Fossil', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Fossil', searchText: 'pokemon fossil', displayName: 'Pokemon Fossil' },
        { name: 'Pokemon Team Rocket', sport: 'Pokemon', year: '2000', brand: 'Wizards of the Coast', setName: 'Team Rocket', searchText: 'pokemon team rocket', displayName: 'Pokemon Team Rocket' },
        { name: 'Pokemon Gym Heroes', sport: 'Pokemon', year: '2000', brand: 'Wizards of the Coast', setName: 'Gym Heroes', searchText: 'pokemon gym heroes', displayName: 'Pokemon Gym Heroes' },
        
        // Hockey
        { name: 'Upper Deck Hockey', sport: 'Hockey', year: '1990', brand: 'Upper Deck', setName: 'Upper Deck', searchText: 'upper deck hockey', displayName: 'Upper Deck Hockey' },
        { name: 'Topps Hockey', sport: 'Hockey', year: '1954', brand: 'Topps', setName: 'Topps', searchText: 'topps hockey', displayName: 'Topps Hockey' },
        { name: 'O-Pee-Chee Hockey', sport: 'Hockey', year: '1933', brand: 'O-Pee-Chee', setName: 'O-Pee-Chee', searchText: 'o-pee-chee hockey', displayName: 'O-Pee-Chee Hockey' },
        
        // Soccer
        { name: 'Topps Soccer', sport: 'Soccer', year: '1954', brand: 'Topps', setName: 'Topps', searchText: 'topps soccer', displayName: 'Topps Soccer' },
        { name: 'Panini Soccer', sport: 'Soccer', year: '2010', brand: 'Panini', setName: 'Panini', searchText: 'panini soccer', displayName: 'Panini Soccer' }
      ];

      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sets
          (name, sport, year, brand, setName, source, searchText, displayName)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = enhancedData.length;

        enhancedData.forEach((set, index) => {
          stmt.run([
            set.name,
            set.sport,
            set.year,
            set.brand,
            set.setName,
            'enhanced',
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
                  db.close();
                  reject(err);
                } else {
                  console.log('✅ Enhanced sport data inserted successfully');
                  db.close((err) => {
                    if (err) {
                      console.error('❌ Error closing database:', err);
                      reject(err);
                    } else {
                      console.log('✅ Database closed successfully after data insertion');
                      resolve();
                    }
                  });
                }
              });
            }
          });
        });
      });
    });
  }

  getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database for stats:', err);
          reject(err);
          return;
        }
      });

      db.get('SELECT COUNT(*) as count FROM sets', (err, row) => {
        if (err) {
          db.close();
          reject(err);
        } else {
          const stats = fs.statSync(this.dbPath);
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database for stats:', err);
            }
            resolve({
              count: row.count,
              size: stats.size
            });
          });
        }
      });
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
