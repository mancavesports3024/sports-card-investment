const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class EnhancedComprehensiveDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'comprehensive-card-database.db');
  }

  async enhanceDatabase() {
    try {
      console.log('🚀 Starting comprehensive database enhancement...');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create database and tables
      await this.createTables();
      
      // Add extensive set data
      await this.addExtensiveSetData();
      
      // Add individual card data
      await this.addIndividualCardData();
      
      // Add other collectibles
      await this.addOtherCollectibles();
      
      const stats = await this.getDatabaseStats();
      console.log('✅ Database enhancement completed!');
      console.log(`📈 Final stats: ${stats.sets} sets, ${stats.cards} cards, ${stats.size} bytes`);
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error enhancing database:', error);
      throw error;
    }
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
      });

      db.serialize(() => {
        // Enhanced sets table
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
            db.close();
            reject(err);
          }
        });

        // Individual cards table
        db.run(`CREATE TABLE IF NOT EXISTS cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          sport TEXT,
          year TEXT,
          brand TEXT,
          setName TEXT,
          cardNumber TEXT,
          playerName TEXT,
          searchText TEXT,
          displayName TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            db.close();
            reject(err);
          } else {
            db.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          }
        });
      });
    });
  }

  addExtensiveSetData() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      const extensiveSets = [
        // Football - Panini (2010-2024)
        ...this.generateFootballSets(),
        
        // Basketball - Various brands (1990-2024)
        ...this.generateBasketballSets(),
        
        // Baseball - Topps/Bowman (1952-2024)
        ...this.generateBaseballSets(),
        
        // Pokemon (1999-2024)
        ...this.generatePokemonSets(),
        
        // Hockey (1990-2024)
        ...this.generateHockeySets(),
        
        // Soccer (1990-2024)
        ...this.generateSoccerSets(),
        
        // Other Collectibles
        ...this.generateOtherCollectibles()
      ];

      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sets
          (name, sport, year, brand, setName, source, searchText, displayName)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = extensiveSets.length;

        extensiveSets.forEach((set, index) => {
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
            if (err) console.error(`❌ Error inserting set ${index}:`, err);
            
            completed++;
            if (completed % 50 === 0) {
              console.log(`📊 Progress: ${completed}/${total} sets processed`);
            }
            
            if (completed === total) {
              stmt.finalize((err) => {
                if (err) {
                  db.close();
                  reject(err);
                } else {
                  db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }
              });
            }
          });
        });
      });
    });
  }

  generateFootballSets() {
    const sets = [];
    const years = ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
    
    // Panini Donruss
    years.forEach(year => {
      sets.push({
        name: `Panini Donruss Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Donruss',
        searchText: `panini donruss football ${year}`,
        displayName: `Panini Donruss Football ${year}`
      });
      sets.push({
        name: `Donruss Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Donruss',
        searchText: `donruss football ${year}`,
        displayName: `Donruss Football ${year}`
      });
    });

    // Panini Prizm (2012-2024)
    ['2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Prizm Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Prizm',
        searchText: `panini prizm football ${year}`,
        displayName: `Panini Prizm Football ${year}`
      });
      sets.push({
        name: `Prizm Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Prizm',
        searchText: `prizm football ${year}`,
        displayName: `Prizm Football ${year}`
      });
    });

    // Panini Prizm DP (Draft Picks) - Football (2021-2024)
    ['2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Prizm DP Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Prizm DP',
        searchText: `panini prizm dp football ${year}`,
        displayName: `Panini Prizm DP Football ${year}`
      });
      sets.push({
        name: `Prizm DP Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Prizm DP',
        searchText: `prizm dp football ${year}`,
        displayName: `Prizm DP Football ${year}`
      });
    });

    // Panini Select (2013-2024)
    ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Select Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Select',
        searchText: `panini select football ${year}`,
        displayName: `Panini Select Football ${year}`
      });
    });

    // Panini Mosaic (2020-2024)
    ['2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Mosaic Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Mosaic',
        searchText: `panini mosaic football ${year}`,
        displayName: `Panini Mosaic Football ${year}`
      });
    });

    // Panini Obsidian (2020-2024)
    ['2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Obsidian Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Obsidian',
        searchText: `panini obsidian football ${year}`,
        displayName: `Panini Obsidian Football ${year}`
      });
      sets.push({
        name: `Obsidian Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Panini',
        setName: 'Obsidian',
        searchText: `obsidian football ${year}`,
        displayName: `Obsidian Football ${year}`
      });
    });

    // Topps Chrome (1997-2024)
    ['1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Chrome Football ${year}`,
        sport: 'Football',
        year: year,
        brand: 'Topps',
        setName: 'Chrome',
        searchText: `topps chrome football ${year}`,
        displayName: `Topps Chrome Football ${year}`
      });
    });

    return sets;
  }

  generateBasketballSets() {
    const sets = [];
    
    // Panini Prizm (2012-2024)
    ['2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Prizm Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Panini',
        setName: 'Prizm',
        searchText: `panini prizm basketball ${year}`,
        displayName: `Panini Prizm Basketball ${year}`
      });
    });

    // Panini Prizm DP (Draft Picks) - Basketball (2021-2024)
    ['2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Prizm DP Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Panini',
        setName: 'Prizm DP',
        searchText: `panini prizm dp basketball ${year}`,
        displayName: `Panini Prizm DP Basketball ${year}`
      });
      sets.push({
        name: `Prizm DP Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Panini',
        setName: 'Prizm DP',
        searchText: `prizm dp basketball ${year}`,
        displayName: `Prizm DP Basketball ${year}`
      });
    });

    // Panini Select (2013-2024)
    ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Select Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Panini',
        setName: 'Select',
        searchText: `panini select basketball ${year}`,
        displayName: `Panini Select Basketball ${year}`
      });
    });

    // Topps Chrome (1997-2010)
    ['1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010'].forEach(year => {
      sets.push({
        name: `Topps Chrome Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Topps',
        setName: 'Chrome',
        searchText: `topps chrome basketball ${year}`,
        displayName: `Topps Chrome Basketball ${year}`
      });
    });

    // Upper Deck (1990-2010)
    ['1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010'].forEach(year => {
      sets.push({
        name: `Upper Deck Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Upper Deck',
        setName: 'Upper Deck',
        searchText: `upper deck basketball ${year}`,
        displayName: `Upper Deck Basketball ${year}`
      });
    });

    // Upper Deck Synergy (2020-2024)
    ['2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Upper Deck Synergy Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Upper Deck',
        setName: 'Synergy',
        searchText: `upper deck synergy basketball ${year}`,
        displayName: `Upper Deck Synergy Basketball ${year}`
      });
      sets.push({
        name: `Synergy Basketball ${year}`,
        sport: 'Basketball',
        year: year,
        brand: 'Upper Deck',
        setName: 'Synergy',
        searchText: `synergy basketball ${year}`,
        displayName: `Synergy Basketball ${year}`
      });
    });

    return sets;
  }

  generateBaseballSets() {
    const sets = [];
    
    // Topps (1952-2024)
    ['1952', '1953', '1954', '1955', '1956', '1957', '1958', '1959', '1960', '1961', '1962', '1963', '1964', '1965', '1966', '1967', '1968', '1969', '1970', '1971', '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Baseball ${year}`,
        sport: 'Baseball',
        year: year,
        brand: 'Topps',
        setName: 'Topps',
        searchText: `topps baseball ${year}`,
        displayName: `Topps Baseball ${year}`
      });
    });

    // Topps Chrome (1997-2024)
    ['1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Chrome Baseball ${year}`,
        sport: 'Baseball',
        year: year,
        brand: 'Topps',
        setName: 'Chrome',
        searchText: `topps chrome baseball ${year}`,
        displayName: `Topps Chrome Baseball ${year}`
      });
    });

    // Topps Heritage (2001-2024)
    ['2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Heritage Baseball ${year}`,
        sport: 'Baseball',
        year: year,
        brand: 'Topps',
        setName: 'Heritage',
        searchText: `topps heritage baseball ${year}`,
        displayName: `Topps Heritage Baseball ${year}`
      });
    });

    // Bowman (1989-2024)
    ['1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Bowman Baseball ${year}`,
        sport: 'Baseball',
        year: year,
        brand: 'Bowman',
        setName: 'Bowman',
        searchText: `bowman baseball ${year}`,
        displayName: `Bowman Baseball ${year}`
      });
    });

    return sets;
  }

  generatePokemonSets() {
    const sets = [];
    
    // Classic Pokemon sets
    const pokemonSets = [
      { name: 'Pokemon Base Set', year: '1999', searchText: 'pokemon base set' },
      { name: 'Pokemon Jungle', year: '1999', searchText: 'pokemon jungle' },
      { name: 'Pokemon Fossil', year: '1999', searchText: 'pokemon fossil' },
      { name: 'Pokemon Team Rocket', year: '2000', searchText: 'pokemon team rocket' },
      { name: 'Pokemon Gym Heroes', year: '2000', searchText: 'pokemon gym heroes' },
      { name: 'Pokemon Gym Challenge', year: '2000', searchText: 'pokemon gym challenge' },
      { name: 'Pokemon Neo Genesis', year: '2000', searchText: 'pokemon neo genesis' },
      { name: 'Pokemon Neo Discovery', year: '2001', searchText: 'pokemon neo discovery' },
      { name: 'Pokemon Neo Revelation', year: '2001', searchText: 'pokemon neo revelation' },
      { name: 'Pokemon Neo Destiny', year: '2002', searchText: 'pokemon neo destiny' },
      { name: 'Pokemon Legendary Collection', year: '2002', searchText: 'pokemon legendary collection' },
      { name: 'Pokemon Expedition Base Set', year: '2002', searchText: 'pokemon expedition base set' },
      { name: 'Pokemon Aquapolis', year: '2003', searchText: 'pokemon aquapolis' },
      { name: 'Pokemon Skyridge', year: '2003', searchText: 'pokemon skyridge' },
      { name: 'Pokemon EX Ruby & Sapphire', year: '2003', searchText: 'pokemon ex ruby sapphire' },
      { name: 'Pokemon EX Sandstorm', year: '2003', searchText: 'pokemon ex sandstorm' },
      { name: 'Pokemon EX Dragon', year: '2003', searchText: 'pokemon ex dragon' },
      { name: 'Pokemon EX Team Magma vs Team Aqua', year: '2004', searchText: 'pokemon ex team magma aqua' },
      { name: 'Pokemon EX Hidden Legends', year: '2004', searchText: 'pokemon ex hidden legends' },
      { name: 'Pokemon EX FireRed & LeafGreen', year: '2004', searchText: 'pokemon ex firered leafgreen' },
      { name: 'Pokemon EX Team Rocket Returns', year: '2004', searchText: 'pokemon ex team rocket returns' },
      { name: 'Pokemon EX Deoxys', year: '2005', searchText: 'pokemon ex deoxys' },
      { name: 'Pokemon EX Emerald', year: '2005', searchText: 'pokemon ex emerald' },
      { name: 'Pokemon EX Unseen Forces', year: '2005', searchText: 'pokemon ex unseen forces' },
      { name: 'Pokemon EX Delta Species', year: '2005', searchText: 'pokemon ex delta species' },
      { name: 'Pokemon EX Legend Maker', year: '2006', searchText: 'pokemon ex legend maker' },
      { name: 'Pokemon EX Holon Phantoms', year: '2006', searchText: 'pokemon ex holon phantoms' },
      { name: 'Pokemon EX Crystal Guardians', year: '2006', searchText: 'pokemon ex crystal guardians' },
      { name: 'Pokemon EX Dragon Frontiers', year: '2006', searchText: 'pokemon ex dragon frontiers' },
      { name: 'Pokemon EX Power Keepers', year: '2007', searchText: 'pokemon ex power keepers' },
      { name: 'Pokemon Diamond & Pearl', year: '2007', searchText: 'pokemon diamond pearl' },
      { name: 'Pokemon Mysterious Treasures', year: '2007', searchText: 'pokemon mysterious treasures' },
      { name: 'Pokemon Secret Wonders', year: '2007', searchText: 'pokemon secret wonders' },
      { name: 'Pokemon Great Encounters', year: '2008', searchText: 'pokemon great encounters' },
      { name: 'Pokemon Majestic Dawn', year: '2008', searchText: 'pokemon majestic dawn' },
      { name: 'Pokemon Legends Awakened', year: '2008', searchText: 'pokemon legends awakened' },
      { name: 'Pokemon Stormfront', year: '2008', searchText: 'pokemon stormfront' },
      { name: 'Pokemon Platinum', year: '2009', searchText: 'pokemon platinum' },
      { name: 'Pokemon Rising Rivals', year: '2009', searchText: 'pokemon rising rivals' },
      { name: 'Pokemon Supreme Victors', year: '2009', searchText: 'pokemon supreme victors' },
      { name: 'Pokemon Arceus', year: '2009', searchText: 'pokemon arceus' },
      { name: 'Pokemon HeartGold & SoulSilver', year: '2010', searchText: 'pokemon heartgold soulsilver' },
      { name: 'Pokemon Unleashed', year: '2010', searchText: 'pokemon unleashed' },
      { name: 'Pokemon Undaunted', year: '2010', searchText: 'pokemon undaunted' },
      { name: 'Pokemon Triumphant', year: '2010', searchText: 'pokemon triumphant' },
      { name: 'Pokemon Call of Legends', year: '2011', searchText: 'pokemon call of legends' },
      { name: 'Pokemon Black & White', year: '2011', searchText: 'pokemon black white' },
      { name: 'Pokemon Emerging Powers', year: '2011', searchText: 'pokemon emerging powers' },
      { name: 'Pokemon Noble Victories', year: '2011', searchText: 'pokemon noble victories' },
      { name: 'Pokemon Next Destinies', year: '2012', searchText: 'pokemon next destinies' },
      { name: 'Pokemon Dark Explorers', year: '2012', searchText: 'pokemon dark explorers' },
      { name: 'Pokemon Dragons Exalted', year: '2012', searchText: 'pokemon dragons exalted' },
      { name: 'Pokemon Boundaries Crossed', year: '2012', searchText: 'pokemon boundaries crossed' },
      { name: 'Pokemon Plasma Storm', year: '2013', searchText: 'pokemon plasma storm' },
      { name: 'Pokemon Plasma Freeze', year: '2013', searchText: 'pokemon plasma freeze' },
      { name: 'Pokemon Plasma Blast', year: '2013', searchText: 'pokemon plasma blast' },
      { name: 'Pokemon Legendary Treasures', year: '2013', searchText: 'pokemon legendary treasures' },
      { name: 'Pokemon XY', year: '2014', searchText: 'pokemon xy' },
      { name: 'Pokemon Flashfire', year: '2014', searchText: 'pokemon flashfire' },
      { name: 'Pokemon Furious Fists', year: '2014', searchText: 'pokemon furious fists' },
      { name: 'Pokemon Phantom Forces', year: '2014', searchText: 'pokemon phantom forces' },
      { name: 'Pokemon Primal Clash', year: '2015', searchText: 'pokemon primal clash' },
      { name: 'Pokemon Roaring Skies', year: '2015', searchText: 'pokemon roaring skies' },
      { name: 'Pokemon Ancient Origins', year: '2015', searchText: 'pokemon ancient origins' },
      { name: 'Pokemon Breakthrough', year: '2015', searchText: 'pokemon breakthrough' },
      { name: 'Pokemon Breakpoint', year: '2016', searchText: 'pokemon breakpoint' },
      { name: 'Pokemon Fates Collide', year: '2016', searchText: 'pokemon fates collide' },
      { name: 'Pokemon Steam Siege', year: '2016', searchText: 'pokemon steam siege' },
      { name: 'Pokemon Evolutions', year: '2016', searchText: 'pokemon evolutions' },
      { name: 'Pokemon Sun & Moon', year: '2017', searchText: 'pokemon sun moon' },
      { name: 'Pokemon Guardians Rising', year: '2017', searchText: 'pokemon guardians rising' },
      { name: 'Pokemon Burning Shadows', year: '2017', searchText: 'pokemon burning shadows' },
      { name: 'Pokemon Crimson Invasion', year: '2017', searchText: 'pokemon crimson invasion' },
      { name: 'Pokemon Ultra Prism', year: '2018', searchText: 'pokemon ultra prism' },
      { name: 'Pokemon Forbidden Light', year: '2018', searchText: 'pokemon forbidden light' },
      { name: 'Pokemon Celestial Storm', year: '2018', searchText: 'pokemon celestial storm' },
      { name: 'Pokemon Dragon Majesty', year: '2018', searchText: 'pokemon dragon majesty' },
      { name: 'Pokemon Lost Thunder', year: '2018', searchText: 'pokemon lost thunder' },
      { name: 'Pokemon Team Up', year: '2019', searchText: 'pokemon team up' },
      { name: 'Pokemon Detective Pikachu', year: '2019', searchText: 'pokemon detective pikachu' },
      { name: 'Pokemon Unbroken Bonds', year: '2019', searchText: 'pokemon unbroken bonds' },
      { name: 'Pokemon Unified Minds', year: '2019', searchText: 'pokemon unified minds' },
      { name: 'Pokemon Hidden Fates', year: '2019', searchText: 'pokemon hidden fates' },
      { name: 'Pokemon Cosmic Eclipse', year: '2019', searchText: 'pokemon cosmic eclipse' },
      { name: 'Pokemon Sword & Shield', year: '2020', searchText: 'pokemon sword shield' },
      { name: 'Pokemon Rebel Clash', year: '2020', searchText: 'pokemon rebel clash' },
      { name: 'Pokemon Darkness Ablaze', year: '2020', searchText: 'pokemon darkness ablaze' },
      { name: 'Pokemon Champions Path', year: '2020', searchText: 'pokemon champions path' },
      { name: 'Pokemon Vivid Voltage', year: '2020', searchText: 'pokemon vivid voltage' },
      { name: 'Pokemon Shining Fates', year: '2021', searchText: 'pokemon shining fates' },
      { name: 'Pokemon Battle Styles', year: '2021', searchText: 'pokemon battle styles' },
      { name: 'Pokemon Chilling Reign', year: '2021', searchText: 'pokemon chilling reign' },
      { name: 'Pokemon Evolving Skies', year: '2021', searchText: 'pokemon evolving skies' },
      { name: 'Pokemon Fusion Strike', year: '2021', searchText: 'pokemon fusion strike' },
      { name: 'Pokemon Brilliant Stars', year: '2022', searchText: 'pokemon brilliant stars' },
      { name: 'Pokemon Astral Radiance', year: '2022', searchText: 'pokemon astral radiance' },
      { name: 'Pokemon Lost Origin', year: '2022', searchText: 'pokemon lost origin' },
      { name: 'Pokemon Silver Tempest', year: '2022', searchText: 'pokemon silver tempest' },
      { name: 'Pokemon Crown Zenith', year: '2023', searchText: 'pokemon crown zenith' },
      { name: 'Pokemon Scarlet & Violet', year: '2023', searchText: 'pokemon scarlet violet' },
      { name: 'Pokemon Paldea Evolved', year: '2023', searchText: 'pokemon paldea evolved' },
      { name: 'Pokemon Obsidian Flames', year: '2023', searchText: 'pokemon obsidian flames' },
      { name: 'Pokemon 151', year: '2023', searchText: 'pokemon 151' },
      { name: 'Pokemon Paradox Rift', year: '2023', searchText: 'pokemon paradox rift' },
      { name: 'Pokemon Paldean Fates', year: '2024', searchText: 'pokemon paldean fates' },
      { name: 'Pokemon Temporal Forces', year: '2024', searchText: 'pokemon temporal forces' },
      { name: 'Pokemon Twilight Masquerade', year: '2024', searchText: 'pokemon twilight masquerade' }
    ];

    pokemonSets.forEach(set => {
      sets.push({
        name: set.name,
        sport: 'Pokemon',
        year: set.year,
        brand: 'Wizards of the Coast',
        setName: set.name.replace('Pokemon ', ''),
        searchText: set.searchText,
        displayName: set.name
      });
    });

    return sets;
  }

  generateHockeySets() {
    const sets = [];
    
    // Upper Deck (1990-2024)
    ['1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Upper Deck Hockey ${year}`,
        sport: 'Hockey',
        year: year,
        brand: 'Upper Deck',
        setName: 'Upper Deck',
        searchText: `upper deck hockey ${year}`,
        displayName: `Upper Deck Hockey ${year}`
      });
    });

    // Topps (1954-2024)
    ['1954', '1955', '1956', '1957', '1958', '1959', '1960', '1961', '1962', '1963', '1964', '1965', '1966', '1967', '1968', '1969', '1970', '1971', '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Hockey ${year}`,
        sport: 'Hockey',
        year: year,
        brand: 'Topps',
        setName: 'Topps',
        searchText: `topps hockey ${year}`,
        displayName: `Topps Hockey ${year}`
      });
    });

    // Upper Deck Synergy (2020-2024)
    ['2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Upper Deck Synergy Hockey ${year}`,
        sport: 'Hockey',
        year: year,
        brand: 'Upper Deck',
        setName: 'Synergy',
        searchText: `upper deck synergy hockey ${year}`,
        displayName: `Upper Deck Synergy Hockey ${year}`
      });
      sets.push({
        name: `Synergy Hockey ${year}`,
        sport: 'Hockey',
        year: year,
        brand: 'Upper Deck',
        setName: 'Synergy',
        searchText: `synergy hockey ${year}`,
        displayName: `Synergy Hockey ${year}`
      });
    });

    return sets;
  }

  generateSoccerSets() {
    const sets = [];
    
    // Topps (1954-2024)
    ['1954', '1955', '1956', '1957', '1958', '1959', '1960', '1961', '1962', '1963', '1964', '1965', '1966', '1967', '1968', '1969', '1970', '1971', '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Topps Soccer ${year}`,
        sport: 'Soccer',
        year: year,
        brand: 'Topps',
        setName: 'Topps',
        searchText: `topps soccer ${year}`,
        displayName: `Topps Soccer ${year}`
      });
    });

    // Panini (2010-2024)
    ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'].forEach(year => {
      sets.push({
        name: `Panini Soccer ${year}`,
        sport: 'Soccer',
        year: year,
        brand: 'Panini',
        setName: 'Panini',
        searchText: `panini soccer ${year}`,
        displayName: `Panini Soccer ${year}`
      });
    });

    return sets;
  }

  addIndividualCardData() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Add some popular individual cards for better sport detection
      const popularCards = [
        // Football players
        { name: 'Tom Brady', sport: 'Football', year: '2000', brand: 'Topps', setName: 'Topps', cardNumber: '236', searchText: 'tom brady 2000 topps', displayName: 'Tom Brady 2000 Topps #236' },
        { name: 'Patrick Mahomes', sport: 'Football', year: '2017', brand: 'Panini', setName: 'Prizm', cardNumber: '248', searchText: 'patrick mahomes 2017 prizm', displayName: 'Patrick Mahomes 2017 Prizm #248' },
        { name: 'Caleb Williams', sport: 'Football', year: '2024', brand: 'Panini', setName: 'Prizm', cardNumber: '1', searchText: 'caleb williams 2024 prizm', displayName: 'Caleb Williams 2024 Prizm #1' },
        
        // Basketball players
        { name: 'Michael Jordan', sport: 'Basketball', year: '1986', brand: 'Fleer', setName: 'Fleer', cardNumber: '57', searchText: 'michael jordan 1986 fleer', displayName: 'Michael Jordan 1986 Fleer #57' },
        { name: 'LeBron James', sport: 'Basketball', year: '2003', brand: 'Upper Deck', setName: 'Upper Deck', cardNumber: '23', searchText: 'lebron james 2003 upper deck', displayName: 'LeBron James 2003 Upper Deck #23' },
        { name: 'Victor Wembanyama', sport: 'Basketball', year: '2024', brand: 'Panini', setName: 'Prizm', cardNumber: '1', searchText: 'victor wembanyama 2024 prizm', displayName: 'Victor Wembanyama 2024 Prizm #1' },
        
        // Baseball players
        { name: 'Mike Trout', sport: 'Baseball', year: '2011', brand: 'Topps', setName: 'Topps', cardNumber: '175', searchText: 'mike trout 2011 topps', displayName: 'Mike Trout 2011 Topps #175' },
        { name: 'Shohei Ohtani', sport: 'Baseball', year: '2018', brand: 'Topps', setName: 'Topps', cardNumber: '700', searchText: 'shohei ohtani 2018 topps', displayName: 'Shohei Ohtani 2018 Topps #700' },
        
        // Pokemon cards
        { name: 'Charizard', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Base Set', cardNumber: '4', searchText: 'charizard 1999 base set', displayName: 'Charizard 1999 Base Set #4' },
        { name: 'Pikachu', sport: 'Pokemon', year: '1999', brand: 'Wizards of the Coast', setName: 'Base Set', cardNumber: '58', searchText: 'pikachu 1999 base set', displayName: 'Pikachu 1999 Base Set #58' },
        
        // Boxing/Stamps
        { name: 'Muhammad Ali', sport: 'Boxing', year: '1964', brand: 'Slania', setName: 'Stamps Cassius Clay', cardNumber: '23', searchText: 'muhammad ali 1964 slania stamps cassius clay', displayName: 'Muhammad Ali 1964 Slania Stamps Cassius Clay #23' },
        
        // Panini Select Card Types
        { name: 'Premier Level', sport: 'Basketball', year: '2023', brand: 'Panini', setName: 'Select', cardNumber: '', searchText: 'panini select premier level', displayName: 'Panini Select Premier Level' },
        { name: 'Club Level', sport: 'Basketball', year: '2023', brand: 'Panini', setName: 'Select', cardNumber: '', searchText: 'panini select club level', displayName: 'Panini Select Club Level' },
        { name: 'Field Level', sport: 'Basketball', year: '2023', brand: 'Panini', setName: 'Select', cardNumber: '', searchText: 'panini select field level', displayName: 'Panini Select Field Level' },
        { name: 'Concourses', sport: 'Basketball', year: '2023', brand: 'Panini', setName: 'Select', cardNumber: '', searchText: 'panini select concourses', displayName: 'Panini Select Concourses' },
        
        // Panini Prizm Draft Picks
        { name: 'Panini Prizm DP', sport: 'Basketball', year: '2021', brand: 'Panini', setName: 'Prizm DP', cardNumber: '', searchText: 'panini prizm dp', displayName: 'Panini Prizm DP' },
        { name: 'Panini Prizm DP', sport: 'Football', year: '2023', brand: 'Panini', setName: 'Prizm DP', cardNumber: '', searchText: 'panini prizm dp football', displayName: 'Panini Prizm DP Football' },
        
        // Donruss Optic Downtown
        { name: 'Ja\'Marr Chase', sport: 'Football', year: '2021', brand: 'Panini', setName: 'Donruss Optic', cardNumber: 'DT36', searchText: 'ja marr chase 2021 donruss optic downtown', displayName: 'Ja\'Marr Chase 2021 Donruss Optic Downtown #DT36' }
      ];

      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO cards
          (name, sport, year, brand, setName, cardNumber, playerName, searchText, displayName)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = popularCards.length;

        popularCards.forEach((card, index) => {
          stmt.run([
            card.name,
            card.sport,
            card.year,
            card.brand,
            card.setName,
            card.cardNumber,
            card.name,
            card.searchText,
            card.displayName
          ], (err) => {
            if (err) console.error(`❌ Error inserting card ${index}:`, err);
            
            completed++;
            if (completed === total) {
              stmt.finalize((err) => {
                if (err) {
                  db.close();
                  reject(err);
                } else {
                  db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }
              });
            }
          });
        });
      });
    });
  }

  generateOtherCollectibles() {
    const sets = [];
    
    // Slania Stamps (1960s-2000s)
    ['1960', '1961', '1962', '1963', '1964', '1965', '1966', '1967', '1968', '1969', '1970', '1971', '1972', '1973', '1974', '1975', '1976', '1977', '1978', '1979', '1980', '1981', '1982', '1983', '1984', '1985', '1986', '1987', '1988', '1989', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999', '2000'].forEach(year => {
      sets.push({
        name: `Slania Stamps ${year}`,
        sport: 'Stamps',
        year: year,
        brand: 'Slania',
        setName: 'Stamps',
        searchText: `slania stamps ${year}`,
        displayName: `Slania Stamps ${year}`
      });
    });

    // Specific Muhammad Ali Cassius Clay set
    sets.push({
      name: 'Slania Stamps Cassius Clay',
      sport: 'Boxing',
      year: '1964',
      brand: 'Slania',
      setName: 'Stamps Cassius Clay',
      searchText: 'slania stamps cassius clay',
      displayName: 'Slania Stamps Cassius Clay'
    });

    return sets;
  }

  async addOtherCollectibles() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      const otherCollectibles = this.generateOtherCollectibles();

      db.serialize(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sets
          (name, sport, year, brand, setName, source, searchText, displayName)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let completed = 0;
        const total = otherCollectibles.length;

        otherCollectibles.forEach((set, index) => {
          stmt.run([
            set.name,
            set.sport,
            set.year,
            set.brand,
            set.setName,
            'other_collectibles',
            set.searchText,
            set.displayName
          ], (err) => {
            if (err) console.error(`❌ Error inserting other collectible ${index}:`, err);
            
            completed++;
            if (completed === total) {
              stmt.finalize((err) => {
                if (err) {
                  db.close();
                  reject(err);
                } else {
                  db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }
              });
            }
          });
        });
      });
    });
  }

  async getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get('SELECT COUNT(*) as sets FROM sets', (err, setsResult) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        db.get('SELECT COUNT(*) as cards FROM cards', (err, cardsResult) => {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          
          db.close((err) => {
            if (err) {
              reject(err);
            } else {
              const stats = fs.statSync(this.dbPath);
              resolve({
                sets: setsResult.sets,
                cards: cardsResult.cards,
                size: stats.size
              });
            }
          });
        });
      });
    });
  }
}

// Main execution
async function main() {
  const enhancer = new EnhancedComprehensiveDatabase();
  
  try {
    await enhancer.enhanceDatabase();
  } catch (error) {
    console.error('❌ Error enhancing database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { EnhancedComprehensiveDatabase };
